import { CHARCOL, rr, shade, eyePair } from './kit.js';

/* --- ПЕРФОКАРТА 1890: шагающая карта с перфорацией и веером карт за спиной --- */
export function cardArt(g, wp, mv, t, ay) {
  const col = CHARCOL.punch,
    dk = 'rgba(0,0,0,.26)';
  const stp = mv ? Math.sin(wp) * 2.1 : 0;
  g.save();
  g.rotate(mv ? Math.sin(wp) * 0.04 : 0);
  /* веер карт за спиной */
  g.save();
  g.translate(-6.2, -1.5);
  g.rotate(-0.3 + Math.sin(t * 1.8) * 0.05);
  g.fillStyle = shade(col, -0.22);
  g.fillRect(-4.4, -6.6, 8, 12.6);
  g.fillStyle = dk;
  g.fillRect(-3.2, -4.8, 4.4, 0.7);
  g.fillRect(-3.2, -2.2, 4.4, 0.7);
  g.restore();
  g.save();
  g.translate(-5.2, -1.5);
  g.rotate(-0.13);
  g.fillStyle = shade(col, -0.1);
  g.fillRect(-4.4, -7, 8.4, 13.2);
  g.restore();
  /* ноги-картонки */
  g.fillStyle = shade(col, -0.38);
  g.beginPath();
  rr(g, -4.8 + stp, 9.4, 3.3, 3.6, 1);
  g.fill();
  g.beginPath();
  rr(g, 1.9 - stp, 9.4, 3.3, 3.6, 1);
  g.fill();
  /* тело-карта со срезанным углом */
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(-7.2, -9.6);
  g.lineTo(4.4, -9.6);
  g.lineTo(7.2, -6.4);
  g.lineTo(7.2, 9.4);
  g.lineTo(-7.2, 9.4);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.15)';
  g.fillRect(-5.8, -8.2, 2.6, 16.2);
  g.strokeStyle = 'rgba(0,0,0,.18)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-7.2, -4.2);
  g.lineTo(7.2, -4.2);
  g.stroke(); // линия отреза
  /* перфорация */
  g.fillStyle = 'rgba(0,0,0,.24)';
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 7; c++) {
      if ((r * 7 + c) % 3 === 0) continue;
      g.fillRect(-5.6 + c * 1.86, -2.6 + r * 2.06, 1.05, 1.25);
    }
  /* лицо: круглые отверстия + щель */
  eyePair(g, -2, 3.4, -6.4, ay, t, '#fff3cf', '#3a2c10');
  g.fillStyle = '#3a2c10';
  g.fillRect(-1.5, -1.6, 4.4, 1.5);
  /* язычок сверху */
  g.fillStyle = shade(col, -0.2);
  g.fillRect(-3.4, -12, 6.4, 2.6);
  g.fillStyle = 'rgba(255,255,255,.3)';
  g.fillRect(-2.4, -11.3, 4.4, 0.7);
  g.restore();
}
