import { P, run, enemies, S, CAP_ENEMIES } from '../core/state.js';
import { ETYPES, BOSSES } from '../data/enemies.js';
import { rnd, TAU, pick } from '../core/utils.js';
import { note } from '../combat/effects.js';
import { sfx } from '../core/audio.js';
import { threat, hpMul, timeSpd, enemyPow } from './stats.js';
import { hooks } from '../core/hooks.js';

/* ================= SPAWN DIRECTOR ================= */
export function spawnEnemy(typeId, x, y, o = {}) {
  const t = ETYPES[typeId];
  if (!t) return null;
  const e = {
    uid: S.uidC++,
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
export function spawnBoss(tier) {
  const def = BOSSES[Math.min(tier - 1, BOSSES.length - 1)];
  const a = rnd(TAU),
    R = Math.hypot(S.W, S.H) / 2 + 120;
  const isFinal = !!def.final;
  const e = {
    uid: S.uidC++,
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
  hooks.bossBar?.(e.name);
  note(e.x, e.y - e.r - 26, '⚠ ' + e.name + ' ПРОСНУЛСЯ', '#f87171');
  sfx('boss');
}
export function ringWave(types) {
  /* «меня окружили, бежать некуда»: игрок всегда в центре экрана, поэтому кольцо
     входит ПО КРАЯМ ЭКРАНА — дистанция до края в направлении θ = min((S.W/2)/|cosθ|,(S.H/2)/|sinθ|)+64
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
    /* расширенный прямоугольник (S.W+128)×(S.H+128): края ровно в 64px за экраном.
       Вариант min(...)+64 (64 вдоль ЛУЧА, а не перпендикуляра) по диагоналям нырял
       внутрь — просветы на изломах сжимались вдвое относительно прямых участков */
    const tx = ca !== 0 ? (S.W / 2 + 64) / Math.abs(ca) : 1e9,
      ty = sa !== 0 ? (S.H / 2 + 64) / Math.abs(sa) : 1e9;
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
export function director(dt) {
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
      const R = Math.hypot(S.W, S.H) / 2 + 70;
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
