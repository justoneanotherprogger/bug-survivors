import { TAU } from '../../core/utils.js';
import { CHARCOL, rr, shade } from './kit.js';

/* --- СВМ 1995: два клина вдоль пунктирной гиперплоскости, опорные векторы --- */
export function svmArt(g, wp, mv, t, _ay) {
  const col = CHARCOL.svm;
  const gap = 1.5 + Math.sin(mv ? wp * 1.3 : t * 2) * 0.35;
  /* верхний клин */
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(-7.4, -8.8);
  g.lineTo(7.4, -8.8);
  g.lineTo(4.1, -1.7 - gap);
  g.lineTo(-4.1, -1.7 - gap);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.16)';
  g.fillRect(-6, -7.8, 12, 2);
  /* нижний клин */
  g.fillStyle = shade(col, -0.27);
  g.beginPath();
  g.moveTo(-4.1, 1.7 + gap);
  g.lineTo(4.1, 1.7 + gap);
  g.lineTo(7.4, 8.8);
  g.lineTo(-7.4, 8.8);
  g.closePath();
  g.fill();
  /* гиперплоскость */
  g.strokeStyle = 'rgba(255,255,255,.85)';
  g.lineWidth = 1;
  g.setLineDash([2.4, 1.8]);
  g.beginPath();
  g.moveTo(-9.6, 0);
  g.lineTo(9.6, 0);
  g.stroke();
  g.setLineDash([]);
  /* опорные векторы */
  g.strokeStyle = '#dfe9ee';
  g.lineWidth = 1.1;
  for (const p of [
    [-8.8, -4.4],
    [8.9, -2.8],
    [-8.4, 4.6],
    [8.5, 5.6],
  ]) {
    g.beginPath();
    g.moveTo(p[0] * 0.7, p[1] * 0.7);
    g.lineTo(p[0], p[1]);
    g.stroke();
    g.fillStyle = p[1] < 0 ? '#e2f4ff' : '#9fc4d8';
    g.beginPath();
    g.arc(p[0], p[1], 1.15, 0, TAU);
    g.fill();
  }
  /* визор-глаз на верхнем клине */
  g.fillStyle = '#0f2733';
  g.beginPath();
  rr(g, -4, -5.8, 8.8, 2.7, 1.2);
  g.fill();
  const dx = Math.max(-1.2, Math.min(1.2, Math.sin(wp * 0.7)));
  g.fillStyle = '#e2f4ff';
  g.fillRect(-1.3 + dx, -5.4, 2.6, 1.9);
  /* рот-линейка */
  g.fillStyle = '#0f2733';
  g.fillRect(-3.2, 4.6, 6.4, 0.9);
  /* штатив */
  g.strokeStyle = '#5b7482';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-4, 8.4);
  g.lineTo(-6.2, 11.6);
  g.stroke();
  g.beginPath();
  g.moveTo(0, 8.4);
  g.lineTo(0, 11.8);
  g.stroke();
  g.beginPath();
  g.moveTo(4, 8.4);
  g.lineTo(6.2, 11.6);
  g.stroke();
}
