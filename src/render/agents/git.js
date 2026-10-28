import { TAU } from '../../core/utils.js';
import { rr } from './kit.js';

/* --- ГИТ 2005: созвездие коммитов, лицо на HEAD, тег на шнурке --- */
export function gitArt(g, wp, mv, t, ay) {
  const b1 = Math.sin(t * 2.1) * 0.8,
    b2 = Math.sin(t * 2.1 + 1) * 0.9,
    b3 = Math.sin(t * 2.1 + 2) * 0.7;
  /* связи */
  g.strokeStyle = '#8a5a56';
  g.lineWidth = 1.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, -8.6 + b1);
  g.quadraticCurveTo(-1, -2.2 + b2, -2.6, 1.6 + b2);
  g.stroke();
  g.beginPath();
  g.moveTo(-2.6, 1.6 + b2);
  g.quadraticCurveTo(-3.8, 5.2, -2.2, 8.2 + b3);
  g.stroke();
  g.beginPath();
  g.moveTo(0, -8.6 + b1);
  g.quadraticCurveTo(5.6, -4.6 + b2, 5.8, 0.6 + b3);
  g.stroke();
  /* узлы */
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(-2.6, 1.6 + b2, 3.3, 0, TAU);
  g.fill();
  g.fillStyle = '#f87171';
  g.beginPath();
  g.arc(-2.2, 8.2 + b3, 2.6, 0, TAU);
  g.fill();
  g.fillStyle = '#7eea9d';
  g.beginPath();
  g.arc(5.8, 0.6 + b3, 2.5, 0, TAU);
  g.fill();
  g.fillStyle = '#4ade80';
  g.beginPath();
  g.arc(0, -8.6 + b1, 4.3, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(0, -8.6 + b1, 4.3, 0, TAU);
  g.stroke();
  g.beginPath();
  g.arc(-2.6, 1.6 + b2, 3.3, 0, TAU);
  g.stroke();
  /* лицо на HEAD */
  const dy = Math.max(-1, Math.min(1, ay)) * 0.5;
  const bl = t % 3.7 < 0.13;
  for (const p of [
    [-1.4, -9.1 + b1],
    [1.4, -9.1 + b1],
  ]) {
    g.fillStyle = '#0c110d';
    if (bl) g.fillRect(p[0] - 0.8, p[1] - 0.15, 1.6, 0.35);
    else {
      g.beginPath();
      g.arc(p[0], p[1], 0.85, 0, TAU);
      g.fill();
      g.fillStyle = '#d0ffe0';
      g.beginPath();
      g.arc(p[0] + 0.2, p[1] + dy * 0.4, 0.35, 0, TAU);
      g.fill();
    }
  }
  g.strokeStyle = '#0c110d';
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(0, -7 + b1, 1, Math.PI * 0.12, Math.PI * 0.88);
  g.stroke();
  /* тег на шнурке */
  g.save();
  g.translate(-2.2, 8.2 + b3);
  g.rotate(Math.sin(t * 2.2) * 0.16);
  g.strokeStyle = '#8a5a56';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 2.2);
  g.stroke();
  g.fillStyle = '#e8dcae';
  g.beginPath();
  rr(g, -2.6, 2.2, 5.2, 3.2, 0.8);
  g.fill();
  g.fillStyle = '#8a5a56';
  g.beginPath();
  g.arc(0, 2.9, 0.5, 0, TAU);
  g.fill();
  g.restore();
}
