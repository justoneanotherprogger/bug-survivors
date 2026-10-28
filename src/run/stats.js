import { P, run } from '../core/state.js';
import { save } from '../core/save.js';
import { CHARS } from '../data/chars.js';
import { WEAPONS } from '../data/weapons.js';
import { PASSIVES } from '../data/upgrades.js';

/* ================= RUN STATS ================= */
export function pl(id) {
  const p = P.passives.find(x => x.id === id);
  const ab = (P.absorbed && P.absorbed[id]) || 0;
  return Math.max(p ? p.lvl : 0, ab);
}
export function wUnlocked(id) {
  const w = WEAPONS[id];
  return !w.lockAch || !!save.ach[w.lockAch];
}
export function pUnlocked(id) {
  const p = PASSIVES[id];
  return !p.lockAch || !!save.ach[p.lockAch];
}
export function recompute() {
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
export function xpNeed(l) {
  return Math.floor(6 + l * 4 + Math.pow(l, 1.7));
}

/* ================= SCALING ================= */
/* «угроза»: ТЕХДОЛГ (мета) + СПАГЕТТИ-КОД (пассивка) — хард-режим с честным фарм-апсайдом.
   Спавн линейный (+10%/ур), HP и скорость — экспонента (×1.16 / ×1.06 за уровень):
   полный стак L=10 → ×2.0 спавн, ×4.4 HP, ×1.8 скорости; лут жирнее на +7%/ур (rew()). */
export function threat() {
  const L = (save.meta.td || 0) + pl('spag');
  return { cnt: 1 + 0.1 * L, hp: Math.pow(1.16, L), spd: Math.pow(1.06, L) };
}
export function rew() {
  return 1 + 0.07 * ((save.meta.td || 0) + pl('spag'));
}
export function enemyPow() {
  return 1 + 0.01 * (save.meta.buginf || 0);
} /* «ОТЧЁТЫ О БАГАХ»: покупные +1%/шт к спавну, HP, урону и скорости багов */
export function hpMul() {
  const m = run.t / 60;
  return (1 + m * 0.45 + m * m * 0.02) * run.stage.hpMul * threat().hp * enemyPow();
}
export function timeSpd() {
  return 1 + (run.t / 60) * 0.1;
} /* враги ускоряются +10%/мин, игрок — НЕТ: давление растёт по ходу забега */
