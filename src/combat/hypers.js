import { P, run, enemies, bullets, fx, S } from '../core/state.js';
import { TAU, rnd, dist2 } from '../core/utils.js';
import { sfx } from '../core/audio.js';
import { gridNear, hurtEnemy, explosion } from './world.js';
import { PRIO } from '../data/hypers.js';

function laserAim(count) {
  const MERGE = 48,
    MINSEP = 104,
    WGT = 240,
    VW = Math.hypot(S.W, S.H) / 2 + 80;
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

/* ================= HYPER ATTACKS ================= */
/* гипер-форма заменяет обе атаки пары целиком; статы — от оружия-носителя (эво + гипер + МОДы) */
export function updHyper(w, s, dt) {
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
        S.shake += 8;
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
export function fireWeapon(w, s) {
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
export function doSlash(w, s, side, vert) {
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
export function doAura(w, s, R) {
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
  const R = Math.min(560, Math.hypot(S.W, S.H) * 0.4),
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
