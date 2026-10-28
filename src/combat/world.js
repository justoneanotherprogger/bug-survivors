import {
  P,
  run,
  enemies,
  bullets,
  gems,
  pickups,
  pools,
  fx,
  parts,
  dmgNums,
  notes,
  S,
  CAP_ENEMIES,
} from '../core/state.js';
import { save } from '../core/save.js';
import { rnd, ri, TAU, clamp, dist2 } from '../core/utils.js';
import { sfx } from '../core/audio.js';
import { burst, dmgNum, note } from './effects.js';
import { pl, rew, timeSpd, enemyPow } from '../run/stats.js';
import { gainXP } from '../run/progression.js';
import { spawnEnemy } from '../run/director.js';
import { hooks } from '../core/hooks.js';

/* ================= SPATIAL GRID ================= */
const CELL = 64;
const grid = new Map();
export function gridRebuild() {
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
export function gridNear(x, y, r) {
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
export function updBullets(dt) {
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
export function explosion(x, y, r, dmg, pull) {
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
  S.shake += 4;
  sfx('boom');
}

/* ================= ENEMIES ================= */
export function updateEnemies(dt) {
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
export function updPools(dt) {
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
export function updPickups(dt) {
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
          S.shake += 10;
          sfx('boom');
          note(P.x, P.y - 36, '💥 БОМБА! ЗАЧИСТКА', '#f87171');
          break;
        case 'chest':
          hooks.openChest?.();
          break;
      }
    }
  }
}

/* ================= DAMAGE / KILL / LOOT ================= */
export function hurtEnemy(e, dmg, opts = {}) {
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
    hooks.bossBar?.(null);
    save.stats.bosses++;
    spawnPickup(e.x, e.y, 'chest');
    for (let i = 0; i < 8; i++) spawnPickup(e.x + rnd(-70, 70), e.y + rnd(-70, 70), 'coin');
    spawnPickup(e.x + rnd(-40, 40), e.y + rnd(-40, 40), 'heal');
    S.shake += 12;
    sfx('boom');
    if (e.final && !run.endless) {
      hooks.endRun?.(true);
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

/* ================= HURT PLAYER ================= */
export function hurtPlayer(d) {
  if (P.iv > 0) return;
  P.iv = 0.3;
  const dmg = Math.max(1, Math.round(d - P.armor));
  P.hp -= dmg;
  dmgNum(P.x, P.y - 20, dmg, '#f87171');
  S.shake += 3;
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
    } else hooks.endRun?.(false);
  }
}
function aoeDamage(x, y, r, dmg) {
  for (const e of gridNear(x, y, r + 30)) {
    if (e.hp > 0 && dist2(e.x, e.y, x, y) < r * r) hurtEnemy(e, dmg, {});
  }
}

/* ================= FX / PARTICLES ================= */
export function updFx(dt) {
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
        for (const e of gridNear(P.x, f.coord, Math.hypot(S.W, S.H) / 2)) {
          if (Math.abs(e.y - f.coord) < w / 2 + e.r * 0.5) hurtEnemy(e, f.dmg, {});
        }
      } else {
        for (const e of gridNear(f.coord, P.y, Math.hypot(S.W, S.H) / 2)) {
          if (Math.abs(e.x - f.coord) < w / 2 + e.r * 0.5) hurtEnemy(e, f.dmg, {});
        }
      }
      S.shake += 2;
    }
    if (f.life <= 0) fx.splice(i, 1);
  }
}
