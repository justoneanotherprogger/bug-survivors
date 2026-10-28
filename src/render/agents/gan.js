import { TAU } from '../../core/utils.js';
import { rr } from './kit.js';

/* --- ГАН 2014: сиамские близнецы — шумовая и чистая половины со швом --- */
export function ganArt(g, wp, mv, t, ay) {
  const stp = mv ? Math.sin(wp) * 2.4 : 0;
  /* ноги: своя у каждой половины */
  g.fillStyle = '#4a3f63';
  g.beginPath();
  rr(g, -5.6 + stp, 5.8, 3.7, 6.4, 1.6);
  g.fill();
  g.fillStyle = '#3c4f42';
  g.beginPath();
  rr(g, 1.9 - stp, 5.8, 3.7, 6.4, 1.6);
  g.fill();
  /* тело: две половины */
  g.fillStyle = '#4a3f63';
  g.beginPath();
  rr(g, -7.4, -4.4, 7.4, 10.6, 2);
  g.fill();
  g.fillStyle = '#3c4f42';
  g.beginPath();
  rr(g, 0, -4.4, 7.4, 10.6, 2);
  g.fill();
  /* шум на левой половине */
  let sd = Math.floor(t * 10) + 3;
  g.fillStyle = 'rgba(211,134,232,.45)';
  for (let i = 0; i < 6; i++) {
    sd = (sd * 16807 + 7) % 2147483647;
    g.fillRect(-6.6 + ((sd >> 2) % 6), -3.6 + ((sd >> 5) % 9), 1.1, 1.1);
  }
  /* шов-стежок */
  g.strokeStyle = '#ffd9f5';
  g.lineWidth = 0.9;
  g.beginPath();
  for (let y = -4.2; y < 6; y += 1.6) {
    g.moveTo(0, y);
    g.lineTo(0, y + 0.8);
  }
  g.stroke();
  /* индикатор правой половины */
  g.fillStyle = '#b8f5c8';
  g.fillRect(3.2, 0.6, 2.6, 1);
  /* руки: левая дёргается */
  const jit = Math.sin(t * 13) * 0.9;
  g.strokeStyle = 'rgba(0,0,0,.32)';
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-5.8, 0);
  g.lineTo(-9.6 + jit, 2.9);
  g.stroke();
  g.beginPath();
  g.moveTo(5.8, 0);
  g.lineTo(9.6, 3.2);
  g.stroke();
  /* головы */
  g.fillStyle = '#4a3f63';
  g.beginPath();
  rr(g, -10.6, -15.4, 10, 9.2, 2.4);
  g.fill();
  g.fillStyle = '#3c4f42';
  g.beginPath();
  rr(g, 0.6, -15.4, 10, 9.2, 2.4);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, -9.4, -14.4, 7.6, 7.2, 1.8);
  g.fill();
  g.beginPath();
  rr(g, 1.8, -14.4, 7.6, 7.2, 1.8);
  g.fill();
  /* лицо генератора: шум */
  sd = Math.floor(t * 11) + 1;
  g.fillStyle = 'rgba(211,134,232,.5)';
  for (let i = 0; i < 5; i++) {
    sd = (sd * 16807 + 7) % 2147483647;
    g.fillRect(-8.8 + ((sd >> 2) % 6), -13.6 + ((sd >> 5) % 5), 1, 1);
  }
  g.fillStyle = '#ffd9f5';
  g.beginPath();
  g.arc(-7.3, -10.9, 0.8, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(-4.9, -10.9, 0.8, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,217,245,.7)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-6.7, -8.8);
  g.lineTo(-5.5, -8.8);
  g.stroke();
  /* лицо дискриминатора: строгое, с бровью */
  const dy = Math.max(-1, Math.min(1, ay)) * 0.5;
  g.fillStyle = '#3c4f42';
  g.fillRect(3.1, -12.6, 4.2, 0.7);
  g.fillRect(6.6, -12.2, 1.6, 0.6);
  g.fillStyle = '#b8f5c8';
  g.beginPath();
  g.arc(3.6, -10.9 + dy * 0.3, 0.8, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(6.2, -10.9 + dy * 0.3, 0.8, 0, TAU);
  g.fill();
  g.fillStyle = '#0c110d';
  g.fillRect(3.35, -11.05 + dy * 0.3, 0.5, 0.45);
  g.fillRect(5.95, -11.05 + dy * 0.3, 0.5, 0.45);
  g.strokeStyle = '#b8f5c8';
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(4.9, -9.1, 1.2, Math.PI * 0.12, Math.PI * 0.88);
  g.stroke();
  /* антенны: у генератора вихляет */
  const swx = Math.sin(t * 3) * 1.2;
  g.strokeStyle = '#2a332b';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-7.6, -15.4);
  g.quadraticCurveTo(-8.4 + swx, -17.6, -7.4 + swx, -19.2);
  g.stroke();
  g.beginPath();
  g.moveTo(7.4, -15.4);
  g.lineTo(7.4, -19.2);
  g.stroke();
  g.fillStyle = '#d386e8';
  g.beginPath();
  g.arc(-7.4 + swx, -19.6, 1, 0, TAU);
  g.fill();
  g.fillStyle = '#b8f5c8';
  g.beginPath();
  g.arc(7.4, -19.6, 1, 0, TAU);
  g.fill();
}
