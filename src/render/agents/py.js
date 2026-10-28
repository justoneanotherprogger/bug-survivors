import { TAU } from '../../core/utils.js';
import { CHARCOL, rr, dia, shade } from './kit.js';

export function snakeArt(g, wp, mv, t, ay) {
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
