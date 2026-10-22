export const $ = id => document.getElementById(id);
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const ri = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx,
    dy = ay - by;
  return dx * dx + dy * dy;
};
export function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return '' + n;
}
export function fmtT(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
}
