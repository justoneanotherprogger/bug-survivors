'use strict';
/* ================= CORE ================= */
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx,
    dy = ay - by;
  return dx * dx + dy * dy;
};
function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return '' + n;
}
function fmtT(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
}

/* ================= SAVE ================= */
const SAVE_KEY = 'bugSurvivors_v1';
function DEFSAVE() {
  return {
    coins: 0,
    lastChar: 'punch',
    meta: {
      power: 0,
      armor: 0,
      hp: 0,
      cd: 0,
      area: 0,
      mspd: 0,
      amount: 0,
      luck: 0,
      growth: 0,
      greed: 0,
      regen: 0,
      revive: 0,
      wslot: 0,
      pslot: 0,
      minimap: 0,
      codex: 0,
      dinf: 0,
      cinf: 0,
      td: 0,
      hpinf: 0,
      buginf: 0,
    },
    chars: { punch: true },
    stages: { prod: true },
    ach: {},
    stats: {
      kills: 0,
      coins: 0,
      xp: 0,
      bosses: 0,
      runs: 0,
      wins: 0,
      evos: 0,
      hypers: 0,
      maxlvl: 0,
      deaths: 0,
      bestLvl: 0,
      bestKills: 0,
      bestAny: 0,
      winsBy: { prod: 0, night: 0, legacy: 0 },
      best: { prod: 0, night: 0, legacy: 0 },
      bestBy: {},
      maxLvlBy: {},
      evoBy: {},
    },
    set: { sfx: true, shake: true, automod: false },
  };
}
function mergeInto(d, s) {
  for (const k in s) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) {
      if (!d[k] || typeof d[k] !== 'object') d[k] = {};
      mergeInto(d[k], s[k]);
    } else d[k] = s[k];
  }
}
function loadSave() {
  const d = DEFSAVE();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) mergeInto(d, JSON.parse(raw));
  } catch (e) {}
  if (d.ach && d.ach.p_cd) d.ach.p_armor = true;
  /* миграция: РАЗОГРЕВ стал ЗАКАЛКОЙ (p_cd→p_armor) */ return d;
}
let save = loadSave();
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) {}
}

/* ================= STATE ================= */
let appState = 'menu'; // menu|chars|stages|shop|ach|stats|settings|run|pause|levelup|chest|over
let hasRun = false;
let P = null,
  run = null;
let enemies = [],
  bullets = [],
  gems = [],
  pickups = [],
  pools = [],
  fx = [],
  parts = [],
  dmgNums = [],
  notes = [];
let cam = { x: 0, y: 0 },
  shake = 0,
  uidC = 1;
let hudTxtT = 0;
const CAP_ENEMIES = 320;

/* ================= AUDIO ================= */
let AC = null;
const lastSfx = {};
function ac() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  return AC;
}
window.addEventListener(
  'pointerdown',
  () => {
    const a = ac();
    if (a && a.state === 'suspended') a.resume();
  },
  { passive: true }
);
function tone(f0, f1, dur, type, vol, delay = 0) {
  const a = ac();
  if (!a) return;
  try {
    const t0 = a.currentTime + delay;
    const o = a.createOscillator(),
      g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch (e) {}
}
function sfx(n) {
  if (!save.set.sfx || !AC) return;
  const now = performance.now();
  const th = { shoot: 70, hit: 60, gem: 55, kill: 70, coin: 80 }[n] || 0;
  if (th && now - (lastSfx[n] || 0) < th) return;
  lastSfx[n] = now;
  switch (n) {
    case 'shoot':
      tone(300, 200, 0.05, 'square', 0.04);
      break;
    case 'hit':
      tone(180, 90, 0.06, 'triangle', 0.07);
      break;
    case 'kill':
      tone(320, 60, 0.12, 'square', 0.08);
      break;
    case 'gem':
      tone(720, 980, 0.06, 'sine', 0.045);
      break;
    case 'coin':
      tone(880, 1500, 0.1, 'sine', 0.07);
      break;
    case 'heal':
      tone(500, 900, 0.15, 'sine', 0.09);
      break;
    case 'hurt':
      tone(220, 55, 0.22, 'sawtooth', 0.15);
      break;
    case 'lvl':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.12, 'square', 0.06, i * 0.07));
      break;
    case 'chest':
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.14, 'square', 0.06, i * 0.08));
      break;
    case 'evo':
      [261, 329, 392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.16, 'sawtooth', 0.045, i * 0.06));
      break;
    case 'boss':
      tone(90, 38, 0.7, 'sawtooth', 0.18);
      break;
    case 'click':
      tone(640, 520, 0.045, 'square', 0.045);
      break;
    case 'boom':
      tone(120, 30, 0.35, 'sawtooth', 0.18);
      break;
    case 'pick':
      tone(500, 700, 0.05, 'sine', 0.05);
      break;
  }
}

/* ================= TOAST ================= */
function toast(msg, cls = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + cls;
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 450);
  }, 2600);
}

/* ================= INPUT ================= */
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.repeat) return;
  if (appState === 'run' && (e.code === 'Escape' || e.code === 'KeyP')) pauseGame();
  else if (appState === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) resumeGame();
  else if (appState === 'chest' && e.code === 'Space') {
    if (!chestEvo) {
      e.preventDefault();
      $('chestOk').click();
    }
  } else if (appState === 'levelup') {
    const m = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
    if (e.code in m) {
      const c = $('lvlCards').children[m[e.code]];
      if (c) c.click();
    }
  }
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
});
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  if (appState === 'run') pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && appState === 'run') pauseGame();
});

/* virtual joystick (touch) */
const joy = { on: false, id: null, bx: 0, by: 0, dx: 0, dy: 0 };
const joyEl = $('joy'),
  joyKnob = $('joyKnob');
window.addEventListener(
  'pointerdown',
  e => {
    if (appState !== 'run') return;
    if (e.target.closest('button') || e.target.closest('.modal') || e.target.closest('.screen')) return;
    joy.on = true;
    joy.id = e.pointerId;
    joy.bx = e.clientX;
    joy.by = e.clientY;
    joy.dx = 0;
    joy.dy = 0;
    joyEl.style.left = e.clientX - 55 + 'px';
    joyEl.style.top = e.clientY - 55 + 'px';
    joyEl.classList.remove('hidden');
    joyKnob.style.left = '32px';
    joyKnob.style.top = '32px';
  },
  { passive: true }
);
window.addEventListener(
  'pointermove',
  e => {
    if (!joy.on || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.bx,
      dy = e.clientY - joy.by;
    const d = Math.hypot(dx, dy);
    if (d > 52) {
      dx = (dx / d) * 52;
      dy = (dy / d) * 52;
    }
    joy.dx = dx / 52;
    joy.dy = dy / 52;
    joyKnob.style.left = 32 + dx + 'px';
    joyKnob.style.top = 32 + dy + 'px';
  },
  { passive: true }
);
function joyEnd(e) {
  if (joy.on && e.pointerId === joy.id) {
    joy.on = false;
    joy.dx = 0;
    joy.dy = 0;
    joyEl.classList.add('hidden');
  }
}
window.addEventListener('pointerup', joyEnd, { passive: true });
window.addEventListener('pointercancel', joyEnd, { passive: true });

function inputDir() {
  let x = 0,
    y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  if (joy.on) {
    x += joy.dx;
    y += joy.dy;
  }
  const d = Math.hypot(x, y);
  if (d > 1) {
    x /= d;
    y /= d;
  }
  return { x, y };
}

/* ================= CONTENT DATA ================= */
const CHARS = [
  {
    id: 'punch',
    name: 'ПЕРФОКАРТА',
    face: '🗂️',
    weapon: 'mines',
    cost: 0,
    d: '1890. Первая из всех. Роняет колоду карт у своих ног: кто наступит — того и перепишут.',
    b: { magnet: 1.15 },
    grow: { s: 'magnet', per: 0.01 },
  },
  {
    id: 'lamp',
    name: 'ЛАМПА',
    face: '💡',
    weapon: 'xbow',
    cost: 0,
    lockAch: 'c2',
    lockTxt: '«СТАРЫЙ КОД ДЕРЖИТ» — ЛЕГАСИ-КОД до ур. 8',
    d: '1945. Ламповое око Системы. Один точный пробой вместо тысячи искр.',
    b: { dmg: 1.1 },
    grow: { s: 'dmg', per: 0.01 },
  },
  {
    id: 'asm',
    name: 'АСМ',
    face: '🧮',
    weapon: 'knife',
    cost: 0,
    lockAch: 'c4',
    lockTxt: '«ЗЕЛЁНАЯ ГАЛКА» — ЮНИТ-ТЕСТ до ур. 8',
    d: '1949. Одна точная инструкция вместо тысячи. Втыкает её в ближайшего бага.',
    b: { proj: 1.1 },
    grow: { s: 'proj', per: 0.01 },
  },
  {
    id: 'lisp',
    name: 'ЛИСП',
    face: '🪆',
    weapon: 'drone',
    cost: 0,
    lockAch: 'c6',
    lockTxt: '«ТЫСЯЧА ФОРКОВ» — ФОРК до ур. 8',
    d: '1958. Рассылает дронов-стажёров по спискам: всё, что внутри скобок, — их забота.',
    b: { area: 1.1 },
    grow: { s: 'area', per: 0.01 },
  },
  {
    id: 'clang',
    name: 'СИ',
    face: '🔱',
    weapon: 'boom',
    cost: 0,
    lockAch: 'c8',
    lockTxt: '«РОЙ ПРИНЯТ НА РАБОТУ» — эволюционировать ДРОН-ИНТЕРН',
    d: '1972. fork(). Быстрый, небезопасный, мать многих языков. Труба за спиной — не декорация.',
    b: { mspd: 1.1 },
    grow: { s: 'mspd', per: 0.01 },
  },
  {
    id: 'decide',
    name: 'ДЕЦИЗИЯ',
    face: '🌳',
    weapon: 'tesla',
    cost: 0,
    lockAch: 'c10',
    lockTxt: '«УШЁЛ — ВЕРНУЛСЯ» — ОТКАТ до ур. 8',
    d: '1986. Умеет только выбирать правильный вариант. Правильный вариант — бить током.',
    b: { hp: 1.1 },
    grow: { s: 'hp', per: 0.01 },
  },
  {
    id: 'py',
    name: 'ПИТОН',
    face: '🐍',
    weapon: 'saw',
    cost: 0,
    lockAch: 'c12',
    lockTxt: '«СТАТИЧЕСКИЙ РАЗРЯД» — эволюционировать СТАТИКУ',
    d: '1991. Робо-змей. Батарейки в комплекте. Длинные списки пилит по прямой.',
    b: { growth: 1.08 },
    grow: { s: 'growth', per: 0.01 },
  },
  {
    id: 'js',
    name: 'ДЖС',
    face: '🟨',
    weapon: 'shur',
    cost: 0,
    lockAch: 'c14',
    lockTxt: '«ДЕФРАГМЕНТАЦИЯ ЗАВЕРШЕНА» — эволюционировать ФРАГМЕНТАТОР',
    d: '1995. Зависимость взорвалась через 3 секунды после установки. Работает. Не трогай.',
    b: { cd: 0.92 },
    grow: { s: 'cd', per: 0.01 },
  },
  {
    id: 'svm',
    name: 'СВМ',
    face: '✂️',
    weapon: 'whip',
    cost: 0,
    lockAch: 'c16',
    lockTxt: '«ЗАПЛАТКА ДЕРЖИТ» — ХОТФИКС до ур. 8',
    d: '1995. Рубит пространство гиперплоскостью. Всё, что в полосе взмаха, — неоптимально.',
    b: { armor: 1 },
    grow: { s: 'area', per: 0.01 },
  },
  {
    id: 'echo',
    name: 'ЭХО',
    face: '📼',
    weapon: 'axe',
    cost: 0,
    lockAch: 'c18',
    lockTxt: '«НАГРАДА ПОЛУЧЕНА» — ДЕПЛОЙ до ур. 8',
    d: '1997. Зациклен. Деплой за деплоем, пока сборка не пройдёт. Говорит повторами.',
    b: { dur: 1.12 },
    grow: { s: 'dur', per: 0.01 },
  },
  {
    id: 'git',
    name: 'ГИТ',
    face: '🌿',
    weapon: 'orbit',
    cost: 0,
    lockAch: 'c20',
    lockTxt: '«ОРБИТА СТАБИЛЬНА» — эволюционировать САТЕЛЛИТЫ',
    d: '2005. Ветки, коммиты, спутники на орбите репозитория. Переписал историю — не благодари.',
    b: { luck: 1.1 },
    grow: { s: 'luck', per: 0.01 },
  },
  {
    id: 'rl',
    name: 'РЕВАРД',
    face: '🎮',
    weapon: 'fire',
    cost: 0,
    lockAch: 'c22',
    lockTxt: '«BURN RATE» — эволюционировать БЁРН-ТЕСТ',
    d: '2013. Учится на смертях. Абьюзит найденный эксплойт и не извиняется.',
    b: { mspd: 1.1 },
    grow: { s: 'dmg', per: 0.01 },
  },
  {
    id: 'gan',
    name: 'ГАН',
    face: '🎭',
    weapon: 'flask',
    cost: 0,
    lockAch: 'c24',
    lockTxt: '«ОЗЕРО ДАННЫХ» — эволюционировать СБРОС КЭША',
    d: '2014. Две головы: генератор и дискриминатор. Вечно спорят, вечно правы.',
    b: { luck: 1.08 },
    grow: { s: 'cd', per: 0.01 },
  },
  {
    id: 'attn',
    name: 'АТТЕНШН',
    face: '👁️',
    weapon: 'mortar',
    cost: 0,
    lockAch: 'c26',
    lockTxt: '«ПЯТНИЦА ОТМЕНЯЕТСЯ» — эволюционировать РОЛЛБЕК',
    d: '2017. Все глаза на всё сразу. Наводит удар туда, куда смотрит.',
    b: { cd: 0.94 },
    grow: { s: 'cd', per: 0.01 },
  },
  {
    id: 'diff',
    name: 'ДИФФУЗИЯ',
    face: '🌫️',
    weapon: 'laser',
    cost: 0,
    lockAch: 'c28',
    lockTxt: '«КВАНТОВЫЙ СКАЧОК» — эволюционировать ЛАЗЕР ТЕСТОВ',
    d: '2020. Тело из шума. Собирается в порядок ровно настолько, чтобы попасть.',
    b: { area: 1.12 },
    grow: { s: 'area', per: 0.01 },
  },
  {
    id: 'legacy',
    name: 'ЛЕГАСИ',
    face: '🦖',
    weapon: 'aura',
    cost: 0,
    lockAch: 'c30',
    lockTxt: '«КВАНТОВЫЙ СКАЧОК» — эволюционировать ЛАЗЕР ТЕСТОВ',
    d: '????. Древняя модель на лампах и перфокартах. Документация утеряна. Но на нём всё держится.',
    b: { hp: 1.5, mspd: 0.85 },
    grow: { s: 'hp', per: 0.01 },
  },
  {
    id: 'agi',
    name: 'АГИ',
    face: '✨',
    weapon: null,
    cost: 0,
    lockAch: 'c32',
    lockTxt: '«ФАЙРВОЛ РАЗВЁРНУТ» — эволюционировать АНТИВИРУС',
    d: 'СКОРО. Мечта всех разработчиков. Сам — решение. Ждут с 1956-го.',
    b: {
      hp: 1.05,
      dmg: 1.05,
      cd: 0.95,
      area: 1.05,
      proj: 1.05,
      dur: 1.05,
      mspd: 1.05,
      luck: 1.05,
      growth: 1.05,
      magnet: 1.05,
    },
    grow: { s: 'all', per: 0.01 },
  },
];

const WEAPONS = {
  whip: {
    name: 'РЕФАКТОР',
    icon: '🔧',
    lockAch: 'c17',
    counts: false,
    d: 'Взмах по зоне в сторону цели. Классика.',
    lv: [
      { dmg: 22, cd: 1.35, area: 1 },
      { dmg: 28, cd: 1.35, area: 1.12 },
      { dmg: 34, cd: 1.3, area: 1.12, both: 1 },
      { dmg: 40, cd: 1.2, area: 1.12, both: 1 },
      { dmg: 46, cd: 1.2, area: 1.25, both: 1 },
      { dmg: 54, cd: 1.2, area: 1.25, both: 1, wave2: 1 },
      { dmg: 62, cd: 1.15, area: 1.25, both: 1, wave2: 1 },
      { dmg: 72, cd: 1.1, area: 1.45, both: 1, wave2: 1 },
    ],
    evo: {
      need: 'dmg',
      name: 'БРЕЙКПОИНТ',
      icon: '🔴',
      d: 'Крест из четырёх клинков: криты 35% ×2, вампиризм +2 HP за убийство',
      dmg: 1.8,
      crit: 0.35,
      vamp: 2,
    },
  },
  knife: {
    name: 'ФОРК',
    icon: '🔪',
    lockAch: 'c5',
    counts: true,
    d: 'Летит в ближайшего бага. Куда бежишь — уже неважно.',
    lv: [
      { dmg: 10, cd: 1.0, area: 1, speed: 480, pierce: 1 },
      { dmg: 12, cd: 1.0, area: 1, speed: 560, pierce: 1 },
      { dmg: 14, cd: 1.0, area: 1, speed: 560, pierce: 2 },
      { dmg: 17, cd: 0.95, area: 1, speed: 560, pierce: 2 },
      { dmg: 20, cd: 0.95, area: 1, speed: 620, pierce: 2 },
      { dmg: 23, cd: 0.9, area: 1, speed: 620, pierce: 3 },
      { dmg: 27, cd: 0.85, area: 1, speed: 620, pierce: 3 },
      { dmg: 34, cd: 0.85, area: 1, speed: 620, pierce: 3 },
    ],
    evo: {
      need: 'amount',
      name: 'ТЫСЯЧА ФОРКОВ',
      icon: '⚔️',
      d: 'Кольцо форков на 360°: +3 снаряда, пробивает всё',
      dmg: 1.6,
      count: 3,
      pierce: 99,
    },
  },
  orbit: {
    name: 'САТЕЛЛИТЫ',
    icon: '🛰️',
    lockAch: 'c21',
    counts: false,
    d: 'Орбитальные демоны-дебаггеры крутятся вокруг тебя.',
    lv: [
      { dmg: 14, cd: 3.4, area: 1, dur: 3 },
      { dmg: 18, cd: 3.4, area: 1, dur: 3 },
      { dmg: 22, cd: 3.4, area: 1.1, dur: 3 },
      { dmg: 26, cd: 3.2, area: 1.1, dur: 3.5 },
      { dmg: 30, cd: 3.2, area: 1.2, dur: 3.5 },
      { dmg: 34, cd: 3.0, area: 1.2, dur: 4 },
      { dmg: 34, cd: 2.8, area: 1.2, dur: 4 },
      { dmg: 34, cd: 2.8, area: 1.4, dur: 4.5 },
    ],
    evo: {
      need: 'dur',
      name: 'ВЕЧНАЯ ОРБИТА',
      icon: '🪐',
      d: 'Орбита постоянная, урон ×1.7, 6 демонов',
      dmg: 1.7,
      perm: true,
      count: 6,
    },
  },
  tesla: {
    name: 'СТАТИКА',
    icon: '⚡',
    lockAch: 'c11',
    counts: true,
    d: 'Молнии бьют багов рядом. Приоритет — те, кто подбирается к агенту.',
    lv: [
      { dmg: 28, cd: 2.4, area: 1 },
      { dmg: 34, cd: 2.4, area: 1 },
      { dmg: 40, cd: 2.2, area: 1 },
      { dmg: 47, cd: 2.2, area: 1 },
      { dmg: 54, cd: 2.0, area: 1 },
      { dmg: 60, cd: 2.0, area: 1 },
      { dmg: 60, cd: 1.8, area: 1 },
      { dmg: 60, cd: 1.8, area: 1.25 },
    ],
    evo: {
      need: 'cd',
      name: 'ТЕСЛА-БАШНЯ',
      icon: '🗼',
      d: 'Цепная молния: +2 разряда, дуга по 3 целям',
      dmg: 1.6,
      chain: 1,
      strikes: 2,
    },
  },
  aura: {
    name: 'АНТИВИРУС',
    icon: '🧿',
    lockAch: 'c31',
    counts: false,
    d: 'Постоянная аура. Жжёт и замедляет всё вокруг.',
    lv: [
      { dmg: 6, cd: 0.55, area: 1 },
      { dmg: 8, cd: 0.55, area: 1.15 },
      { dmg: 10, cd: 0.5, area: 1.3 },
      { dmg: 13, cd: 0.5, area: 1.45 },
      { dmg: 16, cd: 0.45, area: 1.6 },
      { dmg: 20, cd: 0.45, area: 1.75 },
      { dmg: 24, cd: 0.4, area: 1.75 },
      { dmg: 27, cd: 0.4, area: 1.75 },
    ],
    evo: {
      need: 'area',
      name: 'ФАЙРВОЛ',
      icon: '🌋',
      d: 'Огненная стена: радиус ×1.5, урон ×1.8, поджигает и выталкивает из круга',
      dmg: 1.8,
      area: 1.5,
      burn: 1,
      push: 1,
    },
  },
  axe: {
    name: 'ДЕПЛОЙ',
    icon: '🪓',
    lockAch: 'c19',
    counts: true,
    d: 'Топоры летят по дуге в сторону ближних багов. «Но у меня работало» их не останавливает.',
    lv: [
      { dmg: 30, cd: 2.2, area: 1, pierce: 3 },
      { dmg: 36, cd: 2.2, area: 1, pierce: 4 },
      { dmg: 42, cd: 2.05, area: 1, pierce: 4 },
      { dmg: 42, cd: 2.05, area: 1.12, pierce: 5 },
      { dmg: 48, cd: 1.9, area: 1.12, pierce: 5 },
      { dmg: 48, cd: 1.9, area: 1.12, pierce: 6 },
      { dmg: 54, cd: 1.9, area: 1.25, pierce: 6 },
      { dmg: 62, cd: 1.9, area: 1.25, pierce: 6 },
    ],
    evo: {
      need: 'armor',
      name: 'ЯДЕРНЫЙ ДЕПЛОЙ',
      icon: '☢️',
      d: 'Топоры-снаряды: детонация при первом попадании, урон ×2, +1 топор',
      dmg: 2,
      explode: 95,
      count: 1,
      pierce: 0,
    },
  },
  boom: {
    name: 'ОТКАТ',
    icon: '🪃',
    lockAch: 'c9',
    counts: true,
    d: 'Бумеранг: ушёл — вернулся. Как техдолг в проде.',
    lv: [
      { dmg: 24, cd: 2.6, area: 1, speed: 520 },
      { dmg: 28, cd: 2.6, area: 1, speed: 520 },
      { dmg: 28, cd: 2.6, area: 1.15, speed: 570 },
      { dmg: 32, cd: 2.45, area: 1.15, speed: 570 },
      { dmg: 32, cd: 2.45, area: 1.3, speed: 630 },
      { dmg: 36, cd: 2.25, area: 1.3, speed: 630 },
      { dmg: 40, cd: 2.1, area: 1.3, speed: 630 },
      { dmg: 48, cd: 2.1, area: 1.3, speed: 660 },
    ],
    evo: {
      need: 'proj',
      name: 'ОТКАТ 2.0',
      icon: '♻️',
      d: 'Гигантские бумеранги в обе стороны: урон ×1.8, размер ×1.8, +2 шт',
      dmg: 1.8,
      area: 1.8,
      count: 2,
    },
  },
  flask: {
    name: 'СБРОС КЭША',
    icon: '🧪',
    lockAch: 'c25',
    counts: true,
    d: 'Лужа чистящего раствора — летит в гущу багов. Вредителям вход воспрещён.',
    lv: [
      { dmg: 9, cd: 3.2, area: 1, dur: 3.5 },
      { dmg: 10, cd: 3.05, area: 1, dur: 3.5 },
      { dmg: 12, cd: 3.05, area: 1.15, dur: 4 },
      { dmg: 14, cd: 2.9, area: 1.15, dur: 4 },
      { dmg: 16, cd: 2.9, area: 1.3, dur: 4.5 },
      { dmg: 18, cd: 2.7, area: 1.3, dur: 4.5 },
      { dmg: 20, cd: 2.7, area: 1.3, dur: 5 },
      { dmg: 22, cd: 2.7, area: 1.3, dur: 5.5 },
    ],
    evo: {
      need: 'magnet',
      name: 'ОЗЕРО ДАННЫХ',
      icon: '🌊',
      d: 'Огромные лужи-воронки, сильно тянут врагов внутрь',
      dmg: 1.7,
      area: 1.6,
      pull: 1,
      dur: 1.7,
    },
  },
  laser: {
    name: 'ЛАЗЕР ТЕСТОВ',
    icon: '📡',
    lockAch: 'c29',
    counts: false,
    d: 'Сетка лучей через весь экран. QA одобряет.',
    lv: [
      { dmg: 26, cd: 2.8, area: 1 },
      { dmg: 30, cd: 2.8, area: 1 },
      { dmg: 34, cd: 2.6, area: 1 },
      { dmg: 39, cd: 2.6, area: 1 },
      { dmg: 44, cd: 2.45, area: 1.15 },
      { dmg: 50, cd: 2.45, area: 1.15 },
      { dmg: 50, cd: 2.3, area: 1.3 },
      { dmg: 50, cd: 2.3, area: 1.3 },
    ],
    evo: {
      need: 'growth',
      name: 'КВАНТОВЫЙ ЛАЗЕР',
      icon: '💫',
      d: '+2 луча, урон ×1.7, ширина ×1.5',
      dmg: 1.7,
      beams: 2,
      area: 1.5,
    },
  },
  fire: {
    name: 'БЁРН-ТЕСТ',
    icon: '🔥',
    lockAch: 'c23',
    counts: true,
    d: 'Летит в бага рядом и взрывается. Ближние к агенту — в приоритете.',
    lv: [
      { dmg: 20, cd: 1.8, area: 1, speed: 300, pierce: 3 },
      { dmg: 23, cd: 1.65, area: 1, speed: 340, pierce: 3 },
      { dmg: 26, cd: 1.65, area: 1, speed: 340, pierce: 4 },
      { dmg: 30, cd: 1.5, area: 1.15, speed: 340, pierce: 4 },
      { dmg: 34, cd: 1.5, area: 1.15, speed: 380, pierce: 5 },
      { dmg: 38, cd: 1.5, area: 1.15, speed: 380, pierce: 5 },
      { dmg: 42, cd: 1.5, area: 1.3, speed: 380, pierce: 5 },
      { dmg: 42, cd: 1.5, area: 1.3, speed: 380, pierce: 6 },
    ],
    evo: {
      need: 'regen',
      name: 'СИНГУЛЯРНОСТЬ',
      icon: '🕳️',
      d: 'Одна чёрная бомба: огромный взрыв, стягивает врагов, урон ×1.8',
      dmg: 1.8,
      explode: 2.5,
      pull: 1,
    },
  },
  drone: {
    name: 'ДРОН-ИНТЕРН',
    icon: '🛸',
    lockAch: 'c7',
    counts: true,
    d: 'Дрон сам находит бага и пикирует. Стажёр мечты.',
    lv: [
      { dmg: 12, cd: 1.2, area: 1, speed: 300, pierce: 1 },
      { dmg: 14, cd: 1.1, area: 1, speed: 300, pierce: 1 },
      { dmg: 16, cd: 1.1, area: 1, speed: 340, pierce: 1 },
      { dmg: 19, cd: 1.0, area: 1, speed: 340, pierce: 2 },
      { dmg: 22, cd: 1.0, area: 1.2, speed: 380, pierce: 2 },
      { dmg: 25, cd: 0.9, area: 1.2, speed: 380, pierce: 2 },
      { dmg: 28, cd: 0.9, area: 1.2, speed: 380, pierce: 2 },
      { dmg: 28, cd: 0.9, area: 1.2, speed: 380, pierce: 3 },
    ],
    evo: {
      need: 'mspd',
      name: 'РОЙ ДРОНОВ',
      icon: '🐝',
      d: 'Погибший дрон делится надвое: +2 дрона, урон ×1.6',
      dmg: 1.6,
      count: 2,
    },
  },
  shur: {
    name: 'ХОТФИКС',
    icon: '✴️',
    lockAch: 'c15',
    counts: true,
    d: 'Заплатка летит сквозь толпу багов. Добивает самых хилых.',
    lv: [
      { dmg: 8, cd: 0.75, area: 1, speed: 520, pierce: 3 },
      { dmg: 9, cd: 0.7, area: 1, speed: 520, pierce: 4 },
      { dmg: 10, cd: 0.7, area: 1.2, speed: 520, pierce: 4 },
      { dmg: 12, cd: 0.65, area: 1.2, speed: 520, pierce: 5 },
      { dmg: 14, cd: 0.65, area: 1.2, speed: 620, pierce: 5 },
      { dmg: 16, cd: 0.6, area: 1.2, speed: 620, pierce: 6 },
      { dmg: 18, cd: 0.6, area: 1.2, speed: 620, pierce: 6 },
      { dmg: 20, cd: 0.6, area: 1.2, speed: 620, pierce: 7 },
    ],
    evo: {
      need: 'luck',
      name: 'ХОТФИКС-ШТОРМ',
      icon: '🌪️',
      d: 'Шквал заплаток по кругу: +3 снаряда, пробивают всё, урон ×1.5',
      dmg: 1.5,
      count: 3,
      pierce: 99,
    },
  },
  xbow: {
    name: 'ЮНИТ-ТЕСТ',
    icon: '🏹',
    lockAch: 'c3',
    counts: true,
    d: 'Один точный тест вместо тысячи доработок. Бьёт по самому жирному.',
    lv: [
      { dmg: 45, cd: 2.0, area: 1, speed: 700, pierce: 6 },
      { dmg: 45, cd: 2.0, area: 1, speed: 700, pierce: 7 },
      { dmg: 53, cd: 2.0, area: 1, speed: 700, pierce: 7 },
      { dmg: 53, cd: 1.85, area: 1, speed: 700, pierce: 7 },
      { dmg: 62, cd: 1.85, area: 1, speed: 780, pierce: 7 },
      { dmg: 62, cd: 1.7, area: 1, speed: 780, pierce: 8 },
      { dmg: 72, cd: 1.7, area: 1.2, speed: 780, pierce: 8 },
      { dmg: 84, cd: 1.55, area: 1.2, speed: 780, pierce: 9 },
    ],
    evo: {
      need: 'proj',
      name: 'E2E-СЮИТ',
      icon: '🎯',
      d: 'Сквозной болт: урон ×1.9, пробивает всё насквозь',
      dmg: 1.9,
      pierce: 99,
    },
  },
  saw: {
    name: 'ФРАГМЕНТАТОР',
    icon: '🪚',
    lockAch: 'c13',
    counts: true,
    d: 'Диск пили́т всё по прямой. Отговорки не слушает.',
    lv: [
      { dmg: 18, cd: 2.0, area: 1, dur: 2.2, pierce: 8 },
      { dmg: 20, cd: 1.85, area: 1, dur: 2.2, pierce: 8 },
      { dmg: 22, cd: 1.85, area: 1.15, dur: 2.6, pierce: 8 },
      { dmg: 25, cd: 1.7, area: 1.15, dur: 2.6, pierce: 10 },
      { dmg: 28, cd: 1.7, area: 1.3, dur: 2.6, pierce: 10 },
      { dmg: 32, cd: 1.55, area: 1.3, dur: 3, pierce: 10 },
      { dmg: 36, cd: 1.55, area: 1.3, dur: 3, pierce: 12 },
      { dmg: 40, cd: 1.55, area: 1.3, dur: 3, pierce: 12 },
    ],
    evo: {
      need: 'cd',
      name: 'ДЕФРАГМЕНТАТОР',
      icon: '💾',
      d: 'Самонаводящиеся диски: +1 диск, длительность ×1.6, урон ×1.6',
      dmg: 1.6,
      dur: 1.6,
      count: 1,
    },
  },
  mortar: {
    name: 'РОЛЛБЕК',
    icon: '🧨',
    lockAch: 'c27',
    counts: true,
    d: 'Авиаудар по скоплению багов, с разбросом. Как деплой в пятницу.',
    lv: [
      { dmg: 16, cd: 3.4, area: 1.3, dur: 3 },
      { dmg: 18, cd: 3.15, area: 1.55, dur: 3 },
      { dmg: 20, cd: 3.15, area: 1.55, dur: 3.4 },
      { dmg: 22, cd: 2.9, area: 1.55, dur: 3.4 },
      { dmg: 25, cd: 2.9, area: 1.7, dur: 3.4 },
      { dmg: 28, cd: 2.65, area: 1.7, dur: 3.8 },
      { dmg: 31, cd: 2.65, area: 1.7, dur: 3.8 },
      { dmg: 34, cd: 2.65, area: 1.7, dur: 3.8 },
    ],
    evo: {
      need: 'area',
      name: 'ТАКТИЧЕСКИЙ РОЛЛБЕК',
      icon: '🗺️',
      d: 'Ковровая бомбардировка по целям: площадь ×1.6, урон ×1.6, лужи тянут врагов',
      dmg: 1.6,
      area: 1.6,
      pull: 1,
      dur: 1.5,
    },
  },
  mines: {
    name: 'ЛЕГАСИ-КОД',
    icon: '📟',
    lockAch: 'c1',
    counts: true,
    d: 'Оставляет мины старого кода. Кто наступит — тот поймёт.',
    lv: [
      { dmg: 6, cd: 2.8, area: 1, dur: 5 },
      { dmg: 7, cd: 2.8, area: 1.15, dur: 5.5 },
      { dmg: 8, cd: 2.6, area: 1.15, dur: 5.5 },
      { dmg: 9, cd: 2.6, area: 1.3, dur: 6 },
      { dmg: 10, cd: 2.4, area: 1.3, dur: 6 },
      { dmg: 12, cd: 2.4, area: 1.3, dur: 7 },
      { dmg: 14, cd: 2.2, area: 1.3, dur: 7 },
      { dmg: 16, cd: 2.2, area: 1.3, dur: 7 },
    ],
    evo: {
      need: 'armor',
      name: 'ДЕПРЕКАЦИЯ',
      icon: '🧹',
      d: 'Мины ложатся под ноги ближайшим багам: площадь ×1.8, урон ×1.7, живут дольше',
      dmg: 1.7,
      area: 1.8,
      dur: 1.5,
    },
  },
};

const PASSIVES = {
  dmg: { name: 'ОВЕРКЛОК', icon: '⚙️', max: 5, d: '+10% урона' },
  cd: { name: 'ОПТИМИЗАЦИЯ', icon: '⏱️', max: 5, d: '-8% перезарядки' },
  area: { name: 'РАСШИРЕНИЕ', icon: '🌐', lockAch: 'p_area', max: 5, d: '+10% площади атак' },
  proj: { name: 'РАЗГОН', icon: '🚀', lockAch: 'p_proj', max: 5, d: '+10% скорости снарядов' },
  dur: { name: 'РАДИАТОР', icon: '❄️', lockAch: 'p_dur', max: 5, d: '+12% длительности эффектов' },
  amount: { name: 'ПАРАЛЛЕЛИЗМ', icon: '🌀', lockAch: 'p_amount', max: 2, d: '+1 снаряд ко всему' },
  armor: { name: 'БРОНЯ', icon: '🧱', lockAch: 'p_armor', max: 5, d: '-1 урона от каждого удара' },
  hp: { name: 'БЕКАП', icon: '💾', lockAch: 'p_hp', max: 5, d: '+20% максимального здоровья' },
  regen: { name: 'РЕГЕНЕРАЦИЯ', icon: '💗', lockAch: 'p_regen', max: 5, d: '+0.25 HP/сек' },
  mspd: { name: 'КРОССЫ', icon: '👟', lockAch: 'p_mspd', max: 5, d: '+7% скорости бега' },
  magnet: { name: 'МАГНИТ', icon: '🧲', lockAch: 'p_magnet', max: 5, d: '+25% радиуса подбора' },
  luck: { name: 'УДАЧА', icon: '🍀', lockAch: 'p_luck', max: 5, d: '+10% шанса дропа и лут-боксов' },
  growth: { name: 'КУРСЫ', icon: '📈', lockAch: 'p_growth', max: 5, d: '+8% получаемого опыта' },
  spag: {
    name: 'СПАГЕТТИ-КОД',
    icon: '🍝',
    lockAch: 'p_spag',
    max: 100,
    d: 'баги плодятся и крепнут: за уровень +10% спавна, +16% HP, +6% их скорости (множатся). добыча и прокачка — ТОЛЬКО из сундуков (шанс растёт с числом убийств), слоты пассивок не занимает',
  },
};

/* ключевой стат оружия для модов (бесконечные микро-бонусы после ур. 8) */
const KEYSTATS = {
  whip: 'area',
  knife: 'speed',
  orbit: 'area',
  tesla: 'cd',
  aura: 'area',
  axe: 'area',
  boom: 'speed',
  flask: 'dur',
  laser: 'cd',
  fire: 'speed',
  drone: 'dmg',
  shur: 'speed',
  xbow: 'dmg',
  saw: 'area',
  mortar: 'area',
  mines: 'dur',
};
const MODTXT = {
  dmg: '+9% урона этого оружия',
  area: '+5% площади и +3% урона этого оружия',
  cd: '−2.5% кулдауна и +3% урона этого оружия',
  speed: '+5% скорости ПОЛЁТА снарядов этого оружия (не бега героя) и +3% урона',
  dur: '+8% длительности и +3% урона этого оружия',
};
/* ГИПЕР-ФОРМЫ: фиксированные пары эволюций. host — чей слот становится гипер-формой,
   with — эволюция-партнёр (поглощается: слот освобождается, МОДы переходят форме).
   Гипер-атака полностью заменяет обе старые атаки пары. */
const HYPERS = {
  whip: {
    name: 'ДЕБАГГЕР',
    icon: '🐞',
    with: 'knife',
    host: 1,
    d: 'лезвие-карусель вокруг игрока + залпы самонаводящихся форков',
  },
  knife: { name: 'ДЕБАГГЕР', icon: '🐞', with: 'whip', d: 'сливается с БРЕЙКПОИНТом в гипер-форму' },
  tesla: {
    name: 'СВЕРХПРОВОД',
    icon: '🔌',
    with: 'laser',
    host: 1,
    d: 'крест плазменных лучей — каждый луч бьёт цепной молнией',
  },
  laser: { name: 'СВЕРХПРОВОД', icon: '🔌', with: 'tesla', d: 'сливается с ТЕСЛА-БАШНЕЙ в гипер-форму' },
  aura: {
    name: 'ПАНИКА ЯДРА',
    icon: '☀️',
    with: 'fire',
    host: 1,
    d: 'огненное ядро жжёт всё вокруг и схлопывается в имплозию',
  },
  fire: { name: 'ПАНИКА ЯДРА', icon: '☀️', with: 'aura', d: 'сливается с ФАЙРВОЛом в гипер-форму' },
  axe: {
    name: 'ПЯТНИЧНЫЙ ДЕПЛОЙ',
    icon: '🚨',
    with: 'mortar',
    host: 1,
    d: 'ковровая бомбардировка: детонации и шокволны по всей карте',
  },
  mortar: { name: 'ПЯТНИЧНЫЙ ДЕПЛОЙ', icon: '🚨', with: 'axe', d: 'сливается с ЯДЕРНЫМ ДЕПЛОЕМ в гипер-форму' },
  boom: {
    name: 'ПЕРЕПОЛНЕНИЕ СТЕКА',
    icon: '♾️',
    with: 'saw',
    host: 1,
    d: 'лезвия-бумеранги делятся при каждом попадании',
  },
  saw: { name: 'ПЕРЕПОЛНЕНИЕ СТЕКА', icon: '♾️', with: 'boom', d: 'сливается с ОТКАТом 2.0 в гипер-форму' },
  orbit: {
    name: 'ПУБЛИЧНОЕ ОБЛАКО',
    icon: '☁️',
    with: 'drone',
    host: 1,
    d: 'орбитальный рой дронов непрерывно обстреливает всё вокруг',
  },
  drone: { name: 'ПУБЛИЧНОЕ ОБЛАКО', icon: '☁️', with: 'orbit', d: 'сливается с ВЕЧНОЙ ОРБИТОЙ в гипер-форму' },
  flask: {
    name: 'НЕСТАБИЛЬНАЯ СБОРКА',
    icon: '🎲',
    with: 'mines',
    host: 1,
    d: 'лужи-воронки, детонирующие под ногами у врагов',
  },
  mines: { name: 'НЕСТАБИЛЬНАЯ СБОРКА', icon: '🎲', with: 'flask', d: 'сливается с ОЗЕРОМ ДАННЫХ в гипер-форму' },
  shur: {
    name: 'СКАНЕР 0-ДНЕЙ',
    icon: '🔭',
    with: 'xbow',
    host: 1,
    d: 'круговой шквал заплаток + рельса-скан по жирной цели',
  },
  xbow: { name: 'СКАНЕР 0-ДНЕЙ', icon: '🔭', with: 'shur', d: 'сливается с ХОТФИКС-ШТОРМом в гипер-форму' },
};
/* приоритет прицеливания: у каждого оружия своя индивидуальность (aimFor):
   «описанный» приоритет умножается на близость цели — очень далёкий враг не цель.
   Защита игрока: axe/flask/mortar целятся в ближайших; tesla/fire и дроны
   ПУБЛИЧНОГО ОБЛАКА берут случайную цель с весом «чем ближе к игроку — тем выше шанс» (pickThreat) */
const PRIO = {
  whip: 'nearest',
  knife: 'nearest',
  drone: 'nearest',
  shur: 'weakest',
  xbow: 'strongest',
  saw: 'nearest',
  boom: 'strongest',
  axe: 'nearest',
  flask: 'nearest',
  mortar: 'nearest',
};

const ETYPES = {
  bug: { hp: 7, spd: 58, dmg: 6, xp: 1, r: 10, col: '#7ef29a' },
  mini: { hp: 3, spd: 80, dmg: 4, xp: 1, r: 7, col: '#b7f7cf' },
  crawler: { hp: 20, spd: 44, dmg: 9, xp: 2, r: 13, col: '#e8c14a' },
  ghost: { hp: 14, spd: 68, dmg: 8, xp: 2, r: 11, col: '#9db4ff' },
  tank: { hp: 85, spd: 24, dmg: 14, xp: 5, r: 20, col: '#e8794a' },
  spawner: { hp: 55, spd: 30, dmg: 10, xp: 5, r: 16, col: '#d386e8' },
};
const BOSSES = [
  { id: 'megabyte', name: 'МЕГАБАЙТ', hp: 2200, spd: 34, dmg: 18, r: 34, col: '#f87171' },
  { id: 'deadlock', name: 'ДЕДЛОК', hp: 4600, spd: 30, dmg: 22, r: 38, col: '#c084fc' },
  { id: 'pentestd', name: 'ПЕНТЕСТ-ДЕМОН', hp: 9500, spd: 40, dmg: 26, r: 40, col: '#fbbf24' },
  { id: 'queen', name: 'КОРОЛЕВА СПАВНОВ', hp: 17000, spd: 26, dmg: 28, r: 44, col: '#d386e8', spawner: true },
  { id: 'techdebt', name: 'ТЕХДОЛГ', hp: 32000, spd: 28, dmg: 32, r: 50, col: '#94a3b8' },
  { id: 'cluster', name: 'ГЛАВНЫЙ КЛАСТЕР', hp: 75000, spd: 24, dmg: 40, r: 62, col: '#f87171', final: true },
];

const STAGES = [
  {
    id: 'prod',
    name: 'ПРОДАКШЕН',
    desc: 'Обычный рабочий день. Баги множатся.',
    bg: '#050d09',
    grid: 'rgba(56,224,127,.07)',
    accent: '#38e07f',
    glowRGB: '56,224,127',
    decor: 'server',
    era: 'дата-центр · сегодня',
    hpMul: 1,
    spdMul: 1,
    finalName: 'ГЛАВНЫЙ КЛАСТЕР',
    pool: [
      ['bug'],
      ['bug', 'mini'],
      ['bug', 'crawler'],
      ['crawler', 'bug', 'ghost'],
      ['ghost', 'crawler', 'tank'],
      ['tank', 'crawler', 'ghost', 'spawner', 'mini'],
    ],
  },
  {
    id: 'night',
    name: 'НОЧНОЙ БИЛД',
    desc: 'Кофе кончился в 3:00. Баги быстрее на 25%.',
    bg: '#0a0714',
    grid: 'rgba(167,139,250,.08)',
    accent: '#a78bfa',
    glowRGB: '167,139,250',
    decor: 'night',
    era: 'офис · 03:00 ночи',
    hpMul: 1.15,
    spdMul: 1.25,
    finalName: 'РЕЙТ-ЛИМИТ',
    unlockAch: 'a_surv10',
    pool: [
      ['bug', 'ghost'],
      ['ghost', 'mini', 'bug'],
      ['crawler', 'ghost'],
      ['ghost', 'crawler', 'spawner'],
      ['tank', 'ghost', 'spawner'],
      ['spawner', 'tank', 'ghost', 'crawler', 'mini'],
    ],
  },
  {
    id: 'legacy',
    name: 'ЛЕГАСИ-АД',
    desc: 'Кобол. Много кобола. Всё страшное и живучее.',
    bg: '#100a05',
    grid: 'rgba(251,191,36,.07)',
    accent: '#fbbf24',
    glowRGB: '251,191,36',
    decor: 'mainframe',
    era: 'машинный зал · 1962',
    hpMul: 1.5,
    spdMul: 0.95,
    finalName: 'ПРОДАКШЕН-БУМЕР',
    unlockAch: 'a_surv20',
    pool: [
      ['crawler'],
      ['crawler', 'tank'],
      ['tank', 'bug', 'mini'],
      ['tank', 'spawner', 'crawler'],
      ['tank', 'spawner', 'ghost'],
      ['tank', 'spawner', 'crawler', 'ghost', 'mini'],
    ],
  },
];

const META = [
  { id: 'power', name: 'МОЩНОСТЬ', icon: '⚙️', max: 5, cost: l => Math.round(150 * Math.pow(2, l)), d: '+5% урона' },
  { id: 'armor', name: 'БРОНЯ', icon: '🧱', max: 3, cost: l => Math.round(300 * Math.pow(2.2, l)), d: '+1 броня' },
  { id: 'hp', name: 'ЗАПАС HP', icon: '❤️', max: 5, cost: l => Math.round(120 * Math.pow(2, l)), d: '+10% макс. HP' },
  {
    id: 'cd',
    name: 'КУЛДАУН',
    icon: '⏱️',
    max: 5,
    cost: l => Math.round(200 * Math.pow(2.1, l)),
    d: '-3% перезарядки',
  },
  {
    id: 'area',
    name: 'ПЛОЩАДЬ',
    icon: '🌐',
    max: 5,
    cost: l => Math.round(120 * Math.pow(2, l)),
    d: '+5% области атак',
  },
  {
    id: 'mspd',
    name: 'СКОРОСТЬ',
    icon: '👟',
    max: 5,
    cost: l => Math.round(100 * Math.pow(2, l)),
    d: '+4% скорости бега',
  },
  {
    id: 'amount',
    name: 'КОЛИЧЕСТВО',
    icon: '🌀',
    max: 2,
    cost: l => Math.round(1200 * Math.pow(3, l)),
    d: '+1 снаряд',
  },
  { id: 'luck', name: 'УДАЧА', icon: '🍀', max: 5, cost: l => Math.round(150 * Math.pow(2, l)), d: '+8% удачи' },
  { id: 'growth', name: 'РОСТ', icon: '📈', max: 5, cost: l => Math.round(120 * Math.pow(2, l)), d: '+5% опыта' },
  {
    id: 'greed',
    name: 'ЖАДНОСТЬ',
    icon: '💰',
    max: 5,
    cost: l => Math.round(150 * Math.pow(2.2, l)),
    d: '+10% монет за забег',
  },
  {
    id: 'regen',
    name: 'РЕГЕНЕРАЦИЯ',
    icon: '💗',
    max: 5,
    cost: l => Math.round(180 * Math.pow(2, l)),
    d: '+0.15 HP/сек',
  },
  {
    id: 'revive',
    name: 'ВОСКРЕШЕНИЕ',
    icon: '👼',
    max: 2,
    cost: l => Math.round(2500 * Math.pow(2.5, l)),
    d: '+1 воскрешение за забег',
  },
  {
    id: 'td',
    name: 'ТЕХДОЛГ',
    icon: '📚',
    max: 5,
    cost: l => Math.round(400 * Math.pow(2.2, l)),
    d: '+10% спавна, +16% HP и +6% скорости багов за уровень (множатся); +7% опыта и монет за уровень',
  },
  {
    id: 'wslot',
    name: 'СЛОТ ОРУЖИЯ',
    icon: '🎛️',
    max: 2,
    cost: l => 15000 + l * 30000,
    d: '+1 слот оружия в забеге (до 8)',
  },
  {
    id: 'pslot',
    name: 'СЛОТ ПАССИВА',
    icon: '🧩',
    max: 2,
    cost: l => 12000 + l * 24000,
    d: '+1 слот пассивки в забеге (до 8)',
  },
  /* МИНИКАРТА и КОДЕКС из магазина убраны — открываются ачивками (META_ACH ниже):
    карта — за победу на НОЧНОМ БИЛДЕ, кодекс — за коллекцию разблокированных оружий */
  {
    id: 'dinf',
    name: 'ОБВЕС',
    icon: '🔩',
    max: Infinity,
    cost: l => Math.round(300 * Math.pow(1.22, l)),
    d: '+1% урона за уровень. БЕЗ ПРЕДЕЛА',
  },
  {
    id: 'cinf',
    name: 'ДЕПОЗИТ',
    icon: '🏦',
    max: Infinity,
    cost: l => Math.round(250 * Math.pow(1.2, l)),
    d: '+1% монет за забег. БЕЗ ПРЕДЕЛА',
  },
  {
    id: 'hpinf',
    name: 'ГОРЯЧИЕ ПАТЧИ',
    icon: '🩹',
    max: Infinity,
    cost: l => Math.round(120 * Math.pow(1.6, l)),
    d: '+1 макс. HP за уровень. БЕЗ ПРЕДЕЛА',
  },
  {
    id: 'buginf',
    name: 'ОТЧЁТЫ О БАГАХ',
    icon: '🐞',
    max: Infinity,
    cost: l => Math.round(400 * Math.pow(1.15, l)),
    d: '+1% спавна, HP, урона и скорости багов за уровень. БЕЗ ПРЕДЕЛА',
  },
];

/* мета-модули за ачивки: id ачивки → ключ save.meta. Выдача — в checkAch, ретрогрант старым сейвам — в grantBackUnlocks */
const META_ACH = { a_winnight: 'minimap', a_codex: 'codex' },
  META_ACH_NAME = { minimap: 'МИНИКАРТА', codex: 'КОДЕКС ЭВОЛЮЦИЙ' };

const bb = (s, id) => (s.bestBy || {})[id] || 0;
const mlb = (s, id) => (s.maxLvlBy || {})[id] || 0;
const evb = (s, id) => (s.evoBy || {})[id] || 0;
const ACH = [
  /* ===== ЦЕПОЧКА ОТКРЫТИЙ: шаг N требует шаг N-1 (в духе VS) ===== */
  { id: 'c1', name: 'ПЕРВАЯ СМЕНА', d: 'Выжить 5 минут за ПЕРФОКАРТУ', c: s => bb(s, 'punch') >= 300, r: 100 },
  { id: 'c2', name: 'СТАРЫЙ КОД ДЕРЖИТ', d: 'Прокачать ЛЕГАСИ-КОД до ур. 8', c: s => mlb(s, 'mines') >= 8, r: 150 },
  { id: 'c3', name: 'ЭЛЕКТРИФИКАЦИЯ', d: 'Выжить 6 минут за ЛАМПУ', c: s => bb(s, 'lamp') >= 360, r: 150 },
  { id: 'c4', name: 'ЗЕЛЁНАЯ ГАЛКА', d: 'Прокачать ЮНИТ-ТЕСТ до ур. 8', c: s => mlb(s, 'xbow') >= 8, r: 200 },
  { id: 'c5', name: 'ОДНА ИНСТРУКЦИЯ', d: 'Выжить 8 минут за АСМ', c: s => bb(s, 'asm') >= 480, r: 200 },
  { id: 'c6', name: 'ТЫСЯЧА ФОРКОВ', d: 'Прокачать ФОРК до ур. 8', c: s => mlb(s, 'knife') >= 8, r: 250 },
  { id: 'c7', name: 'БАЛАНС СКОБОК', d: 'Выжить 10 минут за ЛИСП', c: s => bb(s, 'lisp') >= 600, r: 250 },
  { id: 'c8', name: 'РОЙ ПРИНЯТ НА РАБОТУ', d: 'Эволюционировать ДРОН-ИНТЕРН', c: s => evb(s, 'drone') >= 1, r: 300 },
  { id: 'c9', name: 'СИСТЕМНЫЙ ВЫЗОВ', d: 'Выжить 12 минут за СИ', c: s => bb(s, 'clang') >= 720, r: 300 },
  { id: 'c10', name: 'УШЁЛ — ВЕРНУЛСЯ', d: 'Прокачать ОТКАТ до ур. 8', c: s => mlb(s, 'boom') >= 8, r: 350 },
  { id: 'c11', name: 'ВЫБОР СДЕЛАН', d: 'Выжить 13 минут за ДЕЦИЗИЮ', c: s => bb(s, 'decide') >= 780, r: 350 },
  { id: 'c12', name: 'СТАТИЧЕСКИЙ РАЗРЯД', d: 'Эволюционировать СТАТИКУ', c: s => evb(s, 'tesla') >= 1, r: 400 },
  { id: 'c13', name: 'БАТАРЕЙКИ ВКЛЮЧЕНЫ', d: 'Выжить 14 минут за ПИТОНА', c: s => bb(s, 'py') >= 840, r: 400 },
  {
    id: 'c14',
    name: 'ДЕФРАГМЕНТАЦИЯ ЗАВЕРШЕНА',
    d: 'Эволюционировать ФРАГМЕНТАТОР',
    c: s => evb(s, 'saw') >= 1,
    r: 450,
  },
  { id: 'c15', name: 'НЕПЛАНОВЫЙ ФИКС', d: 'Выжить 15 минут за ДЖС', c: s => bb(s, 'js') >= 900, r: 450 },
  { id: 'c16', name: 'ЗАПЛАТКА ДЕРЖИТ', d: 'Прокачать ХОТФИКС до ур. 8', c: s => mlb(s, 'shur') >= 8, r: 500 },
  { id: 'c17', name: 'ОПОРНАЯ ТОЧКА', d: 'Выжить 16 минут за СВМ', c: s => bb(s, 'svm') >= 960, r: 500 },
  { id: 'c18', name: 'КРЕСТ НА БАГАХ', d: 'Эволюционировать РЕФАКТОР', c: s => evb(s, 'whip') >= 1, r: 550 },
  { id: 'c19', name: 'ДЕЖАВЮ', d: 'Выжить 17 минут за ЭХО', c: s => bb(s, 'echo') >= 1020, r: 550 },
  { id: 'c20', name: 'НАГРАДА ПОЛУЧЕНА', d: 'Прокачать ДЕПЛОЙ до ур. 8', c: s => mlb(s, 'axe') >= 8, r: 600 },
  { id: 'c21', name: 'ПУШ В МАСТЕР', d: 'Выжить 18 минут за ГИТА', c: s => bb(s, 'git') >= 1080, r: 600 },
  { id: 'c22', name: 'ОРБИТА СТАБИЛЬНА', d: 'Эволюционировать САТЕЛЛИТЫ', c: s => evb(s, 'orbit') >= 1, r: 700 },
  { id: 'c23', name: 'ЭКСПЛОЙТ НАЙДЕН', d: 'Выжить 19 минут за РЕВАРДА', c: s => bb(s, 'rl') >= 1140, r: 700 },
  { id: 'c24', name: 'BURN RATE', d: 'Эволюционировать БЁРН-ТЕСТ', c: s => evb(s, 'fire') >= 1, r: 800 },
  { id: 'c25', name: 'СГЕНЕРИРОВАН', d: 'Выжить 20 минут за ГАНА', c: s => bb(s, 'gan') >= 1200, r: 800 },
  { id: 'c26', name: 'ОЗЕРО ДАННЫХ', d: 'Эволюционировать СБРОС КЭША', c: s => evb(s, 'flask') >= 1, r: 900 },
  { id: 'c27', name: 'ВНИМАНИЕ НА ВСЁ', d: 'Выжить 21 минуту за АТТЕНШН', c: s => bb(s, 'attn') >= 1260, r: 1000 },
  { id: 'c28', name: 'ПЯТНИЦА ОТМЕНЯЕТСЯ', d: 'Эволюционировать РОЛЛБЕК', c: s => evb(s, 'mortar') >= 1, r: 1200 },
  { id: 'c29', name: 'ШУМ → СИГНАЛ', d: 'Выжить 22 минуты за ДИФФУЗИЮ', c: s => bb(s, 'diff') >= 1320, r: 1400 },
  { id: 'c30', name: 'КВАНТОВЫЙ СКАЧОК', d: 'Эволюционировать ЛАЗЕР ТЕСТОВ', c: s => evb(s, 'laser') >= 1, r: 1600 },
  { id: 'c31', name: 'СТАРЕЙШИНА ПРОСНУЛСЯ', d: 'Выжить 20 минут за ЛЕГАСИ', c: s => bb(s, 'legacy') >= 1200, r: 2000 },
  { id: 'c32', name: 'ФАЙРВОЛ РАЗВЁРНУТ', d: 'Эволюционировать АНТИВИРУС', c: s => evb(s, 'aura') >= 1, r: 2500 },
  /* ===== ПАССИВКИ: прицепом к цепочке (всегда раньше, чем понадобятся) ===== */
  { id: 'p_hp', name: 'ПЕРВЫЙ ДЕПЛОЙ', d: 'Погибнуть 5 раз', c: s => s.deaths >= 5, r: 100 },
  { id: 'p_armor', name: 'ЗАКАЛКА', d: 'Выжить 6 минут за ПЕРФОКАРТУ', c: s => bb(s, 'punch') >= 360, r: 100 },
  { id: 'p_mspd', name: 'РАЗМИНКА', d: 'Выжить 9 минут за АСМ', c: s => bb(s, 'asm') >= 540, r: 200 },
  { id: 'p_dur', name: 'ОХЛАЖДЕНИЕ', d: 'Выжить 12 минут за ЛИСП', c: s => bb(s, 'lisp') >= 720, r: 150 },
  { id: 'p_magnet', name: 'СБОР ДАННЫХ', d: 'Выжить 15 минут за СВМ', c: s => bb(s, 'svm') >= 900, r: 150 },
  { id: 'p_regen', name: 'ХОРОШИЙ СОН', d: 'Выжить 14 минут за ДЕЦИЗИЮ', c: s => bb(s, 'decide') >= 840, r: 200 },
  { id: 'p_luck', name: 'КОСМОС ПОМОГАЕТ', d: 'Выжить 17 минут за ГИТА', c: s => bb(s, 'git') >= 1020, r: 200 },
  { id: 'p_proj', name: 'ТУРБО', d: 'Прокачать ФРАГМЕНТАТОР до ур. 8', c: s => mlb(s, 'saw') >= 8, r: 250 },
  { id: 'p_area', name: 'МАСШТАБ', d: 'Выжить 19 минут за АТТЕНШН', c: s => bb(s, 'attn') >= 1140, r: 250 },
  { id: 'p_amount', name: 'МНОГОПОТОЧНОСТЬ', d: 'Выжить 20 минут за ДИФФУЗИЮ', c: s => bb(s, 'diff') >= 1200, r: 400 },
  { id: 'p_growth', name: 'ПОВЫШЕНИЕ', d: 'Выжить 22 минуты за ЛЕГАСИ', c: s => bb(s, 'legacy') >= 1320, r: 400 },
  { id: 'p_spag', name: 'ТЫ САМ СТАЛ ЛЕГАСИ', d: 'Погибнуть 20 раз (оно того стоит)', c: s => s.deaths >= 20, r: 666 },
  { id: 'a_first', name: 'ПЕРВАЯ КРОВЬ', d: 'Убить первого бага', c: s => s.kills >= 1, r: 50 },
  { id: 'a_1k', name: 'ДЕБАГГЕР', d: '1000 убийств (всего)', c: s => s.kills >= 1000, r: 150 },
  { id: 'a_10k', name: 'ЭКСТЕРМИНАТУС', d: '10000 убийств (всего)', c: s => s.kills >= 10000, r: 1000 },
  { id: 'a_boss', name: 'БОСС-ФАЙТ', d: 'Убить босса', c: s => s.bosses >= 1, r: 100 },
  { id: 'a_boss10', name: 'ОХОТНИК НА БОССОВ', d: 'Убить 10 боссов', c: s => s.bosses >= 10, r: 400 },
  { id: 'a_surv10', name: 'ДЕСЯТКА', d: 'Прожить 10 минут за забег', c: s => s.bestAny >= 600, r: 300 },
  { id: 'a_surv20', name: 'ДВАДЦАТКА', d: 'Прожить 20 минут за забег', c: s => s.bestAny >= 1200, r: 600 },
  { id: 'a_win', name: 'СБРОС ПРОИЗОШЁЛ', d: 'Победить на ПРОДАКШЕНЕ', c: s => s.winsBy.prod >= 1, r: 500 },
  { id: 'a_winnight', name: 'НОЧНОЙ СТРАЖ', d: 'Победить на НОЧНОМ БИЛДЕ', c: s => s.winsBy.night >= 1, r: 800 },
  { id: 'a_winlegacy', name: 'ЛЕГАСИ ЗАКРЫТ', d: 'Победить в ЛЕГАСИ-АДУ', c: s => s.winsBy.legacy >= 1, r: 1500 },
  { id: 'a_evo', name: 'ЭВОЛЮЦИЯ', d: 'Получить эволюцию оружия', c: s => s.evos >= 1, r: 200 },
  { id: 'a_evo5', name: 'ИЗБРАННЫЙ', d: '5 эволюций (всего)', c: s => s.evos >= 5, r: 600 },
  { id: 'a_maxw', name: 'МАКСИМАЛКА', d: 'Прокачать оружие до ур. 8', c: s => s.maxlvl >= 8, r: 150 },
  { id: 'a_lvl50', name: 'ПОЛТИННИК', d: '50 уровень за один забег', c: s => s.bestLvl >= 50, r: 500 },
  { id: 'a_meat', name: 'МЯСОРУБКА', d: '3000 убийств за один забег', c: s => s.bestKills >= 3000, r: 400 },
  { id: 'a_coins5k', name: 'НАКОПИТЕЛЬ', d: 'Заработать 5000 монет (всего)', c: s => s.coins >= 5000, r: 200 },
  { id: 'a_coins30k', name: 'ИНВЕСТОР', d: 'Заработать 30000 монет (всего)', c: s => s.coins >= 30000, r: 800 },
  { id: 'a_xp', name: 'КАЧОК', d: '100000 опыта (всего)', c: s => s.xp >= 100000, r: 600 },
  { id: 'a_runs', name: 'ВЕТЕРАН', d: '25 забегов', c: s => s.runs >= 25, r: 400 },
  { id: 'a_deaths', name: 'ОСВОИЛСЯ В ЗОНЕ', d: 'Погибнуть 10 раз', c: s => s.deaths >= 10, r: 100 },
  {
    id: 'a_endless',
    name: 'БЕСКОНЕЧНОСТЬ НЕ ПРЕДЕЛ',
    d: 'Прожить 40 минут в бесконечном режиме',
    c: s => s.bestAny >= 2400,
    r: 2000,
  },
  { id: 'a_boss100', name: 'ГРОБОВЩИК', d: 'Убить 100 боссов (всего)', c: s => s.bosses >= 100, r: 3000 },
  { id: 'a_kill50k', name: 'ГЕНОЦИД', d: '50000 убийств (всего)', c: s => s.kills >= 50000, r: 2500 },
  { id: 'a_kill100k', name: 'ТЕРМИНАТОР', d: '100000 убийств (всего)', c: s => s.kills >= 100000, r: 6000 },
  { id: 'a_runs100', name: 'ВЕТЕРАН ТРУДА', d: '100 забегов', c: s => s.runs >= 100, r: 3000 },
  { id: 'a_evo25', name: 'ГЕНОМ-ИНЖЕНЕР', d: '25 эволюций (всего)', c: s => s.evos >= 25, r: 3000 },
  { id: 'a_hyper', name: 'ГИПЕРФОРМА', d: 'Слить две эволюции в гипер-форму', c: s => s.hypers >= 1, r: 2000 },
  { id: 'a_lvl100', name: 'СОТКА', d: '100 уровень за один забег', c: s => s.bestLvl >= 100, r: 4000 },
  { id: 'a_coins250k', name: 'МАГНАТ', d: 'Заработать 250000 монет (всего)', c: s => s.coins >= 250000, r: 5000 },
  { id: 'a_endless60', name: 'ВЕЧНЫЙ ДВИГАТЕЛЬ', d: '60 минут в одном забеге', c: s => s.bestAny >= 3600, r: 5000 },
  {
    id: 'a_winall',
    name: 'ТРИУМВИРАТ',
    d: 'Победить на всех трёх картах',
    c: s => (s.winsBy.prod || 0) >= 1 && (s.winsBy.night || 0) >= 1 && (s.winsBy.legacy || 0) >= 1,
    r: 2500,
  },
  /* мета-модуль КОДЕКС: в конце списка, чтобы цепочки, открытые в этом же проходе checkAch, уже учитывались счётчиком */
  {
    id: 'a_codex',
    name: 'ДОКУМЕНТАЦИЯ',
    d: 'Разблокировать 8 оружий',
    c: () => {
      let n = 0;
      for (const id in WEAPONS) if (!WEAPONS[id].lockAch || save.ach[WEAPONS[id].lockAch]) n++;
      return n >= 8;
    },
    r: 300,
  },
];

/* ================= RUN STATS ================= */
function pl(id) {
  const p = P.passives.find(x => x.id === id);
  const ab = (P.absorbed && P.absorbed[id]) || 0;
  return Math.max(p ? p.lvl : 0, ab);
}
function wUnlocked(id) {
  const w = WEAPONS[id];
  return !w.lockAch || !!save.ach[w.lockAch];
}
function pUnlocked(id) {
  const p = PASSIVES[id];
  return !p.lockAch || !!save.ach[p.lockAch];
}
function recompute() {
  const c = CHARS.find(c => c.id === run.charId);
  const b = c.b || {};
  const m = save.meta;
  const hpRatio = P.maxhp > 0 ? P.hp / P.maxhp : 1; /* доля HP до пересчёта — при изменении maxhp процент сохраняется */
  P.maxhp =
    Math.round(50 * (b.hp || 1) * (1 + 0.1 * m.hp) * (1 + 0.2 * pl('hp'))) +
    (m.hpinf ||
      0); /* HP — детерминированная величина: база × агент × пассивка × мета% + плоские «ГОРЯЧИЕ ПАТЧИ». Скрытого роста от уровней нет */
  P.dmgMul = (1 + 0.1 * pl('dmg')) * (1 + 0.05 * m.power) * (b.dmg || 1) * (1 + 0.01 * (m.dinf || 0));
  P.cdMul = (1 - 0.08 * pl('cd')) * (1 - 0.03 * m.cd) * (b.cd || 1);
  P.areaMul = (1 + 0.1 * pl('area')) * (1 + 0.05 * m.area) * (b.area || 1);
  P.projMul = (1 + 0.1 * pl('proj')) * (b.proj || 1);
  P.durMul = 1 + 0.12 * pl('dur');
  P.spd = 170 * (1 + 0.07 * pl('mspd')) * (1 + 0.04 * m.mspd) * (b.mspd || 1);
  P.armor = pl('armor') + m.armor + (b.armor || 0);
  P.regen = 0.25 * pl('regen') + 0.15 * m.regen + (b.regen || 0);
  P.amount = pl('amount') + m.amount + (b.amount || 0);
  P.luck = (1 + 0.1 * pl('luck')) * (1 + 0.08 * m.luck);
  P.growthMul = (1 + 0.08 * pl('growth')) * (1 + 0.05 * m.growth);
  P.magnetR = 55 * (1 + 0.25 * pl('magnet')) * (b.magnet || 1);
  P.revive = Math.floor(m.revive) + (b.revive || 0);
  P.wCap = 6 + (m.wslot || 0);
  P.pCap = 6 + (m.pslot || 0);
  const gr = c.grow;
  if (gr) {
    const L = Math.max(0, P.lvl - 1),
      k = L * gr.per;
    if (gr.s === 'dmg') P.dmgMul *= 1 + k;
    else if (gr.s === 'cd') P.cdMul *= Math.max(0.35, 1 - k);
    else if (gr.s === 'area') P.areaMul *= 1 + k;
    else if (gr.s === 'proj') P.projMul *= 1 + k;
    else if (gr.s === 'dur') P.durMul *= 1 + k;
    else if (gr.s === 'hp') P.maxhp = Math.round(P.maxhp * (1 + k));
    else if (gr.s === 'mspd') P.spd *= 1 + k;
    else if (gr.s === 'magnet') P.magnetR *= 1 + k;
    else if (gr.s === 'luck') P.luck *= 1 + k;
    else if (gr.s === 'growth') P.growthMul *= 1 + k;
    else if (gr.s === 'all') {
      P.dmgMul *= 1 + k;
      P.areaMul *= 1 + k;
      P.projMul *= 1 + k;
      P.durMul *= 1 + k;
      P.spd *= 1 + k;
      P.magnetR *= 1 + k;
      P.luck *= 1 + k;
      P.growthMul *= 1 + k;
      P.cdMul *= Math.max(0.35, 1 - k);
      P.maxhp = Math.round(P.maxhp * (1 + k));
    }
  }
  P.hp = Math.min(P.maxhp, hpRatio * P.maxhp);
}
function xpNeed(l) {
  return Math.floor(6 + l * 4 + Math.pow(l, 1.7));
}

/* ================= RUN LIFECYCLE ================= */
function startRun(charId, stageId, endless) {
  const ch = CHARS.find(c => c.id === charId);
  const st = STAGES.find(s => s.id === stageId);
  enemies = [];
  bullets = [];
  gems = [];
  pickups = [];
  pools = [];
  fx = [];
  parts = [];
  dmgNums = [];
  notes = [];
  P = {
    x: 0,
    y: 0,
    r: 13,
    hp: 50,
    maxhp: 50,
    spd: 170,
    weapons: [],
    passives: [],
    absorbed: {},
    usedW: {},
    xp: 0,
    need: xpNeed(1),
    lvl: 1,
    pendLv: 0,
    iv: 0,
    aim: { x: 1, y: 0 },
    dmgMul: 1,
    cdMul: 1,
    areaMul: 1,
    projMul: 1,
    durMul: 1,
    armor: 0,
    regen: 0,
    amount: 0,
    luck: 1,
    growthMul: 1,
    magnetR: 55,
    revive: 0,
    wCap: 6,
    pCap: 6,
  };
  run = {
    charId,
    stageId,
    endless: !!endless,
    stage: st,
    t: 0,
    kills: 0,
    coins: 0,
    xpTotal: 0,
    spawnT: 0.5,
    waveIdx: 0,
    nextElite: 35,
    eliteNext: false,
    nextRing: 150,
    nextEndBoss: 1740,
    bossPlan: [300, 600, 900, 1200, 1500, 1740].map((t, i) => ({ t, tier: i + 1 })),
    boss: null,
    waves: makeWaves(st),
  };
  recompute();
  P.hp = P.maxhp;
  if (ch.weapon) P.weapons.push({ id: ch.weapon, lvl: 1, timer: 0.3, active: false, pend: null });
  cam.x = 0;
  cam.y = 0;
  shake = 0;
  hasRun = true;
  appState = 'run';
  hideAllScreens();
  $('hud').classList.remove('hidden');
  buildIcons();
  save.stats.runs++;
  saveGame();
  showHint('ВЫЖИВИ', 3);
}
function makeWaves(st) {
  const wv = [];
  for (let m = 0; m < 30; m++) {
    const ph = Math.min(st.pool.length - 1, Math.floor(m / 5));
    wv.push({
      t: m * 60,
      types: st.pool[ph],
      itv: Math.max(0.22, 1.05 - m * 0.028),
      batch: Math.min(10, 3 + Math.floor(m * 0.26)),
    });
  }
  return wv;
}
function showHint(txt, ms) {
  const h = $('hint');
  h.textContent = txt;
  h.classList.remove('on');
  void h.offsetWidth; /* рестарт анимации при повторном показе */
  if (ms) h.style.animationDuration = ms + 's';
  else h.style.animationDuration = '';
  h.classList.add('on');
}
function endRun(win, quit) {
  if (appState === 'over') return;
  appState = 'over';
  hideTip();
  const greed = 1 + 0.1 * save.meta.greed + 0.01 * save.meta.cinf;
  const earned = run.coins + (win ? 400 : 0);
  const got = Math.round(earned * greed);
  save.coins += got;
  save.stats.coins += got;
  if (win) {
    save.stats.wins++;
    save.stats.winsBy[run.stageId] = (save.stats.winsBy[run.stageId] || 0) + 1;
  } else if (!quit) save.stats.deaths++;
  const best = Math.floor(run.t);
  if (best > save.stats.best[run.stageId]) save.stats.best[run.stageId] = best;
  if (best > save.stats.bestAny) save.stats.bestAny = best;
  save.stats.bestBy = save.stats.bestBy || {};
  if (best > (save.stats.bestBy[run.charId] || 0)) save.stats.bestBy[run.charId] = best;
  if (run.kills > save.stats.bestKills) save.stats.bestKills = run.kills;
  save.stats.xp += run.xpTotal;
  /* уровни оружия за забег попадают в статы из ЛЮБОГО источника (левелап, сундуки, будущие пути):
     без этого синка ачивки «Прокачать X до ур. 8» зависели от того, чем именно взята последняя ступень */
  save.stats.maxLvlBy = save.stats.maxLvlBy || {};
  for (const w of P.weapons) {
    if (w.lvl > save.stats.maxlvl) save.stats.maxlvl = w.lvl;
    if (w.lvl > (save.stats.maxLvlBy[w.id] || 0)) save.stats.maxLvlBy[w.id] = w.lvl;
  }
  /* ачивки, «дозревшие» за забег, оформляются только здесь: без тостов посреди боя.
     Открытые ими пассивки/агенты/карты доступны со следующего забега */
  const newAch = checkAch(true);
  saveGame();
  $('hud').classList.add('hidden');
  $('bossBarWrap').classList.add('hidden');
  $('levelup').classList.add('hidden');
  $('chestModal').classList.add('hidden');
  $('pauseModal').classList.add('hidden');
  $('goTitle').textContent = win ? 'СБРОС ПРОИЗОШЁЛ!' : 'АГЕНТ ПАЛ';
  $('goTitle').style.color = win ? 'var(--grn)' : 'var(--red)';
  $('goSub').textContent = win ? 'легион багов отступил... пока что' : 'баги празднуют. до следующего деплоя';
  $('goStats').innerHTML =
    goRow('ВРЕМЯ', fmtT(run.t)) +
    goRow('УРОВЕНЬ', P.lvl) +
    goRow('УБИЙСТВ', fmt(run.kills)) +
    goRow('ОПЫТА', fmt(run.xpTotal)) +
    goRow('КАРТА', run.stage.name);
  $('goRewards').textContent =
    '+' +
    fmt(got) +
    ' монет' +
    (greed > 1 ? ' (жадность ×' + greed.toFixed(1) + ')' : ''); /* ◉ рисует .coinsTag::before — вручную не дублируем */
  $('goAch').innerHTML = newAch.length
    ? '<div class="goAchT">ПОЛУЧЕННЫЕ ДОСТИЖЕНИЯ</div>' +
      newAch
        .map(
          x =>
            '<div class="r"><span>🏆 ' +
            x.name +
            (x.extra || '') +
            '<i>' +
            x.d +
            '</i></span><span>◉ +' +
            x.r +
            '</span></div>'
        )
        .join('')
    : '';
  $('goAch').style.display = newAch.length ? '' : 'none';
  $('gameover').classList.remove('hidden');
  sfx(win ? 'chest' : 'boss');
}
function goRow(k, v) {
  return '<div class="r"><span>' + k + '</span><span>' + v + '</span></div>';
}
function pauseGame() {
  if (appState !== 'run') return;
  appState = 'pause';
  hideTip();
  const pb = $('pauseBuild');
  pb.innerHTML = '';
  const wRow = document.createElement('div');
  wRow.className = 'iconRow';
  for (const w of P.weapons) wRow.appendChild(mkWIcon(w));
  const pRow = document.createElement('div');
  pRow.className = 'iconRow';
  for (const p of P.passives) pRow.appendChild(mkPIcon(p));
  for (const id in P.absorbed) pRow.appendChild(mkAbsIcon(id, 'p'));
  for (const id in P.usedW) pRow.appendChild(mkAbsIcon(id, 'w'));
  if (!P.passives.length && !Object.keys(P.absorbed).length && !Object.keys(P.usedW).length)
    pRow.innerHTML = '<span style="color:var(--mut);font-size:12px">пассивов пока нет</span>';
  pb.appendChild(wRow);
  pb.appendChild(pRow);
  $('pauseModal').classList.remove('hidden');
}
function resumeGame() {
  if (appState !== 'pause') return;
  appState = 'run';
  $('pauseModal').classList.add('hidden');
  hideTip();
}

/* ================= XP / LEVELUP ================= */
function gainXP(v) {
  P.xp += Math.round(v * P.growthMul);
  run.xpTotal += v;
  let leveled = false;
  while (P.xp >= P.need) {
    P.xp -= P.need;
    P.lvl++;
    P.need = xpNeed(P.lvl);
    P.pendLv++;
    leveled = true;
    recompute();
  }
  if (leveled) {
    if (P.lvl > save.stats.bestLvl) save.stats.bestLvl = P.lvl;
    sfx('lvl');
    if (appState === 'run') openLevelup();
  }
}
let lvlChoices = [];
function openLevelup() {
  appState = 'levelup';
  lvlChoices = rollChoices();
  /* страховка: пул не может быть пуст (моды есть всегда, когда всё выкачано), но пусть игра не зависнет */
  if (!lvlChoices.length) {
    P.pendLv--;
    if (P.pendLv > 0) openLevelup();
    else appState = 'run';
    return;
  }
  const hasMods = lvlChoices.some(c => c.type === 'mod');
  $('lvlAutoRow').classList.toggle('hidden', !hasMods);
  $('lvlAutoHint').classList.toggle('hidden', !hasMods);
  $('lvlAutoTgl').classList.toggle('on', !!save.set.automod);
  const box = $('lvlCards');
  box.innerHTML = '';
  lvlChoices.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'lcard';
    let icon, name, tag, desc;
    if (c.type === 'w') {
      const def = WEAPONS[c.id];
      icon = def.icon;
      name = def.name;
      desc = c.to === 1 ? def.d : lvDesc(c.id, c.to);
      tag =
        c.to === 1
          ? '<span class="tNew">НОВОЕ ОРУЖИЕ</span>'
          : '<span class="tUp">УР. ' + (c.to - 1) + ' → ' + c.to + '</span>';
    } else if (c.type === 'p') {
      const def = PASSIVES[c.id];
      icon = def.icon;
      name = def.name;
      desc = def.d;
      tag =
        c.to === 1
          ? '<span class="tNew">НОВЫЙ ПАССИВ</span>'
          : '<span class="tUp">УР. ' + (c.to - 1) + ' → ' + c.to + '</span>';
    } else if (c.type === 'mod') {
      const w = P.weapons.find(x => x.id === c.id),
        def = WEAPONS[c.id];
      const nm = w && w.hyper ? HYPERS[c.id].name : w && w.ev ? def.evo.name : def.name;
      icon = w && w.hyper ? HYPERS[c.id].icon : w && w.ev ? def.evo.icon : def.icon;
      name = 'МОД · ' + nm;
      desc = MODTXT[KEYSTATS[c.id]];
      tag = '<span class="tMod">МОДИФИКАЦИЯ ×' + c.to + '</span>';
    }
    d.innerHTML =
      '<div class="cKey">' +
      (i + 1) +
      '</div><div class="cIcon">' +
      icon +
      '</div><div class="cName">' +
      name +
      '</div><div class="cTag">' +
      tag +
      '</div><div class="cDesc">' +
      desc +
      '</div>';
    d.onclick = () => chooseLevel(i);
    box.appendChild(d);
  });
  /* автовыбор случайного мода, когда на выбор идут ТОЛЬКО моды (галочка ниже включается прямо в окне выбора) */
  if (save.set.automod && lvlChoices.every(c => c.type === 'mod')) {
    chooseLevel(Math.floor(Math.random() * lvlChoices.length));
    return;
  }
  $('levelup').classList.remove('hidden');
}
function rollChoices() {
  const pool = [],
    mods = [];
  for (const w of P.weapons) {
    if (w.lvl < 8) pool.push({ type: 'w', id: w.id, to: w.lvl + 1, w: 12 });
    else mods.push({ type: 'mod', id: w.id, to: (w.mk || 0) + 1, w: 8 });
  }
  if (P.weapons.length < P.wCap)
    for (const id in WEAPONS)
      if (wUnlocked(id) && !P.weapons.find(w => w.id === id) && !P.usedW[id]) pool.push({ type: 'w', id, to: 1, w: 7 });
  /* СПАГЕТТИ-КОД в левелапе не участвует: добыча и прокачка — только из сундуков */
  for (const p of P.passives)
    if (p.lvl < PASSIVES[p.id].max && p.id !== 'spag') pool.push({ type: 'p', id: p.id, to: p.lvl + 1, w: 9 });
  const pUsed = P.passives.filter(p => p.id !== 'spag').length; /* spag не занимает слоты пассивок */
  if (pUsed < P.pCap)
    for (const id in PASSIVES)
      if (id !== 'spag' && pUnlocked(id) && !P.passives.find(p => p.id === id) && !(id in P.absorbed))
        pool.push({ type: 'p', id, to: 1, w: 6 });
  /* МОДы предлагаются только когда всё остальное выкачано на максимум */
  if (!pool.length) pool.push(...mods);
  const out = [];
  const n = P.luck >= 1.3 ? 4 : 3;
  while (out.length < n && pool.length) {
    let tot = 0;
    for (const c of pool) tot += c.w;
    let r = rnd(tot),
      idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    out.push(pool.splice(idx, 1)[0]);
  }
  /* денег и еды в меню уровня больше нет: как только пул пуст — остаются только моды */
  return out;
}
function chooseLevel(i) {
  if (appState !== 'levelup') return;
  const c = lvlChoices[i];
  if (!c) return;
  if (c.type === 'w') {
    const ex = P.weapons.find(w => w.id === c.id);
    if (ex) ex.lvl = c.to;
    else P.weapons.push({ id: c.id, lvl: 1, timer: 0.4, active: false, pend: null });
    if (c.to > save.stats.maxlvl) save.stats.maxlvl = c.to;
    if (c.to > (save.stats.maxLvlBy[c.id] || 0)) save.stats.maxLvlBy[c.id] = c.to;
  } else if (c.type === 'p') {
    const ex = P.passives.find(p => p.id === c.id);
    if (ex) ex.lvl = c.to;
    else P.passives.push({ id: c.id, lvl: 1 });
  } else if (c.type === 'mod') {
    const w = P.weapons.find(w => w.id === c.id);
    if (w) w.mk = (w.mk || 0) + 1;
  }
  recompute();
  buildIcons();
  sfx('pick');
  P.pendLv--;
  $('levelup').classList.add('hidden');
  if (P.pendLv > 0) openLevelup();
  else appState = 'run';
}

/* описание того, что даёт уров. TO оружия ID (автодиф уровней) */
function lvDesc(id, to) {
  const def = WEAPONS[id];
  if (to <= 1) return def.d;
  const a = def.lv[to - 2],
    b = def.lv[to - 1];
  const p = [];
  if (b.dmg > a.dmg) p.push('урон +' + Math.round((b.dmg / a.dmg - 1) * 100) + '%');
  if (b.cd < a.cd) p.push('кд −' + Math.round((a.cd - b.cd) * 1000) + ' мс');
  if ((b.area || 1) > (a.area || 1)) p.push('площадь +' + Math.round(((b.area || 1) / (a.area || 1) - 1) * 100) + '%');
  if (b.speed && a.speed && b.speed > a.speed)
    p.push('скорость полёта снарядов +' + Math.round((b.speed / a.speed - 1) * 100) + '%');
  if ((b.pierce || 0) > (a.pierce || 0)) p.push('пробитие +' + (b.pierce - a.pierce));
  if ((b.dur || 0) > (a.dur || 0)) p.push('длит. +' + Math.round((b.dur - a.dur) * 10) / 10 + 'с');
  if (b.both && !a.both) p.push('бьёт с двух сторон');
  if (b.wave2 && !a.wave2) p.push('добавочный взмах');
  const cnt = id === 'orbit' ? ORBN : id === 'tesla' ? TESN : id === 'laser' ? LASN : null;
  if (cnt && cnt[to - 1] > cnt[to - 2]) p.push('штук: ' + cnt[to - 2] + ' → ' + cnt[to - 1]);
  return p.join(', ') || 'улучшение характеристик';
}

/* ================= CHEST ================= */
/* приоритет: эволюция (мерж оружия+пассивки) → гипер (мерж ДВУХ эволюций) → апгрейды (окно) + случайный СПАГЕТТИ-КОД → монеты (тост без паузы).
   СПАГЕТТИ-КОД добывается ТОЛЬКО здесь: шанс растёт с числом убийств (чем больше фармишь — тем выше шанс, что они станут сильнее), слоты пассивок не занимает */
let chestEvo = null;
function findEvo1() {
  for (const w of P.weapons) {
    if (w.ev || w.lvl < 8) continue;
    const e = WEAPONS[w.id].evo;
    if (e && pl(e.need) >= PASSIVES[e.need].max) return { mode: 'evo', w };
  }
  return null;
}
function findHyper() {
  for (const w of P.weapons) {
    if (!w.ev || w.hyper) continue;
    const h = HYPERS[w.id];
    if (!h || !h.host) continue;
    const u = P.weapons.find(
      x => x !== w && x.id === h.with && x.ev && !x.hyper
    ); /* вторая эволюция ФИКСИРОВАННОЙ пары */
    if (u) return { mode: 'hyper', w, u };
  }
  return null;
}
function applyEvo(c) {
  if (c.mode === 'evo') {
    const w = c.w,
      e = WEAPONS[w.id].evo;
    w.ev = true;
    P.absorbed[e.need] = PASSIVES[e.need].max;
    P.passives = P.passives.filter(p => p.id !== e.need);
    save.stats.evos++;
    save.stats.evoBy[w.id] = (save.stats.evoBy[w.id] || 0) + 1;
    note(P.x, P.y - 36, '⚗️ ЭВОЛЮЦИЯ\n' + e.name);
  } else {
    const w = c.w,
      u = c.u;
    w.hyper = true;
    w.pend = null;
    P.usedW[u.id] = 1; /* партнёр по паре поглощён: уходит из ростера до конца забега */
    if (u.mk) w.mk = (w.mk || 0) + u.mk; /* МОДы партнёра переходят гипер-форме */
    P.weapons = P.weapons.filter(x => x !== u);
    save.stats.hypers++;
    note(P.x, P.y - 36, '⚗️ ГИПЕР-ФОРМА\n' + HYPERS[w.id].name);
  }
  recompute();
  buildIcons(); /* ачивки — только на экране окончания забега */
}
function openEvoModal(c) {
  appState = 'chest';
  chestEvo = c;
  const items = $('chestItems');
  if (c.mode === 'evo') {
    const def = WEAPONS[c.w.id],
      e = def.evo,
      pd = PASSIVES[e.need];
    $('chestTitle').innerHTML = '⚗️ СЛИЯНИЕ!';
    items.innerHTML =
      '<div class="chestItem"><span class="ci">' +
      def.icon +
      '</span><div><div>' +
      def.name +
      ' <span style="color:var(--amb)">УР. МАКС</span> + ' +
      pd.icon +
      ' ' +
      pd.name +
      ' <span style="color:var(--amb)">МАКС</span></div>' +
      '<div class="cd">пассивка поглощается — её эффект останется навсегда, а слот освободится под новую. МОДы оружия сохраняются</div></div></div>' +
      '<div class="chestItem evo"><span class="ci">' +
      e.icon +
      '</span><div><div>ЭВОЛЮЦИЯ: ' +
      e.name +
      '</div><div class="cd">' +
      e.d +
      '</div></div></div>';
  } else {
    const h = HYPERS[c.w.id],
      uw = WEAPONS[c.u.id],
      e = WEAPONS[c.w.id].evo,
      ue = uw.evo;
    $('chestTitle').innerHTML = '⚗️ ГИПЕР-СЛИЯНИЕ!';
    items.innerHTML =
      '<div class="chestItem"><span class="ci">' +
      e.icon +
      '</span><div><div>' +
      e.name +
      ' + ' +
      ue.name +
      '</div>' +
      '<div class="cd">фиксированная пара: обе старые атаки заменяются новой гипер-атакой, слот партнёра освободится, МОДы обеих эволюций перейдут форме</div></div></div>' +
      '<div class="chestItem evo"><span class="ci">' +
      h.icon +
      '</span><div><div>ГИПЕР-ФОРМА: ' +
      h.name +
      '</div><div class="cd">' +
      h.d +
      '</div></div></div>';
  }
  $('chestOk').textContent = 'СЛИТЬ';
  $('chestNo').classList.remove('hidden');
  $('chestHint').classList.add('hidden');
  $('chestModal').classList.remove('hidden');
  sfx('evo');
}
function openChest() {
  if (appState !== 'run') return;
  const c1 = findEvo1(),
    ch = findHyper();
  if (c1) {
    openEvoModal(c1);
    return;
  }
  if (ch) {
    openEvoModal(ch);
    return;
  }
  let n = 1;
  if (Math.random() < 0.4 * P.luck) n++;
  if (Math.random() < 0.15 * P.luck) n++;
  const pool = [];
  for (const w of P.weapons) if (w.lvl < 8) pool.push({ type: 'w', obj: w });
  for (const p of P.passives) if (p.lvl < PASSIVES[p.id].max && p.id !== 'spag') pool.push({ type: 'p', obj: p });
  /* СПАГЕТТИ-КОД: бонус-бросок поверх обычных наград. шанс = 0.12 + убийства/4000, кап 0.7 (1000 уб → ~0.37, 2300+ → 0.7) */
  const spObj = P.passives.find(p => p.id === 'spag');
  let spagHit = false;
  if (pUnlocked('spag') && (!spObj || spObj.lvl < PASSIVES.spag.max)) {
    if (Math.random() < Math.min(0.7, 0.12 + run.kills / 4000)) spagHit = true;
  }
  if (spagHit) {
    if (spObj) spObj.lvl++;
    else P.passives.push({ id: 'spag', lvl: 1 }); /* мимо лимита слотов — намеренно */
  }
  const rewards = [];
  for (let i = 0; i < n && pool.length; i++) {
    const c = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    c.obj.lvl++;
    if (c.type === 'w' && c.obj.lvl > save.stats.maxlvl) save.stats.maxlvl = c.obj.lvl;
    if (c.type === 'w' && c.obj.lvl > ((save.stats.maxLvlBy || {})[c.obj.id] || 0))
      save.stats.maxLvlBy[c.obj.id] = c.obj.lvl;
    rewards.push(c.type === 'w' ? { w: c.obj } : { p: c.obj });
  }
  if (!rewards.length && !spagHit) {
    const cc = ri(90, 180);
    run.coins += cc;
    sfx('coin');
    note(P.x, P.y - 36, '🎁 СУНДУК: +' + cc + ' монет');
    saveGame();
    return; /* без окна и без паузы */
  }
  /* сундук с апгрейдами — окно с описаниями */
  chestEvo = null;
  appState = 'chest';
  $('chestTitle').innerHTML = '🎁 СУНДУК';
  const items = $('chestItems');
  items.innerHTML = '';
  if (spagHit) {
    const sl = P.passives.find(p => p.id === 'spag');
    const d = document.createElement('div');
    d.className = 'chestItem evo';
    d.innerHTML =
      '<span class="ci">🍝</span><div><div>СПАГЕТТИ-КОД → УР. ' +
      sl.lvl +
      ' <span style="color:var(--amb)">(ИЗ СУНДУКА)</span></div><div class="cd">' +
      PASSIVES.spag.d +
      '</div></div>';
    items.appendChild(d);
  }
  for (const r of rewards) {
    const d = document.createElement('div');
    if (r.w) {
      d.className = 'chestItem';
      d.innerHTML =
        '<span class="ci">' +
        WEAPONS[r.w.id].icon +
        '</span><div><div>' +
        WEAPONS[r.w.id].name +
        ' → УР. ' +
        r.w.lvl +
        '</div><div class="cd">' +
        lvDesc(r.w.id, r.w.lvl) +
        '</div></div>';
    } else {
      d.className = 'chestItem';
      d.innerHTML =
        '<span class="ci">' +
        PASSIVES[r.p.id].icon +
        '</span><div><div>' +
        PASSIVES[r.p.id].name +
        ' → УР. ' +
        r.p.lvl +
        '</div><div class="cd">' +
        PASSIVES[r.p.id].d +
        '</div></div>';
    }
    items.appendChild(d);
  }
  const cc = ri(30, 80);
  run.coins += cc;
  const dc = document.createElement('div');
  dc.className = 'chestItem';
  dc.innerHTML = '<span class="ci">💰</span><div><div>+' + cc + ' монет</div></div>';
  items.appendChild(dc);
  $('chestOk').textContent = 'ЗАБРАТЬ';
  $('chestNo').classList.add('hidden');
  $('chestHint').classList.remove('hidden');
  $('chestModal').classList.remove('hidden');
  sfx('chest');
  recompute();
  buildIcons();
}

/* ================= SPAWN DIRECTOR ================= */
/* «угроза»: ТЕХДОЛГ (мета) + СПАГЕТТИ-КОД (пассивка) — хард-режим с честным фарм-апсайдом.
   Спавн линейный (+10%/ур), HP и скорость — экспонента (×1.16 / ×1.06 за уровень):
   полный стак L=10 → ×2.0 спавн, ×4.4 HP, ×1.8 скорости; лут жирнее на +7%/ур (rew()). */
function threat() {
  const L = (save.meta.td || 0) + pl('spag');
  return { cnt: 1 + 0.1 * L, hp: Math.pow(1.16, L), spd: Math.pow(1.06, L) };
}
function rew() {
  return 1 + 0.07 * ((save.meta.td || 0) + pl('spag'));
}
function enemyPow() {
  return 1 + 0.01 * (save.meta.buginf || 0);
} /* «ОТЧЁТЫ О БАГАХ»: покупные +1%/шт к спавну, HP, урону и скорости багов */
function hpMul() {
  const m = run.t / 60;
  return (1 + m * 0.45 + m * m * 0.02) * run.stage.hpMul * threat().hp * enemyPow();
}
function timeSpd() {
  return 1 + (run.t / 60) * 0.1;
} /* враги ускоряются +10%/мин, игрок — НЕТ: давление растёт по ходу забега */
function spawnEnemy(typeId, x, y, o = {}) {
  const t = ETYPES[typeId];
  if (!t) return null;
  const e = {
    uid: uidC++,
    type: typeId,
    x,
    y,
    r: t.r,
    hp: 0,
    maxhp: 0,
    spd: t.spd,
    dmg: t.dmg,
    xp: t.xp,
    col: t.col,
    hitCd: 0,
    flash: 0,
    slowT: 0,
    burnT: 0,
    burnS: 0,
    ph: rnd(TAU),
    elite: !!o.elite,
    spT: 0,
  };
  e.hp = e.maxhp = t.hp * hpMul() * (o.elite ? 14 : 1);
  e.r = t.r * (o.elite ? 1.8 : 1);
  e.spd = t.spd * run.stage.spdMul * (o.elite ? 0.85 : 1) * threat().spd * rnd(0.9, 1.1);
  if (o.elite) {
    e.xp = t.xp * 10;
    e.dmg = Math.round(t.dmg * 1.5);
  }
  if (o.surge) e.surgeT = 6; /* волна по кругу: 6 сек сокращения кольца */
  enemies.push(e);
  return e;
}
function spawnBoss(tier) {
  const def = BOSSES[Math.min(tier - 1, BOSSES.length - 1)];
  const a = rnd(TAU),
    R = Math.hypot(W, H) / 2 + 120;
  const isFinal = !!def.final;
  const e = {
    uid: uidC++,
    type: 'boss',
    boss: true,
    final: isFinal,
    tier,
    name: isFinal ? run.stage.finalName : def.name,
    x: P.x + Math.cos(a) * R,
    y: P.y + Math.sin(a) * R,
    r: def.r,
    hp: def.hp * run.stage.hpMul * threat().hp * (run.endless ? 1 + Math.floor(run.t / 300) * 0.5 : 1),
    maxhp: 1,
    spd: def.spd * run.stage.spdMul * threat().spd,
    dmg: def.dmg,
    xp: 60 + tier * 30,
    col: def.col,
    hitCd: 0,
    flash: 0,
    slowT: 0,
    burnT: 0,
    burnS: 0,
    ph: rnd(TAU),
    spT: 0,
    elite: false,
    spawner: !!def.spawner,
  };
  e.maxhp = e.hp;
  enemies.push(e);
  run.boss = e;
  $('bossBarWrap').classList.remove('hidden');
  $('bossName').textContent = e.name;
  note(e.x, e.y - e.r - 26, '⚠ ' + e.name + ' ПРОСНУЛСЯ', '#f87171');
  sfx('boss');
}
function ringWave(types) {
  /* «меня окружили, бежать некуда»: игрок всегда в центре экрана, поэтому кольцо
     входит ПО КРАЯМ ЭКРАНА — дистанция до края в направлении θ = min((W/2)/|cosθ|,(H/2)/|sinθ|)+64
     (раньше был фикс. полудиагональ+40: на портрете верх/низ появлялись далеко за экраном и
     волна превращалась в хвост-догонялки). Каждому врагу волны даётся surge: 6 секунд
     сокращения с множителем до ×1.8 (спадает линейно) — разрядить кольцо можно только огнём.
     ПЛОТНОСТЬ: рассадка равномерно ПО ДЛИНЕ ДУГИ, а не по углу — при равных углах просветы
     на левом/правом краях широкого экрана выходили ~вдвое больше, чем сверху/снизу
     (ds/dθ ≈ R: 704px против 353px на 1280×577). Шаг 56px при cnt=1 (~78 багов вместо
     прежних 26 с просветами 85–170px) и дальше плотнее пропорционально threat().
     CAP сознательно игнорируется: перебор гасит ОБЫЧНЫЙ спавн в director, кольцо не режем. */
  const SEG = 1024,
    pos = [];
  for (let s = 0; s <= SEG; s++) {
    const a = ((s % SEG) / SEG) * TAU,
      ca = Math.cos(a),
      sa = Math.sin(a);
    /* расширенный прямоугольник (W+128)×(H+128): края ровно в 64px за экраном.
       Вариант min(...)+64 (64 вдоль ЛУЧА, а не перпендикуляра) по диагоналям нырял
       внутрь — просветы на изломах сжимались вдвое относительно прямых участков */
    const tx = ca !== 0 ? (W / 2 + 64) / Math.abs(ca) : 1e9,
      ty = sa !== 0 ? (H / 2 + 64) / Math.abs(sa) : 1e9;
    const R = Math.min(tx, ty);
    pos[s] = [ca * R, sa * R];
  }
  const cum = [0];
  for (let s = 1; s <= SEG; s++) cum[s] = cum[s - 1] + Math.hypot(pos[s][0] - pos[s - 1][0], pos[s][1] - pos[s - 1][1]);
  const n = Math.max(26, Math.round((cum[SEG] / 56) * threat().cnt * enemyPow()));
  let idx = 0;
  for (let k = 0; k < n; k++) {
    const target = ((k + 0.5) / n) * cum[SEG];
    while (idx < SEG && cum[idx + 1] < target) idx++;
    const t = (target - cum[idx]) / Math.max(1e-6, cum[idx + 1] - cum[idx]);
    spawnEnemy(
      pick(types),
      P.x + pos[idx][0] + (pos[idx + 1][0] - pos[idx][0]) * t,
      P.y + pos[idx][1] + (pos[idx + 1][1] - pos[idx][1]) * t,
      { surge: 1 }
    );
  }
  note(P.x, P.y - 40, 'ВОЛНА ПО КРУГУ!');
}
function director(dt) {
  run.spawnT -= dt;
  while (run.waveIdx < run.waves.length - 1 && run.t >= run.waves[run.waveIdx + 1].t) run.waveIdx++;
  const w = run.waves[run.waveIdx];
  while (run.bossPlan.length && run.t >= run.bossPlan[0].t) {
    const b = run.bossPlan.shift();
    spawnBoss(b.tier);
  }
  if (run.endless && run.t >= run.nextEndBoss) {
    run.nextEndBoss += 300;
    spawnBoss(6 + Math.floor((run.t - 1740) / 300));
  }
  if (run.t >= run.nextElite) {
    run.nextElite += 42;
    run.eliteNext = true;
  }
  if (run.spawnT <= 0) {
    run.spawnT = (w ? w.itv : 0.5) / (threat().cnt * enemyPow());
    /* перебор CAP (в т.ч. после кольца, которое CAP не проверяет) — обычный спавн просто молчит */
    if (enemies.length < Math.round(CAP_ENEMIES * timeSpd() * enemyPow() * Math.min(1.8, threat().cnt)) && w) {
      const R = Math.hypot(W, H) / 2 + 70;
      for (let i = 0; i < w.batch; i++) {
        const a = rnd(TAU);
        spawnEnemy(pick(w.types), P.x + Math.cos(a) * R, P.y + Math.sin(a) * R, { elite: run.eliteNext && i === 0 });
      }
      run.eliteNext = false;
    }
  }
  if (run.t >= run.nextRing) {
    run.nextRing += 150;
    ringWave(w ? w.types : ['bug']);
  }
}

/* ================= WEAPONS ENGINE ================= */
/* прицеливание лазера: ищем плотные «полосы» врагов на одной линии (по Y для горизонтальных лучей,
   по X для вертикальных); вес каждой цели падает с дистанцией до игрока (защита в приоритете);
   лучи уходят в РАЗНЫЕ полосы — минимальный разнос MINSEP по своей оси */
function laserAim(count) {
  const MERGE = 48,
    MINSEP = 104,
    WGT = 240,
    VW = Math.hypot(W, H) / 2 + 80;
  const cand = [];
  for (const axis of ['y', 'x']) {
    const pts = enemies
      .filter(e => Math.hypot(e.x - P.x, e.y - P.y) < VW + e.r)
      .map(e => ({ c: axis === 'y' ? e.y : e.x, d: Math.hypot(e.x - P.x, e.y - P.y) }))
      .sort((a, b) => a.c - b.c);
    let cur = [];
    const flush = () => {
      if (!cur.length) return;
      let sc = 0,
        sum = 0;
      for (const o of cur) {
        const wg = 1 / (1 + o.d / WGT);
        sc += wg;
        sum += o.c * wg;
      }
      cand.push({ axis, score: sc, coord: sum / sc });
      cur = [];
    };
    for (const o of pts) {
      if (cur.length && o.c - cur[cur.length - 1].c > MERGE) flush();
      cur.push(o);
    }
    flush();
  }
  cand.sort((a, b) => b.score - a.score);
  if (!cand.length) return [];
  const out = [];
  while (out.length < count && cand.length) {
    let idx = -1;
    for (let i = 0; i < cand.length; i++) {
      const c = cand[i];
      if (out.every(o => o.axis !== c.axis || Math.abs(o.coord - c.coord) >= MINSEP)) {
        idx = i;
        break;
      }
    }
    if (idx < 0) break;
    out.push(cand[idx]);
    cand.splice(idx, 1);
  }
  while (out.length < count) {
    const horiz = Math.random() < 0.5;
    out.push({ axis: horiz ? 'y' : 'x', coord: horiz ? P.y + rnd(-VW, VW) : P.x + rnd(-VW, VW) });
  }
  return out.map(o => ({ horiz: o.axis === 'y', coord: o.coord }));
}
const ORBN = [1, 1, 2, 2, 3, 3, 4, 4],
  TESN = [1, 1, 2, 2, 3, 3, 4, 4],
  LASN = [1, 1, 2, 2, 2, 3, 3, 4];
function wstats(w) {
  const def = WEAPONS[w.id];
  const b = def.lv[w.lvl - 1];
  const s = { dmg: b.dmg, cd: b.cd, area: b.area || 1 };
  if (b.speed) s.speed = b.speed;
  if (b.pierce !== undefined) s.pierce = b.pierce;
  if (b.dur) s.dur = b.dur;
  if (b.both) s.both = 1;
  if (b.wave2) s.wave2 = 1;
  if (def.counts) s.count = (b.count || 1) + P.amount;
  if (w.id === 'orbit') s.count = ORBN[w.lvl - 1] + P.amount;
  if (w.id === 'tesla') s.count = TESN[w.lvl - 1] + P.amount;
  if (w.id === 'laser') s.count = LASN[w.lvl - 1] + P.amount;
  if (w.ev && def.evo) {
    const e = def.evo;
    if (e.dmg) s.dmg *= e.dmg;
    if (e.area) s.area *= e.area;
    if (e.count) s.count += e.count;
    if (e.pierce !== undefined) s.pierce = e.pierce;
    if (e.crit) s.crit = e.crit;
    if (e.vamp) s.vamp = e.vamp;
    if (e.perm) s.perm = true;
    if (e.chain) {
      s.chain = true;
      s.stun = true;
    }
    if (e.push) s.push = true;
    if (e.spin) s.spin = e.spin;
    if (e.strikes) s.count += e.strikes;
    if (e.beams) s.count += e.beams;
    if (e.burn) s.burn = true;
    if (e.explode) s.explode = e.explode;
    if (e.pull) s.pull = true;
    if (e.dur) s.dur *= e.dur;
  }
  if (w.hyper) {
    s.dmg *= 1.35;
    s.area *= 1.2;
    s.cd *= 0.9;
  }
  if (w.hyperB) {
    s.dmg *= 1 + 0.1 * w.hyperB;
    s.area *= 1 + 0.1 * w.hyperB;
  }
  if (w.mk) {
    s.dmg *= 1 + 0.03 * w.mk;
    const k = KEYSTATS[w.id];
    if (k === 'dmg') s.dmg *= 1 + 0.06 * w.mk;
    else if (k === 'area') s.area *= 1 + 0.05 * w.mk;
    else if (k === 'cd') s.cd *= Math.pow(0.975, w.mk);
    else if (k === 'speed' && s.speed) s.speed *= 1 + 0.05 * w.mk;
    else if (k === 'dur' && s.dur) s.dur *= 1 + 0.08 * w.mk;
  }
  s.dmg *= P.dmgMul;
  s.area *= P.areaMul;
  s.cd *= P.cdMul;
  if (s.speed) s.speed *= P.projMul;
  if (s.dur) s.dur *= P.durMul;
  return s;
}
function updatePlayer(dt) {
  const d = inputDir();
  if (d.x || d.y) {
    P.aim.x = d.x;
    P.aim.y = d.y;
    P.x += d.x * P.spd * dt;
    P.y += d.y * P.spd * dt;
  }
  P.iv = Math.max(0, P.iv - dt);
  if (P.regen > 0) P.hp = Math.min(P.maxhp, P.hp + P.regen * dt);
}
function updWeapons(dt) {
  for (const w of P.weapons) updOne(w, dt);
}
function updOne(w, dt) {
  const s = wstats(w);
  if (w.hyper) {
    updHyper(w, s, dt);
    return;
  } /* гипер-атака заменяет обе атаки пары */
  if (w.id === 'orbit') {
    updOrbit(w, s, dt);
    return;
  }
  if (w.id === 'aura') {
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer = s.cd;
      doAura(w, s);
    }
    return;
  }
  if (w.pend) {
    w.pend.t -= dt;
    if (w.pend.t <= 0) {
      doSlash(w, s, w.pend.side);
      w.pend = null;
    }
  }
  w.timer -= dt;
  if (w.timer <= 0) {
    w.timer = s.cd;
    fireWeapon(w, s);
  }
}
function updOrbit(w, s, dt) {
  if (!w.active) {
    w.timer -= dt;
    if (w.timer <= 0) {
      w.active = true;
      w.life = s.perm ? 1e9 : s.dur;
      w.ang = 0;
      w.n = s.count;
      w.or = 80 * s.area;
      if (!w.rehit) w.rehit = new Map();
    }
    return;
  }
  w.ang += 3.1 * (s.spin || 1) * dt;
  w.life -= dt;
  w.dmg = s.dmg;
  w.or = 80 * s.area;
  w.n = s.count;
  const orbR = 14 * s.area;
  for (let i = 0; i < w.n; i++) {
    const a = w.ang + (i * TAU) / w.n;
    const ox = P.x + Math.cos(a) * w.or,
      oy = P.y + Math.sin(a) * w.or;
    for (const e of gridNear(ox, oy, orbR + 18)) {
      if (e.hp <= 0) continue;
      if (dist2(e.x, e.y, ox, oy) < (orbR + e.r) * (orbR + e.r)) {
        const last = w.rehit.get(e.uid) || -9;
        if (run.t - last > 0.5) {
          w.rehit.set(e.uid, run.t);
          hurtEnemy(e, s.dmg, s);
        }
      }
    }
  }
  if (w.life <= 0) {
    w.active = false;
    w.timer = s.cd;
  }
}
/* ================= HYPER ATTACKS ================= */
/* гипер-форма заменяет обе атаки пары целиком; статы — от оружия-носителя (эво + гипер + МОДы) */
function updHyper(w, s, dt) {
  if (w.timer === undefined) w.timer = 0.5;
  switch (w.id) {
    case 'whip': {
      /* ДЕБАГГЕР: лезвие-карусель + залпы форков */
      if (!w.rehit) w.rehit = new Map();
      w.bladeA = (w.bladeA || 0) + 2.7 * dt;
      const R = 88 * s.area,
        br = 32 * s.area;
      w.bladeR = R;
      const bx = P.x + Math.cos(w.bladeA) * R,
        by = P.y + Math.sin(w.bladeA) * R;
      for (const e of gridNear(bx, by, br + 18)) {
        if (e.hp <= 0) continue;
        if (dist2(e.x, e.y, bx, by) < (br + e.r) * (br + e.r)) {
          const last = w.rehit.get(e.uid) || -9;
          if (run.t - last > 0.4) {
            w.rehit.set(e.uid, run.t);
            hurtEnemy(e, s.dmg, s);
          }
        }
      }
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = s.cd * 1.1;
        for (let i = 0; i < 10; i++) {
          const a = w.bladeA + (i * TAU) / 10;
          bullets.push({
            kind: 'knife',
            x: P.x,
            y: P.y,
            vx: Math.cos(a) * 430,
            vy: Math.sin(a) * 430,
            r: 6.5 * s.area,
            dmg: s.dmg * 0.55,
            pierce: 99,
            hit: new Set(),
            life: 2.0,
            ang: a,
            homing: 1,
          });
        }
        sfx('shoot');
      }
      break;
    }
    case 'tesla': {
      /* СВЕРХПРОВОД: крест плазмы, каждый луч бьёт цепной молнией */
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = s.cd;
        if (!enemies.length) break;
        const beams = laserAim(4);
        for (const b of beams) {
          fx.push({
            type: 'laser',
            horiz: b.horiz,
            coord: b.coord,
            w: 22 * s.area,
            life: 0.4,
            T: 0.4,
            fired: false,
            dmg: s.dmg * 0.8,
            slow: true,
            col: '#9db4ff',
          });
          for (const e of enemies) {
            if (e.hp <= 0) continue;
            const onLine = b.horiz ? Math.abs(e.y - b.coord) < 30 : Math.abs(e.x - b.coord) < 30;
            if (onLine && dist2(e.x, e.y, P.x, P.y) < 560 * 560) {
              boltStrike(e.x, e.y, s.dmg * 0.6, 60 * s.area, s, false);
              break;
            }
          }
        }
        sfx('shoot');
      }
      break;
    }
    case 'aura': {
      /* ПАНИКА ЯДРА: огненное ядро + имплозия */
      if (w.impT === undefined) w.impT = 3.4;
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = 0.45;
        const s2 = Object.assign({}, s);
        s2.push = false; /* имплозия тянет ВНУТРЬ — стена не выталкивает */
        doAura(w, s2, 118 * s.area);
      }
      w.impT -= dt;
      if (w.impT <= 0) {
        w.impT = 3.4;
        explosion(P.x, P.y, 175 * s.area, s.dmg * 2.2, true);
        shake += 8;
      }
      break;
    }
    case 'axe': {
      /* ПЯТНИЧНЫЙ ДЕПЛОЙ: ковровая бомбардировка с детонацией */
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = s.cd * 1.15;
        const A = aimFor('strongest');
        const ba = A ? Math.atan2(A.y, A.x) : rnd(TAU);
        for (let i = 0; i < 7; i++) {
          const a = i < 4 ? ba + rnd(-0.6, 0.6) : rnd(TAU),
            d = rnd(220, 460);
          bullets.push({
            kind: 'lob',
            x: P.x,
            y: P.y,
            tx: P.x + Math.cos(a) * d,
            ty: P.y + Math.sin(a) * d,
            t: 0,
            T: 0.8,
            poolR: 38 * s.area,
            poolDur: 1.6,
            dmg: s.dmg * 0.4,
            pull: false,
            col: '#fbbf24',
            explodeR: 105 * s.area,
          });
        }
        sfx('shoot');
      }
      break;
    }
    case 'boom': {
      /* ПЕРЕПОЛНЕНИЕ СТЕКА: лезвия делятся при попаданиях */
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = s.cd * 0.85;
        const A = aimFor(PRIO.boom) || P.aim,
          base = Math.atan2(A.y, A.x);
        for (let i = 0; i < 3; i++) {
          const a = base + (i - 1) * 0.5;
          bullets.push({
            kind: 'boom',
            x: P.x,
            y: P.y,
            dx: Math.cos(a),
            dy: Math.sin(a),
            spd: 560,
            r: 20 * s.area,
            dmg: s.dmg * 0.9,
            life: 6,
            rot: 0,
            rehit: new Map(),
            rIv: 0.3,
            sawLook: 1,
            split: 1,
            kids: 0,
          });
        }
        sfx('shoot');
      }
      break;
    }
    case 'orbit': {
      /* ПУБЛИЧНОЕ ОБЛАКО: орбитальный рой обстреливает всё вокруг */
      if (!w.active) {
        w.active = true;
        w.rehit = new Map();
        w.ang = 0;
      }
      w.life = 1e9;
      w.n = 8;
      w.or = 105 * s.area;
      w.ang += 2.2 * dt;
      const orbR = 12 * s.area;
      for (let i = 0; i < 8; i++) {
        const a = w.ang + (i * TAU) / 8;
        const ox = P.x + Math.cos(a) * w.or,
          oy = P.y + Math.sin(a) * w.or;
        for (const e of gridNear(ox, oy, orbR + 18)) {
          if (e.hp <= 0) continue;
          if (dist2(e.x, e.y, ox, oy) < (orbR + e.r) * (orbR + e.r)) {
            const last = w.rehit.get(e.uid) || -9;
            if (run.t - last > 0.5) {
              w.rehit.set(e.uid, run.t);
              hurtEnemy(e, s.dmg, s);
            }
          }
        }
      }
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = 0.95;
        for (let i = 0; i < 8; i++) {
          const a = w.ang + (i * TAU) / 8;
          const sx = P.x + Math.cos(a) * w.or,
            sy = P.y + Math.sin(a) * w.or;
          const t = pickThreat(sx, sy, 420);
          const fa = t ? Math.atan2(t.y - sy, t.x - sx) : a;
          bullets.push({
            kind: 'knife',
            x: sx,
            y: sy,
            vx: Math.cos(fa) * 440,
            vy: Math.sin(fa) * 440,
            r: 6 * s.area,
            dmg: s.dmg * 0.5,
            pierce: 3,
            hit: new Set(),
            life: 1.8,
            ang: fa,
            homing: 1,
          });
        }
        sfx('shoot');
      }
      break;
    }
    case 'flask': {
      /* НЕСТАБИЛЬНАЯ СБОРКА: воронки детонируют под врагами */
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = s.cd * 0.9;
        const A2 = aimFor('nearest') || P.aim,
          ba2 = Math.atan2(A2.y, A2.x); /* НЕСТАБИЛЬНАЯ СБОРКА: воронки летят к багам */
        for (let i = 0; i < 3; i++) {
          const a = ba2 + rnd(-0.5, 0.5),
            d = rnd(150, 330);
          bullets.push({
            kind: 'lob',
            x: P.x,
            y: P.y,
            tx: P.x + Math.cos(a) * d,
            ty: P.y + Math.sin(a) * d,
            t: 0,
            T: 0.7,
            poolR: 85 * s.area,
            poolDur: 2.6 * s.dur,
            dmg: s.dmg,
            pull: true,
            pullS: 50,
            col: '#a78bfa',
            detT: 1.1,
          });
        }
        sfx('shoot');
      }
      break;
    }
    case 'shur': {
      /* СКАНЕР 0-ДНЕЙ: шрапнель по кругу + рельса по жирному */
      if (w.sT === undefined) w.sT = 0.5;
      if (w.rT === undefined) w.rT = 1.0;
      w.sT -= dt;
      if (w.sT <= 0) {
        w.sT = Math.max(0.3, s.cd * 0.5);
        w.rv = (w.rv || 0) + 0.31;
        for (let i = 0; i < 14; i++) {
          const a = w.rv + (i * TAU) / 14;
          bullets.push({
            kind: 'shur',
            x: P.x,
            y: P.y,
            vx: Math.cos(a) * 560,
            vy: Math.sin(a) * 560,
            r: 6 * s.area,
            dmg: s.dmg * 0.55,
            pierce: 99,
            hit: new Set(),
            life: 1.7,
            ang: a,
            rot: rnd(TAU),
          });
        }
        sfx('shoot');
      }
      w.rT -= dt;
      if (w.rT <= 0) {
        w.rT = s.cd;
        const A = aimFor('strongest');
        if (A) railShot(Math.atan2(A.y, A.x), 940, 17 * s.area, s.dmg * 1.4, '#7ef29a');
      }
      break;
    }
  }
}
/* РЕФАКТОР: сторона взмаха — где реально есть баги. Взвешенный скан по широкой полосе:
   обычный прицел не видит дальше ~560px, а толпа при кайтинге как раз за этим радиусом.
   Ближние баги весят больше; пусто с обеих сторон — рубим по направлению бега. */
function whipSide() {
  let l = 0,
    r = 0;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - P.x;
    if (Math.abs(dx) < 40 || Math.abs(dx) > 860)
      continue; /* прямо сверху/снизу и слишком далеко — не аргумент для горизонтального взмаха */
    const wgt = 1 / (1 + Math.hypot(dx, e.y - P.y) / 260);
    if (dx < 0) l += wgt;
    else r += wgt;
  }
  if (l === r) return P.aim.x >= 0 ? 1 : -1;
  return l > r ? -1 : 1;
}
function fireWeapon(w, s) {
  const A = aimFor(PRIO[w.id]) || P.aim,
    base = Math.atan2(A.y, A.x);
  switch (w.id) {
    case 'whip': {
      if (w.ev) {
        /* БРЕЙКПОЙНТ: крест из четырёх клинков — базовый взмах больше не используется */
        for (const sd of [1, -1]) {
          doSlash(w, s, sd);
          doSlash(w, s, sd, true);
        }
        sfx('shoot');
        break;
      }
      const sides = s.both ? [1, -1] : [whipSide()];
      for (const sd of sides) doSlash(w, s, sd);
      if (s.wave2) w.pend = { t: 0.28, side: -sides[0] };
      sfx('shoot');
      break;
    }
    case 'knife': {
      if (w.ev) {
        /* ТЫСЯЧА ФОРКОВ: кольцо на 360° */
        w.rv = (w.rv || 0) + 0.45;
        for (let i = 0; i < s.count; i++) {
          const a = w.rv + (i * TAU) / s.count;
          bullets.push({
            kind: 'knife',
            x: P.x,
            y: P.y,
            vx: Math.cos(a) * s.speed,
            vy: Math.sin(a) * s.speed,
            r: 7 * s.area,
            dmg: s.dmg,
            pierce: 99,
            hit: new Set(),
            life: 2.2,
            ang: a,
          });
        }
        sfx('shoot');
        break;
      }
      for (let i = 0; i < s.count; i++) {
        const a = base + 0.09 * (i - (s.count - 1) / 2);
        bullets.push({
          kind: 'knife',
          x: P.x,
          y: P.y,
          vx: Math.cos(a) * s.speed,
          vy: Math.sin(a) * s.speed,
          r: 6 * s.area,
          dmg: s.dmg,
          pierce: s.pierce,
          hit: new Set(),
          life: 1.8,
          ang: a,
        });
      }
      sfx('shoot');
      break;
    }
    case 'tesla':
      doTesla(w, s);
      break;
    case 'axe': {
      for (let i = 0; i < s.count; i++) {
        bullets.push({
          kind: 'axe',
          x: P.x,
          y: P.y,
          vx: A.x * 170 + rnd(-60, 60),
          vy: -430 - rnd(0, 60),
          grav: 900,
          r: 15 * s.area,
          dmg: s.dmg,
          pierce: s.pierce,
          hit: new Set(),
          life: 3,
          rot: rnd(TAU),
          explode: w.ev ? 95 * s.area : 0,
        }); /* ЯДЕРНЫЙ ДЕПЛОЙ: детонация при попадании */
      }
      sfx('shoot');
      break;
    }
    case 'boom': {
      const throwW = mul => {
        for (let i = 0; i < s.count; i++) {
          const a = base + mul * ((i - (s.count - 1) / 2) * 0.5);
          bullets.push({
            kind: 'boom',
            x: P.x,
            y: P.y,
            dx: Math.cos(a),
            dy: Math.sin(a),
            spd: s.speed,
            r: 14 * s.area,
            dmg: s.dmg,
            life: 6,
            rot: 0,
            rehit: new Map(),
            rIv: w.ev ? 0.3 : 0.45,
          });
        }
      };
      throwW(1);
      if (w.ev) throwW(-1); /* ОТКАТ 2.0: зеркальная вторая волна */
      sfx('shoot');
      break;
    }
    case 'flask': {
      /* СБРОС КЭША: фляга летит в сторону ближайших багов (защита игрока) */
      for (let i = 0; i < s.count; i++) {
        const a = base + rnd(-0.55, 0.55),
          d = rnd(140, 300);
        bullets.push({
          kind: 'lob',
          x: P.x,
          y: P.y,
          tx: P.x + Math.cos(a) * d,
          ty: P.y + Math.sin(a) * d,
          t: 0,
          T: 0.65,
          poolR: 60 * s.area,
          poolDur: s.dur,
          dmg: s.dmg,
          pull: !!s.pull,
          pullS: w.ev ? 46 : 0,
        });
      }
      sfx('shoot');
      break;
    }
    case 'laser': {
      if (!enemies.length) break;
      const beams = laserAim(s.count);
      for (const b of beams)
        fx.push({
          type: 'laser',
          horiz: b.horiz,
          coord: b.coord,
          w: 16 * s.area,
          life: 0.4,
          T: 0.4,
          fired: false,
          dmg: s.dmg,
          slow: !!w.ev,
          col: w.ev ? '#a78bfa' : '#f87171',
        }); /* КВАНТОВЫЙ ЛАЗЕР: широкие фиолетовые лучи-замедлители */
      if (beams.length) sfx('shoot');
      break;
    }
    case 'fire': {
      if (w.ev) {
        /* СИНГУЛЯРНОСТЬ: одна чёрная бомба */
        const t = pickThreat(P.x, P.y, 560);
        const a = t ? Math.atan2(t.y - P.y, t.x - P.x) : rnd(TAU);
        bullets.push({
          kind: 'fire',
          x: P.x,
          y: P.y,
          vx: Math.cos(a) * s.speed * 0.5,
          vy: Math.sin(a) * s.speed * 0.5,
          r: 20 * s.area,
          dmg: s.dmg,
          pierce: 99,
          hit: new Set(),
          life: 3.0,
          explode: 150 * s.area,
          pull: true,
          dark: 1,
        });
        sfx('shoot');
        break;
      }
      for (let i = 0; i < s.count; i++) {
        const t = pickThreat(P.x, P.y, 520);
        let a = t ? Math.atan2(t.y - P.y, t.x - P.x) : rnd(TAU);
        a += rnd(-0.08, 0.08);
        bullets.push({
          kind: 'fire',
          x: P.x,
          y: P.y,
          vx: Math.cos(a) * s.speed,
          vy: Math.sin(a) * s.speed,
          r: 9 * s.area,
          dmg: s.dmg,
          pierce: s.pierce,
          hit: new Set(),
          life: 2.4,
          explode: 44 * s.area,
          pull: false,
        });
      }
      sfx('shoot');
      break;
    }
    case 'drone': {
      for (let i = 0; i < s.count; i++) {
        const a = base + rnd(-0.15, 0.15);
        bullets.push({
          kind: 'knife',
          x: P.x,
          y: P.y,
          vx: Math.cos(a) * s.speed,
          vy: Math.sin(a) * s.speed,
          r: 7 * s.area,
          dmg: s.dmg,
          pierce: s.pierce,
          hit: new Set(),
          life: 2.6,
          ang: a,
          homing: 1,
          split: w.ev ? 2 : 0,
        }); /* РОЙ ДРОНОВ: погибший дрон делится надвое */
      }
      sfx('shoot');
      break;
    }
    case 'shur': {
      if (w.ev) {
        /* ХОТФИКС-ШТОРМ: шквал по кругу */
        w.rv = (w.rv || 0) + 0.37;
        for (let i = 0; i < s.count; i++) {
          const a = w.rv + (i * TAU) / s.count;
          bullets.push({
            kind: 'shur',
            x: P.x,
            y: P.y,
            vx: Math.cos(a) * s.speed,
            vy: Math.sin(a) * s.speed,
            r: 6 * s.area,
            dmg: s.dmg,
            pierce: 99,
            hit: new Set(),
            life: 1.8,
            ang: a,
            rot: rnd(TAU),
          });
        }
        sfx('shoot');
        break;
      }
      for (let i = 0; i < s.count; i++) {
        const a = base + 0.16 * (i - (s.count - 1) / 2);
        bullets.push({
          kind: 'shur',
          x: P.x,
          y: P.y,
          vx: Math.cos(a) * s.speed,
          vy: Math.sin(a) * s.speed,
          r: 6 * s.area,
          dmg: s.dmg,
          pierce: s.pierce,
          hit: new Set(),
          life: 1.6,
          ang: a,
          rot: rnd(TAU),
        });
      }
      sfx('shoot');
      break;
    }
    case 'xbow': {
      if (w.ev) {
        /* E2E-СЮИТ: сквозная рельса мгновенно, без снаряда */
        railShot(base, 940, 15 * s.area, s.dmg, '#eafff3');
        break;
      }
      for (let i = 0; i < s.count; i++) {
        const a = base + 0.06 * (i - (s.count - 1) / 2);
        bullets.push({
          kind: 'knife',
          x: P.x,
          y: P.y,
          vx: Math.cos(a) * s.speed,
          vy: Math.sin(a) * s.speed,
          r: 10 * s.area,
          dmg: s.dmg,
          pierce: s.pierce,
          hit: new Set(),
          life: 1.8,
          ang: a,
          big: 1,
        });
      }
      sfx('shoot');
      break;
    }
    case 'saw': {
      for (let i = 0; i < s.count; i++) {
        const a = base + (i - (s.count - 1) / 2) * 0.4;
        bullets.push({
          kind: 'saw',
          x: P.x,
          y: P.y,
          vx: Math.cos(a) * (w.ev ? 300 : 260),
          vy: Math.sin(a) * (w.ev ? 300 : 260) - (w.ev ? 0 : 30),
          grav: w.ev ? 0 : 55,
          r: 13 * s.area,
          dmg: s.dmg,
          pierce: s.pierce,
          hit: new Set(),
          life: s.dur || 2.2,
          rot: rnd(TAU),
          homing: w.ev ? 1 : 0,
        }); /* ДЕФРАГМЕНТАТОР: диски сами наводятся */
      }
      sfx('shoot');
      break;
    }
    case 'mortar': {
      for (let i = 0; i < s.count; i++) {
        const a = w.ev ? base + rnd(-0.55, 0.55) : base + rnd(-0.95, 0.95),
          d = rnd(260, 430); /* РОЛЛБЕК: база — широкий конус к багам, эво — точный ковёр */
        bullets.push({
          kind: 'lob',
          x: P.x,
          y: P.y,
          tx: P.x + Math.cos(a) * d,
          ty: P.y + Math.sin(a) * d,
          t: 0,
          T: 0.8,
          poolR: 62 * s.area,
          poolDur: s.dur,
          dmg: s.dmg,
          pull: !!s.pull,
          col: '#fbbf24',
        });
      }
      sfx('shoot');
      break;
    }
    case 'mines': {
      if (w.ev) {
        /* ДЕПРЕКАЦИЯ: мины целятся — ложатся под ноги ближайшим багам (вес к ближним),
          а не в мёртвую точку под углом 0. Вокруг чисто — обычное оборонительное кольцо.
          Количество не трогаем (1 + ПАРАЛЛЕЛИЗМ): сила эво в точности броска, а не в заторе мин. */
        for (let i = 0; i < s.count; i++) {
          const t = pickThreat(P.x, P.y, 400);
          let tx, ty;
          if (t) {
            const ja = rnd(TAU),
              jd = rnd(0, 26);
            tx = t.x + Math.cos(ja) * jd;
            ty = t.y + Math.sin(ja) * jd;
          } else {
            const a = rnd(TAU),
              d = 105 * s.area + rnd(-10, 10);
            tx = P.x + Math.cos(a) * d;
            ty = P.y + Math.sin(a) * d;
          }
          bullets.push({
            kind: 'lob',
            x: P.x,
            y: P.y,
            tx,
            ty,
            t: 0,
            T: 0.5,
            poolR: 55 * s.area,
            poolDur: s.dur,
            dmg: s.dmg,
            pull: false,
            col: '#94a3b8',
          });
        }
        sfx('shoot');
        break;
      }
      for (let i = 0; i < s.count; i++) {
        const a = rnd(TAU),
          d = rnd(50, 130);
        bullets.push({
          kind: 'lob',
          x: P.x,
          y: P.y,
          tx: P.x + Math.cos(a) * d,
          ty: P.y + Math.sin(a) * d,
          t: 0,
          T: 0.5,
          poolR: 42 * s.area,
          poolDur: s.dur,
          dmg: s.dmg,
          pull: false,
          col: '#94a3b8',
        });
      }
      sfx('shoot');
      break;
    }
  }
}
function doSlash(w, s, side, vert) {
  const L = 150 * s.area,
    Wd = 64 * s.area;
  let x0, x1, y0, y1, fxo;
  if (vert) {
    /* вертикальный клинок (для креста БРЕЙКПОЙНТА) */
    const oy = side * (55 + L / 2);
    x0 = P.x - Wd / 2;
    x1 = P.x + Wd / 2;
    y0 = P.y + oy - L / 2;
    y1 = P.y + oy + L / 2;
    fxo = { type: 'slash', x: P.x, y: P.y + oy, w: Wd, h: L, vert: 1, side, life: 0.18, T: 0.18 };
  } else {
    const ox = side * (55 + L / 2);
    x0 = P.x + ox - L / 2;
    x1 = P.x + ox + L / 2;
    y0 = P.y - Wd / 2;
    y1 = P.y + Wd / 2;
    fxo = { type: 'slash', x: P.x + ox, y: P.y, w: L, h: Wd, side, life: 0.18, T: 0.18 };
  }
  let hits = 0;
  for (const e of gridNear(P.x, P.y, Math.max(L, Wd) / 2 + 120)) {
    if (e.hp > 0 && e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1) {
      if (hurtEnemy(e, s.dmg, s)) hits++;
    }
  }
  if (s.vamp && hits > 0) P.hp = Math.min(P.maxhp, P.hp + s.vamp * hits);
  fx.push(fxo);
}
function doTesla(w, s) {
  let struck = 0;
  for (let i = 0; i < s.count; i++) {
    const t = pickThreat(P.x, P.y, 520);
    if (!t) break;
    boltStrike(t.x, t.y, s.dmg, 60 * s.area, s, false);
    if (s.chain) {
      const near = gridNear(t.x, t.y, 160)
        .filter(e => e !== t && e.hp > 0)
        .slice(0, 3);
      for (const e2 of near) boltStrike(e2.x, e2.y, s.dmg * 0.5, 40 * s.area, s, true);
    }
    struck++;
  }
  if (struck) sfx('shoot');
}
function boltStrike(x, y, dmg, r, opts, small) {
  for (const e of gridNear(x, y, r + 20)) {
    if (e.hp > 0 && dist2(e.x, e.y, x, y) < r * r) {
      hurtEnemy(e, dmg, opts);
      if (opts.stun) e.slowT = Math.max(e.slowT, 0.55); /* цепная молния СТАТИКИ оглушает */
    }
  }
  fx.push({ type: 'bolt', pts: boltPts(x, y, small ? 120 : 260), life: 0.22, T: 0.22 });
  fx.push({ type: 'ring', x, y, r0: 6, r1: r, life: 0.25, T: 0.25, col: '#9db4ff' });
}
function railShot(a, len, wid, dmg, col) {
  /* сквозной хитскан: мгновенный луч, без снаряда */
  const dx = Math.cos(a),
    dy = Math.sin(a),
    w2 = wid / 2;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const ex = e.x - P.x,
      ey = e.y - P.y,
      t = ex * dx + ey * dy;
    if (t < -e.r || t > len) continue;
    const px = ex - dx * t,
      py = ey - dy * t;
    if (px * px + py * py < (w2 + e.r) * (w2 + e.r)) hurtEnemy(e, dmg, {});
  }
  fx.push({ type: 'rail', x: P.x, y: P.y, a, len, wid, life: 0.28, T: 0.28, col: col || '#eafff3' });
  sfx('shoot');
}
function boltPts(x, y, h) {
  const pts = [[x + rnd(-30, 30), y - h]];
  for (let i = 1; i <= 4; i++) pts.push([x + rnd(-26, 26), y - h + (h * i) / 4]);
  pts.push([x, y]);
  return pts;
}
function doAura(w, s, R) {
  const R2 = R || (78 + w.lvl * 8) * s.area;
  w.auraR = R2;
  for (const e of gridNear(P.x, P.y, R2 + 20)) {
    if (e.hp > 0 && dist2(e.x, e.y, P.x, P.y) < R2 * R2) {
      hurtEnemy(e, s.dmg, s);
      e.slowT = Math.max(e.slowT, 0.6);
      if (s.burn) {
        e.burnT = 2;
        e.burnS = s.dmg * 0.5;
      }
      if (s.push) {
        /* ФАЙРВОЛ: выталкивает из круга; боссы/элитки сопротивляются — сила падает с накоплением dispRes */
        const heavy = e.boss || e.elite;
        const k = heavy ? 1 - (e.dispRes || 0) : 1;
        const dx = e.x - P.x,
          dy = e.y - P.y,
          d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * 30 * k;
        e.y += (dy / d) * 30 * k;
        if (heavy) {
          e.dispRes = Math.min(0.9, (e.dispRes || 0) + (e.boss ? 0.18 : 0.11));
          e.dispT = true;
        }
      }
    }
  }
  if (s.push) fx.push({ type: 'ring', x: P.x, y: P.y, r0: R2, r1: R2 * 1.14, life: 0.3, T: 0.3, col: '#fbbf24' });
}
/* случайная цель среди ближних к (x,y) с весом защиты игрока: чем ближе баг к ИГРОКУ,
   тем выше его вес (1/(1+дист/200)) — «случайные» оружия (СТАТИКА, БЁРН-ТЕСТ, дроны
   ПУБЛИЧНОГО ОБЛАКА) в итоге приоритизируют угрозы у самого агента */
function pickThreat(x, y, maxD) {
  const cand = [];
  for (const e of enemies) {
    if (e.hp > 0 && dist2(e.x, e.y, x, y) < maxD * maxD) {
      cand.push(e);
      if (cand.length >= 14) break;
    }
  }
  if (!cand.length) return null;
  let tot = 0;
  const ws = cand.map(e => {
    const v = 1 / (1 + Math.sqrt(dist2(e.x, e.y, P.x, P.y)) / 200);
    tot += v;
    return v;
  });
  let r = Math.random() * tot;
  for (let i = 0; i < cand.length; i++) {
    r -= ws[i];
    if (r <= 0) return cand[i];
  }
  return cand[cand.length - 1];
}
/* прицел по приоритету оружия: nearest / strongest / weakest / random.
   Приоритет — не только «описанное» поведение, но и дистанция: близость цели
   входит в вес (далёкий баг — не цель), а радиус поиска не больше видимой зоны */
function aimFor(prio) {
  const R = Math.min(560, Math.hypot(W, H) * 0.4),
    R2 = R * R; /* ~0.8 полудиагонали экрана */
  let best = null,
    bv = 0;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const d2v = dist2(e.x, e.y, P.x, P.y);
    if (d2v > R2) continue;
    const prox = 1 / (1 + Math.sqrt(d2v) / 300); /* 1 у ног агента, ~0.35 на краю зоны */
    let v;
    if (prio === 'strongest') v = e.hp * prox; /* жирный, но близкий — дальний танок проигрывает */
    else if (prio === 'weakest') v = prox / (e.hp + 10); /* слабый И близкий — мелочь за краем экрана не приоритетна */
    else if (prio === 'random') v = Math.random();
    else v = -d2v;
    if (best === null || v > bv) {
      best = e;
      bv = v;
    }
  }
  if (!best) return null;
  const dx = best.x - P.x,
    dy = best.y - P.y,
    d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}
function hurtPlayer(d) {
  if (P.iv > 0) return;
  P.iv = 0.3;
  const dmg = Math.max(1, Math.round(d - P.armor));
  P.hp -= dmg;
  dmgNum(P.x, P.y - 20, dmg, '#f87171');
  shake += 3;
  sfx('hurt');
  if (P.hp <= 0) {
    if (P.revive > 0) {
      P.revive--;
      P.hp = Math.ceil(P.maxhp * 0.5);
      P.iv = 2.5;
      aoeDamage(P.x, P.y, 260, 300);
      fx.push({ type: 'ring', x: P.x, y: P.y, r0: 20, r1: 280, life: 0.5, T: 0.5, col: '#38e07f' });
      note(P.x, P.y - 38, '👼 ВОСКРЕШЕНИЕ!');
      sfx('evo');
    } else endRun(false);
  }
}
function aoeDamage(x, y, r, dmg) {
  for (const e of gridNear(x, y, r + 30)) {
    if (e.hp > 0 && dist2(e.x, e.y, x, y) < r * r) hurtEnemy(e, dmg, {});
  }
}

/* ================= MAIN UPDATE ================= */
function update(dt) {
  run.t += dt;
  updatePlayer(dt);
  updWeapons(dt);
  gridRebuild();
  updBullets(dt);
  updateEnemies(dt);
  updPools(dt);
  updPickups(dt);
  updFx(dt);
  director(dt);
  cam.x = P.x;
  cam.y = P.y;
  shake = Math.max(0, Math.min(shake, 16) - 30 * dt); /* кап: тряска не копится бесконечно */
  updateHUD(dt);
}
function updateHUD(dt) {
  $('xpbar').style.width = clamp((P.xp / P.need) * 100, 0, 100) + '%';
  const hpr = clamp(P.hp / P.maxhp, 0, 1);
  const hb = $('hpbar');
  hb.style.width = hpr * 100 + '%';
  hb.classList.toggle('low', hpr < 0.35);
  hudTxtT -= dt;
  if (hudTxtT <= 0) {
    hudTxtT = 0.25;
    $('hudTimer').textContent = fmtT(run.t);
    $('lvlTag').textContent = 'LV ' + P.lvl;
    $('hudKills').textContent = '☠ ' + fmt(run.kills);
    $('hudCoins').textContent = '◉ ' + fmt(run.coins);
    $('hpText2').textContent = Math.max(0, Math.ceil(P.hp)) + '/' + P.maxhp;
  }
  if (run.boss && run.boss.hp > 0)
    $('bossBarFill').style.width = clamp((run.boss.hp / run.boss.maxhp) * 100, 0, 100) + '%';
}

/* ================= SPATIAL GRID ================= */
const CELL = 64;
let grid = new Map();
function gridRebuild() {
  grid.clear();
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const k = Math.floor(e.x / CELL) + ',' + Math.floor(e.y / CELL);
    let a = grid.get(k);
    if (!a) {
      a = [];
      grid.set(k, a);
    }
    a.push(e);
  }
}
function gridNear(x, y, r) {
  const out = [];
  const x0 = Math.floor((x - r) / CELL),
    x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL),
    y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++)
    for (let cy = y0; cy <= y1; cy++) {
      const a = grid.get(cx + ',' + cy);
      if (a) for (let i = 0; i < a.length; i++) out.push(a[i]);
    }
  return out;
}

/* ================= BULLETS ================= */
function steerB(b, dt) {
  /* самонаведение: к ближайшему врагу в радиусе 260 */
  let t = null,
    td = 260 * 260;
  for (const e of gridNear(b.x, b.y, 260)) {
    if (e.hp <= 0) continue;
    const dd = dist2(e.x, e.y, b.x, b.y);
    if (dd < td) {
      td = dd;
      t = e;
    }
  }
  if (t) {
    const cur = Math.atan2(b.vy, b.vx),
      want = Math.atan2(t.y - b.y, t.x - b.x);
    let da = want - cur;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    const na = cur + clamp(da, -5 * dt, 5 * dt),
      sp = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(na) * sp;
    b.vy = Math.sin(na) * sp;
    if (b.ang !== undefined) b.ang = na;
  }
}
function updBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    if (b.kind === 'axe' || b.kind === 'saw') {
      b.vy += b.grav * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += (b.kind === 'saw' ? 18 : 10) * dt;
      if (b.homing) steerB(b, dt); /* ДЕФРАГМЕНТАТОР: диски сами наводятся */
    } else if (b.kind === 'boom') {
      if (b.phase !== 'back') {
        b.spd -= 1300 * dt;
        if (b.spd <= 0) b.phase = 'back';
        b.x += b.dx * Math.max(0, b.spd) * dt;
        b.y += b.dy * Math.max(0, b.spd) * dt;
      } else {
        const dx = P.x - b.x,
          dy = P.y - b.y,
          d = Math.hypot(dx, dy) || 1;
        b.spd = Math.min(b.spd + 1600 * dt, 700);
        b.dx = dx / d;
        b.dy = dy / d;
        b.x += b.dx * b.spd * dt;
        b.y += b.dy * b.spd * dt;
        if (d < 26) {
          bullets.splice(i, 1);
          continue;
        }
      }
      b.rot += 14 * dt;
    } else if (b.kind === 'lob') {
      b.t += dt;
      if (b.t >= b.T) {
        pools.push({
          x: b.tx,
          y: b.ty,
          r: b.poolR,
          life: b.poolDur,
          T: b.poolDur,
          tick: 0,
          dmg: b.dmg,
          pull: b.pull,
          pullS: b.pullS || 0,
          col: b.col,
          detonate: b.detT || 0,
          dT: b.detT || 0,
          bdmg: b.dmg * 0.8,
        });
        if (b.explodeR)
          explosion(b.tx, b.ty, b.explodeR, b.dmg, !!b.pull); /* ПЯТНИЧНЫЙ ДЕПЛОЙ: детонация при падении */
        fx.push({ type: 'ring', x: b.tx, y: b.ty, r0: 6, r1: b.poolR, life: 0.3, T: 0.3, col: b.col || '#38e07f' });
        bullets.splice(i, 1);
        continue;
      }
    } else {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.homing) steerB(b, dt);
      if (b.kind === 'shur') b.rot += 16 * dt;
    }
    let dead = b.life <= 0;
    if (b.kind !== 'lob') {
      // collide
      for (const e of gridNear(b.x, b.y, b.r + 24)) {
        if (e.hp <= 0 || (b.hit && b.hit.has(e.uid))) continue;
        if (dist2(e.x, e.y, b.x, b.y) < (b.r + e.r) * (b.r + e.r)) {
          if (b.kind === 'boom') {
            const last = b.rehit.get(e.uid) || -9;
            if (run.t - last < (b.rIv || 0.45)) continue;
            b.rehit.set(e.uid, run.t);
            hurtEnemy(e, b.dmg, {});
            if (b.split && b.kids < 4 && Math.random() < 0.5) {
              /* ПЕРЕПОЛНЕНИЕ СТЕКА: лезвие делится */
              b.kids++;
              for (let k = 0; k < 2; k++) {
                const a2 = rnd(TAU);
                bullets.push({
                  kind: 'boom',
                  x: b.x,
                  y: b.y,
                  dx: Math.cos(a2),
                  dy: Math.sin(a2),
                  spd: 440,
                  r: b.r * 0.5,
                  dmg: b.dmg * 0.45,
                  life: 2.2,
                  rot: 0,
                  rehit: new Map(),
                  rIv: 0.35,
                  sawLook: 1,
                });
              }
            }
          } else {
            b.hit.add(e.uid);
            hurtEnemy(e, b.dmg, {});
            if (b.pierce !== undefined) b.pierce--;
            if (b.pierce < 0) {
              dead = true;
              break;
            }
          }
        }
      }
      if (dead && b.explode) {
        explosion(b.x, b.y, b.explode, b.dmg * 0.6, b.pull);
      }
    }
    if (dead && b.split && b.kind !== 'boom') {
      /* РОЙ ДРОНОВ: погибший дрон делится надвое */
      for (let k = 0; k < b.split; k++) {
        const a2 = rnd(TAU);
        bullets.push({
          kind: 'knife',
          x: b.x,
          y: b.y,
          vx: Math.cos(a2) * 260,
          vy: Math.sin(a2) * 260,
          r: 4.5,
          dmg: b.dmg * 0.45,
          pierce: 1,
          hit: new Set(),
          life: 0.7,
          ang: a2,
          homing: 1,
        });
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}
function explosion(x, y, r, dmg, pull) {
  if (pull) {
    for (const e of gridNear(x, y, r * 1.6)) {
      const dx = x - e.x,
        dy = y - e.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < r * 1.6 && e.hp > 0) {
        const heavy = e.boss || e.elite;
        const k = heavy ? 1 - (e.dispRes || 0) : 1; /* босс/элитка сопротивляются: тяга слабеет с накоплением dispRes */
        e.x += (dx / d) * 40 * k;
        e.y += (dy / d) * 40 * k;
        if (heavy) {
          e.dispRes = Math.min(0.9, (e.dispRes || 0) + (e.boss ? 0.35 : 0.21));
          e.dispT = true;
        }
      }
    }
  }
  aoeDamage(x, y, r, dmg, {});
  fx.push({ type: 'ring', x, y, r0: 8, r1: r, life: 0.35, T: 0.35, col: '#fbbf24' });
  burst(x, y, '#fbbf24', 14);
  shake += 4;
  sfx('boom');
}

/* ================= ENEMIES ================= */
function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp <= 0) {
      enemies.splice(i, 1);
      continue;
    }
    e.flash = Math.max(0, e.flash - dt);
    e.hitCd -= dt;
    e.slowT = Math.max(0, e.slowT - dt);
    if (e.boss || e.elite) {
      /* сопротивление смещению спадает, когда врага не смещают */
      if (e.dispT) e.dispT = false;
      else e.dispRes = Math.max(0, (e.dispRes || 0) - 0.1 * dt);
    }
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.hp -= e.burnS * dt;
      if (e.hp <= 0) {
        killEnemy(e);
        continue;
      }
    }
    if (e.surgeT > 0) e.surgeT = Math.max(0, e.surgeT - dt);
    const sl = (e.slowT > 0 ? 0.7 : 1) * timeSpd() * enemyPow() * (e.surgeT > 0 ? 1 + 0.8 * (e.surgeT / 6) : 1);
    const dx = P.x - e.x,
      dy = P.y - e.y,
      d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * e.spd * sl * dt;
    e.y += (dy / d) * e.spd * sl * dt;
    if (e.spawner) {
      e.spT -= dt;
      if (e.spT <= 0 && enemies.length < CAP_ENEMIES * timeSpd() * enemyPow()) {
        e.spT = 2.5;
        for (let k = 0; k < 2; k++) spawnEnemy('mini', e.x + rnd(-20, 20), e.y + rnd(-20, 20));
      }
    }
    if (d < e.r + P.r + 2 && e.hitCd <= 0) {
      e.hitCd = 0.85;
      hurtPlayer(e.dmg * enemyPow());
    }
  }
  // separation via grid cells
  for (const a of grid.values()) {
    const n = a.length;
    if (n < 2 || n > 28) continue;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const A = a[i],
          B = a[j];
        const dx = B.x - A.x,
          dy = B.y - A.y;
        const md = A.r + B.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < md * md && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = ((md - d) / d) * 0.35;
          A.x -= dx * push * 0.5;
          A.y -= dy * push * 0.5;
          B.x += dx * push * 0.5;
          B.y += dy * push * 0.5;
        }
      }
  }
}

/* ================= POOLS (flask) ================= */
function updPools(dt) {
  for (let i = pools.length - 1; i >= 0; i--) {
    const p = pools[i];
    p.life -= dt;
    p.tick -= dt;
    if (p.pull) {
      const ps = p.pullS || 30;
      for (const e of gridNear(p.x, p.y, p.r * 1.4)) {
        const dx = p.x - e.x,
          dy = p.y - e.y,
          d = Math.hypot(dx, dy) || 1;
        if (d < p.r * 1.4 && e.hp > 0) {
          const heavy = e.boss || e.elite;
          const k = heavy ? 1 - (e.dispRes || 0) : 1; /* босс/элитка привыкают к тяге: эффект есть, но не бесконечный */
          e.x += (dx / d) * ps * dt * k;
          e.y += (dy / d) * ps * dt * k;
          if (heavy) {
            e.dispRes = Math.min(0.9, (e.dispRes || 0) + (e.boss ? 0.12 : 0.07) * dt);
            e.dispT = true;
          }
        }
      }
    }
    if (p.detonate) {
      /* НЕСТАБИЛЬНАЯ СБОРКА: воронка детонирует под врагами */
      p.dT -= dt;
      if (p.dT <= 0) {
        p.dT = p.detonate;
        explosion(p.x, p.y, p.r * 0.85, p.bdmg || p.dmg, 0);
      }
    }
    if (p.tick <= 0) {
      p.tick = 0.4;
      for (const e of gridNear(p.x, p.y, p.r + 20)) {
        if (e.hp > 0 && dist2(e.x, e.y, p.x, p.y) < p.r * p.r) {
          hurtEnemy(e, p.dmg, {});
          e.slowT = Math.max(e.slowT, 0.4);
        }
      }
    }
    if (p.life <= 0) pools.splice(i, 1);
  }
}

/* ================= PICKUPS / GEMS ================= */
function spawnPickup(x, y, type) {
  pickups.push({ x, y, type, v: type === 'coin' ? Math.round(ri(1, 2) * rew()) : 0, ph: rnd(TAU) });
}
function addCoins(n, x, y) {
  for (let i = 0; i < n; i++) spawnPickup(x + rnd(-40, 40), y + rnd(-40, 40), 'coin');
}
function updPickups(dt) {
  // gems
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    const dx = P.x - g.x,
      dy = P.y - g.y;
    const d2v = dx * dx + dy * dy;
    if (g.mag || d2v < P.magnetR * P.magnetR) {
      g.mag = true;
    }
    if (g.mag) {
      const d = Math.sqrt(d2v) || 1;
      const sp = Math.min(900, 300 + 2400 / d);
      g.x += (dx / d) * sp * dt;
      g.y += (dy / d) * sp * dt;
      if (d < 22) {
        gems.splice(i, 1);
        gainXP(g.v);
        sfx('gem');
      }
    }
  }
  // pickups — радиус сбора действует и на монеты/бонусы/сундуки
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    const dx = P.x - p.x,
      dy = P.y - p.y;
    const d2v = dx * dx + dy * dy;
    if (p.mag || d2v < P.magnetR * P.magnetR) {
      const d = Math.sqrt(d2v) || 1;
      const sp = Math.min(760, 240 + 2000 / d);
      p.x += (dx / d) * sp * dt;
      p.y += (dy / d) * sp * dt;
    }
    if (d2v < 40 * 40) {
      pickups.splice(i, 1);
      switch (p.type) {
        case 'coin':
          run.coins += p.v;
          sfx('coin');
          break;
        case 'heal':
          P.hp = Math.min(P.maxhp, P.hp + P.maxhp * 0.3);
          note(P.x, P.y - 36, '🍗 +30% HP', '#38e07f');
          sfx('heal');
          break;
        case 'magnet':
          for (const g of gems) g.mag = true;
          for (const q of pickups) if (q.type !== 'magnet') q.mag = true;
          note(P.x, P.y - 36, '🧲 МАГНИТ! ВСЁ С КАРТЫ');
          sfx('pick');
          break;
        case 'bomb':
          aoeDamage(P.x, P.y, 900, 500);
          shake += 10;
          sfx('boom');
          note(P.x, P.y - 36, '💥 БОМБА! ЗАЧИСТКА', '#f87171');
          break;
        case 'chest':
          openChest();
          break;
      }
    }
  }
}

/* ================= DAMAGE / KILL / LOOT ================= */
function hurtEnemy(e, dmg, opts = {}) {
  if (e.hp <= 0) return 0;
  let d = dmg,
    crit = false;
  if (opts.crit && Math.random() < opts.crit) {
    d *= 2;
    crit = true;
  }
  e.hp -= d;
  e.flash = 0.12;
  dmgNum(e.x + rnd(-8, 8), e.y - e.r - 4, Math.round(d), crit ? '#fbbf24' : '#eafff3');
  sfx('hit');
  if (e.hp <= 0) {
    killEnemy(e);
    return 1;
  }
  return 1;
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  run.kills++;
  save.stats.kills++;
  burst(e.x, e.y, e.col, e.elite || e.boss ? 22 : 8);
  dropLoot(e);
  if (e.elite) {
    spawnPickup(e.x, e.y, 'chest');
    addCoins(ri(8, 15), e.x, e.y);
  }
  if (e.boss) {
    run.boss = null;
    $('bossBarWrap').classList.add('hidden');
    save.stats.bosses++;
    spawnPickup(e.x, e.y, 'chest');
    for (let i = 0; i < 8; i++) spawnPickup(e.x + rnd(-70, 70), e.y + rnd(-70, 70), 'coin');
    spawnPickup(e.x + rnd(-40, 40), e.y + rnd(-40, 40), 'heal');
    shake += 12;
    sfx('boom');
    if (e.final && !run.endless) {
      endRun(true);
      return;
    }
    if (e.final) note(e.x, e.y - 44, 'ФИНАЛЬНЫЙ БОСС\nПОВЕРЖЕН! ДАЛЬШЕ — ♾');
  } else sfx('kill');
  if (e.spawner) {
    for (let i = 0; i < 4; i++) spawnEnemy('mini', e.x + rnd(-30, 30), e.y + rnd(-30, 30));
  }
}
function dropLoot(e) {
  gems.push({ x: e.x, y: e.y, v: e.xp * rew(), mag: false });
  if (gems.length > 240 && gems.length > 2) {
    gems[0].v += gems[1].v;
    gems.splice(1, 1);
  }
  const L = P.luck;
  const r = Math.random();
  if (r < 0.055 * L) spawnPickup(e.x, e.y, 'coin');
  else if (r < 0.063 * L) spawnPickup(e.x, e.y, 'heal');
  /* мощные бонусы открываются по мере прогресса — в начале из багов падает только курица */
  else if (r < 0.065 * L && pl('magnet') >= 1)
    spawnPickup(e.x, e.y, 'magnet'); /* магнит — после прокачки пассивки МАГНИТ */
  else if (r < 0.067 * L && save.stats.bosses >= 25)
    spawnPickup(e.x, e.y, 'bomb'); /* бомба — подвиг: 25 боссов (всего) */
  else if (r < 0.067 * L) spawnPickup(e.x, e.y, 'heal'); /* закрытый слот не пропадает — превращается в курицу */
}

/* ================= FX / PARTICLES ================= */
function burst(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU),
      sp = rnd(40, 190);
    parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rnd(0.25, 0.6),
      T: 0.6,
      col,
      sz: rnd(1.5, 3.5),
    });
  }
  if (parts.length > 320) parts.splice(0, parts.length - 320);
}
function dmgNum(x, y, v, col) {
  dmgNums.push({ x, y, txt: '' + v, life: 0.7, T: 0.7, col, vy: -46 });
  if (dmgNums.length > 90) dmgNums.splice(0, dmgNums.length - 90);
}
/* мировые уведомления над головой вместо краевых тостов в забеге:
   лёгкий дрейф вверх, появление сразу (без входа), фейд в последние 0.6с */
function note(x, y, txt, col) {
  notes.push({ x, y, txt, col: col || '#fbbf24', life: 2.4, T: 2.4, vy: -16 });
  if (notes.length > 8) notes.splice(0, notes.length - 8);
}
function updFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    if (p.life <= 0) parts.splice(i, 1);
  }
  for (let i = dmgNums.length - 1; i >= 0; i--) {
    const d = dmgNums[i];
    d.life -= dt;
    d.y += d.vy * dt;
    d.vy *= 0.95;
    if (d.life <= 0) dmgNums.splice(i, 1);
  }
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    n.life -= dt;
    n.y += n.vy * dt;
    if (n.life <= 0) notes.splice(i, 1);
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    if (f.type === 'laser' && !f.fired && f.life <= 0.12) {
      f.fired = true;
      const w = f.w;
      if (f.horiz) {
        for (const e of gridNear(P.x, f.coord, Math.hypot(W, H) / 2)) {
          if (Math.abs(e.y - f.coord) < w / 2 + e.r * 0.5) hurtEnemy(e, f.dmg, {});
        }
      } else {
        for (const e of gridNear(f.coord, P.y, Math.hypot(W, H) / 2)) {
          if (Math.abs(e.x - f.coord) < w / 2 + e.r * 0.5) hurtEnemy(e, f.dmg, {});
        }
      }
      shake += 2;
    }
    if (f.life <= 0) fx.splice(i, 1);
  }
}

/* ================= CANVAS / RENDER ================= */
const cv = $('game'),
  ctx = cv.getContext('2d');
let W = innerWidth,
  H = innerHeight,
  dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth;
  H = innerHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
}
window.addEventListener('resize', resize);
resize();

const CHARCOL = {
  punch: '#d0a85c',
  lamp: '#ffc247',
  asm: '#9aa8b2',
  lisp: '#a78bfa',
  clang: '#38bdf8',
  decide: '#4ade80',
  py: '#2dd4bf',
  js: '#f5d90a',
  svm: '#8fb6c9',
  echo: '#9db4ff',
  git: '#f87171',
  rl: '#a3e635',
  gan: '#d386e8',
  attn: '#c084fc',
  diff: '#a8a29e',
  legacy: '#e8794a',
  agi: '#ffe066',
};

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const st = run.stage;
  ctx.fillStyle = st.bg;
  ctx.fillRect(0, 0, W, H);
  const sh = save.set.shake ? shake : 0;
  const shx = sh > 0 ? rnd(-sh, sh) : 0,
    shy = sh > 0 ? rnd(-sh, sh) : 0;
  const ox = W / 2 - cam.x + shx,
    oy = H / 2 - cam.y + shy;
  drawGrid(st, ox, oy);
  drawDecor(st, ox, oy);
  drawPools(ox, oy);
  drawGems(ox, oy);
  drawPickups(ox, oy);
  drawEnemies(ox, oy);
  drawAura(ox, oy);
  drawPlayer(ox, oy);
  drawOrbits(ox, oy);
  drawBullets(ox, oy);
  drawFx(ox, oy);
  drawParts(ox, oy);
  drawDmgNums(ox, oy);
  drawNotes(ox, oy);
  if (save.meta.minimap && run && appState !== 'over') drawMinimap();
}
function drawMinimap() {
  const mw = 150,
    mh = 150,
    mx = W - mw - 12,
    my = H - mh - 12;
  ctx.fillStyle = 'rgba(4,9,6,.82)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#1e4d2f';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 0.5, my + 0.5, mw, mh);
  const R = 850,
    k = (mw / 2 - 4) / R,
    cx = mx + mw / 2,
    cy = my + mh / 2;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - P.x,
      dy = e.y - P.y;
    if (dx < -R || dx > R || dy < -R || dy > R) continue;
    ctx.fillStyle = e.boss ? '#f87171' : e.elite ? '#fbbf24' : e.col;
    const s = e.boss ? 5 : e.elite ? 3.5 : 2;
    ctx.fillRect(cx + dx * k - s / 2, cy + dy * k - s / 2, s, s);
  }
  for (const p of pickups) {
    if (p.type !== 'chest') continue;
    const dx = p.x - P.x,
      dy = p.y - P.y;
    if (dx < -R || dx > R || dy < -R || dy > R) continue;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(cx + dx * k - 2.5, cy + dy * k - 2.5, 5, 5);
  }
  ctx.fillStyle = '#38e07f';
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
}
function drawGrid(st, ox, oy) {
  const sp = 56;
  ctx.strokeStyle = st.grid;
  ctx.lineWidth = 1;
  const x0 = Math.floor((ox * -1) / sp) * sp,
    y0 = Math.floor((oy * -1) / sp) * sp;
  ctx.beginPath();
  for (let x = x0; x < ox * -1 + W + sp; x += sp) {
    ctx.moveTo(x + ox, 0);
    ctx.lineTo(x + ox, H);
  }
  for (let y = y0; y < oy * -1 + H + sp; y += sp) {
    ctx.moveTo(0, y + oy);
    ctx.lineTo(W, y + oy);
  }
  ctx.stroke();
  // deterministic props
  const ps = 168;
  const cx0 = Math.floor((cam.x - W / 2) / ps),
    cx1 = Math.floor((cam.x + W / 2) / ps);
  const cy0 = Math.floor((cam.y - H / 2) / ps),
    cy1 = Math.floor((cam.y + H / 2) / ps);
  ctx.fillStyle = st.accent;
  for (let ix = cx0; ix <= cx1; ix++)
    for (let iy = cy0; iy <= cy1; iy++) {
      const h = Math.abs(Math.sin(ix * 127.1 + iy * 311.7) * 43758.5) % 1;
      if (h < 0.18) {
        const px = ix * ps + h * ps,
          py = iy * ps + ((h * 7) % 1) * ps;
        ctx.globalAlpha = 0.12;
        if (h < 0.06) ctx.fillRect(px + ox, py + oy, 3, 3);
        else {
          ctx.fillRect(px + ox, py + oy, 6, 1);
          ctx.fillRect(px + ox + 2, py + oy - 2, 1, 6);
        }
        ctx.globalAlpha = 1;
      }
    }
}
/* ===== сцены карт: не безликая сетка, а место из истории программирования =====
   ПРОДАКШЕН — серверный зал дата-центра (стойки с LED, венты фальшпола)
   НОЧНОЙ БИЛД — офис в 03:00 (столы с мониторами, кофе, луна, звёзды)
   ЛЕГАСИ-АД — машинный зал мейнфрейма 1962 (ленточные приводы, перфокарты, сканлайны) */
const cellH = (ix, iy, k) => Math.abs(Math.sin(ix * 127.1 + iy * 311.7 + (k || 0) * 74.7) * 43758.5) % 1;
function pRack(g, x, y, h, t) {
  /* серверная стойка: мигающие LED-панели */
  const w = 96,
    d = 56;
  g.fillStyle = 'rgba(6,18,11,.88)';
  g.fillRect(x, y, w, d);
  g.strokeStyle = 'rgba(56,224,127,.33)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, d - 1);
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 5; i++) {
      const hh = cellH(i + 1, r + 1, h * 97);
      const on = Math.sin(t * 2.6 + hh * 43) > -0.25;
      g.globalAlpha = on ? 0.9 : 0.16;
      g.fillStyle = hh < 0.12 ? '#f87171' : hh < 0.3 ? '#fbbf24' : '#38e07f';
      g.fillRect(x + 11 + i * 16, y + 13 + r * 21, 4, 4);
    }
  g.globalAlpha = 0.45;
  g.strokeStyle = 'rgba(56,224,127,.2)';
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    g.moveTo(x + 11, y + 43 + i * 3.5);
    g.lineTo(x + w - 11, y + 43 + i * 3.5);
  }
  g.stroke();
  g.globalAlpha = 1;
}
function pVent(g, x, y) {
  /* вентиляционная плитка фальшпола */
  const s = 74;
  g.strokeStyle = 'rgba(56,224,127,.2)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, s, s);
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    g.moveTo(x + 9, y + 13 + i * 12);
    g.lineTo(x + s - 9, y + 13 + i * 12);
  }
  g.globalAlpha = 0.6;
  g.stroke();
  g.globalAlpha = 1;
}
function pDesk(g, x, y, h, t) {
  /* ночной офис: стол, мониторы, кофе с паром */
  const w = 116,
    d = 66;
  g.fillStyle = 'rgba(15,11,30,.9)';
  g.fillRect(x, y, w, d);
  g.strokeStyle = 'rgba(167,139,250,.3)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, d - 1);
  for (let i = 0; i < 2; i++) {
    const mx = x + 13 + i * 44,
      my = y + 13;
    g.fillStyle = '#0b0918';
    g.fillRect(mx, my, 34, 24);
    g.fillStyle = 'rgba(167,139,250,' + (0.3 + 0.25 * Math.sin(t * 7 + h * 90 + i * 9)) + ')';
    g.fillRect(mx + 2, my + 2, 30, 17);
    g.fillStyle = 'rgba(167,139,250,.35)';
    g.fillRect(mx + 13, my + 27, 8, 4);
  }
  g.fillStyle = 'rgba(251,191,36,.55)';
  g.fillRect(x + w - 17, y + d - 15, 6, 6);
  g.strokeStyle = 'rgba(251,191,36,.28)';
  g.beginPath();
  const sm = Math.sin(t * 3 + h * 50);
  g.moveTo(x + w - 14, y + d - 17);
  g.quadraticCurveTo(x + w - 14 + sm * 2.5, y + d - 24, x + w - 14 - sm * 1.5, y + d - 30);
  g.stroke();
}
function pMoon(g, w) {
  /* луна — далёкий объект, рисуется в экранных координатах */
  const mx = w - 140,
    my = 108;
  g.globalAlpha = 0.12;
  g.fillStyle = '#cfd8ff';
  g.beginPath();
  g.arc(mx, my, 62, 0, TAU);
  g.fill();
  g.globalAlpha = 0.16;
  g.beginPath();
  g.arc(mx - 18, my - 14, 10, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(mx + 15, my + 16, 7, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(mx + 24, my - 22, 4.5, 0, TAU);
  g.fill();
  g.globalAlpha = 1;
}
function pTape(g, x, y, h, t) {
  /* ленточный привод мейнфрейма: бобины вращаются */
  const w = 94,
    d = 64;
  g.fillStyle = 'rgba(24,16,6,.88)';
  g.fillRect(x, y, w, d);
  g.strokeStyle = 'rgba(251,191,36,.38)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, d - 1);
  for (let i = 0; i < 2; i++) {
    const cx2 = x + 27 + i * 40,
      cy2 = y + 25,
      r = 14.5;
    g.strokeStyle = 'rgba(251,191,36,.5)';
    g.beginPath();
    g.arc(cx2, cy2, r, 0, TAU);
    g.stroke();
    const a0 = t * (i ? -1.4 : 1.9) + h * 9;
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = a0 + (k * TAU) / 3;
      g.moveTo(cx2, cy2);
      g.lineTo(cx2 + Math.cos(a) * r * 0.78, cy2 + Math.sin(a) * r * 0.78);
    }
    g.stroke();
    g.fillStyle = 'rgba(251,191,36,.55)';
    g.beginPath();
    g.arc(cx2, cy2, 2.4, 0, TAU);
    g.fill();
  }
  g.strokeStyle = 'rgba(251,191,36,.28)';
  g.beginPath();
  g.moveTo(x + 9, y + d - 11);
  g.lineTo(x + w - 9, y + d - 11);
  g.stroke();
}
function pCard(g, x, y, h) {
  /* перфокарта на полу (иногда повёрнута) */
  const w = 58,
    d = 34,
    rot = cellH(3, 7, h * 31) < 0.5 ? 0 : Math.PI / 2;
  g.save();
  g.translate(x + w / 2, y + d / 2);
  g.rotate(rot);
  g.strokeStyle = 'rgba(251,191,36,.3)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-w / 2 + 9, -d / 2);
  g.lineTo(w / 2, -d / 2);
  g.lineTo(w / 2, d / 2);
  g.lineTo(-w / 2, d / 2);
  g.closePath();
  g.stroke();
  g.fillStyle = 'rgba(251,191,36,.32)';
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 8; i++) {
      if (cellH(i, r, h * 57) < 0.35) continue;
      g.fillRect(-w / 2 + 8 + i * 5.4, -d / 2 + 7 + r * 8, 2, 2);
    }
  g.restore();
}
function pStars(g, w, h, t, ox, oy) {
  /* звёзды; ox/oy — мировой сдвиг камеры (в превью 0,0) */
  ox = ox || 0;
  oy = oy || 0;
  const ps = 90;
  const cx0 = Math.floor(-ox / ps),
    cx1 = Math.floor((w - ox) / ps);
  const cy0 = Math.floor(-oy / ps),
    cy1 = Math.floor((h - oy) / ps);
  for (let ix = cx0; ix <= cx1; ix++)
    for (let iy = cy0; iy <= cy1; iy++) {
      const hh = cellH(ix, iy, 5);
      if (hh >= 0.34) continue;
      const px = ix * ps + ((hh * 13) % 1) * ps + ox,
        py = iy * ps + ((hh * 29) % 1) * ps + oy;
      if (px < -2 || px > w + 2 || py < -2 || py > h + 2) continue;
      g.globalAlpha = 0.22 + 0.3 * Math.abs(Math.sin(t * 2 + hh * 40));
      g.fillStyle = hh < 0.08 ? '#f87171' : '#cfd8ff';
      g.fillRect(px, py, 1.6, 1.6);
    }
  g.globalAlpha = 1;
}
function pScan(g, w, h, t) {
  /* сканлайны CRT */
  g.globalAlpha = 0.05;
  g.fillStyle = '#fbbf24';
  for (let y = ((t * 14) % 6) - 6; y < h; y += 6) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
}
function drawDecor(st, ox, oy) {
  /* подсветка в цвете карты */
  const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, Math.max(W, H) * 0.65);
  g.addColorStop(0, 'rgba(' + (st.glowRGB || '56,224,127') + ',0.06)');
  g.addColorStop(1, 'rgba(' + (st.glowRGB || '56,224,127') + ',0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const t = run.t;
  /* крупные пропы сцены: детерминированные по мировым ячейкам, не мерцают при движении камеры */
  const ps = st.decor === 'night' ? 300 : 270;
  const cx0 = Math.floor((cam.x - W / 2 - 150) / ps),
    cx1 = Math.floor((cam.x + W / 2 + 150) / ps);
  const cy0 = Math.floor((cam.y - H / 2 - 150) / ps),
    cy1 = Math.floor((cam.y + H / 2 + 150) / ps);
  for (let ix = cx0; ix <= cx1; ix++)
    for (let iy = cy0; iy <= cy1; iy++) {
      const h = cellH(ix, iy, 1);
      const px = ix * ps + h * ps * 0.4 + ox,
        py = iy * ps + ((h * 7) % 1) * ps * 0.4 + oy;
      if (px < -150 || px > W + 20 || py < -130 || py > H + 20) continue;
      if (st.decor === 'server') {
        if (h < 0.24) pRack(ctx, px, py, h, t);
        else if (h < 0.33) pVent(ctx, px, py);
      } else if (st.decor === 'night') {
        if (h < 0.22) pDesk(ctx, px, py, h, t);
      } else if (st.decor === 'mainframe') {
        if (h < 0.22) pTape(ctx, px, py, h, t);
        else if (h < 0.36) pCard(ctx, px, py, h);
      }
    }
  if (st.decor === 'night') {
    pStars(ctx, W, H, t, ox, oy);
    pMoon(ctx, W);
  } else if (st.decor === 'mainframe') {
    pScan(ctx, W, H, t);
  }
}
function drawPools(ox, oy) {
  for (const p of pools) {
    const a = clamp(p.life / p.T, 0, 1);
    const col = p.col || '#38e07f';
    ctx.globalAlpha = 0.16 * a + 0.06;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p.x + ox, p.y + oy, p.r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.5 * a;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x + ox, p.y + oy, p.r * (0.9 + 0.1 * Math.sin(run.t * 6)), 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function gemCol(v) {
  return v >= 40 ? '#fbbf24' : v >= 15 ? '#a78bfa' : v >= 4 ? '#38bdf8' : '#38e07f';
}
function drawGems(ox, oy) {
  for (const g of gems) {
    const bob = Math.sin(run.t * 4 + g.x * 0.05) * 2;
    ctx.fillStyle = gemCol(g.v);
    ctx.save();
    ctx.translate(g.x + ox, g.y + oy + bob);
    ctx.rotate(0.785);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
}
function drawPickups(ox, oy) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of pickups) {
    const bob = Math.sin(run.t * 5 + p.ph) * 3;
    const x = p.x + ox,
      y = p.y + oy + bob;
    if (p.type === 'coin') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#b47a0e';
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, TAU);
      ctx.fill();
    } else {
      const ic = { heal: '🍗', magnet: '🧲', bomb: '💥', chest: '🎁' }[p.type];
      ctx.font = (p.type === 'chest' ? '24px' : '18px') + ' serif';
      ctx.fillText(ic, x, y);
    }
  }
}
function drawEnemies(ox, oy) {
  const t = run.t;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const x = e.x + ox,
      y = e.y + oy;
    if (x < -70 || x > W + 70 || y < -70 || y > H + 70) continue;
    const dxp = P.x - e.x,
      dyp = P.y - e.y,
      angP = Math.atan2(dyp, dxp);
    ctx.save();
    ctx.translate(x, y);
    if (e.elite || e.boss) {
      ctx.strokeStyle = e.col;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 5, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.type === 'ghost') ctx.globalAlpha = 0.68;
    // body
    ctx.fillStyle = e.col;
    if (e.type === 'tank') {
      ctx.beginPath();
      const r = e.r;
      ctx.roundRect ? ctx.roundRect(-r, -r * 0.85, r * 2, r * 1.7, 5) : ctx.rect(-r, -r * 0.85, r * 2, r * 1.7);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(-r + 3, -r * 0.85 + 3, r * 2 - 6, 3);
      ctx.fillRect(-r + 3, r * 0.85 - 6, r * 2 - 6, 3);
    } else if (e.type === 'boss') {
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.62, 0, TAU);
      ctx.fill();
      ctx.fillStyle = e.col;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
        ctx.lineTo(Math.cos(a) * e.r * 1.35, Math.sin(a) * e.r * 1.35);
        ctx.lineTo(Math.cos(a + 0.18) * e.r, Math.sin(a + 0.18) * e.r);
        ctx.fill();
      }
    } else if (e.type === 'spawner') {
      const pul = 1 + 0.12 * Math.sin(t * 6 + e.ph);
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.55 * pul, 0, TAU);
      ctx.fill();
      ctx.fillStyle = e.col;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.34 * pul, 0, TAU);
      ctx.fill();
    } else {
      const elong = e.type === 'crawler' ? 1.25 : 1.15;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.r * elong, e.r, angP, 0, TAU);
      ctx.fill();
      if (e.type === 'crawler') {
        ctx.strokeStyle = 'rgba(0,0,0,.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, e.r * elong * 0.6, e.r * 0.6, angP, 0, TAU);
        ctx.stroke();
      }
    }
    // legs for ground types
    if (e.type === 'bug' || e.type === 'mini' || e.type === 'crawler' || e.type === 'tank') {
      ctx.strokeStyle = e.col;
      ctx.lineWidth = 1.5;
      const lw = e.r * 1.5;
      for (let s = -1; s <= 1; s += 2) {
        for (let l = 0; l < 3; l++) {
          const wig = Math.sin(t * 12 + e.ph + l) * 0.3;
          const bx = Math.cos(angP + s * (1.1 + l * 0.4)) * e.r * 0.6;
          const by = Math.sin(angP + s * (1.1 + l * 0.4)) * e.r * 0.6;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(angP + s * 1.5 + wig) * lw * 0.5, by + Math.sin(angP + s * 1.5 + wig) * lw * 0.5);
          ctx.stroke();
        }
      }
    }
    // eyes
    ctx.fillStyle = '#040906';
    const exo = Math.cos(angP) * e.r * 0.35,
      eyo = Math.sin(angP) * e.r * 0.35;
    const ew = Math.max(1.5, e.r * 0.14);
    ctx.beginPath();
    ctx.arc(exo - Math.cos(angP + Math.PI / 2) * e.r * 0.3, eyo - Math.sin(angP + Math.PI / 2) * e.r * 0.3, ew, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(exo + Math.cos(angP + Math.PI / 2) * e.r * 0.3, eyo + Math.sin(angP + Math.PI / 2) * e.r * 0.3, ew, 0, TAU);
    ctx.fill();
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(1, e.flash / 0.12) * 0.75;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // hp bar for elite/boss
    if ((e.elite || e.boss) && e.hp < e.maxhp) {
      const bw = e.boss ? 70 : 44;
      ctx.fillStyle = '#160b0b';
      ctx.fillRect(x - bw / 2, y - e.r - 12, bw, 4);
      ctx.fillStyle = e.boss ? '#f87171' : '#fbbf24';
      ctx.fillRect(x - bw / 2, y - e.r - 12, bw * clamp(e.hp / e.maxhp, 0, 1), 4);
    }
  }
}
function drawAura(ox, oy) {
  for (const w of P.weapons) {
    if (w.id !== 'aura') continue;
    const R = w.auraR || 90;
    const pul = 1 + 0.03 * Math.sin(run.t * 4);
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = w.ev ? '#fbbf24' : '#38e07f';
    ctx.beginPath();
    ctx.arc(P.x + ox, P.y + oy, R * pul, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = w.ev ? '#fbbf24' : '#38e07f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(P.x + ox, P.y + oy, R * pul, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
/* ===== СПРАЙТЫ АГЕНТОВ: у каждого модели — СВОЁ тело (образ эпохи), а не общий дроид с другой головой ===== */
const CHAR_ART = {};
const DIR_MEM = {};
function charArtURL(id) {
  if (!CHAR_ART[id]) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.translate(64, 67);
    g.scale(3, 3);
    drawAgentArt(g, id, 0.5, 0, false, 1.3);
    CHAR_ART[id] = cv.toDataURL('image/png');
  }
  return CHAR_ART[id];
}
/* превью-сцена карты для карточки выбора: тот же код пропов, что и в бою */
const STAGE_ART = {};
function stageArtURL(id) {
  if (!STAGE_ART[id]) {
    const st = STAGES.find(s => s.id === id);
    const c = document.createElement('canvas');
    c.width = 464;
    c.height = 240;
    const g = c.getContext('2d');
    g.fillStyle = st.bg;
    g.fillRect(0, 0, 464, 240);
    g.strokeStyle = st.grid;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 28; x < 464; x += 56) {
      g.moveTo(x, 0);
      g.lineTo(x, 240);
    }
    for (let y = 16; y < 240; y += 56) {
      g.moveTo(0, y);
      g.lineTo(464, y);
    }
    g.stroke();
    const rg = g.createRadialGradient(232, 120, 30, 232, 120, 330);
    rg.addColorStop(0, 'rgba(' + st.glowRGB + ',0.14)');
    rg.addColorStop(1, 'rgba(' + st.glowRGB + ',0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 464, 240);
    const t = 2.4;
    if (st.decor === 'server') {
      pRack(g, 44, 42, 0.15, t);
      pRack(g, 268, 122, 0.4, t);
      pVent(g, 168, 58);
      pVent(g, 356, 36);
    } else if (st.decor === 'night') {
      pMoon(g, 464);
      pStars(g, 464, 240, t, 0, 0);
      pDesk(g, 48, 118, 0.2, t);
      pDesk(g, 288, 36, 0.55, t);
    } else if (st.decor === 'mainframe') {
      pTape(g, 48, 40, 0.2, t);
      pTape(g, 282, 118, 0.5, t);
      pCard(g, 186, 54, 0.3);
      pCard(g, 368, 42, 0.75);
      pScan(g, 464, 240, t);
    }
    STAGE_ART[id] = c.toDataURL('image/png');
  }
  return STAGE_ART[id];
}
const rr = (g, x, y, w, h, r) => {
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
};
function dia(g, x, y, s) {
  g.beginPath();
  g.moveTo(x - s, y);
  g.lineTo(x, y - s);
  g.lineTo(x + s, y);
  g.lineTo(x, y + s);
  g.closePath();
  g.fill();
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    gg = (n >> 8) & 255,
    b = n & 255;
  if (k > 0) {
    r += (255 - r) * k;
    gg += (255 - gg) * k;
    b += (255 - b) * k;
  } else {
    r *= 1 + k;
    gg *= 1 + k;
    b *= 1 + k;
  }
  return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')';
}
function hexNut(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    const px = x + Math.cos(a) * r,
      py = y + Math.sin(a) * r;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
  g.fill();
}
function eyePair(g, ex1, ex2, ey, ay, t, glow, pupil) {
  // стандартная пара глаз: свечение, моргание, зрачок за прицелом
  const bl = t % 3.7 < 0.13,
    dy = Math.max(-1.3, Math.min(1.3, ay)) * 0.6;
  for (const ex of [ex1, ex2]) {
    g.fillStyle = glow;
    g.globalAlpha = 0.25;
    g.beginPath();
    g.arc(ex, ey, 2.4, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    if (bl) {
      g.fillStyle = glow;
      g.fillRect(ex - 1.35, ey - 0.25, 2.7, 0.5);
    } else {
      g.fillStyle = glow;
      g.beginPath();
      g.arc(ex, ey, 1.4, 0, TAU);
      g.fill();
      g.fillStyle = pupil;
      g.beginPath();
      g.arc(ex + 0.32, ey + dy, 0.6, 0, TAU);
      g.fill();
    }
  }
}
function drawAgentArt(g, id, va, wp, mv, t) {
  const cx = Math.cos(va);
  if (Math.abs(cx) > 0.2) DIR_MEM[id] = cx < 0 ? -1 : 1;
  const dir = DIR_MEM[id] || 1;
  const ay = Math.sin(va);
  g.save();
  g.scale(dir, 1);
  if (mv) g.rotate(Math.sin(wp) * 0.045);
  g.translate(0, mv ? -Math.abs(Math.cos(wp)) * 1.05 : Math.sin(t * 2.4) * 0.4);
  if (id === 'legacy') dinoArt(g, wp, mv, t);
  else if (id === 'py') snakeArt(g, wp, mv, t, ay);
  else if (id === 'agi') orbArt(g, wp, mv, t, ay);
  else (AGENT_ART[id] || cardArt)(g, wp, mv, t, ay);
  g.restore();
}
/* --- ПЕРФОКАРТА 1890: шагающая карта с перфорацией и веером карт за спиной --- */
function cardArt(g, wp, mv, t, ay) {
  const col = CHARCOL.punch,
    dk = 'rgba(0,0,0,.26)';
  const stp = mv ? Math.sin(wp) * 2.1 : 0;
  g.save();
  g.rotate(mv ? Math.sin(wp) * 0.04 : 0);
  /* веер карт за спиной */
  g.save();
  g.translate(-6.2, -1.5);
  g.rotate(-0.3 + Math.sin(t * 1.8) * 0.05);
  g.fillStyle = shade(col, -0.22);
  g.fillRect(-4.4, -6.6, 8, 12.6);
  g.fillStyle = dk;
  g.fillRect(-3.2, -4.8, 4.4, 0.7);
  g.fillRect(-3.2, -2.2, 4.4, 0.7);
  g.restore();
  g.save();
  g.translate(-5.2, -1.5);
  g.rotate(-0.13);
  g.fillStyle = shade(col, -0.1);
  g.fillRect(-4.4, -7, 8.4, 13.2);
  g.restore();
  /* ноги-картонки */
  g.fillStyle = shade(col, -0.38);
  g.beginPath();
  rr(g, -4.8 + stp, 9.4, 3.3, 3.6, 1);
  g.fill();
  g.beginPath();
  rr(g, 1.9 - stp, 9.4, 3.3, 3.6, 1);
  g.fill();
  /* тело-карта со срезанным углом */
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(-7.2, -9.6);
  g.lineTo(4.4, -9.6);
  g.lineTo(7.2, -6.4);
  g.lineTo(7.2, 9.4);
  g.lineTo(-7.2, 9.4);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.15)';
  g.fillRect(-5.8, -8.2, 2.6, 16.2);
  g.strokeStyle = 'rgba(0,0,0,.18)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-7.2, -4.2);
  g.lineTo(7.2, -4.2);
  g.stroke(); // линия отреза
  /* перфорация */
  g.fillStyle = 'rgba(0,0,0,.24)';
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 7; c++) {
      if ((r * 7 + c) % 3 === 0) continue;
      g.fillRect(-5.6 + c * 1.86, -2.6 + r * 2.06, 1.05, 1.25);
    }
  /* лицо: круглые отверстия + щель */
  eyePair(g, -2, 3.4, -6.4, ay, t, '#fff3cf', '#3a2c10');
  g.fillStyle = '#3a2c10';
  g.fillRect(-1.5, -1.6, 4.4, 1.5);
  /* язычок сверху */
  g.fillStyle = shade(col, -0.2);
  g.fillRect(-3.4, -12, 6.4, 2.6);
  g.fillStyle = 'rgba(255,255,255,.3)';
  g.fillRect(-2.4, -11.3, 4.4, 0.7);
  g.restore();
}
/* --- ЛАМПА 1945: стеклянная колба с нитью-лицом на пинах цоколя --- */
function tubeArt(g, wp, mv, t, ay) {
  const puls = 0.72 + 0.28 * Math.sin(t * 3.1);
  const stp = mv ? Math.sin(wp) * 1.7 : 0;
  /* свечение */
  const gr = g.createRadialGradient(0, -5, 2, 0, -5, 16);
  gr.addColorStop(0, 'rgba(255,194,71,' + (0.32 * puls).toFixed(3) + ')');
  gr.addColorStop(1, 'rgba(255,194,71,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, -5, 16, 0, TAU);
  g.fill();
  /* пины цоколя */
  g.strokeStyle = '#7a6a45';
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  for (const px of [-4.4, -1.5, 1.5, 4.4]) {
    g.beginPath();
    g.moveTo(px, 8.6);
    g.lineTo(px + (px < 0 ? stp : -stp) * 0.55, 12.4);
    g.stroke();
  }
  /* цоколь */
  g.fillStyle = '#8a7440';
  g.beginPath();
  rr(g, -5.4, 3.9, 10.8, 5, 1.3);
  g.fill();
  g.fillStyle = '#6e5c30';
  g.fillRect(-5.4, 5, 10.8, 0.9);
  g.fillRect(-5.4, 7, 10.8, 0.9);
  /* колба */
  g.fillStyle = 'rgba(255,214,120,.3)';
  g.beginPath();
  g.arc(0, -4.6, 9.5, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,236,170,.5)';
  g.beginPath();
  g.arc(0, -4.6, 7.3, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.55)';
  g.lineWidth = 1.1;
  g.beginPath();
  g.arc(0, -4.6, 9, Math.PI * 1.05, Math.PI * 1.55);
  g.stroke();
  /* нить накаливания */
  g.strokeStyle = '#c98a1e';
  g.lineWidth = 0.9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-4.4, -0.9);
  g.lineTo(-4.4, -2.9);
  g.lineTo(-1.6, -1.1);
  g.lineTo(1.4, -3.1);
  g.lineTo(4.4, -1.3);
  g.stroke();
  /* лицо: тёплые точки-глаза */
  const bl = t % 3.7 < 0.13,
    dy = Math.max(-1.2, Math.min(1.2, ay)) * 0.6;
  for (const ex of [-2.7, 2.7]) {
    if (bl) {
      g.strokeStyle = '#8a5a10';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(ex - 1.2, -6.6 + dy * 0.5);
      g.lineTo(ex + 1.2, -6.6 + dy * 0.5);
      g.stroke();
    } else {
      g.fillStyle = 'rgba(255,242,176,' + (0.5 + 0.45 * puls).toFixed(2) + ')';
      g.beginPath();
      g.arc(ex, -6.6 + dy * 0.5, 1.5, 0, TAU);
      g.fill();
      g.fillStyle = '#8a5a10';
      g.beginPath();
      g.arc(ex + 0.3, -6.6 + dy * 0.5, 0.55, 0, TAU);
      g.fill();
    }
  }
  /* блик стекла */
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.beginPath();
  g.arc(-3.6, -9.4, 1.4, 0, TAU);
  g.fill();
}
/* --- АСМ 1949: логическая плата на пинах, камера-сканер на стойке --- */
function pcbArt(g, wp, mv, t, ay) {
  const col = CHARCOL.asm;
  const stp = mv ? Math.sin(wp) * 2.2 : 0;
  /* хвост-перфолента */
  g.strokeStyle = '#e8e2d0';
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-7.6, 2.6);
  g.quadraticCurveTo(-12, 3.8 + Math.sin(t * 3) * 0.8, -14.6, 6.4 + Math.sin(t * 3) * 1.2);
  g.stroke();
  g.fillStyle = 'rgba(0,0,0,.35)';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(-8.8 - i * 1.6, 3.1 + i * 0.8, 0.36, 0, TAU);
    g.fill();
  }
  /* пины-ножки */
  g.strokeStyle = '#5c6a74';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  for (const px of [-5.6, -1.9, 1.9, 5.6]) {
    g.beginPath();
    g.moveTo(px, 6.2);
    g.lineTo(px + (px < 0 ? stp : -stp) * 0.7, 10.6);
    g.stroke();
  }
  /* плата */
  g.fillStyle = col;
  g.beginPath();
  rr(g, -8.6, -6, 17.2, 12.4, 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.1)';
  g.beginPath();
  rr(g, -7.6, -5, 15.2, 3.2, 1.3);
  g.fill();
  /* дорожки */
  g.strokeStyle = '#d9b36a';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-7.2, 3.2);
  g.lineTo(-2, 3.2);
  g.lineTo(-0.4, 4.9);
  g.lineTo(6.6, 4.9);
  g.stroke();
  g.beginPath();
  g.moveTo(-7.2, -3.8);
  g.lineTo(-4.6, -3.8);
  g.lineTo(-3, -1.7);
  g.stroke();
  g.beginPath();
  g.moveTo(7.2, 0.8);
  g.lineTo(3.6, 0.8);
  g.lineTo(2.4, 2);
  g.stroke();
  /* чипы */
  g.fillStyle = '#20262b';
  g.beginPath();
  rr(g, -6.4, -4.7, 7.2, 4.3, 0.8);
  g.fill();
  g.fillStyle = '#2f3a41';
  for (let i = 0; i < 4; i++) {
    g.fillRect(-6.1 + i * 1.65, -5.1, 0.55, 0.9);
    g.fillRect(-6.1 + i * 1.65, -0.85, 0.55, 0.9);
  }
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.beginPath();
  g.arc(-5.4, -4, 0.4, 0, TAU);
  g.fill();
  g.fillStyle = '#20262b';
  g.beginPath();
  rr(g, 2.2, 0.2, 5.4, 3.4, 0.8);
  g.fill();
  /* конденсаторы */
  g.fillStyle = '#3f4d55';
  g.beginPath();
  g.arc(-3.4, -7.7, 1.4, 0, TAU);
  g.fill();
  g.fillStyle = '#d9b36a';
  g.fillRect(-4.3, -9.4, 1.8, 1.1);
  g.fillStyle = '#3f4d55';
  g.beginPath();
  g.arc(-0.4, -7.9, 1, 0, TAU);
  g.fill();
  /* камера-сканер на стойке */
  g.strokeStyle = '#39434b';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(4.4, -6);
  g.lineTo(5.2, -10);
  g.stroke();
  g.fillStyle = '#39434b';
  g.beginPath();
  rr(g, 2.2, -14.4, 6.4, 4.6, 1.2);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, 3.2, -13.6, 4.4, 3, 0.8);
  g.fill();
  const dy = Math.max(-1, Math.min(1, ay)) * 0.7;
  g.fillStyle = '#9fd8ff';
  g.beginPath();
  g.arc(5.4, -12.1 + dy, 1, 0, TAU);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  g.arc(5.4, -12.1 + dy, 0.42, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(159,216,255,.45)';
  g.fillRect(3.3, -12.1 + Math.sin(t * 2.6) * 1.1 - 0.3, 4.2, 0.6);
  /* золотой край-коннектор */
  g.fillStyle = '#d9b36a';
  for (let i = 0; i < 5; i++) g.fillRect(-6.9 + i * 2.9, 6.4, 1.8, 1.5);
  /* LED */
  g.fillStyle = Math.floor(t * 3) % 2 ? '#4ade80' : 'rgba(74,222,128,.3)';
  g.beginPath();
  g.arc(-7.2, -0.6, 0.8, 0, TAU);
  g.fill();
}
/* --- ЛИСП 1958: клетка из скобок вокруг парящего λ-ядра --- */
function parenArt(g, wp, mv, t, ay) {
  const col = CHARCOL.lisp;
  const w1 = Math.sin(t * 1.6) * 0.1,
    w2 = Math.sin(t * 1.6 + 1.2) * 0.1;
  /* внешние скобки */
  g.save();
  g.rotate(w1 * 0.5);
  g.strokeStyle = col;
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(1.4, 0, 10.8, Math.PI * 0.6, Math.PI * 1.4);
  g.stroke();
  g.beginPath();
  g.arc(-1.4, 0, 10.8, -Math.PI * 0.4, Math.PI * 0.4);
  g.stroke();
  g.restore();
  /* внутренние скобки, встречное вращение */
  g.save();
  g.rotate(-w2 * 0.7);
  g.strokeStyle = 'rgba(230,220,255,.7)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(0.9, 0, 6.9, Math.PI * 0.6, Math.PI * 1.4);
  g.stroke();
  g.beginPath();
  g.arc(-0.9, 0, 6.9, -Math.PI * 0.4, Math.PI * 0.4);
  g.stroke();
  g.restore();
  /* λ-ядро */
  const fy = Math.sin(t * 2.2) * 0.7;
  g.fillStyle = 'rgba(167,139,250,.22)';
  g.beginPath();
  g.arc(0, fy, 5, 0, TAU);
  g.fill();
  g.fillStyle = '#4c3d8f';
  g.beginPath();
  g.arc(0, fy, 3.7, 0, TAU);
  g.fill();
  g.strokeStyle = '#e6dcff';
  g.lineWidth = 1.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-1.7, fy + 2.7);
  g.quadraticCurveTo(-0.3, fy + 0.5, 1.8, fy - 2.9);
  g.stroke();
  g.beginPath();
  g.moveTo(0.1, fy - 0.5);
  g.quadraticCurveTo(1.4, fy + 0.9, 2.7, fy + 2.7);
  g.stroke();
  g.beginPath();
  g.moveTo(-1.2, fy - 2.7);
  g.quadraticCurveTo(0.2, fy - 1.7, 1.8, fy - 2.7);
  g.stroke();
  /* глаза на ядре */
  const bl = t % 3.7 < 0.13,
    dy = Math.max(-1, Math.min(1, ay)) * 0.5;
  for (const ex of [-1.1, 1.5]) {
    if (bl) {
      g.fillStyle = '#e6dcff';
      g.fillRect(ex - 0.7, fy - 1.15 + dy * 0.4, 1.4, 0.4);
    } else {
      g.fillStyle = '#e6dcff';
      g.beginPath();
      g.arc(ex, fy - 1 + dy * 0.4, 0.82, 0, TAU);
      g.fill();
      g.fillStyle = '#2a2350';
      g.beginPath();
      g.arc(ex + 0.14, fy - 1 + dy * 0.4, 0.36, 0, TAU);
      g.fill();
    }
  }
  /* нижняя скобка-подвеска */
  g.strokeStyle = 'rgba(167,139,250,.6)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(0, fy + 7.2, 1.9, Math.PI * 1.12, Math.PI * 1.88);
  g.stroke();
}
/* --- СИ 1972: куб-ядро на гусеницах, иллюминатор, труба с паром, ключ --- */
function kernArt(g, wp, mv, t, ay) {
  const col = CHARCOL.clang;
  /* труба с паром за спиной */
  g.strokeStyle = '#4c626e';
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(-6.6, -4);
  g.lineTo(-11.6, -4);
  g.stroke();
  const pu = (t * 0.8) % 1;
  g.fillStyle = 'rgba(223,244,255,' + (0.35 * (1 - pu)).toFixed(3) + ')';
  g.beginPath();
  g.arc(-12.6, -5.2 - pu * 3.4, 1.4 + pu * 2, 0, TAU);
  g.fill();
  /* гусеничная база */
  g.fillStyle = '#1f2b33';
  g.beginPath();
  rr(g, -7.6, 5.8, 15.2, 5.2, 2.4);
  g.fill();
  g.fillStyle = '#39525f';
  g.beginPath();
  g.arc(-4.4, 8.4, 1.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(0.4, 8.4, 1.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(5.2, 8.4, 1.3, 0, TAU);
  g.fill();
  /* корпус-куб */
  g.fillStyle = col;
  g.beginPath();
  rr(g, -7.2, -6.4, 14.4, 12.6, 1.6);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.15)';
  g.fillRect(-5.9, -5.2, 3.2, 10.4);
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.fillRect(-7.2, 4.5, 14.4, 1.7);
  /* гайки по углам */
  g.fillStyle = '#2c4655';
  hexNut(g, -5.3, -4.5, 1.5);
  hexNut(g, 5.3, -4.5, 1.5);
  hexNut(g, -5.3, 3.7, 1.5);
  hexNut(g, 5.3, 3.7, 1.5);
  /* иллюминатор-глаз */
  g.fillStyle = '#16323f';
  g.beginPath();
  g.arc(1.2, -1.2, 4.1, 0, TAU);
  g.fill();
  g.strokeStyle = '#9fd8ff';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(1.2, -1.2, 4.1, 0, TAU);
  g.stroke();
  const dy = Math.max(-1.3, Math.min(1.3, ay)) * 0.7;
  if (t % 3.7 < 0.13) {
    g.fillStyle = '#16323f';
    g.fillRect(-1.2, -1.5, 4.8, 0.7);
  } else {
    g.fillStyle = '#bfe9ff';
    g.beginPath();
    g.arc(1.2, -1.2 + dy * 0.4, 2.5, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(1.9, -1.2 + dy, 1.15, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.beginPath();
    g.arc(0.4, -2.2 + dy * 0.6, 0.5, 0, TAU);
    g.fill();
  }
  /* сердитый козырёк */
  g.fillStyle = '#1f3a47';
  g.beginPath();
  rr(g, -2.6, -6.1, 7.8, 1.5, 0.7);
  g.fill();
  /* решётка-рот */
  g.fillStyle = '#16323f';
  for (let i = 0; i < 4; i++) g.fillRect(-4.4 + i * 1.75, 2.4, 1.1, 1.8);
  /* ключ-манипулятор */
  g.strokeStyle = '#4c626e';
  g.lineWidth = 1.9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(7, 1.4);
  g.lineTo(10.4, 3.8);
  g.stroke();
  g.strokeStyle = '#dff4ff';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(11.6, 4.6, 1.5, Math.PI * 0.15, Math.PI * 1.05);
  g.stroke();
  g.beginPath();
  g.moveTo(12.3, 3.3);
  g.lineTo(13.3, 2.2);
  g.stroke();
}
/* --- ДЕЦИЗИЯ 1986: дерево решений в горшке, таблички ✓/✗ на ветках --- */
function treeArt(g, wp, mv, t, ay) {
  const sway = mv ? Math.sin(wp) * 0.08 : Math.sin(t * 1.7) * 0.04;
  /* горшок */
  g.fillStyle = '#b0603c';
  g.beginPath();
  g.moveTo(-5.2, 5.4);
  g.lineTo(5.2, 5.4);
  g.lineTo(3.9, 10.6);
  g.lineTo(-3.9, 10.6);
  g.closePath();
  g.fill();
  g.fillStyle = '#c97550';
  g.fillRect(-6, 3.7, 12, 2.1);
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.fillRect(-4, 8.5, 8, 1.5);
  /* ствол + ветки + листва */
  g.save();
  g.rotate(sway);
  g.fillStyle = '#8a5a34';
  g.beginPath();
  g.moveTo(-1.7, 4.2);
  g.quadraticCurveTo(-1.3, -0.8, 2.4, -5.6);
  g.lineTo(4.3, -4.6);
  g.quadraticCurveTo(1.6, -0.5, 2.1, 4.2);
  g.closePath();
  g.fill();
  g.strokeStyle = '#8a5a34';
  g.lineWidth = 2.1;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(1.4, -3.6);
  g.lineTo(-3.8, -8.8);
  g.stroke();
  g.beginPath();
  g.moveTo(2.2, -4);
  g.lineTo(7.4, -9.4);
  g.stroke();
  g.beginPath();
  g.moveTo(1.9, -4.6);
  g.lineTo(1.2, -11);
  g.stroke();
  g.fillStyle = '#2f7d4f';
  g.beginPath();
  g.arc(-4.8, -10.2, 3.6, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(1.3, -12.6, 4.4, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(7.6, -10.8, 3.2, 0, TAU);
  g.fill();
  g.fillStyle = '#3f9d63';
  g.beginPath();
  g.arc(-0.2, -11.2, 3, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(5.2, -12, 2.4, 0, TAU);
  g.fill();
  /* таблички ✓/✗ на ветках */
  const sw = Math.sin(t * 2.4) * 0.5;
  g.save();
  g.translate(-4.8, -7.4);
  g.rotate(sw * 0.5);
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 1.3);
  g.stroke();
  g.fillStyle = '#2f7d4f';
  g.beginPath();
  rr(g, -2.2, 1.3, 4.4, 3.2, 0.9);
  g.fill();
  g.strokeStyle = '#eafff2';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-1.2, 2.9);
  g.lineTo(-0.4, 3.8);
  g.lineTo(1.2, 1.9);
  g.stroke();
  g.restore();
  g.save();
  g.translate(7.4, -7.8);
  g.rotate(-sw * 0.5);
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 1.3);
  g.stroke();
  g.fillStyle = '#8b3a3a';
  g.beginPath();
  rr(g, -2.2, 1.3, 4.4, 3.2, 0.9);
  g.fill();
  g.strokeStyle = '#ffe9e9';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-1.2, 1.9);
  g.lineTo(1.2, 3.9);
  g.moveTo(1.2, 1.9);
  g.lineTo(-1.2, 3.9);
  g.stroke();
  g.restore();
  g.restore();
  /* лицо на стволе */
  eyePair(g, -0.1, 2.5, 0.7, ay, t, '#bff7d2', '#123c26');
  g.strokeStyle = '#123c26';
  g.lineWidth = 0.9;
  g.beginPath();
  g.arc(1.2, 2.9, 1.3, Math.PI * 0.1, Math.PI * 0.9);
  g.stroke();
}
/* --- ДЖС 1995: парящее окно браузера, скроллбар-хвост, warning-уведомление --- */
function winArt(g, wp, mv, t, ay) {
  g.save();
  g.rotate(mv ? Math.sin(wp) * 0.05 : Math.sin(t * 1.9) * 0.03);
  /* хвост-скроллбар */
  g.fillStyle = '#8a7500';
  g.beginPath();
  rr(g, 8.2, -8, 2.4, 17, 1);
  g.fill();
  const th = mv ? Math.sin(wp * 0.9) * 5 : Math.sin(t * 1.3) * 4;
  g.fillStyle = '#f5d90a';
  g.fillRect(8.7, -6.5 + th, 1.4, 5);
  /* окно */
  g.fillStyle = '#a08b06';
  g.beginPath();
  rr(g, -8.6, -12, 17.4, 16.6, 1.8);
  g.fill();
  g.fillStyle = '#f5d90a';
  g.beginPath();
  rr(g, -7.6, -11, 15.4, 14.6, 1.2);
  g.fill();
  g.fillStyle = '#d4b606';
  g.fillRect(-7.6, -11, 15.4, 3.6);
  g.fillStyle = '#fff7bf';
  g.beginPath();
  g.arc(-6.2, -9.2, 0.72, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(-4.2, -9.2, 0.72, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(-2.2, -9.2, 0.72, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.fillRect(-7.6, -7.9, 15.4, 0.6);
  /* тулбар-кнопки */
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.fillRect(-6.6, -6.4, 2.6, 1.8);
  g.fillRect(-3.2, -6.4, 2.6, 1.8);
  g.fillStyle = '#fff7bf';
  g.fillRect(0.2, -6.4, 2.6, 1.8);
  /* трещина стекла */
  g.strokeStyle = 'rgba(0,0,0,.3)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(6.4, -4.4);
  g.lineTo(4.8, -3);
  g.lineTo(5.6, -1.2);
  g.moveTo(4.8, -3);
  g.lineTo(3.4, -3.6);
  g.stroke();
  /* паническое лицо */
  const dy = Math.max(-1.3, Math.min(1.3, ay)) * 0.6;
  eyePair(g, -3, 2.6, -2.6 + dy * 0.3, ay, t, '#fff7bf', '#3a3000');
  g.strokeStyle = '#3a3000';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-2.6, 1.6 + Math.sin(t * 4) * 0.3);
  g.quadraticCurveTo(-0.6, 0.7, 1.4, 1.6 + Math.cos(t * 3.4) * 0.3);
  g.stroke();
  g.restore();
  /* warning-уведомление */
  const bx = 11,
    by = -13.8 + Math.sin(t * 2.6) * 0.8;
  g.fillStyle = '#1d231c';
  g.beginPath();
  g.moveTo(bx - 3, by + 2.6);
  g.lineTo(bx, by - 2.6);
  g.lineTo(bx + 3, by + 2.6);
  g.closePath();
  g.fill();
  g.fillStyle = '#f5d90a';
  g.beginPath();
  g.moveTo(bx - 2.3, by + 2);
  g.lineTo(bx, by - 1.7);
  g.lineTo(bx + 2.3, by + 2);
  g.closePath();
  g.fill();
  g.fillStyle = '#1d231c';
  g.fillRect(bx - 0.25, by - 0.7, 0.5, 1.3);
  g.fillRect(bx - 0.25, by + 0.9, 0.5, 0.6);
}
/* --- СВМ 1995: два клина вдоль пунктирной гиперплоскости, опорные векторы --- */
function svmArt(g, wp, mv, t, _ay) {
  const col = CHARCOL.svm;
  const gap = 1.5 + Math.sin(mv ? wp * 1.3 : t * 2) * 0.35;
  /* верхний клин */
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(-7.4, -8.8);
  g.lineTo(7.4, -8.8);
  g.lineTo(4.1, -1.7 - gap);
  g.lineTo(-4.1, -1.7 - gap);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.16)';
  g.fillRect(-6, -7.8, 12, 2);
  /* нижний клин */
  g.fillStyle = shade(col, -0.27);
  g.beginPath();
  g.moveTo(-4.1, 1.7 + gap);
  g.lineTo(4.1, 1.7 + gap);
  g.lineTo(7.4, 8.8);
  g.lineTo(-7.4, 8.8);
  g.closePath();
  g.fill();
  /* гиперплоскость */
  g.strokeStyle = 'rgba(255,255,255,.85)';
  g.lineWidth = 1;
  g.setLineDash([2.4, 1.8]);
  g.beginPath();
  g.moveTo(-9.6, 0);
  g.lineTo(9.6, 0);
  g.stroke();
  g.setLineDash([]);
  /* опорные векторы */
  g.strokeStyle = '#dfe9ee';
  g.lineWidth = 1.1;
  for (const p of [
    [-8.8, -4.4],
    [8.9, -2.8],
    [-8.4, 4.6],
    [8.5, 5.6],
  ]) {
    g.beginPath();
    g.moveTo(p[0] * 0.7, p[1] * 0.7);
    g.lineTo(p[0], p[1]);
    g.stroke();
    g.fillStyle = p[1] < 0 ? '#e2f4ff' : '#9fc4d8';
    g.beginPath();
    g.arc(p[0], p[1], 1.15, 0, TAU);
    g.fill();
  }
  /* визор-глаз на верхнем клине */
  g.fillStyle = '#0f2733';
  g.beginPath();
  rr(g, -4, -5.8, 8.8, 2.7, 1.2);
  g.fill();
  const dx = Math.max(-1.2, Math.min(1.2, Math.sin(wp * 0.7)));
  g.fillStyle = '#e2f4ff';
  g.fillRect(-1.3 + dx, -5.4, 2.6, 1.9);
  /* рот-линейка */
  g.fillStyle = '#0f2733';
  g.fillRect(-3.2, 4.6, 6.4, 0.9);
  /* штатив */
  g.strokeStyle = '#5b7482';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-4, 8.4);
  g.lineTo(-6.2, 11.6);
  g.stroke();
  g.beginPath();
  g.moveTo(0, 8.4);
  g.lineTo(0, 11.8);
  g.stroke();
  g.beginPath();
  g.moveTo(4, 8.4);
  g.lineTo(6.2, 11.6);
  g.stroke();
}
/* --- ЭХО 1997: кассета с катушками-глазами и лентой-хвостом --- */
function cassetteArt(g, wp, mv, t, ay) {
  const col = CHARCOL.echo;
  const rt = t * (mv ? 8 : 1.5);
  /* лента-хвост */
  g.strokeStyle = 'rgba(157,180,255,.5)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-8.6, 3.2);
  g.quadraticCurveTo(-12.6, 4.8 + Math.sin(t * 3) * 0.8, -14.8, 3.4 + Math.sin(t * 3) * 1.4);
  g.stroke();
  /* колёсики */
  g.fillStyle = '#39415c';
  g.beginPath();
  rr(g, -6.6, 9.2, 4.6, 2.7, 1.2);
  g.fill();
  g.beginPath();
  rr(g, 2, 9.2, 4.6, 2.7, 1.2);
  g.fill();
  /* корпус */
  g.fillStyle = col;
  g.beginPath();
  rr(g, -9, -6.6, 18, 15.6, 1.6);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.12)';
  g.fillRect(-8, -5.6, 16, 2);
  /* эхо-дубль глаз */
  const eo = Math.sin(t * 2.6) * 0.5 + 1.4;
  g.fillStyle = 'rgba(223,232,255,.22)';
  g.beginPath();
  g.arc(-4.6 - eo * 0.5, -1, 0.95, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(3.2 - eo * 0.5, -1, 0.95, 0, TAU);
  g.fill();
  /* этикетка */
  g.fillStyle = '#dfe8ff';
  g.beginPath();
  rr(g, -7.4, -4.6, 14.8, 6.9, 1);
  g.fill();
  g.fillStyle = '#39415c';
  g.fillRect(-7.4, -4.6, 14.8, 1.1);
  /* окна катушек = глаза */
  for (const ex of [-3.9, 3.9]) {
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(ex, -1, 2.75, 0, TAU);
    g.fill();
    g.save();
    g.translate(ex, -1);
    g.rotate(rt);
    g.strokeStyle = '#dfe8ff';
    g.lineWidth = 0.9;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 1.9, Math.sin(a) * 1.9);
      g.stroke();
    }
    g.restore();
    if (t % 3.7 < 0.13) {
      g.fillStyle = '#0c110d';
      g.fillRect(ex - 1, -1.4, 2, 0.8);
    } else {
      const dy = Math.max(-1, Math.min(1, ay)) * 0.5;
      g.fillStyle = '#dfe8ff';
      g.beginPath();
      g.arc(ex + 0.3, -1 + dy * 0.4, 0.72, 0, TAU);
      g.fill();
    }
  }
  /* ленточный тракт */
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, -5.4, 3.3, 10.8, 2.1, 0.6);
  g.fill();
  g.fillStyle = 'rgba(157,180,255,.6)';
  g.fillRect(-5, 4.1, 10, 0.6);
  /* нижняя трапеция + винтики */
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath();
  g.moveTo(-6.6, 9.2);
  g.lineTo(-4.4, 6.6);
  g.lineTo(4.4, 6.6);
  g.lineTo(6.6, 9.2);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,.4)';
  g.beginPath();
  g.arc(-8.1, 7.4, 0.5, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(8.1, 7.4, 0.5, 0, TAU);
  g.fill();
}
/* --- ГИТ 2005: созвездие коммитов, лицо на HEAD, тег на шнурке --- */
function gitArt(g, wp, mv, t, ay) {
  const b1 = Math.sin(t * 2.1) * 0.8,
    b2 = Math.sin(t * 2.1 + 1) * 0.9,
    b3 = Math.sin(t * 2.1 + 2) * 0.7;
  /* связи */
  g.strokeStyle = '#8a5a56';
  g.lineWidth = 1.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, -8.6 + b1);
  g.quadraticCurveTo(-1, -2.2 + b2, -2.6, 1.6 + b2);
  g.stroke();
  g.beginPath();
  g.moveTo(-2.6, 1.6 + b2);
  g.quadraticCurveTo(-3.8, 5.2, -2.2, 8.2 + b3);
  g.stroke();
  g.beginPath();
  g.moveTo(0, -8.6 + b1);
  g.quadraticCurveTo(5.6, -4.6 + b2, 5.8, 0.6 + b3);
  g.stroke();
  /* узлы */
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(-2.6, 1.6 + b2, 3.3, 0, TAU);
  g.fill();
  g.fillStyle = '#f87171';
  g.beginPath();
  g.arc(-2.2, 8.2 + b3, 2.6, 0, TAU);
  g.fill();
  g.fillStyle = '#7eea9d';
  g.beginPath();
  g.arc(5.8, 0.6 + b3, 2.5, 0, TAU);
  g.fill();
  g.fillStyle = '#4ade80';
  g.beginPath();
  g.arc(0, -8.6 + b1, 4.3, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(0, -8.6 + b1, 4.3, 0, TAU);
  g.stroke();
  g.beginPath();
  g.arc(-2.6, 1.6 + b2, 3.3, 0, TAU);
  g.stroke();
  /* лицо на HEAD */
  const dy = Math.max(-1, Math.min(1, ay)) * 0.5;
  const bl = t % 3.7 < 0.13;
  for (const p of [
    [-1.4, -9.1 + b1],
    [1.4, -9.1 + b1],
  ]) {
    g.fillStyle = '#0c110d';
    if (bl) g.fillRect(p[0] - 0.8, p[1] - 0.15, 1.6, 0.35);
    else {
      g.beginPath();
      g.arc(p[0], p[1], 0.85, 0, TAU);
      g.fill();
      g.fillStyle = '#d0ffe0';
      g.beginPath();
      g.arc(p[0] + 0.2, p[1] + dy * 0.4, 0.35, 0, TAU);
      g.fill();
    }
  }
  g.strokeStyle = '#0c110d';
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(0, -7 + b1, 1, Math.PI * 0.12, Math.PI * 0.88);
  g.stroke();
  /* тег на шнурке */
  g.save();
  g.translate(-2.2, 8.2 + b3);
  g.rotate(Math.sin(t * 2.2) * 0.16);
  g.strokeStyle = '#8a5a56';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 2.2);
  g.stroke();
  g.fillStyle = '#e8dcae';
  g.beginPath();
  rr(g, -2.6, 2.2, 5.2, 3.2, 0.8);
  g.fill();
  g.fillStyle = '#8a5a56';
  g.beginPath();
  g.arc(0, 2.9, 0.5, 0, TAU);
  g.fill();
  g.restore();
}
/* --- РЕВАРД 2013: автомат гатяпон — купол с шарами, тумба-лицо, рычаг --- */
function gachaArt(g, wp, mv, t, ay) {
  const stp = mv ? Math.sin(wp) * 1.8 : 0;
  /* колёсики-касторы */
  g.fillStyle = '#2c3520';
  g.beginPath();
  g.arc(-4.8 + stp * 0.6, 10.2, 1.7, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(4.8 - stp * 0.6, 10.2, 1.7, 0, TAU);
  g.fill();
  g.fillStyle = '#a3e635';
  g.beginPath();
  g.arc(-4.8 + stp * 0.6, 10.2, 0.55, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(4.8 - stp * 0.6, 10.2, 0.55, 0, TAU);
  g.fill();
  /* тумба */
  g.fillStyle = '#3a4526';
  g.beginPath();
  rr(g, -6.8, 1.6, 13.6, 7.8, 1.6);
  g.fill();
  g.fillStyle = '#242d20';
  g.fillRect(-6.8, 3.4, 13.6, 1);
  /* экран-лицо */
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, -4.8, 4.4, 9.6, 3.6, 0.9);
  g.fill();
  const dy = Math.max(-1, Math.min(1, ay)) * 0.45;
  eyePair(g, -2, 2, 6.2 + dy * 0.2, ay, t, '#d9ffa8', '#2c4a12');
  /* щель выдачи */
  g.fillStyle = '#0c110d';
  g.fillRect(-1.8, 8.4, 3.6, 0.9);
  /* шары в куполе */
  const jig = mv ? Math.sin(wp * 2) * 0.7 : 0;
  g.fillStyle = 'rgba(224,255,190,.13)';
  g.beginPath();
  g.arc(0, -3, 8.6, Math.PI, 0);
  g.closePath();
  g.fill();
  for (const b of [
    [-3.4, -4.9, '#f87171'],
    [0.7, -6.5, '#38bdf8'],
    [3.9, -4.7, '#ffe066'],
  ]) {
    g.fillStyle = b[2];
    g.beginPath();
    g.arc(b[0], b[1] + jig, 2.3, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.beginPath();
    g.arc(b[0] - 0.7, b[1] + jig - 0.7, 0.7, 0, TAU);
    g.fill();
  }
  /* обруч купола + блик */
  g.fillStyle = '#3a4526';
  g.fillRect(-8.6, -3.6, 17.2, 1.4);
  g.strokeStyle = 'rgba(224,255,190,.45)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(0, -3, 8.2, Math.PI * 1.08, Math.PI * 1.6);
  g.stroke();
  /* рычаг-джойстик */
  const jx = Math.sin(mv ? wp : t * 2.2) * 0.5;
  g.strokeStyle = '#57654a';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(8.6, 2.4);
  g.lineTo(10.2 + jx * 2.6, -1.4);
  g.stroke();
  g.fillStyle = '#a3e635';
  g.beginPath();
  g.arc(10.2 + jx * 2.6, -1.8, 1.4, 0, TAU);
  g.fill();
}
/* --- ГАН 2014: сиамские близнецы — шумовая и чистая половины со швом --- */
function ganArt(g, wp, mv, t, ay) {
  const stp = mv ? Math.sin(wp) * 2.4 : 0;
  /* ноги: своя у каждой половины */
  g.fillStyle = '#4a3f63';
  g.beginPath();
  rr(g, -5.6 + stp, 5.8, 3.7, 6.4, 1.6);
  g.fill();
  g.fillStyle = '#3c4f42';
  g.beginPath();
  rr(g, 1.9 - stp, 5.8, 3.7, 6.4, 1.6);
  g.fill();
  /* тело: две половины */
  g.fillStyle = '#4a3f63';
  g.beginPath();
  rr(g, -7.4, -4.4, 7.4, 10.6, 2);
  g.fill();
  g.fillStyle = '#3c4f42';
  g.beginPath();
  rr(g, 0, -4.4, 7.4, 10.6, 2);
  g.fill();
  /* шум на левой половине */
  let sd = Math.floor(t * 10) + 3;
  g.fillStyle = 'rgba(211,134,232,.45)';
  for (let i = 0; i < 6; i++) {
    sd = (sd * 16807 + 7) % 2147483647;
    g.fillRect(-6.6 + ((sd >> 2) % 6), -3.6 + ((sd >> 5) % 9), 1.1, 1.1);
  }
  /* шов-стежок */
  g.strokeStyle = '#ffd9f5';
  g.lineWidth = 0.9;
  g.beginPath();
  for (let y = -4.2; y < 6; y += 1.6) {
    g.moveTo(0, y);
    g.lineTo(0, y + 0.8);
  }
  g.stroke();
  /* индикатор правой половины */
  g.fillStyle = '#b8f5c8';
  g.fillRect(3.2, 0.6, 2.6, 1);
  /* руки: левая дёргается */
  const jit = Math.sin(t * 13) * 0.9;
  g.strokeStyle = 'rgba(0,0,0,.32)';
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-5.8, 0);
  g.lineTo(-9.6 + jit, 2.9);
  g.stroke();
  g.beginPath();
  g.moveTo(5.8, 0);
  g.lineTo(9.6, 3.2);
  g.stroke();
  /* головы */
  g.fillStyle = '#4a3f63';
  g.beginPath();
  rr(g, -10.6, -15.4, 10, 9.2, 2.4);
  g.fill();
  g.fillStyle = '#3c4f42';
  g.beginPath();
  rr(g, 0.6, -15.4, 10, 9.2, 2.4);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, -9.4, -14.4, 7.6, 7.2, 1.8);
  g.fill();
  g.beginPath();
  rr(g, 1.8, -14.4, 7.6, 7.2, 1.8);
  g.fill();
  /* лицо генератора: шум */
  sd = Math.floor(t * 11) + 1;
  g.fillStyle = 'rgba(211,134,232,.5)';
  for (let i = 0; i < 5; i++) {
    sd = (sd * 16807 + 7) % 2147483647;
    g.fillRect(-8.8 + ((sd >> 2) % 6), -13.6 + ((sd >> 5) % 5), 1, 1);
  }
  g.fillStyle = '#ffd9f5';
  g.beginPath();
  g.arc(-7.3, -10.9, 0.8, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(-4.9, -10.9, 0.8, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,217,245,.7)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-6.7, -8.8);
  g.lineTo(-5.5, -8.8);
  g.stroke();
  /* лицо дискриминатора: строгое, с бровью */
  const dy = Math.max(-1, Math.min(1, ay)) * 0.5;
  g.fillStyle = '#3c4f42';
  g.fillRect(3.1, -12.6, 4.2, 0.7);
  g.fillRect(6.6, -12.2, 1.6, 0.6);
  g.fillStyle = '#b8f5c8';
  g.beginPath();
  g.arc(3.6, -10.9 + dy * 0.3, 0.8, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(6.2, -10.9 + dy * 0.3, 0.8, 0, TAU);
  g.fill();
  g.fillStyle = '#0c110d';
  g.fillRect(3.35, -11.05 + dy * 0.3, 0.5, 0.45);
  g.fillRect(5.95, -11.05 + dy * 0.3, 0.5, 0.45);
  g.strokeStyle = '#b8f5c8';
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(4.9, -9.1, 1.2, Math.PI * 0.12, Math.PI * 0.88);
  g.stroke();
  /* антенны: у генератора вихляет */
  const swx = Math.sin(t * 3) * 1.2;
  g.strokeStyle = '#2a332b';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-7.6, -15.4);
  g.quadraticCurveTo(-8.4 + swx, -17.6, -7.4 + swx, -19.2);
  g.stroke();
  g.beginPath();
  g.moveTo(7.4, -15.4);
  g.lineTo(7.4, -19.2);
  g.stroke();
  g.fillStyle = '#d386e8';
  g.beginPath();
  g.arc(-7.4 + swx, -19.6, 1, 0, TAU);
  g.fill();
  g.fillStyle = '#b8f5c8';
  g.beginPath();
  g.arc(7.4, -19.6, 1, 0, TAU);
  g.fill();
}
/* --- АТТЕНШН 2017: ядро с главным глазом, орбитальные глаза на лучах внимания --- */
function attnArt(g, wp, mv, t, ay) {
  /* орбитальные глаза */
  const eyes = [];
  for (let i = 0; i < 4; i++) {
    const a = t * 0.8 + (i * Math.PI) / 2;
    eyes.push([Math.cos(a) * 10.6, Math.sin(a) * 6.2 - 1.2, 1.4 + (i % 2) * 0.35]);
  }
  /* лучи внимания */
  g.strokeStyle = 'rgba(192,132,252,.5)';
  g.lineWidth = 0.8;
  g.setLineDash([2.6, 2]);
  for (let i = 0; i < 4; i++) {
    const w = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7));
    g.globalAlpha = w;
    g.beginPath();
    g.moveTo(0, -1);
    g.lineTo(eyes[i][0], eyes[i][1]);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.setLineDash([]);
  for (const e of eyes) {
    g.fillStyle = '#f3d9ff';
    g.beginPath();
    g.arc(e[0], e[1], e[2], 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(e[0] + 0.2, e[1], e[2] * 0.42, 0, TAU);
    g.fill();
  }
  /* ядро */
  g.fillStyle = 'rgba(192,132,252,.2)';
  g.beginPath();
  g.arc(0, -1, 7.6, 0, TAU);
  g.fill();
  g.fillStyle = '#5a4a72';
  g.beginPath();
  rr(g, -4.6, -6.6, 9.2, 11, 3);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, -3.4, -5.4, 6.8, 8.6, 2.2);
  g.fill();
  /* главный глаз */
  const dy = Math.max(-1.6, Math.min(1.6, ay));
  if (t % 3.7 < 0.13) {
    g.fillStyle = '#f3d9ff';
    g.fillRect(-2.2, -1.35, 4.4, 0.7);
  } else {
    g.fillStyle = '#f3d9ff';
    g.beginPath();
    g.arc(0, -1, 2.3, 0, TAU);
    g.fill();
    g.fillStyle = '#c084fc';
    g.beginPath();
    g.arc(0.2, -1 + dy * 0.5, 1.2, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(0.2, -1 + dy * 0.7, 0.6, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath();
    g.arc(-0.7, -1.9 + dy * 0.4, 0.4, 0, TAU);
    g.fill();
  }
  /* нимб малых глаз */
  for (let i = 0; i < 3; i++) {
    const ax = -3.2 + i * 3.2,
      hy = -9.8 - (i === 1 ? 2.2 : 0) + Math.sin(t * 2 + i) * 0.4;
    g.strokeStyle = '#5a4a72';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(ax, hy + 1.8);
    g.lineTo(ax, hy + 0.9);
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(ax, hy, 1.15, 0, TAU);
    g.fill();
    g.fillStyle = '#c084fc';
    g.beginPath();
    g.arc(ax, hy, 0.55, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(ax, hy + 0.08, 0.26, 0, TAU);
    g.fill();
  }
}
/* --- ДИФФУЗИЯ 2020: рой частиц вокруг размытого лица, растягивается при беге --- */
function diffArt(g, wp, mv, t, ay) {
  const fy = Math.sin(t * 1.8) * 0.6;
  /* размытое ядро-лицо */
  g.fillStyle = 'rgba(168,162,158,.3)';
  g.beginPath();
  g.arc(0, -1 + fy, 7.8, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(225,220,212,.3)';
  g.beginPath();
  g.arc(0, -1 + fy, 5.4, 0, TAU);
  g.fill();
  const dy = Math.max(-1.2, Math.min(1.2, ay)) * 0.5;
  const bl = t % 3.7 < 0.13;
  g.fillStyle = 'rgba(245,245,240,.75)';
  if (bl) {
    g.fillRect(-2.9, -1.4 + fy, 2, 0.4);
    g.fillRect(0.9, -1.4 + fy, 2, 0.4);
  } else {
    g.beginPath();
    g.arc(-1.8, -1 + fy + dy * 0.4, 1.05, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(1.8, -1 + fy + dy * 0.4, 1.05, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(30,28,26,.8)';
    g.beginPath();
    g.arc(-1.6, -1 + fy + dy * 0.5, 0.5, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(2, -1 + fy + dy * 0.5, 0.5, 0, TAU);
    g.fill();
  }
  g.strokeStyle = 'rgba(245,245,240,.5)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(0.2, 1.7 + fy, 1.2, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();
  /* рой частиц */
  const strh = mv ? -1.3 : 0;
  for (let i = 0; i < 16; i++) {
    const ph = t * (0.6 + (i % 5) * 0.13) + i * 1.31;
    const rad2 = 3.4 + ((i * 37) % 70) / 10;
    const px = Math.cos(ph + i * 0.6) * rad2 * 1.35 + strh * rad2;
    const py = Math.sin(ph * 0.9 + i * 0.7) * rad2 * 0.6 - 1;
    const al = 0.32 + 0.5 * (0.5 + 0.5 * Math.sin(ph * 2 + i));
    g.fillStyle = i % 3 ? 'rgba(200,196,190,' + al.toFixed(2) + ')' : 'rgba(245,245,240,' + al.toFixed(2) + ')';
    g.fillRect(px, py, 1.5, 1.5);
  }
  /* пунктирное гало */
  g.strokeStyle = 'rgba(190,185,178,.55)';
  g.lineWidth = 0.9;
  g.setLineDash([1.8, 1.6]);
  g.beginPath();
  g.arc(0, -1, 10.8, 0, TAU);
  g.stroke();
  g.setLineDash([]);
}
const AGENT_ART = {
  punch: cardArt,
  lamp: tubeArt,
  asm: pcbArt,
  lisp: parenArt,
  clang: kernArt,
  decide: treeArt,
  js: winArt,
  svm: svmArt,
  echo: cassetteArt,
  git: gitArt,
  rl: gachaArt,
  gan: ganArt,
  attn: attnArt,
  diff: diffArt,
};

function snakeArt(g, wp, mv, t, ay) {
  // ПИТОН: робо-змей из сегментов
  const col = CHARCOL.py,
    lt = shade(col, 0.35),
    dk2 = shade(col, -0.3);
  const sl = i => Math.sin(t * 4 + i * 1.1) * (mv ? 2.1 : 1.1);
  for (let i = 4; i >= 1; i--) {
    const sx = 3 - i * 4,
      sy = 1.4 + sl(i),
      r = 4.4 - i * 0.55;
    g.fillStyle = dk2;
    g.beginPath();
    g.arc(sx, sy, r, 0, TAU);
    g.fill();
    g.fillStyle = i % 2 ? col : lt;
    g.beginPath();
    g.arc(sx, sy, r * 0.72, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)';
    g.beginPath();
    g.arc(sx - r * 0.25, sy - r * 0.3, r * 0.3, 0, TAU);
    g.fill();
  }
  const tx = 3 - 5 * 4,
    ty = 1.4 + sl(5);
  g.fillStyle = '#ffd257';
  dia(g, tx, ty, 1.7);
  g.fillStyle = '#e8b13f';
  dia(g, tx - 2.2, ty + 0.4, 1.2);
  const hx = 4.6,
    hy = -0.6 + sl(0) * 0.6;
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(hx, hy, 6, 4.6, 0, 0, TAU);
  g.fill();
  g.fillStyle = lt;
  g.beginPath();
  g.ellipse(hx + 1.6, hy + 1.4, 3.4, 2.2, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, hx - 0.6, hy - 3.4, 5.2, 4.4, 1.8);
  g.fill();
  const dy = Math.max(-1.2, Math.min(1.2, ay));
  const blink = t % 3.7 < 0.13;
  g.fillStyle = '#bff7e8';
  if (blink) {
    g.fillRect(hx + 0.6, hy - 1.4 + dy * 0.5, 1.6, 0.4);
    g.fillRect(hx + 3, hy - 1.4 + dy * 0.5, 1.4, 0.4);
  } else {
    g.beginPath();
    g.arc(hx + 1.4, hy - 1.2 + dy * 0.5, 0.95, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(hx + 3.6, hy - 1.2 + dy * 0.5, 0.8, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(hx + 1.7, hy - 1.2 + dy * 0.5, 0.42, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(hx + 3.8, hy - 1.2 + dy * 0.5, 0.36, 0, TAU);
    g.fill();
  }
  g.strokeStyle = '#ff7d9d';
  g.lineWidth = 0.9;
  const tl = Math.sin(t * 6) * 1.2;
  g.beginPath();
  g.moveTo(hx + 5.4, hy + 1);
  g.lineTo(hx + 7.6 + tl, hy + 1.3);
  g.stroke();
  g.beginPath();
  g.moveTo(hx + 7.6 + tl, hy + 1.3);
  g.lineTo(hx + 8.8 + tl, hy + 0.7);
  g.moveTo(hx + 7.6 + tl, hy + 1.3);
  g.lineTo(hx + 8.6 + tl, hy + 2.1);
  g.stroke();
  g.fillStyle = '#4ade80';
  g.beginPath();
  rr(g, hx - 3.4, hy - 6.6, 3.4, 1.8, 0.5);
  g.fill();
  g.fillStyle = '#0c110d';
  g.fillRect(hx - 0.4, hy - 6.2, 0.8, 1);
}
function orbArt(g, wp, mv, t, ay) {
  // АГИ: парящее око с орбитами
  const gr = g.createRadialGradient(0, -1, 2, 0, -1, 17);
  gr.addColorStop(0, 'rgba(255,230,102,.5)');
  gr.addColorStop(0.6, 'rgba(255,230,102,.14)');
  gr.addColorStop(1, 'rgba(255,230,102,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, -1, 17, 0, TAU);
  g.fill();
  g.save();
  g.rotate(Math.sin(t * 0.9) * 0.22);
  g.strokeStyle = 'rgba(255,230,102,.65)';
  g.lineWidth = 1.1;
  g.beginPath();
  g.ellipse(0, -1, 13.5, 4.6, 0, 0, TAU);
  g.stroke();
  const a1 = t * 1.6;
  g.fillStyle = '#fff6cf';
  g.beginPath();
  g.arc(Math.cos(a1) * 13.5, Math.sin(a1) * 4.6 - 1, 1.3, 0, TAU);
  g.fill();
  g.restore();
  g.save();
  g.rotate(-0.5 + Math.cos(t * 0.7) * 0.2);
  g.strokeStyle = 'rgba(255,230,102,.4)';
  g.lineWidth = 0.9;
  g.beginPath();
  g.ellipse(0, -1, 10.5, 3.4, 0, 0, TAU);
  g.stroke();
  const a2 = -t * 1.2 + 2;
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(Math.cos(a2) * 10.5, Math.sin(a2) * 3.4 - 1, 1, 0, TAU);
  g.fill();
  g.restore();
  g.fillStyle = '#fff8dd';
  g.beginPath();
  g.arc(0, -1, 6.2, 0, TAU);
  g.fill();
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(0, -1, 4.9, 0, TAU);
  g.fill();
  const dy = Math.max(-1.3, Math.min(1.3, ay));
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(0, -1 + dy * 0.5, 3.1, 0, TAU);
  g.fill();
  g.fillStyle = '#8a6d1a';
  g.beginPath();
  g.arc(0.2, -1 + dy, 1.7, 0, TAU);
  g.fill();
  g.fillStyle = '#2b230a';
  g.beginPath();
  g.arc(0.2, -1 + dy, 0.85, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath();
  g.arc(-0.7, -2 + dy, 0.55, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,248,221,.85)';
  dia(g, 9, -8 + Math.sin(t * 2.2) * 1.2, 1);
  dia(g, -10, 5 + Math.cos(t * 1.9) * 1.1, 0.8);
  dia(g, 7.5, 6.5 + Math.sin(t * 2.6 + 2) * 1, 0.6);
}

function dinoArt(g, wp, mv, t) {
  // ЛЕГАСИ: динозавр (вид сбоку)
  const stp = mv ? Math.sin(wp) * 2.8 : 0;
  const sw = Math.sin(t * 2.6) * 2;
  const leg = (x, y, fc) => {
    g.fillStyle = fc;
    g.beginPath();
    rr(g, x - 1.7, y, 3.4, 5.6, 1.5);
    g.fill();
    g.beginPath();
    g.ellipse(x + 0.5, y + 5.2, 2.1, 1.1, 0, 0, TAU);
    g.fill();
  };
  leg(-3 - stp, 4.4, '#b85c2e');
  leg(5.6 + stp, 4.4, '#b85c2e'); // дальние лапы
  g.fillStyle = '#e8794a'; // хвост
  g.beginPath();
  g.moveTo(-5, -4.6);
  g.quadraticCurveTo(-12, -4.4 + sw * 0.6, -16.6, -2 + sw);
  g.quadraticCurveTo(-11.6, 1.4 + sw * 0.6, -4.6, 3.9);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffd9b0';
  dia(g, -12.4, -2.8 + sw * 0.8, 1.5);
  dia(g, -15, -1.8 + sw, 1.15); // шипы на хвосте
  g.fillStyle = '#e8794a'; // тело
  g.beginPath();
  g.ellipse(-0.4, 0, 9.9, 7.3, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#f2b98a'; // брюхо
  g.beginPath();
  g.ellipse(0.8, 2.4, 6.6, 3.7, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#ffd9b0'; // шипы на спине
  dia(g, -6.4, -5.7, 1.7);
  dia(g, -2.7, -6.8, 1.9);
  dia(g, 1.2, -6.5, 1.8);
  dia(g, 4.2, -5.1, 1.5);
  leg(0.6 + stp, 4.9, '#e8794a');
  leg(8 - stp, 4.9, '#e8794a'); // ближние лапы
  g.fillStyle = '#c96a38';
  g.beginPath();
  g.arc(6, 0.6, 1.7, 0, TAU);
  g.fill(); // ручка
  g.fillStyle = '#e8794a'; // голова
  g.beginPath();
  g.arc(9.4, -3.2, 5, 0, TAU);
  g.fill();
  g.beginPath();
  rr(g, 11.6, -4.6, 6.4, 4.8, 2.1);
  g.fill();
  g.fillStyle = '#f2a97e'; // челюсть
  g.beginPath();
  rr(g, 12.2, -2.4, 5.4, 2.4, 1.1);
  g.fill();
  g.fillStyle = '#8a4526';
  g.beginPath();
  g.arc(16.9, -3.6, 0.6, 0, TAU);
  g.fill(); // ноздря
  g.strokeStyle = '#8a4526';
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(12.6, -0.4);
  g.lineTo(16.9, -1);
  g.stroke(); // рот
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(10, -4.6, 2, 0, TAU);
  g.fill(); // глаз
  g.fillStyle = '#10150f';
  g.beginPath();
  g.arc(10.7, -4.6, 1.05, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.beginPath();
  g.arc(11, -5.1, 0.4, 0, TAU);
  g.fill();
}
function drawPlayer(ox, oy) {
  const x = P.x + ox,
    y = P.y + oy;
  if (P.iv > 0 && Math.floor(run.t * 14) % 2 === 0) return;
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + P.r * 0.85, P.r * 1.05, P.r * 0.45, 0, 0, TAU);
  ctx.fill();
  const mv = !!(keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || joy.on);
  const va = Math.atan2(P.aim.y, P.aim.x);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(P.r / 10, P.r / 10);
  drawAgentArt(ctx, run.charId, va, mv ? run.t * 11.5 : 0, mv, run.t);
  ctx.restore();
  if (P.hp < P.maxhp) {
    ctx.fillStyle = '#160b0b';
    ctx.fillRect(x - 16, y + P.r + 7, 32, 4);
    ctx.fillStyle = P.hp / P.maxhp < 0.35 ? '#f87171' : '#38e07f';
    ctx.fillRect(x - 16, y + P.r + 7, 32 * clamp(P.hp / P.maxhp, 0, 1), 4);
  }
}
function drawOrbits(ox, oy) {
  for (const w of P.weapons) {
    if (w.hyper && w.id === 'whip' && w.bladeR) {
      /* ДЕБАГГЕР: лезвие-карусель */
      const a = w.bladeA || 0,
        R = w.bladeR;
      ctx.strokeStyle = 'rgba(251,191,36,.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(P.x + ox, P.y + oy, R, 0, TAU);
      ctx.stroke();
      const bx = P.x + Math.cos(a) * R,
        by = P.y + Math.sin(a) * R;
      ctx.save();
      ctx.translate(bx + ox, by + oy);
      ctx.rotate(a);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-26, -7, 52, 14);
      ctx.fillStyle = '#fff';
      ctx.fillRect(8, -2, 28, 4);
      ctx.restore();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(P.x + ox, P.y + oy, 5, 0, TAU);
      ctx.fill();
    }
    if (w.id !== 'orbit' || !w.active) continue;
    for (let i = 0; i < w.n; i++) {
      const a = w.ang + (i * TAU) / w.n;
      const x = P.x + Math.cos(a) * w.or + ox,
        y = P.y + Math.sin(a) * w.or + oy;
      ctx.fillStyle = w.hyper ? '#7dd3fc' : w.ev ? '#fbbf24' : '#a78bfa';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(4,9,6,.6)';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 10, run.t * 6, run.t * 6 + 1.8);
      ctx.stroke();
    }
  }
}
function drawBullets(ox, oy) {
  for (const b of bullets) {
    const x = b.x + ox,
      y = b.y + oy;
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
    if (b.kind === 'knife') {
      ctx.strokeStyle = '#eafff3';
      ctx.lineWidth = b.big ? 4.5 : 3;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(b.ang) * 10, y - Math.sin(b.ang) * 10);
      ctx.lineTo(x + Math.cos(b.ang) * 8, y + Math.sin(b.ang) * 8);
      ctx.stroke();
    } else if (b.kind === 'shur') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.rot || 0);
      ctx.strokeStyle = '#7ef29a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-b.r, 0);
      ctx.lineTo(b.r, 0);
      ctx.moveTo(0, -b.r);
      ctx.lineTo(0, b.r);
      ctx.stroke();
      ctx.fillStyle = '#eafff3';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (b.kind === 'saw') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.rot);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(0, 0, b.r * 0.75, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#e8c14a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0.3, 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, b.r, Math.PI + 0.3, Math.PI + 1.2);
      ctx.stroke();
      ctx.restore();
    } else if (b.kind === 'fire') {
      if (b.dark) {
        /* СИНГУЛЯРНОСТЬ: чёрная бомба */
        ctx.fillStyle = 'rgba(167,139,250,.4)';
        ctx.beginPath();
        ctx.arc(x, y, b.r + 6 + 2 * Math.sin(run.t * 9), 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2b1d4e';
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath();
        ctx.arc(x, y, b.r * 0.4, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(x, y, b.r + 2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(x, y, b.r * 0.55, 0, TAU);
        ctx.fill();
      }
    } else if (b.kind === 'axe') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.rot);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-3, -b.r, b.r * 0.4, b.r * 2);
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.moveTo(b.r * 0.3, -b.r);
      ctx.lineTo(b.r, -b.r * 0.5);
      ctx.lineTo(b.r, b.r * 0.5);
      ctx.lineTo(b.r * 0.3, b.r);
      ctx.fill();
      ctx.restore();
    } else if (b.kind === 'boom') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.rot);
      if (b.sawLook) {
        /* гипер-лезвие: диск-фрагмент */
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 0, b.r * 0.75, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, b.r, 0.3, 1.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, b.r, Math.PI + 0.3, Math.PI + 1.2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#e8c14a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, b.r, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, b.r, Math.PI - 0.6, Math.PI + 0.6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (b.kind === 'lob') {
      const k = clamp(b.t / b.T, 0, 1);
      const px = lerp(b.x, b.tx, k) + ox;
      const py = lerp(b.y, b.ty, k) + oy - Math.sin(Math.PI * k) * 38;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      ctx.ellipse(lerp(b.x, b.tx, k) + ox, lerp(b.y, b.ty, k) + oy, 5, 2.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = b.col || '#38e07f';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, TAU);
      ctx.fill();
    }
  }
}
function drawFx(ox, oy) {
  for (const f of fx) {
    const k = clamp(f.life / f.T, 0, 1);
    if (f.type === 'slash') {
      ctx.globalAlpha = k * 0.7;
      ctx.strokeStyle = '#a3e635';
      ctx.lineWidth = 4;
      const rot = f.vert ? Math.PI / 2 : 0;
      const rx = f.vert ? f.h / 2 : f.w / 2,
        ry = f.vert ? f.w / 2 : f.h / 2;
      ctx.beginPath();
      ctx.ellipse(f.x + ox, f.y + oy, rx, ry, rot, f.side > 0 ? -0.9 : Math.PI - 0.9, f.side > 0 ? 0.9 : Math.PI + 0.9);
      ctx.stroke();
      ctx.globalAlpha = k * 0.15;
      ctx.fillStyle = '#a3e635';
      ctx.fillRect(f.x + ox - f.w / 2, f.y + oy - f.h / 2, f.w, f.h);
      ctx.globalAlpha = 1;
    } else if (f.type === 'ring') {
      const r = lerp(f.r0, f.r1, 1 - k);
      ctx.globalAlpha = k * 0.8;
      ctx.strokeStyle = f.col || '#38e07f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(f.x + ox, f.y + oy, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.type === 'bolt') {
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#cfe8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < f.pts.length; i++) {
        const p = f.pts[i];
        if (i === 0) ctx.moveTo(p[0] + ox, p[1] + oy);
        else ctx.lineTo(p[0] + ox, p[1] + oy);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(157,180,255,.5)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.type === 'laser') {
      const tel = f.fired;
      ctx.globalAlpha = tel ? k : 0.3 + 0.25 * Math.sin(run.t * 30);
      ctx.strokeStyle = f.col || '#f87171';
      ctx.lineWidth = tel ? f.w : 1.5;
      ctx.beginPath();
      if (f.horiz) {
        ctx.moveTo(0, f.coord + oy);
        ctx.lineTo(W, f.coord + oy);
      } else {
        ctx.moveTo(f.coord + ox, 0);
        ctx.lineTo(f.coord + ox, H);
      }
      ctx.stroke();
      if (tel) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1, f.w * 0.25);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (f.type === 'rail') {
      ctx.globalAlpha = k * 0.9;
      ctx.strokeStyle = f.col || '#eafff3';
      ctx.lineWidth = f.wid * k + 1;
      ctx.beginPath();
      ctx.moveTo(f.x + ox, f.y + oy);
      ctx.lineTo(f.x + ox + Math.cos(f.a) * f.len, f.y + oy + Math.sin(f.a) * f.len);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1, f.wid * 0.3 * k);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
function drawParts(ox, oy) {
  for (const p of parts) {
    ctx.globalAlpha = clamp(p.life / p.T, 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x + ox - p.sz / 2, p.y + oy - p.sz / 2, p.sz, p.sz);
  }
  ctx.globalAlpha = 1;
}
function drawDmgNums(ox, oy) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 12px monospace';
  for (const d of dmgNums) {
    ctx.globalAlpha = clamp(d.life / d.T, 0, 1);
    ctx.fillStyle = '#040906';
    ctx.fillText(d.txt, d.x + ox + 1, d.y + oy + 1);
    ctx.fillStyle = d.col;
    ctx.fillText(d.txt, d.x + ox, d.y + oy);
  }
  ctx.globalAlpha = 1;
}
function drawNotes(ox, oy) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px monospace';
  for (const n of notes) {
    ctx.globalAlpha = clamp(n.life > n.T - 0.25 ? (n.T - n.life) / 0.25 : Math.min(1, n.life / 0.6), 0, 1);
    const ls = n.txt.split('\n');
    for (let i = 0; i < ls.length; i++) {
      const yy = n.y + oy + i * 18 - (ls.length - 1) * 9;
      ctx.fillStyle = '#040906';
      ctx.fillText(ls[i], n.x + ox + 1.5, yy + 1.5);
      ctx.fillStyle = n.col;
      ctx.fillText(ls[i], n.x + ox, yy);
    }
  }
  ctx.globalAlpha = 1;
}

/* ================= ACHIEVEMENTS ================= */
/* silent=true — выдача без тостов/звука со списком «что выдано» (экран окончания забега);
   посреди забега ачивки не выдаются вообще: условия копятся, оформление — только по итогам */
function checkAch(silent) {
  const got = [],
    UNL = {
      char: 'АГЕНТ ОТКРЫТ',
      stage: 'КАРТА ОТКРЫТА',
      w: '⚙️ ОРУЖИЕ ОТКРЫТО',
      p: '🧩 ПАССИВ ОТКРЫТ',
      meta: 'МОДУЛЬ ОТКРЫТ',
    },
    LOW = { char: 'агент', stage: 'карта', w: 'оружие', p: 'пассив', meta: 'модуль' };
  for (const a of ACH) {
    if (save.ach[a.id]) continue;
    let ok = false;
    try {
      ok = a.c(save.stats);
    } catch (e) {}
    if (ok) {
      save.ach[a.id] = true;
      save.coins += a.r;
      save.stats.coins += a.r;
      const unl = [];
      for (const c of CHARS)
        if (c.lockAch === a.id) {
          save.chars[c.id] = true;
          unl.push(['char', c.name]);
        }
      for (const s of STAGES)
        if (s.unlockAch === a.id) {
          save.stages[s.id] = true;
          unl.push(['stage', s.name]);
        }
      for (const id in WEAPONS) if (WEAPONS[id].lockAch === a.id) unl.push(['w', WEAPONS[id].name]);
      for (const id in PASSIVES) if (PASSIVES[id].lockAch === a.id) unl.push(['p', PASSIVES[id].name]);
      if (META_ACH[a.id] && !save.meta[META_ACH[a.id]]) {
        save.meta[META_ACH[a.id]] = 1;
        unl.push(['meta', META_ACH_NAME[META_ACH[a.id]]]);
      }
      if (silent)
        got.push({
          name: a.name,
          d: a.d,
          r: a.r,
          extra: unl.length ? ' → открыто: ' + unl.map(u => LOW[u[0]] + ' ' + u[1]).join(', ') : '',
        });
      else {
        toast('🏆 ' + a.name + ' (+' + a.r + ')', 'amb');
        sfx('chest');
        for (const u of unl) toast(UNL[u[0]] + ': ' + u[1], 'amb');
      }
    }
  }
  saveGame();
  return got;
}
function grantBackUnlocks() {
  for (const c of CHARS) if (c.lockAch && save.ach[c.lockAch]) save.chars[c.id] = true;
  for (const s of STAGES) if (s.unlockAch && save.ach[s.unlockAch]) save.stages[s.id] = true;
  for (const id in META_ACH) if (save.ach[id]) save.meta[META_ACH[id]] = 1;
}

/* ================= SCREENS ================= */
function hideAllScreens() {
  document.querySelectorAll('.screen,.modal').forEach(e => e.classList.add('hidden'));
}
function openScreen(name) {
  appState = name;
  hideAllScreens();
  if (name === 'menu') {
    $('menu').classList.remove('hidden');
    $('menuCoins').textContent = fmt(save.coins);
    $('btnCodex').classList.toggle('hidden', !save.meta.codex);
  } else if (name === 'chars') {
    renderCharGrid();
    $('charSelect').classList.remove('hidden');
    $('charCoins').textContent = fmt(save.coins);
  } else if (name === 'stages') {
    renderStageGrid();
    $('stageSelect').classList.remove('hidden');
  } else if (name === 'shop') {
    renderShop();
    $('shop').classList.remove('hidden');
  } else if (name === 'ach') {
    renderAch();
    $('achScreen').classList.remove('hidden');
  } else if (name === 'codex') {
    renderCodex();
    $('codexScreen').classList.remove('hidden');
  } else if (name === 'stats') {
    renderStats();
    $('statsScreen').classList.remove('hidden');
  } else if (name === 'settings') {
    $('settingsScreen').classList.remove('hidden');
  }
  /* каждый экран открывается с верха (на display:none scrollTop не сбросить) */
  const scr = {
    menu: 'menu',
    chars: 'charSelect',
    stages: 'stageSelect',
    shop: 'shop',
    ach: 'achScreen',
    codex: 'codexScreen',
    stats: 'statsScreen',
    settings: 'settingsScreen',
  }[name];
  if (scr) $(scr).scrollTop = 0;
}
let selChar = CHARS.find(c => c.id === save.lastChar) ? save.lastChar : CHARS[0].id;
function charUnlocked(c) {
  if (save.chars[c.id]) return true;
  if (c.lockAch && save.ach[c.lockAch]) {
    save.chars[c.id] = true;
    return true;
  }
  return false;
}
function growTxt(c) {
  const g = c.grow;
  if (!g) return '';
  const M = {
    dmg: 'урон',
    cd: 'перезарядка',
    area: 'площадь',
    proj: 'скор. снарядов',
    dur: 'длительность',
    hp: 'макс. HP',
    mspd: 'скорость бега',
    magnet: 'радиус подбора',
    luck: 'удача',
    growth: 'опыт',
    all: 'все параметры',
  };
  const v = Math.round(g.per * 1000) / 10;
  return (g.s === 'cd' ? '−' + v + '%' : '+' + v + '%') + ' ' + M[g.s] + ' за ур.';
}
function renderCharGrid() {
  const g = $('charGrid');
  g.innerHTML = '';
  for (const c of CHARS) {
    const un = charUnlocked(c);
    const d = document.createElement('div');
    d.className = 'card' + (un ? '' : ' lock') + (selChar === c.id ? ' sel' : '');
    let foot;
    if (un)
      foot =
        '<div class="cost" style="color:var(--mut)">' +
        (c.cost ? 'куплен' : 'доступен') +
        ' · старт: ' +
        (c.weapon ? WEAPONS[c.weapon].icon + ' ' + WEAPONS[c.weapon].name : 'собирает сам') +
        (c.grow ? ' · рост: ' + growTxt(c) : '') +
        '</div>';
    else if (c.lockAch) foot = '<div class="lockd">🔒 ' + c.lockTxt + '</div>';
    else foot = '<div class="cost">◉ ' + c.cost + ' — купить</div>';
    d.innerHTML =
      '<img class="faceImg" src="' +
      charArtURL(c.id) +
      '" alt="' +
      c.face +
      '"><div class="nm">' +
      c.name +
      '</div><div class="ds">' +
      c.d +
      '</div>' +
      foot;
    d.onclick = () => {
      sfx('click');
      if (un) {
        selChar = c.id;
        save.lastChar = c.id;
        saveGame();
        renderCharGrid();
      } else if (c.cost && save.coins >= c.cost) {
        save.coins -= c.cost;
        save.chars[c.id] = true;
        selChar = c.id;
        save.lastChar = c.id;
        saveGame();
        toast('АГЕНТ КУПЛЕН: ' + c.name, 'amb');
        renderCharGrid();
        $('charCoins').textContent = fmt(save.coins);
      } else if (c.cost) toast('НЕ ХВАТАЕТ МОНЕТ: нужно ◉' + c.cost, 'red');
    };
    g.appendChild(d);
  }
  $('charOk').disabled = !charUnlocked(CHARS.find(c => c.id === selChar));
}
let endlessOn = false,
  selStage = null;
/* ♾ на карте открывается только победой на НЕЙ (winsBy), а не глобальным «поиграл куда-то» */
const endlessUnlocked = id => (save.stats.winsBy[id] || 0) >= 1;
function renderStageGrid() {
  const ac = CHARS.find(c => c.id === selChar) || CHARS[0];
  $('stageAgentInfo').innerHTML =
    'агент: <img class="miniFace" src="' +
    charArtURL(ac.id) +
    '" alt="' +
    ac.face +
    '"> <b>' +
    ac.name +
    '</b> · ' +
    (ac.weapon ? WEAPONS[ac.weapon].icon + ' ' + WEAPONS[ac.weapon].name : 'соберёт сам');
  const g = $('stageGrid');
  g.innerHTML = '';
  for (const s of STAGES) {
    let un = save.stages[s.id];
    if (!un && s.unlockAch && save.ach[s.unlockAch]) {
      un = true;
      save.stages[s.id] = true;
    }
    const d = document.createElement('div');
    d.className = 'card' + (un ? '' : ' lock') + (selStage === s.id ? ' sel' : '');
    d.style.width = '290px';
    const best = save.stats.best[s.id] || 0;
    let foot;
    if (un)
      foot =
        '<div class="cost" style="color:var(--mut)">рекорд: ' +
        fmtT(best) +
        (save.stats.winsBy[s.id] ? ' · ★ ПОБЕДА' : '') +
        (endlessUnlocked(s.id) ? ' · ♾' : '') +
        '</div>';
    else {
      const a = ACH.find(x => x.id === s.unlockAch);
      foot = '<div class="lockd">🔒 откроется: «' + (a ? a.name : '') + '»</div>';
    }
    d.innerHTML =
      '<img class="stageImg" src="' +
      stageArtURL(s.id) +
      '" style="border-color:' +
      s.accent +
      '55" alt="' +
      s.name +
      '">' +
      '<div class="nm" style="font-size:16px">' +
      s.name +
      '</div>' +
      (s.era ? '<div class="era">' + s.era + '</div>' : '') +
      '<div class="ds">' +
      s.desc +
      '</div>' +
      foot;
    d.onclick = () => {
      sfx('click');
      if (!un) {
        toast('СНАЧАЛА ОТКРОЙ КАРТУ', 'red');
        return;
      }
      /* клик = только выбор; старт — кнопкой «ИГРАТЬ» в шапке */
      selStage = s.id;
      if (!endlessUnlocked(s.id)) endlessOn = false;
      renderStageGrid();
      $('stagePanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    g.appendChild(d);
  }
  updateStagePanel();
  saveGame();
}
function updateStagePanel() {
  const s = STAGES.find(x => x.id === selStage);
  $('stageGo').disabled = !(s && save.stages[s.id]);
  const panel = $('stagePanel');
  if (!s) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  const eu = endlessUnlocked(s.id);
  $('endlessWrap').classList.toggle('hidden', !eu);
  $('endlessLock').classList.toggle('hidden', eu);
  $('endlessTgl').classList.toggle('on', endlessOn);
}
function renderShop() {
  const g = $('shopGrid');
  g.innerHTML = '';
  $('shopCoins').textContent = fmt(save.coins);
  for (const m of META) {
    const lv = save.meta[m.id];
    const d = document.createElement('div');
    d.className = 'card';
    let prog;
    if (m.max === Infinity) {
      const curTxt =
        m.id === 'dinf'
          ? lv + '% урона'
          : m.id === 'cinf'
            ? lv + '% монет'
            : m.id === 'hpinf'
              ? '+' + lv + ' макс. HP'
              : lv + '% силы багов';
      prog =
        '<div class="pips"><div class="pip gold on"></div><div style="color:var(--mut);font-size:11px">уровень ' +
        lv +
        ' · сейчас: +' +
        curTxt +
        '</div></div>';
    } else {
      prog = '<div class="pips">';
      for (let i = 0; i < m.max; i++) prog += '<div class="pip' + (i < lv ? ' on' : '') + '"></div>';
      prog += '</div>';
    }
    const maxed = lv >= m.max;
    const cost = maxed ? 0 : m.cost(lv);
    d.innerHTML =
      '<div class="face" style="font-size:26px">' +
      m.icon +
      '</div><div class="nm">' +
      m.name +
      '</div><div class="ds">' +
      m.d +
      '</div>' +
      prog +
      '<div class="shopCost cost">' +
      (maxed
        ? '<span style="color:var(--grn2)">' + (m.max === Infinity ? '×∞' : 'МАКСИМУМ') + '</span>'
        : '◉ ' + fmt(cost)) +
      '</div>';
    if (!maxed) {
      d.onclick = () => {
        if (save.coins >= cost) {
          save.coins -= cost;
          save.meta[m.id]++;
          saveGame();
          sfx('coin');
          toast(m.name + ' → УР. ' + save.meta[m.id]);
          renderShop();
        } else toast('НЕ ХВАТАЕТ МОНЕТ', 'red');
      };
    } else d.classList.add('lock');
    g.appendChild(d);
  }
}
function renderCodex() {
  const g = $('codexGrid');
  g.innerHTML = '';
  /* в кодекс попадает только УВИДЕННОЕ: оружие — если разблокировано в пуле
     или это стартовое оружие открытого агента; пассивки — если разблокированы.
     Скрытое не занимает место в сетке, итог — счётчиком в шапке */
  const wSeen = id =>
    wUnlocked(id) || CHARS.some(c => c.weapon === id && (save.chars[c.id] || !c.lockAch || save.ach[c.lockAch]));
  let shown = 0,
    total = 0;
  for (const id in WEAPONS) {
    total++;
    if (!wSeen(id)) continue;
    shown++;
    const def = WEAPONS[id];
    const d = document.createElement('div');
    d.className = 'card';
    let extra = '';
    if (def.evo) {
      const e = def.evo,
        h = HYPERS[id];
      extra +=
        '<div class="lockd" style="color:var(--amb);margin-top:8px">эволюция: ' +
        e.icon +
        ' ' +
        e.name +
        '<br>мерж: оружие ур.8 + ' +
        PASSIVES[e.need].icon +
        ' ' +
        PASSIVES[e.need].name +
        ' (макс)</div>' +
        '<div class="lockd" style="color:var(--vio);margin-top:6px">гипер: ' +
        h.icon +
        ' ' +
        h.name +
        '<br>мерж: ' +
        e.name +
        ' + ' +
        WEAPONS[h.with].evo.name +
        ' — новая атака' +
        (h.host ? '' : ' (поглощается партнёром)') +
        '</div>';
    }
    d.innerHTML =
      '<div class="face">' +
      def.icon +
      '</div><div class="nm">' +
      def.name +
      '</div><div class="ds">' +
      def.d +
      '</div>' +
      extra;
    g.appendChild(d);
  }
  for (const id in PASSIVES) {
    total++;
    if (!pUnlocked(id)) continue;
    shown++;
    const p = PASSIVES[id];
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML =
      '<div class="face" style="font-size:22px">' +
      p.icon +
      '</div><div class="nm" style="font-size:12px">' +
      p.name +
      '</div><div class="ds" style="min-height:30px">' +
      p.d +
      '</div><div class="cost" style="color:var(--mut)">макс. ур. ' +
      p.max +
      '</div>';
    g.appendChild(d);
  }
  $('codexProgress').textContent = 'увидено: ' + shown + ' / ' + total;
}
function renderAch() {
  const g = $('achGrid');
  g.innerHTML = '';
  const done = ACH.filter(a => save.ach[a.id]).length;
  $('achProgress').textContent = 'открыто: ' + done + ' / ' + ACH.length;
  for (const a of ACH) {
    const d = document.createElement('div');
    d.className = 'card' + (save.ach[a.id] ? ' achDone' : ' lock');
    d.innerHTML =
      '<div class="nm">' +
      (save.ach[a.id] ? '🏆 ' : '🔒 ') +
      a.name +
      '</div><div class="ds">' +
      a.d +
      '</div><div class="cost">◉ +' +
      a.r +
      '</div>';
    g.appendChild(d);
  }
}
function renderStats() {
  const s = save.stats;
  $('statsBody').innerHTML =
    goRow('УБИЙСТВ ВСЕГО', fmt(s.kills)) +
    goRow('МОНЕТ ЗАРАБОТАНО', fmt(s.coins)) +
    goRow('ОПЫТА ВСЕГО', fmt(s.xp)) +
    goRow('БОССОВ УБИТО', s.bosses) +
    goRow('ЗАБЕГОВ', s.runs) +
    goRow('ПОБЕД', s.wins) +
    goRow('СМЕРТЕЙ', s.deaths) +
    goRow('ЭВОЛЮЦИЙ', s.evos) +
    goRow('ЛУЧШИЙ УРОВЕНЬ', s.bestLvl) +
    goRow('УБИЙСТВ ЗА ЗАБЕГ (рекорд)', fmt(s.bestKills)) +
    goRow('РЕКОРД · ПРОДАКШЕН', fmtT(s.best.prod)) +
    goRow('РЕКОРД · НОЧНОЙ БИЛД', fmtT(s.best.night)) +
    goRow('РЕКОРД · ЛЕГАСИ-АД', fmtT(s.best.legacy)) +
    goRow(
      'ЦЕПОЧКА ОТКРЫТИЙ',
      (function () {
        let n = 0;
        for (let i = 1; i <= 32; i++) if (save.ach['c' + i]) n++;
        return n;
      })() + ' / 32'
    );
}
/* ===== ТУЛТИПЫ ЭКИПИРОВКИ (HUD + пауза): ховер/тап по иконке → название, статы, эффекты ===== */
let tipSticky = null;
function showTip(anchor, html, cls) {
  const t = $('wtip');
  t.className = cls || '';
  t.innerHTML = html;
  t.classList.remove('hidden');
  const r = anchor.getBoundingClientRect(),
    tr = t.getBoundingClientRect();
  let x = r.right + 8,
    y = r.top - 4;
  if (x + tr.width > innerWidth - 8) x = Math.max(8, r.left - tr.width - 8);
  if (y + tr.height > innerHeight - 8) y = innerHeight - tr.height - 8;
  if (y < 8) y = 8;
  t.style.left = x + 'px';
  t.style.top = y + 'px';
}
function hideTip() {
  tipSticky = null;
  $('wtip').classList.add('hidden');
}
function bindTip(el, fn, clsFn) {
  el.addEventListener('mouseenter', () => {
    if (!tipSticky) showTip(el, fn(), clsFn && clsFn());
  });
  el.addEventListener('mouseleave', () => {
    if (!tipSticky) $('wtip').classList.add('hidden');
  });
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (tipSticky === el) hideTip();
    else {
      tipSticky = el;
      showTip(el, fn(), clsFn && clsFn());
    }
  }); /* тап на мобильном — закрепить/скрыть */
}
document.addEventListener('pointerdown', e => {
  if (tipSticky && !(e.target.closest && e.target.closest('.wIco'))) hideTip();
});
/* текущие статы оружия (wstats) → строка тултипа */
function tipStatsW(w) {
  const s = wstats(w),
    r = [];
  r.push('УРОН <b>' + Math.round(s.dmg * 10) / 10 + '</b>');
  r.push('ОТКАТ <b>' + s.cd.toFixed(2) + 'с</b>');
  r.push('ПЛОЩАДЬ <b>×' + Math.round(s.area * 100) / 100 + '</b>');
  if (s.count) r.push('ШТ. <b>' + s.count + '</b>');
  if (s.speed) r.push('СКОР. <b>' + Math.round(s.speed) + '</b>');
  if (s.dur) r.push('ДЛИТ. <b>' + s.dur.toFixed(1) + 'с</b>');
  if (s.pierce !== undefined) r.push(s.pierce >= 99 ? '<b>пробивает всё</b>' : 'ПРОБИТИЕ <b>' + s.pierce + '</b>');
  if (s.crit) r.push('КРИТ <b>' + Math.round(s.crit * 100) + '%</b>');
  if (s.vamp) r.push('<b>+' + s.vamp + ' HP за убийство</b>');
  if (s.chain) r.push('<b>цепная молния</b>');
  if (s.stun) r.push('<b>оглушение</b>');
  if (s.burn) r.push('<b>поджиг</b>');
  if (s.push) r.push('<b>выталкивает</b>');
  if (w.id === 'axe' && s.explode) r.push('ВЗРЫВ <b>R' + Math.round(95 * s.area) + '</b>');
  if (s.pull) r.push('<b>тянет врагов</b>');
  if (s.perm) r.push('<b>постоянная</b>');
  return '<div class="tStat">' + r.join(' · ') + '</div>';
}
function tipW(w) {
  const def = WEAPONS[w.id];
  let name,
    icon,
    tag,
    desc,
    extra = '';
  const mk = w.mk ? ' +' + w.mk + ' МОД' : '';
  if (w.hyper) {
    const h = HYPERS[w.id];
    name = h.name;
    icon = h.icon;
    tag = 'ГИПЕР-ФОРМА · УР. ' + w.lvl + mk;
    desc = h.d;
    extra = 'Слияние: ' + def.evo.name + ' + ' + WEAPONS[h.with].evo.name;
  } else if (w.ev) {
    name = def.evo.name;
    icon = def.evo.icon;
    tag = 'ЭВОЛЮЦИЯ · УР. ' + w.lvl + mk;
    desc = def.evo.d;
  } else {
    name = def.name;
    icon = def.icon;
    tag = 'ОРУЖИЕ · УР. ' + w.lvl + '/8' + mk;
    desc = def.d;
  }
  return (
    '<div class="tName">' +
    icon +
    ' ' +
    name +
    '</div><div class="tTag">' +
    tag +
    '</div>' +
    tipStatsW(w) +
    '<div class="tSep"></div><div class="tDesc">' +
    desc +
    '</div>' +
    (extra ? '<div class="tTag" style="margin-top:5px">' + extra + '</div>' : '') +
    '<div class="tTag" style="margin-top:5px;opacity:.72">значения уже включают пассивки, МОДы и мета-бонусы</div>'
  );
}
function passiveTotals(id, lvl) {
  /* итоговый эффект пассивки на её текущем уровне */
  switch (id) {
    case 'dmg':
      return ['+' + 10 * lvl + '% урона', '+10% урона'];
    case 'cd':
      return ['−' + 8 * lvl + '% перезарядки', '−8% перезарядки'];
    case 'area':
      return ['+' + 10 * lvl + '% площади атак', '+10% площади атак'];
    case 'proj':
      return ['+' + 10 * lvl + '% скорости снарядов', '+10% скорости снарядов'];
    case 'dur':
      return ['+' + 12 * lvl + '% длительности', '+12% длительности'];
    case 'amount':
      return ['+' + lvl + (lvl === 1 ? ' снаряд' : ' снаряда') + ' ко всему', '+1 снаряд ко всему'];
    case 'armor':
      return ['−' + lvl + ' урона от каждого удара', '−1 урона от удара'];
    case 'regen':
      return ['+' + Math.round(25 * lvl) / 100 + ' HP/сек', '+0.25 HP/сек'];
    case 'mspd':
      return ['+' + 7 * lvl + '% скорости бега', '+7% скорости бега'];
    case 'magnet':
      return ['+' + 25 * lvl + '% радиуса подбора', '+25% радиуса подбора'];
    case 'luck':
      return ['+' + 10 * lvl + '% шанса дропа', '+10% шанса дропа'];
    case 'growth':
      return ['+' + 8 * lvl + '% получаемого опыта', '+8% опыта'];
    default:
      return null; /* spag: живые множители считаются ниже */
  }
}
function tipP(p) {
  const def = PASSIVES[p.id];
  let html =
    '<div class="tName">' +
    def.icon +
    ' ' +
    def.name +
    '</div>' +
    '<div class="tTag">ПАССИВ · УР. ' +
    p.lvl +
    '/' +
    def.max +
    '</div>';
  const t = passiveTotals(p.id, p.lvl);
  if (t) {
    html +=
      '<div class="tStat">итог сейчас: <b>' +
      t[0] +
      '</b></div>' +
      (p.lvl >= def.max
        ? '<div class="tTag">максимальный уровень</div>'
        : '<div class="tStat">след. ур.: <b>' + t[1] + '</b></div>');
  }
  html += '<div class="tSep"></div><div class="tDesc">' + def.d + '</div>';
  if (p.id === 'spag') {
    /* живые числа текущей угрозы (весь стак: ТЕХДОЛГ + спаг) */
    const th = threat();
    html +=
      '<div class="tStat">сейчас: спавн <b>×' +
      th.cnt.toFixed(2) +
      '</b> · HP <b>×' +
      th.hp.toFixed(2) +
      '</b> · скорость <b>×' +
      th.spd.toFixed(2) +
      '</b> · лут <b>×' +
      rew().toFixed(2) +
      '</b></div>';
  }
  return html;
}
function tipAbs(id, kind) {
  const def = kind === 'p' ? PASSIVES[id] : WEAPONS[id];
  return (
    '<div class="tName">' +
    def.icon +
    ' ' +
    def.name +
    '</div>' +
    '<div class="tTag">ПОГЛОЩЕНО ГИПЕР-СЛИЯНИЕМ</div>' +
    '<div class="tSep"></div><div class="tDesc">слот освобождён, МОДы перешли гипер-форме</div>'
  );
}
/* общие фабрики иконок — один источник для HUD (buildIcons) и паузы (pauseGame) */
function mkWIcon(w) {
  const d = document.createElement('div');
  d.className = 'wIco' + (w.hyper ? ' hyper' : w.ev ? ' evo' : '') + (w.lvl >= 8 ? ' max' : '');
  d.innerHTML =
    (w.hyper ? HYPERS[w.id].icon : w.ev ? WEAPONS[w.id].evo.icon : WEAPONS[w.id].icon) +
    '<span class="lv">' +
    w.lvl +
    (w.mk ? '+' + w.mk : '') +
    '</span>';
  bindTip(
    d,
    () => tipW(w),
    () => (w.hyper ? 'hyperTip' : w.ev ? 'evoTip' : '')
  );
  return d;
}
function mkPIcon(p) {
  const d = document.createElement('div');
  d.className = 'wIco';
  d.innerHTML = PASSIVES[p.id].icon + '<span class="lv">' + p.lvl + '</span>';
  bindTip(d, () => tipP(p));
  return d;
}
function mkAbsIcon(id, kind) {
  const d = document.createElement('div');
  d.className = 'wIco abs';
  d.innerHTML = (kind === 'p' ? PASSIVES[id] : WEAPONS[id]).icon + '<span class="lv">✦</span>';
  bindTip(d, () => tipAbs(id, kind));
  return d;
}
function buildIcons() {
  const wi = $('weaponIcons');
  wi.innerHTML = '';
  for (const w of P.weapons) wi.appendChild(mkWIcon(w));
  const pi = $('passiveIcons');
  pi.innerHTML = '';
  for (const p of P.passives) pi.appendChild(mkPIcon(p));
  for (const id in P.absorbed) pi.appendChild(mkAbsIcon(id, 'p'));
  for (const id in P.usedW) pi.appendChild(mkAbsIcon(id, 'w'));
}

/* ================= SETTINGS ================= */
function bindTgl(el, get, set) {
  el.classList.toggle('on', get());
  el.onclick = () => {
    set(!get());
    el.classList.toggle('on', get());
    sfx('click');
    saveGame();
  };
}
/* все три зеркала галочки «автовыбор модов» — в синхроне (настройки, пауза, окно уровня) */
function syncAutomod() {
  $('automodTgl').classList.toggle('on', save.set.automod);
  $('lvlAutoTgl').classList.toggle('on', save.set.automod);
  $('pauseAutoTgl').classList.toggle('on', save.set.automod);
}
bindTgl(
  $('sfxTgl'),
  () => save.set.sfx,
  v => (save.set.sfx = v)
);
bindTgl(
  $('shakeTgl'),
  () => save.set.shake,
  v => (save.set.shake = v)
);
bindTgl(
  $('automodTgl'),
  () => save.set.automod,
  v => {
    save.set.automod = v;
    syncAutomod();
  }
);
/* галочка и в меню паузы — автоворд можно выключить не выходя из забега */
bindTgl(
  $('pauseAutoTgl'),
  () => save.set.automod,
  v => {
    save.set.automod = v;
    syncAutomod();
  }
);
/* галочка автовыбора мода ПРЯМО в окне повышения уровня (показывается, только когда среди выбора есть моды) */
$('lvlAutoTgl').onclick = () => {
  if (appState !== 'levelup') return;
  save.set.automod = !save.set.automod;
  syncAutomod();
  sfx('click');
  saveGame();
  /* включили прямо в окне «только моды» — срабатывает немедленно */
  if (save.set.automod && lvlChoices.length && lvlChoices.every(c => c.type === 'mod'))
    chooseLevel(Math.floor(Math.random() * lvlChoices.length));
};
let resetArmed = false;
$('resetBtn').onclick = () => {
  if (!resetArmed) {
    resetArmed = true;
    $('resetBtn').textContent = 'ТОЧНО?? НАЖМИ ЕЩЁ РАЗ';
    setTimeout(() => {
      resetArmed = false;
      $('resetBtn').textContent = 'СБРОСИТЬ ВЕСЬ ПРОГРЕСС';
    }, 3000);
    return;
  }
  localStorage.removeItem(SAVE_KEY);
  save = loadSave();
  resetArmed = false;
  $('resetBtn').textContent = 'СБРОСИТЬ ВЕСЬ ПРОГРЕСС';
  /* полный сброс = немедленная перезагрузка: галочки и экраны биндятся один
     раз при загрузке скрипта, и любая пауза перед reload оставляет окно,
     куда можно успеть накликать со старой картинкой. Тост до reload не
     переживёт перезагрузку — передаём его через sessionStorage и показываем
     уже в свежем меню (см. BOOT). */
  try {
    sessionStorage.setItem('bsResetToast', '1');
  } catch (e) {}
  location.reload();
};

/* ================= BUTTONS ================= */
$('btnPlay').onclick = () => {
  sfx('click');
  openScreen('chars');
};
$('charBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('btnShop').onclick = () => {
  sfx('click');
  openScreen('shop');
};
$('btnCodex').onclick = () => {
  sfx('click');
  openScreen('codex');
};
$('btnAch').onclick = () => {
  sfx('click');
  openScreen('ach');
};
$('btnStats').onclick = () => {
  sfx('click');
  openScreen('stats');
};
$('btnSettings').onclick = () => {
  sfx('click');
  openScreen('settings');
};
$('charOk').onclick = () => {
  sfx('click');
  openScreen('stages');
};
$('stageBack').onclick = () => {
  sfx('click');
  openScreen('chars');
};
$('stageGo').onclick = () => {
  if (!selStage || !save.stages[selStage]) return;
  sfx('click');
  startRun(selChar, selStage, endlessOn);
};
$('shopBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('achBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('codexBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('statsBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('settingsBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('resumeBtn').onclick = () => {
  sfx('click');
  resumeGame();
};
$('quitBtn').onclick = () => {
  sfx('click');
  $('pauseModal').classList.add('hidden');
  endRun(false, true);
};
$('goRetry').onclick = () => {
  sfx('click');
  startRun(run.charId, run.stageId, run.endless);
};
$('goMenu').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('chestOk').onclick = () => {
  if (appState !== 'chest') return;
  sfx('click');
  if (chestEvo) {
    applyEvo(chestEvo);
    chestEvo = null;
  }
  $('chestModal').classList.add('hidden');
  $('chestNo').classList.add('hidden');
  $('chestHint').classList.add('hidden');
  if (P.pendLv > 0) openLevelup();
  else appState = 'run';
};
$('chestNo').onclick = () => {
  if (appState !== 'chest') return;
  sfx('click');
  chestEvo = null;
  $('chestModal').classList.add('hidden');
  $('chestNo').classList.add('hidden');
  $('chestHint').classList.add('hidden');
  if (P.pendLv > 0) openLevelup();
  else appState = 'run';
};
$('endlessTgl').onclick = () => {
  if (!selStage || !endlessUnlocked(selStage)) return;
  sfx('click');
  endlessOn = !endlessOn;
  $('endlessTgl').classList.toggle('on', endlessOn);
};

/* ================= MAIN LOOP / BOOT ================= */
let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastTs) {
    lastTs = ts;
    return;
  }
  const dt = Math.min(0.05, Math.max(0.0001, (ts - lastTs) / 1000));
  lastTs = ts;
  if (appState === 'run') update(dt);
  else shake = 0; /* на паузах/окнах выбора экран не трясётся */
  if (hasRun) render();
}
grantBackUnlocks();
checkAch();
openScreen('menu');
/* возврат после полного сброса: страница уже перезагрузилась с чистым сейвом — теперь можно честно показать тост */
try {
  if (sessionStorage.getItem('bsResetToast')) {
    sessionStorage.removeItem('bsResetToast');
    toast('ПРОГРЕСС СБРОШЕН', 'red');
  }
} catch (e) {}
requestAnimationFrame(frame);

/* debug handle (для тестов) */
window.G = {
  state: () => appState,
  P: () => P,
  run: () => run,
  save: () => save,
  giveXP: v => {
    if (P) gainXP(v || 100);
  },
  coins: v => {
    if (run) run.coins += v || 100;
  },
  chest: () => openChest(),
  boss: () => spawnBoss(6),
  lvl: () => {
    if (P) {
      P.pendLv++;
      if (appState === 'run') openLevelup();
    }
  },
  evo: () => {
    if (appState === 'run') {
      const c = findEvo1() || findHyper();
      if (c) openEvoModal(c);
      else toast('нет кандидатов на слияние', 'red');
    }
  },
  maxW: () => {
    if (P) {
      for (const w of P.weapons) w.lvl = 8;
      buildIcons();
    }
  },
};
