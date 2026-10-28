import { S, P, run, enemies, gems, pickups, pools, bullets, fx, parts, dmgNums, notes } from '../core/state.js';
import { TAU, clamp, lerp } from '../core/utils.js';
import { keys, joy } from '../core/input.js';
import { ctx } from './context.js';
import { drawAgentArt } from './sprites.js';

export function drawPools(ox, oy) {
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
export function drawGems(ox, oy) {
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
export function drawPickups(ox, oy) {
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
export function drawEnemies(ox, oy) {
  const t = run.t;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const x = e.x + ox,
      y = e.y + oy;
    if (x < -70 || x > S.W + 70 || y < -70 || y > S.H + 70) continue;
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
export function drawAura(ox, oy) {
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
export function drawPlayer(ox, oy) {
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
export function drawOrbits(ox, oy) {
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
export function drawBullets(ox, oy) {
  for (const b of bullets) {
    const x = b.x + ox,
      y = b.y + oy;
    if (x < -40 || x > S.W + 40 || y < -40 || y > S.H + 40) continue;
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
export function drawFx(ox, oy) {
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
        ctx.lineTo(S.W, f.coord + oy);
      } else {
        ctx.moveTo(f.coord + ox, 0);
        ctx.lineTo(f.coord + ox, S.H);
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
export function drawParts(ox, oy) {
  for (const p of parts) {
    ctx.globalAlpha = clamp(p.life / p.T, 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x + ox - p.sz / 2, p.y + oy - p.sz / 2, p.sz, p.sz);
  }
  ctx.globalAlpha = 1;
}
export function drawDmgNums(ox, oy) {
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
export function drawNotes(ox, oy) {
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
