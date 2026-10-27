import { TAU } from '../../core/utils.js';
import { CHARCOL, rr } from './kit.js';

/* --- ЭХО 1997: кассета с катушками-глазами и лентой-хвостом --- */
export function cassetteArt(g, wp, mv, t, ay) {
  const col = CHARCOL.echo;
  const rt = t * (mv ? 8 : 1.5);
  /* лента-хвост */
  g.strokeStyle = 'rgba(157,180,255,.5)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-8.6, 3.2);
  g.quadraticCurveTo(-12.6, 4.8 + Math.sin(t * 3) * 0.8, -14.8, 3.4 + Math.sin(t * 3) * 1.4);
  g.stroke();
  /* колёсики */
  g.fillStyle = '#39415c';
  g.beginPath();
  rr(g, -6.6, 9.2, 4.6, 2.7, 1.2);
  g.fill();
  g.beginPath();
  rr(g, 2, 9.2, 4.6, 2.7, 1.2);
  g.fill();
  /* корпус */
  g.fillStyle = col;
  g.beginPath();
  rr(g, -9, -6.6, 18, 15.6, 1.6);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.12)';
  g.fillRect(-8, -5.6, 16, 2);
  /* эхо-дубль глаз */
  const eo = Math.sin(t * 2.6) * 0.5 + 1.4;
  g.fillStyle = 'rgba(223,232,255,.22)';
  g.beginPath();
  g.arc(-4.6 - eo * 0.5, -1, 0.95, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(3.2 - eo * 0.5, -1, 0.95, 0, TAU);
  g.fill();
  /* этикетка */
  g.fillStyle = '#dfe8ff';
  g.beginPath();
  rr(g, -7.4, -4.6, 14.8, 6.9, 1);
  g.fill();
  g.fillStyle = '#39415c';
  g.fillRect(-7.4, -4.6, 14.8, 1.1);
  /* окна катушек = глаза */
  for (const ex of [-3.9, 3.9]) {
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(ex, -1, 2.75, 0, TAU);
    g.fill();
    g.save();
    g.translate(ex, -1);
    g.rotate(rt);
    g.strokeStyle = '#dfe8ff';
    g.lineWidth = 0.9;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 1.9, Math.sin(a) * 1.9);
      g.stroke();
    }
    g.restore();
    if (t % 3.7 < 0.13) {
      g.fillStyle = '#0c110d';
      g.fillRect(ex - 1, -1.4, 2, 0.8);
    } else {
      const dy = Math.max(-1, Math.min(1, ay)) * 0.5;
      g.fillStyle = '#dfe8ff';
      g.beginPath();
      g.arc(ex + 0.3, -1 + dy * 0.4, 0.72, 0, TAU);
      g.fill();
    }
  }
  /* ленточный тракт */
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, -5.4, 3.3, 10.8, 2.1, 0.6);
  g.fill();
  g.fillStyle = 'rgba(157,180,255,.6)';
  g.fillRect(-5, 4.1, 10, 0.6);
  /* нижняя трапеция + винтики */
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath();
  g.moveTo(-6.6, 9.2);
  g.lineTo(-4.4, 6.6);
  g.lineTo(4.4, 6.6);
  g.lineTo(6.6, 9.2);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,.4)';
  g.beginPath();
  g.arc(-8.1, 7.4, 0.5, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(8.1, 7.4, 0.5, 0, TAU);
  g.fill();
}
