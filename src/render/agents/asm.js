import { TAU } from '../../core/utils.js';
import { CHARCOL, rr } from './kit.js';

/* --- АСМ 1949: логическая плата на пинах, камера-сканер на стойке --- */
export function pcbArt(g, wp, mv, t, ay) {
  const col = CHARCOL.asm;
  const stp = mv ? Math.sin(wp) * 2.2 : 0;
  /* хвост-перфолента */
  g.strokeStyle = '#e8e2d0';
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-7.6, 2.6);
  g.quadraticCurveTo(-12, 3.8 + Math.sin(t * 3) * 0.8, -14.6, 6.4 + Math.sin(t * 3) * 1.2);
  g.stroke();
  g.fillStyle = 'rgba(0,0,0,.35)';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(-8.8 - i * 1.6, 3.1 + i * 0.8, 0.36, 0, TAU);
    g.fill();
  }
  /* пины-ножки */
  g.strokeStyle = '#5c6a74';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  for (const px of [-5.6, -1.9, 1.9, 5.6]) {
    g.beginPath();
    g.moveTo(px, 6.2);
    g.lineTo(px + (px < 0 ? stp : -stp) * 0.7, 10.6);
    g.stroke();
  }
  /* плата */
  g.fillStyle = col;
  g.beginPath();
  rr(g, -8.6, -6, 17.2, 12.4, 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.1)';
  g.beginPath();
  rr(g, -7.6, -5, 15.2, 3.2, 1.3);
  g.fill();
  /* дорожки */
  g.strokeStyle = '#d9b36a';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-7.2, 3.2);
  g.lineTo(-2, 3.2);
  g.lineTo(-0.4, 4.9);
  g.lineTo(6.6, 4.9);
  g.stroke();
  g.beginPath();
  g.moveTo(-7.2, -3.8);
  g.lineTo(-4.6, -3.8);
  g.lineTo(-3, -1.7);
  g.stroke();
  g.beginPath();
  g.moveTo(7.2, 0.8);
  g.lineTo(3.6, 0.8);
  g.lineTo(2.4, 2);
  g.stroke();
  /* чипы */
  g.fillStyle = '#20262b';
  g.beginPath();
  rr(g, -6.4, -4.7, 7.2, 4.3, 0.8);
  g.fill();
  g.fillStyle = '#2f3a41';
  for (let i = 0; i < 4; i++) {
    g.fillRect(-6.1 + i * 1.65, -5.1, 0.55, 0.9);
    g.fillRect(-6.1 + i * 1.65, -0.85, 0.55, 0.9);
  }
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.beginPath();
  g.arc(-5.4, -4, 0.4, 0, TAU);
  g.fill();
  g.fillStyle = '#20262b';
  g.beginPath();
  rr(g, 2.2, 0.2, 5.4, 3.4, 0.8);
  g.fill();
  /* конденсаторы */
  g.fillStyle = '#3f4d55';
  g.beginPath();
  g.arc(-3.4, -7.7, 1.4, 0, TAU);
  g.fill();
  g.fillStyle = '#d9b36a';
  g.fillRect(-4.3, -9.4, 1.8, 1.1);
  g.fillStyle = '#3f4d55';
  g.beginPath();
  g.arc(-0.4, -7.9, 1, 0, TAU);
  g.fill();
  /* камера-сканер на стойке */
  g.strokeStyle = '#39434b';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(4.4, -6);
  g.lineTo(5.2, -10);
  g.stroke();
  g.fillStyle = '#39434b';
  g.beginPath();
  rr(g, 2.2, -14.4, 6.4, 4.6, 1.2);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, 3.2, -13.6, 4.4, 3, 0.8);
  g.fill();
  const dy = Math.max(-1, Math.min(1, ay)) * 0.7;
  g.fillStyle = '#9fd8ff';
  g.beginPath();
  g.arc(5.4, -12.1 + dy, 1, 0, TAU);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  g.arc(5.4, -12.1 + dy, 0.42, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(159,216,255,.45)';
  g.fillRect(3.3, -12.1 + Math.sin(t * 2.6) * 1.1 - 0.3, 4.2, 0.6);
  /* золотой край-коннектор */
  g.fillStyle = '#d9b36a';
  for (let i = 0; i < 5; i++) g.fillRect(-6.9 + i * 2.9, 6.4, 1.8, 1.5);
  /* LED */
  g.fillStyle = Math.floor(t * 3) % 2 ? '#4ade80' : 'rgba(74,222,128,.3)';
  g.beginPath();
  g.arc(-7.2, -0.6, 0.8, 0, TAU);
  g.fill();
}
