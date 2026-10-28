import { TAU } from '../../core/utils.js';
import { CHARCOL } from './kit.js';

/* --- ЛИСП 1958: клетка из скобок вокруг парящего λ-ядра --- */
export function parenArt(g, wp, mv, t, ay) {
  const col = CHARCOL.lisp;
  const w1 = Math.sin(t * 1.6) * 0.1,
    w2 = Math.sin(t * 1.6 + 1.2) * 0.1;
  /* внешние скобки */
  g.save();
  g.rotate(w1 * 0.5);
  g.strokeStyle = col;
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(1.4, 0, 10.8, Math.PI * 0.6, Math.PI * 1.4);
  g.stroke();
  g.beginPath();
  g.arc(-1.4, 0, 10.8, -Math.PI * 0.4, Math.PI * 0.4);
  g.stroke();
  g.restore();
  /* внутренние скобки, встречное вращение */
  g.save();
  g.rotate(-w2 * 0.7);
  g.strokeStyle = 'rgba(230,220,255,.7)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(0.9, 0, 6.9, Math.PI * 0.6, Math.PI * 1.4);
  g.stroke();
  g.beginPath();
  g.arc(-0.9, 0, 6.9, -Math.PI * 0.4, Math.PI * 0.4);
  g.stroke();
  g.restore();
  /* λ-ядро */
  const fy = Math.sin(t * 2.2) * 0.7;
  g.fillStyle = 'rgba(167,139,250,.22)';
  g.beginPath();
  g.arc(0, fy, 5, 0, TAU);
  g.fill();
  g.fillStyle = '#4c3d8f';
  g.beginPath();
  g.arc(0, fy, 3.7, 0, TAU);
  g.fill();
  g.strokeStyle = '#e6dcff';
  g.lineWidth = 1.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-1.7, fy + 2.7);
  g.quadraticCurveTo(-0.3, fy + 0.5, 1.8, fy - 2.9);
  g.stroke();
  g.beginPath();
  g.moveTo(0.1, fy - 0.5);
  g.quadraticCurveTo(1.4, fy + 0.9, 2.7, fy + 2.7);
  g.stroke();
  g.beginPath();
  g.moveTo(-1.2, fy - 2.7);
  g.quadraticCurveTo(0.2, fy - 1.7, 1.8, fy - 2.7);
  g.stroke();
  /* глаза на ядре */
  const bl = t % 3.7 < 0.13,
    dy = Math.max(-1, Math.min(1, ay)) * 0.5;
  for (const ex of [-1.1, 1.5]) {
    if (bl) {
      g.fillStyle = '#e6dcff';
      g.fillRect(ex - 0.7, fy - 1.15 + dy * 0.4, 1.4, 0.4);
    } else {
      g.fillStyle = '#e6dcff';
      g.beginPath();
      g.arc(ex, fy - 1 + dy * 0.4, 0.82, 0, TAU);
      g.fill();
      g.fillStyle = '#2a2350';
      g.beginPath();
      g.arc(ex + 0.14, fy - 1 + dy * 0.4, 0.36, 0, TAU);
      g.fill();
    }
  }
  /* нижняя скобка-подвеска */
  g.strokeStyle = 'rgba(167,139,250,.6)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(0, fy + 7.2, 1.9, Math.PI * 1.12, Math.PI * 1.88);
  g.stroke();
}
