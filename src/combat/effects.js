import { parts, dmgNums, notes } from '../core/state.js';
import { rnd, TAU } from '../core/utils.js';

/* ================= FX / PARTICLES ================= */
export function burst(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU),
      sp = rnd(40, 190);
    parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rnd(0.25, 0.6),
      T: 0.6,
      col,
      sz: rnd(1.5, 3.5),
    });
  }
  if (parts.length > 320) parts.splice(0, parts.length - 320);
}
export function dmgNum(x, y, v, col) {
  dmgNums.push({ x, y, txt: '' + v, life: 0.7, T: 0.7, col, vy: -46 });
  if (dmgNums.length > 90) dmgNums.splice(0, dmgNums.length - 90);
}
/* мировые уведомления над головой вместо краевых тостов в забеге:
   лёгкий дрейф вверх, появление сразу (без входа), фейд в последние 0.6с */
export function note(x, y, txt, col) {
  notes.push({ x, y, txt, col: col || '#fbbf24', life: 2.4, T: 2.4, vy: -16 });
  if (notes.length > 8) notes.splice(0, notes.length - 8);
}
