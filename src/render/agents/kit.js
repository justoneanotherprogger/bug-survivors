import { TAU } from '../../core/utils.js';

export const CHARCOL = {
  punch: '#d0a85c',
  lamp: '#ffc247',
  asm: '#9aa8b2',
  lisp: '#a78bfa',
  clang: '#38bdf8',
  decide: '#4ade80',
  py: '#2dd4bf',
  js: '#f5d90a',
  svm: '#8fb6c9',
  echo: '#9db4ff',
  git: '#f87171',
  rl: '#a3e635',
  gan: '#d386e8',
  attn: '#c084fc',
  diff: '#a8a29e',
  legacy: '#e8794a',
  agi: '#ffe066',
};

export const rr = (g, x, y, w, h, r) => {
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
};

export function dia(g, x, y, s) {
  g.beginPath();
  g.moveTo(x - s, y);
  g.lineTo(x, y - s);
  g.lineTo(x + s, y);
  g.lineTo(x, y + s);
  g.closePath();
  g.fill();
}

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    gg = (n >> 8) & 255,
    b = n & 255;
  if (k > 0) {
    r += (255 - r) * k;
    gg += (255 - gg) * k;
    b += (255 - b) * k;
  } else {
    r *= 1 + k;
    gg *= 1 + k;
    b *= 1 + k;
  }
  return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')';
}

export function hexNut(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    const px = x + Math.cos(a) * r,
      py = y + Math.sin(a) * r;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
  g.fill();
}

export function eyePair(g, ex1, ex2, ey, ay, t, glow, pupil) {
  // стандартная пара глаз: свечение, моргание, зрачок за прицелом
  const bl = t % 3.7 < 0.13,
    dy = Math.max(-1.3, Math.min(1.3, ay)) * 0.6;
  for (const ex of [ex1, ex2]) {
    g.fillStyle = glow;
    g.globalAlpha = 0.25;
    g.beginPath();
    g.arc(ex, ey, 2.4, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    if (bl) {
      g.fillStyle = glow;
      g.fillRect(ex - 1.35, ey - 0.25, 2.7, 0.5);
    } else {
      g.fillStyle = glow;
      g.beginPath();
      g.arc(ex, ey, 1.4, 0, TAU);
      g.fill();
      g.fillStyle = pupil;
      g.beginPath();
      g.arc(ex + 0.32, ey + dy, 0.6, 0, TAU);
      g.fill();
    }
  }
}
