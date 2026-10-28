import { TAU } from '../../core/utils.js';

/* --- ДИФФУЗИЯ 2020: рой частиц вокруг размытого лица, растягивается при беге --- */
export function diffArt(g, wp, mv, t, ay) {
  const fy = Math.sin(t * 1.8) * 0.6;
  /* размытое ядро-лицо */
  g.fillStyle = 'rgba(168,162,158,.3)';
  g.beginPath();
  g.arc(0, -1 + fy, 7.8, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(225,220,212,.3)';
  g.beginPath();
  g.arc(0, -1 + fy, 5.4, 0, TAU);
  g.fill();
  const dy = Math.max(-1.2, Math.min(1.2, ay)) * 0.5;
  const bl = t % 3.7 < 0.13;
  g.fillStyle = 'rgba(245,245,240,.75)';
  if (bl) {
    g.fillRect(-2.9, -1.4 + fy, 2, 0.4);
    g.fillRect(0.9, -1.4 + fy, 2, 0.4);
  } else {
    g.beginPath();
    g.arc(-1.8, -1 + fy + dy * 0.4, 1.05, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(1.8, -1 + fy + dy * 0.4, 1.05, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(30,28,26,.8)';
    g.beginPath();
    g.arc(-1.6, -1 + fy + dy * 0.5, 0.5, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(2, -1 + fy + dy * 0.5, 0.5, 0, TAU);
    g.fill();
  }
  g.strokeStyle = 'rgba(245,245,240,.5)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(0.2, 1.7 + fy, 1.2, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();
  /* рой частиц */
  const strh = mv ? -1.3 : 0;
  for (let i = 0; i < 16; i++) {
    const ph = t * (0.6 + (i % 5) * 0.13) + i * 1.31;
    const rad2 = 3.4 + ((i * 37) % 70) / 10;
    const px = Math.cos(ph + i * 0.6) * rad2 * 1.35 + strh * rad2;
    const py = Math.sin(ph * 0.9 + i * 0.7) * rad2 * 0.6 - 1;
    const al = 0.32 + 0.5 * (0.5 + 0.5 * Math.sin(ph * 2 + i));
    g.fillStyle = i % 3 ? 'rgba(200,196,190,' + al.toFixed(2) + ')' : 'rgba(245,245,240,' + al.toFixed(2) + ')';
    g.fillRect(px, py, 1.5, 1.5);
  }
  /* пунктирное гало */
  g.strokeStyle = 'rgba(190,185,178,.55)';
  g.lineWidth = 0.9;
  g.setLineDash([1.8, 1.6]);
  g.beginPath();
  g.arc(0, -1, 10.8, 0, TAU);
  g.stroke();
  g.setLineDash([]);
}
