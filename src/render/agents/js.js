import { TAU } from '../../core/utils.js';
import { rr, eyePair } from './kit.js';

/* --- ДЖС 1995: парящее окно браузера, скроллбар-хвост, warning-уведомление --- */
export function winArt(g, wp, mv, t, ay) {
  g.save();
  g.rotate(mv ? Math.sin(wp) * 0.05 : Math.sin(t * 1.9) * 0.03);
  /* хвост-скроллбар */
  g.fillStyle = '#8a7500';
  g.beginPath();
  rr(g, 8.2, -8, 2.4, 17, 1);
  g.fill();
  const th = mv ? Math.sin(wp * 0.9) * 5 : Math.sin(t * 1.3) * 4;
  g.fillStyle = '#f5d90a';
  g.fillRect(8.7, -6.5 + th, 1.4, 5);
  /* окно */
  g.fillStyle = '#a08b06';
  g.beginPath();
  rr(g, -8.6, -12, 17.4, 16.6, 1.8);
  g.fill();
  g.fillStyle = '#f5d90a';
  g.beginPath();
  rr(g, -7.6, -11, 15.4, 14.6, 1.2);
  g.fill();
  g.fillStyle = '#d4b606';
  g.fillRect(-7.6, -11, 15.4, 3.6);
  g.fillStyle = '#fff7bf';
  g.beginPath();
  g.arc(-6.2, -9.2, 0.72, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(-4.2, -9.2, 0.72, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(-2.2, -9.2, 0.72, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.fillRect(-7.6, -7.9, 15.4, 0.6);
  /* тулбар-кнопки */
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.fillRect(-6.6, -6.4, 2.6, 1.8);
  g.fillRect(-3.2, -6.4, 2.6, 1.8);
  g.fillStyle = '#fff7bf';
  g.fillRect(0.2, -6.4, 2.6, 1.8);
  /* трещина стекла */
  g.strokeStyle = 'rgba(0,0,0,.3)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(6.4, -4.4);
  g.lineTo(4.8, -3);
  g.lineTo(5.6, -1.2);
  g.moveTo(4.8, -3);
  g.lineTo(3.4, -3.6);
  g.stroke();
  /* паническое лицо */
  const dy = Math.max(-1.3, Math.min(1.3, ay)) * 0.6;
  eyePair(g, -3, 2.6, -2.6 + dy * 0.3, ay, t, '#fff7bf', '#3a3000');
  g.strokeStyle = '#3a3000';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-2.6, 1.6 + Math.sin(t * 4) * 0.3);
  g.quadraticCurveTo(-0.6, 0.7, 1.4, 1.6 + Math.cos(t * 3.4) * 0.3);
  g.stroke();
  g.restore();
  /* warning-уведомление */
  const bx = 11,
    by = -13.8 + Math.sin(t * 2.6) * 0.8;
  g.fillStyle = '#1d231c';
  g.beginPath();
  g.moveTo(bx - 3, by + 2.6);
  g.lineTo(bx, by - 2.6);
  g.lineTo(bx + 3, by + 2.6);
  g.closePath();
  g.fill();
  g.fillStyle = '#f5d90a';
  g.beginPath();
  g.moveTo(bx - 2.3, by + 2);
  g.lineTo(bx, by - 1.7);
  g.lineTo(bx + 2.3, by + 2);
  g.closePath();
  g.fill();
  g.fillStyle = '#1d231c';
  g.fillRect(bx - 0.25, by - 0.7, 0.5, 1.3);
  g.fillRect(bx - 0.25, by + 0.9, 0.5, 0.6);
}
