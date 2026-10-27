import { TAU } from '../../core/utils.js';
import { rr } from './kit.js';

/* --- ЛАМПА 1945: стеклянная колба с нитью-лицом на пинах цоколя --- */
export function tubeArt(g, wp, mv, t, ay) {
  const puls = 0.72 + 0.28 * Math.sin(t * 3.1);
  const stp = mv ? Math.sin(wp) * 1.7 : 0;
  /* свечение */
  const gr = g.createRadialGradient(0, -5, 2, 0, -5, 16);
  gr.addColorStop(0, 'rgba(255,194,71,' + (0.32 * puls).toFixed(3) + ')');
  gr.addColorStop(1, 'rgba(255,194,71,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, -5, 16, 0, TAU);
  g.fill();
  /* пины цоколя */
  g.strokeStyle = '#7a6a45';
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  for (const px of [-4.4, -1.5, 1.5, 4.4]) {
    g.beginPath();
    g.moveTo(px, 8.6);
    g.lineTo(px + (px < 0 ? stp : -stp) * 0.55, 12.4);
    g.stroke();
  }
  /* цоколь */
  g.fillStyle = '#8a7440';
  g.beginPath();
  rr(g, -5.4, 3.9, 10.8, 5, 1.3);
  g.fill();
  g.fillStyle = '#6e5c30';
  g.fillRect(-5.4, 5, 10.8, 0.9);
  g.fillRect(-5.4, 7, 10.8, 0.9);
  /* колба */
  g.fillStyle = 'rgba(255,214,120,.3)';
  g.beginPath();
  g.arc(0, -4.6, 9.5, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,236,170,.5)';
  g.beginPath();
  g.arc(0, -4.6, 7.3, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.55)';
  g.lineWidth = 1.1;
  g.beginPath();
  g.arc(0, -4.6, 9, Math.PI * 1.05, Math.PI * 1.55);
  g.stroke();
  /* нить накаливания */
  g.strokeStyle = '#c98a1e';
  g.lineWidth = 0.9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-4.4, -0.9);
  g.lineTo(-4.4, -2.9);
  g.lineTo(-1.6, -1.1);
  g.lineTo(1.4, -3.1);
  g.lineTo(4.4, -1.3);
  g.stroke();
  /* лицо: тёплые точки-глаза */
  const bl = t % 3.7 < 0.13,
    dy = Math.max(-1.2, Math.min(1.2, ay)) * 0.6;
  for (const ex of [-2.7, 2.7]) {
    if (bl) {
      g.strokeStyle = '#8a5a10';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(ex - 1.2, -6.6 + dy * 0.5);
      g.lineTo(ex + 1.2, -6.6 + dy * 0.5);
      g.stroke();
    } else {
      g.fillStyle = 'rgba(255,242,176,' + (0.5 + 0.45 * puls).toFixed(2) + ')';
      g.beginPath();
      g.arc(ex, -6.6 + dy * 0.5, 1.5, 0, TAU);
      g.fill();
      g.fillStyle = '#8a5a10';
      g.beginPath();
      g.arc(ex + 0.3, -6.6 + dy * 0.5, 0.55, 0, TAU);
      g.fill();
    }
  }
  /* блик стекла */
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.beginPath();
  g.arc(-3.6, -9.4, 1.4, 0, TAU);
  g.fill();
}
