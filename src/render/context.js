import { $ } from '../core/utils.js';
import { S } from '../core/state.js';

/* ================= CANVAS / RENDER ================= */
const cv = $('game'),
  ctx = cv.getContext('2d');
function resize() {
  S.dpr = Math.min(2, window.devicePixelRatio || 1);
  S.W = innerWidth;
  S.H = innerHeight;
  cv.width = S.W * S.dpr;
  cv.height = S.H * S.dpr;
}
window.addEventListener('resize', resize);
resize();

export { cv, ctx, resize };
