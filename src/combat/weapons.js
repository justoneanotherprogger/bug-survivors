import { P, run } from '../core/state.js';
import { WEAPONS } from '../data/weapons.js';
import { KEYSTATS } from '../data/upgrades.js';
import { TAU, dist2 } from '../core/utils.js';
import { gridNear, hurtEnemy } from './world.js';
import { updHyper, doAura, doSlash, fireWeapon } from './hypers.js';

/* ================= WEAPONS ENGINE ================= */
const ORBN = [1, 1, 2, 2, 3, 3, 4, 4],
  TESN = [1, 1, 2, 2, 3, 3, 4, 4],
  LASN = [1, 1, 2, 2, 2, 3, 3, 4];
export function wstats(w) {
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
export function lvDesc(id, to) {
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
export function updWeapons(dt) {
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
