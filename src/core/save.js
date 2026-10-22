/* ================= SAVE ================= */
export const SAVE_KEY = 'bugSurvivors_v1';
export function DEFSAVE() {
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
export function loadSave() {
  const d = DEFSAVE();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) mergeInto(d, JSON.parse(raw));
  } catch (e) {}
  if (d.ach && d.ach.p_cd) d.ach.p_armor = true;
  /* миграция: РАЗОГРЕВ стал ЗАКАЛКОЙ (p_cd→p_armor) */ return d;
}
export let save = loadSave();
export function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) {}
}
export function reloadSave() {
  save = loadSave();
}
