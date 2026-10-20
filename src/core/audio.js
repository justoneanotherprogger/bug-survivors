import { save } from './save.js';

/* ================= AUDIO ================= */
let AC = null;
const lastSfx = {};
function ac() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  return AC;
}
window.addEventListener(
  'pointerdown',
  () => {
    const a = ac();
    if (a && a.state === 'suspended') a.resume();
  },
  { passive: true }
);
function tone(f0, f1, dur, type, vol, delay = 0) {
  const a = ac();
  if (!a) return;
  try {
    const t0 = a.currentTime + delay;
    const o = a.createOscillator(),
      g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch (e) {}
}
export function sfx(n) {
  if (!save.set.sfx || !AC) return;
  const now = performance.now();
  const th = { shoot: 70, hit: 60, gem: 55, kill: 70, coin: 80 }[n] || 0;
  if (th && now - (lastSfx[n] || 0) < th) return;
  lastSfx[n] = now;
  switch (n) {
    case 'shoot':
      tone(300, 200, 0.05, 'square', 0.04);
      break;
    case 'hit':
      tone(180, 90, 0.06, 'triangle', 0.07);
      break;
    case 'kill':
      tone(320, 60, 0.12, 'square', 0.08);
      break;
    case 'gem':
      tone(720, 980, 0.06, 'sine', 0.045);
      break;
    case 'coin':
      tone(880, 1500, 0.1, 'sine', 0.07);
      break;
    case 'heal':
      tone(500, 900, 0.15, 'sine', 0.09);
      break;
    case 'hurt':
      tone(220, 55, 0.22, 'sawtooth', 0.15);
      break;
    case 'lvl':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.12, 'square', 0.06, i * 0.07));
      break;
    case 'chest':
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.14, 'square', 0.06, i * 0.08));
      break;
    case 'evo':
      [261, 329, 392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.16, 'sawtooth', 0.045, i * 0.06));
      break;
    case 'boss':
      tone(90, 38, 0.7, 'sawtooth', 0.18);
      break;
    case 'click':
      tone(640, 520, 0.045, 'square', 0.045);
      break;
    case 'boom':
      tone(120, 30, 0.35, 'sawtooth', 0.18);
      break;
    case 'pick':
      tone(500, 700, 0.05, 'sine', 0.05);
      break;
  }
}
