import { TAU } from '../../core/utils.js';
import { rr } from './kit.js';

/* --- АТТЕНШН 2017: ядро с главным глазом, орбитальные глаза на лучах внимания --- */
export function attnArt(g, wp, mv, t, ay) {
  /* орбитальные глаза */
  const eyes = [];
  for (let i = 0; i < 4; i++) {
    const a = t * 0.8 + (i * Math.PI) / 2;
    eyes.push([Math.cos(a) * 10.6, Math.sin(a) * 6.2 - 1.2, 1.4 + (i % 2) * 0.35]);
  }
  /* лучи внимания */
  g.strokeStyle = 'rgba(192,132,252,.5)';
  g.lineWidth = 0.8;
  g.setLineDash([2.6, 2]);
  for (let i = 0; i < 4; i++) {
    const w = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7));
    g.globalAlpha = w;
    g.beginPath();
    g.moveTo(0, -1);
    g.lineTo(eyes[i][0], eyes[i][1]);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.setLineDash([]);
  for (const e of eyes) {
    g.fillStyle = '#f3d9ff';
    g.beginPath();
    g.arc(e[0], e[1], e[2], 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(e[0] + 0.2, e[1], e[2] * 0.42, 0, TAU);
    g.fill();
  }
  /* ядро */
  g.fillStyle = 'rgba(192,132,252,.2)';
  g.beginPath();
  g.arc(0, -1, 7.6, 0, TAU);
  g.fill();
  g.fillStyle = '#5a4a72';
  g.beginPath();
  rr(g, -4.6, -6.6, 9.2, 11, 3);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, -3.4, -5.4, 6.8, 8.6, 2.2);
  g.fill();
  /* главный глаз */
  const dy = Math.max(-1.6, Math.min(1.6, ay));
  if (t % 3.7 < 0.13) {
    g.fillStyle = '#f3d9ff';
    g.fillRect(-2.2, -1.35, 4.4, 0.7);
  } else {
    g.fillStyle = '#f3d9ff';
    g.beginPath();
    g.arc(0, -1, 2.3, 0, TAU);
    g.fill();
    g.fillStyle = '#c084fc';
    g.beginPath();
    g.arc(0.2, -1 + dy * 0.5, 1.2, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(0.2, -1 + dy * 0.7, 0.6, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath();
    g.arc(-0.7, -1.9 + dy * 0.4, 0.4, 0, TAU);
    g.fill();
  }
  /* нимб малых глаз */
  for (let i = 0; i < 3; i++) {
    const ax = -3.2 + i * 3.2,
      hy = -9.8 - (i === 1 ? 2.2 : 0) + Math.sin(t * 2 + i) * 0.4;
    g.strokeStyle = '#5a4a72';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(ax, hy + 1.8);
    g.lineTo(ax, hy + 0.9);
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(ax, hy, 1.15, 0, TAU);
    g.fill();
    g.fillStyle = '#c084fc';
    g.beginPath();
    g.arc(ax, hy, 0.55, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(ax, hy + 0.08, 0.26, 0, TAU);
    g.fill();
  }
}
