import { S, P, run, cam, enemies, pickups } from '../core/state.js';
import { save } from '../core/save.js';
import { rnd } from '../core/utils.js';
import { ctx } from './context.js';
import { cellH, pRack, pVent, pDesk, pMoon, pTape, pCard, pStars, pScan } from './scenes.js';
import {
  drawPools,
  drawGems,
  drawPickups,
  drawEnemies,
  drawAura,
  drawPlayer,
  drawOrbits,
  drawBullets,
  drawFx,
  drawParts,
  drawDmgNums,
  drawNotes,
} from './entities.js';

export function render() {
  ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  const st = run.stage;
  ctx.fillStyle = st.bg;
  ctx.fillRect(0, 0, S.W, S.H);
  const sh = save.set.shake ? S.shake : 0;
  const shx = sh > 0 ? rnd(-sh, sh) : 0,
    shy = sh > 0 ? rnd(-sh, sh) : 0;
  const ox = S.W / 2 - cam.x + shx,
    oy = S.H / 2 - cam.y + shy;
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
  if (save.meta.minimap && run && S.appState !== 'over') drawMinimap();
}
export function drawMinimap() {
  const mw = 150,
    mh = 150,
    mx = S.W - mw - 12,
    my = S.H - mh - 12;
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
export function drawGrid(st, ox, oy) {
  const sp = 56;
  ctx.strokeStyle = st.grid;
  ctx.lineWidth = 1;
  const x0 = Math.floor((ox * -1) / sp) * sp,
    y0 = Math.floor((oy * -1) / sp) * sp;
  ctx.beginPath();
  for (let x = x0; x < ox * -1 + S.W + sp; x += sp) {
    ctx.moveTo(x + ox, 0);
    ctx.lineTo(x + ox, S.H);
  }
  for (let y = y0; y < oy * -1 + S.H + sp; y += sp) {
    ctx.moveTo(0, y + oy);
    ctx.lineTo(S.W, y + oy);
  }
  ctx.stroke();
  // deterministic props
  const ps = 168;
  const cx0 = Math.floor((cam.x - S.W / 2) / ps),
    cx1 = Math.floor((cam.x + S.W / 2) / ps);
  const cy0 = Math.floor((cam.y - S.H / 2) / ps),
    cy1 = Math.floor((cam.y + S.H / 2) / ps);
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
export function drawDecor(st, ox, oy) {
  /* подсветка в цвете карты */
  const g = ctx.createRadialGradient(S.W / 2, S.H / 2, 60, S.W / 2, S.H / 2, Math.max(S.W, S.H) * 0.65);
  g.addColorStop(0, 'rgba(' + (st.glowRGB || '56,224,127') + ',0.06)');
  g.addColorStop(1, 'rgba(' + (st.glowRGB || '56,224,127') + ',0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S.W, S.H);
  const t = run.t;
  /* крупные пропы сцены: детерминированные по мировым ячейкам, не мерцают при движении камеры */
  const ps = st.decor === 'night' ? 300 : 270;
  const cx0 = Math.floor((cam.x - S.W / 2 - 150) / ps),
    cx1 = Math.floor((cam.x + S.W / 2 + 150) / ps);
  const cy0 = Math.floor((cam.y - S.H / 2 - 150) / ps),
    cy1 = Math.floor((cam.y + S.H / 2 + 150) / ps);
  for (let ix = cx0; ix <= cx1; ix++)
    for (let iy = cy0; iy <= cy1; iy++) {
      const h = cellH(ix, iy, 1);
      const px = ix * ps + h * ps * 0.4 + ox,
        py = iy * ps + ((h * 7) % 1) * ps * 0.4 + oy;
      if (px < -150 || px > S.W + 20 || py < -130 || py > S.H + 20) continue;
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
    pStars(ctx, S.W, S.H, t, ox, oy);
    pMoon(ctx, S.W);
  } else if (st.decor === 'mainframe') {
    pScan(ctx, S.W, S.H, t);
  }
}
