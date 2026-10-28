import { P, run, S } from '../core/state.js';
import { save, saveGame } from '../core/save.js';
import { WEAPONS } from '../data/weapons.js';
import { PASSIVES } from '../data/upgrades.js';
import { HYPERS } from '../data/hypers.js';
import { xpNeed, recompute, pl, wUnlocked, pUnlocked } from './stats.js';
import { note } from '../combat/effects.js';
import { sfx } from '../core/audio.js';
import { rnd, ri } from '../core/utils.js';
import { hooks } from '../core/hooks.js';

/* ================= XP / LEVELUP ================= */
export function gainXP(v) {
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
    if (S.appState === 'run') hooks.openLevelup?.();
  }
}
export function rollChoices() {
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

/* ================= CHEST LOGIC ================= */
export function findEvo1() {
  for (const w of P.weapons) {
    if (w.ev || w.lvl < 8) continue;
    const e = WEAPONS[w.id].evo;
    if (e && pl(e.need) >= PASSIVES[e.need].max) return { mode: 'evo', w };
  }
  return null;
}
export function findHyper() {
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
export function applyEvo(c) {
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
  hooks.buildIcons?.(); /* ачивки — только на экране окончания забега */
}

/* ================= CHEST REWARDS ================= */
export function openChestLogic() {
  if (S.appState !== 'run') return null;
  const c1 = findEvo1(),
    ch = findHyper();
  if (c1) return { mode: 'evo', c: c1 };
  if (ch) return { mode: 'evo', c: ch };
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
    return { mode: 'coins', coins: cc }; /* без окна и без паузы */
  }
  const cc = ri(30, 80);
  run.coins += cc;
  return { mode: 'items', rewards, spagHit, coins: cc };
}
