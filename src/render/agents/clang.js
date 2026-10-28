import { TAU } from '../../core/utils.js';
import { CHARCOL, rr, hexNut } from './kit.js';

/* --- СИ 1972: куб-ядро на гусеницах, иллюминатор, труба с паром, ключ --- */
export function kernArt(g, wp, mv, t, ay) {
  const col = CHARCOL.clang;
  /* труба с паром за спиной */
  g.strokeStyle = '#4c626e';
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(-6.6, -4);
  g.lineTo(-11.6, -4);
  g.stroke();
  const pu = (t * 0.8) % 1;
  g.fillStyle = 'rgba(223,244,255,' + (0.35 * (1 - pu)).toFixed(3) + ')';
  g.beginPath();
  g.arc(-12.6, -5.2 - pu * 3.4, 1.4 + pu * 2, 0, TAU);
  g.fill();
  /* гусеничная база */
  g.fillStyle = '#1f2b33';
  g.beginPath();
  rr(g, -7.6, 5.8, 15.2, 5.2, 2.4);
  g.fill();
  g.fillStyle = '#39525f';
  g.beginPath();
  g.arc(-4.4, 8.4, 1.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(0.4, 8.4, 1.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(5.2, 8.4, 1.3, 0, TAU);
  g.fill();
  /* корпус-куб */
  g.fillStyle = col;
  g.beginPath();
  rr(g, -7.2, -6.4, 14.4, 12.6, 1.6);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.15)';
  g.fillRect(-5.9, -5.2, 3.2, 10.4);
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.fillRect(-7.2, 4.5, 14.4, 1.7);
  /* гайки по углам */
  g.fillStyle = '#2c4655';
  hexNut(g, -5.3, -4.5, 1.5);
  hexNut(g, 5.3, -4.5, 1.5);
  hexNut(g, -5.3, 3.7, 1.5);
  hexNut(g, 5.3, 3.7, 1.5);
  /* иллюминатор-глаз */
  g.fillStyle = '#16323f';
  g.beginPath();
  g.arc(1.2, -1.2, 4.1, 0, TAU);
  g.fill();
  g.strokeStyle = '#9fd8ff';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(1.2, -1.2, 4.1, 0, TAU);
  g.stroke();
  const dy = Math.max(-1.3, Math.min(1.3, ay)) * 0.7;
  if (t % 3.7 < 0.13) {
    g.fillStyle = '#16323f';
    g.fillRect(-1.2, -1.5, 4.8, 0.7);
  } else {
    g.fillStyle = '#bfe9ff';
    g.beginPath();
    g.arc(1.2, -1.2 + dy * 0.4, 2.5, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(1.9, -1.2 + dy, 1.15, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.beginPath();
    g.arc(0.4, -2.2 + dy * 0.6, 0.5, 0, TAU);
    g.fill();
  }
  /* сердитый козырёк */
  g.fillStyle = '#1f3a47';
  g.beginPath();
  rr(g, -2.6, -6.1, 7.8, 1.5, 0.7);
  g.fill();
  /* решётка-рот */
  g.fillStyle = '#16323f';
  for (let i = 0; i < 4; i++) g.fillRect(-4.4 + i * 1.75, 2.4, 1.1, 1.8);
  /* ключ-манипулятор */
  g.strokeStyle = '#4c626e';
  g.lineWidth = 1.9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(7, 1.4);
  g.lineTo(10.4, 3.8);
  g.stroke();
  g.strokeStyle = '#dff4ff';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(11.6, 4.6, 1.5, Math.PI * 0.15, Math.PI * 1.05);
  g.stroke();
  g.beginPath();
  g.moveTo(12.3, 3.3);
  g.lineTo(13.3, 2.2);
  g.stroke();
}
