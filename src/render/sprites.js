import { TAU } from '../core/utils.js';
import { STAGES } from '../data/stages.js';
import { pRack, pVent, pDesk, pMoon, pTape, pCard, pStars, pScan } from './scenes.js';
const CHARCOL = {
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

/* ===== СПРАЙТЫ АГЕНТОВ: у каждого модели — СВОЁ тело (образ эпохи), а не общий дроид с другой головой ===== */
const CHAR_ART = {};
const DIR_MEM = {};
export function charArtURL(id) {
  if (!CHAR_ART[id]) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.translate(64, 67);
    g.scale(3, 3);
    drawAgentArt(g, id, 0.5, 0, false, 1.3);
    CHAR_ART[id] = cv.toDataURL('image/png');
  }
  return CHAR_ART[id];
}
/* превью-сцена карты для карточки выбора: тот же код пропов, что и в бою */
const STAGE_ART = {};
export function stageArtURL(id) {
  if (!STAGE_ART[id]) {
    const st = STAGES.find(s => s.id === id);
    const c = document.createElement('canvas');
    c.width = 464;
    c.height = 240;
    const g = c.getContext('2d');
    g.fillStyle = st.bg;
    g.fillRect(0, 0, 464, 240);
    g.strokeStyle = st.grid;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 28; x < 464; x += 56) {
      g.moveTo(x, 0);
      g.lineTo(x, 240);
    }
    for (let y = 16; y < 240; y += 56) {
      g.moveTo(0, y);
      g.lineTo(464, y);
    }
    g.stroke();
    const rg = g.createRadialGradient(232, 120, 30, 232, 120, 330);
    rg.addColorStop(0, 'rgba(' + st.glowRGB + ',0.14)');
    rg.addColorStop(1, 'rgba(' + st.glowRGB + ',0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 464, 240);
    const t = 2.4;
    if (st.decor === 'server') {
      pRack(g, 44, 42, 0.15, t);
      pRack(g, 268, 122, 0.4, t);
      pVent(g, 168, 58);
      pVent(g, 356, 36);
    } else if (st.decor === 'night') {
      pMoon(g, 464);
      pStars(g, 464, 240, t, 0, 0);
      pDesk(g, 48, 118, 0.2, t);
      pDesk(g, 288, 36, 0.55, t);
    } else if (st.decor === 'mainframe') {
      pTape(g, 48, 40, 0.2, t);
      pTape(g, 282, 118, 0.5, t);
      pCard(g, 186, 54, 0.3);
      pCard(g, 368, 42, 0.75);
      pScan(g, 464, 240, t);
    }
    STAGE_ART[id] = c.toDataURL('image/png');
  }
  return STAGE_ART[id];
}
const rr = (g, x, y, w, h, r) => {
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
};
function dia(g, x, y, s) {
  g.beginPath();
  g.moveTo(x - s, y);
  g.lineTo(x, y - s);
  g.lineTo(x + s, y);
  g.lineTo(x, y + s);
  g.closePath();
  g.fill();
}
function shade(hex, k) {
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
function hexNut(g, x, y, r) {
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
function eyePair(g, ex1, ex2, ey, ay, t, glow, pupil) {
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
export function drawAgentArt(g, id, va, wp, mv, t) {
  const cx = Math.cos(va);
  if (Math.abs(cx) > 0.2) DIR_MEM[id] = cx < 0 ? -1 : 1;
  const dir = DIR_MEM[id] || 1;
  const ay = Math.sin(va);
  g.save();
  g.scale(dir, 1);
  if (mv) g.rotate(Math.sin(wp) * 0.045);
  g.translate(0, mv ? -Math.abs(Math.cos(wp)) * 1.05 : Math.sin(t * 2.4) * 0.4);
  if (id === 'legacy') dinoArt(g, wp, mv, t);
  else if (id === 'py') snakeArt(g, wp, mv, t, ay);
  else if (id === 'agi') orbArt(g, wp, mv, t, ay);
  else (AGENT_ART[id] || cardArt)(g, wp, mv, t, ay);
  g.restore();
}
/* --- ПЕРФОКАРТА 1890: шагающая карта с перфорацией и веером карт за спиной --- */
function cardArt(g, wp, mv, t, ay) {
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
/* --- ЛАМПА 1945: стеклянная колба с нитью-лицом на пинах цоколя --- */
function tubeArt(g, wp, mv, t, ay) {
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
/* --- АСМ 1949: логическая плата на пинах, камера-сканер на стойке --- */
function pcbArt(g, wp, mv, t, ay) {
  const col = CHARCOL.asm;
  const stp = mv ? Math.sin(wp) * 2.2 : 0;
  /* хвост-перфолента */
  g.strokeStyle = '#e8e2d0';
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-7.6, 2.6);
  g.quadraticCurveTo(-12, 3.8 + Math.sin(t * 3) * 0.8, -14.6, 6.4 + Math.sin(t * 3) * 1.2);
  g.stroke();
  g.fillStyle = 'rgba(0,0,0,.35)';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(-8.8 - i * 1.6, 3.1 + i * 0.8, 0.36, 0, TAU);
    g.fill();
  }
  /* пины-ножки */
  g.strokeStyle = '#5c6a74';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  for (const px of [-5.6, -1.9, 1.9, 5.6]) {
    g.beginPath();
    g.moveTo(px, 6.2);
    g.lineTo(px + (px < 0 ? stp : -stp) * 0.7, 10.6);
    g.stroke();
  }
  /* плата */
  g.fillStyle = col;
  g.beginPath();
  rr(g, -8.6, -6, 17.2, 12.4, 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.1)';
  g.beginPath();
  rr(g, -7.6, -5, 15.2, 3.2, 1.3);
  g.fill();
  /* дорожки */
  g.strokeStyle = '#d9b36a';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-7.2, 3.2);
  g.lineTo(-2, 3.2);
  g.lineTo(-0.4, 4.9);
  g.lineTo(6.6, 4.9);
  g.stroke();
  g.beginPath();
  g.moveTo(-7.2, -3.8);
  g.lineTo(-4.6, -3.8);
  g.lineTo(-3, -1.7);
  g.stroke();
  g.beginPath();
  g.moveTo(7.2, 0.8);
  g.lineTo(3.6, 0.8);
  g.lineTo(2.4, 2);
  g.stroke();
  /* чипы */
  g.fillStyle = '#20262b';
  g.beginPath();
  rr(g, -6.4, -4.7, 7.2, 4.3, 0.8);
  g.fill();
  g.fillStyle = '#2f3a41';
  for (let i = 0; i < 4; i++) {
    g.fillRect(-6.1 + i * 1.65, -5.1, 0.55, 0.9);
    g.fillRect(-6.1 + i * 1.65, -0.85, 0.55, 0.9);
  }
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.beginPath();
  g.arc(-5.4, -4, 0.4, 0, TAU);
  g.fill();
  g.fillStyle = '#20262b';
  g.beginPath();
  rr(g, 2.2, 0.2, 5.4, 3.4, 0.8);
  g.fill();
  /* конденсаторы */
  g.fillStyle = '#3f4d55';
  g.beginPath();
  g.arc(-3.4, -7.7, 1.4, 0, TAU);
  g.fill();
  g.fillStyle = '#d9b36a';
  g.fillRect(-4.3, -9.4, 1.8, 1.1);
  g.fillStyle = '#3f4d55';
  g.beginPath();
  g.arc(-0.4, -7.9, 1, 0, TAU);
  g.fill();
  /* камера-сканер на стойке */
  g.strokeStyle = '#39434b';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(4.4, -6);
  g.lineTo(5.2, -10);
  g.stroke();
  g.fillStyle = '#39434b';
  g.beginPath();
  rr(g, 2.2, -14.4, 6.4, 4.6, 1.2);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, 3.2, -13.6, 4.4, 3, 0.8);
  g.fill();
  const dy = Math.max(-1, Math.min(1, ay)) * 0.7;
  g.fillStyle = '#9fd8ff';
  g.beginPath();
  g.arc(5.4, -12.1 + dy, 1, 0, TAU);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  g.arc(5.4, -12.1 + dy, 0.42, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(159,216,255,.45)';
  g.fillRect(3.3, -12.1 + Math.sin(t * 2.6) * 1.1 - 0.3, 4.2, 0.6);
  /* золотой край-коннектор */
  g.fillStyle = '#d9b36a';
  for (let i = 0; i < 5; i++) g.fillRect(-6.9 + i * 2.9, 6.4, 1.8, 1.5);
  /* LED */
  g.fillStyle = Math.floor(t * 3) % 2 ? '#4ade80' : 'rgba(74,222,128,.3)';
  g.beginPath();
  g.arc(-7.2, -0.6, 0.8, 0, TAU);
  g.fill();
}
/* --- ЛИСП 1958: клетка из скобок вокруг парящего λ-ядра --- */
function parenArt(g, wp, mv, t, ay) {
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
/* --- СИ 1972: куб-ядро на гусеницах, иллюминатор, труба с паром, ключ --- */
function kernArt(g, wp, mv, t, ay) {
  const col = CHARCOL.clang;
  /* труба с паром за спиной */
  g.strokeStyle = '#4c626e';
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(-6.6, -4);
  g.lineTo(-11.6, -4);
  g.stroke();
  const pu = (t * 0.8) % 1;
  g.fillStyle = 'rgba(223,244,255,' + (0.35 * (1 - pu)).toFixed(3) + ')';
  g.beginPath();
  g.arc(-12.6, -5.2 - pu * 3.4, 1.4 + pu * 2, 0, TAU);
  g.fill();
  /* гусеничная база */
  g.fillStyle = '#1f2b33';
  g.beginPath();
  rr(g, -7.6, 5.8, 15.2, 5.2, 2.4);
  g.fill();
  g.fillStyle = '#39525f';
  g.beginPath();
  g.arc(-4.4, 8.4, 1.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(0.4, 8.4, 1.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(5.2, 8.4, 1.3, 0, TAU);
  g.fill();
  /* корпус-куб */
  g.fillStyle = col;
  g.beginPath();
  rr(g, -7.2, -6.4, 14.4, 12.6, 1.6);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.15)';
  g.fillRect(-5.9, -5.2, 3.2, 10.4);
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.fillRect(-7.2, 4.5, 14.4, 1.7);
  /* гайки по углам */
  g.fillStyle = '#2c4655';
  hexNut(g, -5.3, -4.5, 1.5);
  hexNut(g, 5.3, -4.5, 1.5);
  hexNut(g, -5.3, 3.7, 1.5);
  hexNut(g, 5.3, 3.7, 1.5);
  /* иллюминатор-глаз */
  g.fillStyle = '#16323f';
  g.beginPath();
  g.arc(1.2, -1.2, 4.1, 0, TAU);
  g.fill();
  g.strokeStyle = '#9fd8ff';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(1.2, -1.2, 4.1, 0, TAU);
  g.stroke();
  const dy = Math.max(-1.3, Math.min(1.3, ay)) * 0.7;
  if (t % 3.7 < 0.13) {
    g.fillStyle = '#16323f';
    g.fillRect(-1.2, -1.5, 4.8, 0.7);
  } else {
    g.fillStyle = '#bfe9ff';
    g.beginPath();
    g.arc(1.2, -1.2 + dy * 0.4, 2.5, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(1.9, -1.2 + dy, 1.15, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.beginPath();
    g.arc(0.4, -2.2 + dy * 0.6, 0.5, 0, TAU);
    g.fill();
  }
  /* сердитый козырёк */
  g.fillStyle = '#1f3a47';
  g.beginPath();
  rr(g, -2.6, -6.1, 7.8, 1.5, 0.7);
  g.fill();
  /* решётка-рот */
  g.fillStyle = '#16323f';
  for (let i = 0; i < 4; i++) g.fillRect(-4.4 + i * 1.75, 2.4, 1.1, 1.8);
  /* ключ-манипулятор */
  g.strokeStyle = '#4c626e';
  g.lineWidth = 1.9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(7, 1.4);
  g.lineTo(10.4, 3.8);
  g.stroke();
  g.strokeStyle = '#dff4ff';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(11.6, 4.6, 1.5, Math.PI * 0.15, Math.PI * 1.05);
  g.stroke();
  g.beginPath();
  g.moveTo(12.3, 3.3);
  g.lineTo(13.3, 2.2);
  g.stroke();
}
/* --- ДЕЦИЗИЯ 1986: дерево решений в горшке, таблички ✓/✗ на ветках --- */
function treeArt(g, wp, mv, t, ay) {
  const sway = mv ? Math.sin(wp) * 0.08 : Math.sin(t * 1.7) * 0.04;
  /* горшок */
  g.fillStyle = '#b0603c';
  g.beginPath();
  g.moveTo(-5.2, 5.4);
  g.lineTo(5.2, 5.4);
  g.lineTo(3.9, 10.6);
  g.lineTo(-3.9, 10.6);
  g.closePath();
  g.fill();
  g.fillStyle = '#c97550';
  g.fillRect(-6, 3.7, 12, 2.1);
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.fillRect(-4, 8.5, 8, 1.5);
  /* ствол + ветки + листва */
  g.save();
  g.rotate(sway);
  g.fillStyle = '#8a5a34';
  g.beginPath();
  g.moveTo(-1.7, 4.2);
  g.quadraticCurveTo(-1.3, -0.8, 2.4, -5.6);
  g.lineTo(4.3, -4.6);
  g.quadraticCurveTo(1.6, -0.5, 2.1, 4.2);
  g.closePath();
  g.fill();
  g.strokeStyle = '#8a5a34';
  g.lineWidth = 2.1;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(1.4, -3.6);
  g.lineTo(-3.8, -8.8);
  g.stroke();
  g.beginPath();
  g.moveTo(2.2, -4);
  g.lineTo(7.4, -9.4);
  g.stroke();
  g.beginPath();
  g.moveTo(1.9, -4.6);
  g.lineTo(1.2, -11);
  g.stroke();
  g.fillStyle = '#2f7d4f';
  g.beginPath();
  g.arc(-4.8, -10.2, 3.6, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(1.3, -12.6, 4.4, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(7.6, -10.8, 3.2, 0, TAU);
  g.fill();
  g.fillStyle = '#3f9d63';
  g.beginPath();
  g.arc(-0.2, -11.2, 3, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(5.2, -12, 2.4, 0, TAU);
  g.fill();
  /* таблички ✓/✗ на ветках */
  const sw = Math.sin(t * 2.4) * 0.5;
  g.save();
  g.translate(-4.8, -7.4);
  g.rotate(sw * 0.5);
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 1.3);
  g.stroke();
  g.fillStyle = '#2f7d4f';
  g.beginPath();
  rr(g, -2.2, 1.3, 4.4, 3.2, 0.9);
  g.fill();
  g.strokeStyle = '#eafff2';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-1.2, 2.9);
  g.lineTo(-0.4, 3.8);
  g.lineTo(1.2, 1.9);
  g.stroke();
  g.restore();
  g.save();
  g.translate(7.4, -7.8);
  g.rotate(-sw * 0.5);
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 1.3);
  g.stroke();
  g.fillStyle = '#8b3a3a';
  g.beginPath();
  rr(g, -2.2, 1.3, 4.4, 3.2, 0.9);
  g.fill();
  g.strokeStyle = '#ffe9e9';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-1.2, 1.9);
  g.lineTo(1.2, 3.9);
  g.moveTo(1.2, 1.9);
  g.lineTo(-1.2, 3.9);
  g.stroke();
  g.restore();
  g.restore();
  /* лицо на стволе */
  eyePair(g, -0.1, 2.5, 0.7, ay, t, '#bff7d2', '#123c26');
  g.strokeStyle = '#123c26';
  g.lineWidth = 0.9;
  g.beginPath();
  g.arc(1.2, 2.9, 1.3, Math.PI * 0.1, Math.PI * 0.9);
  g.stroke();
}
/* --- ДЖС 1995: парящее окно браузера, скроллбар-хвост, warning-уведомление --- */
function winArt(g, wp, mv, t, ay) {
  g.save();
  g.rotate(mv ? Math.sin(wp) * 0.05 : Math.sin(t * 1.9) * 0.03);
  /* хвост-скроллбар */
  g.fillStyle = '#8a7500';
  g.beginPath();
  rr(g, 8.2, -8, 2.4, 17, 1);
  g.fill();
  const th = mv ? Math.sin(wp * 0.9) * 5 : Math.sin(t * 1.3) * 4;
  g.fillStyle = '#f5d90a';
  g.fillRect(8.7, -6.5 + th, 1.4, 5);
  /* окно */
  g.fillStyle = '#a08b06';
  g.beginPath();
  rr(g, -8.6, -12, 17.4, 16.6, 1.8);
  g.fill();
  g.fillStyle = '#f5d90a';
  g.beginPath();
  rr(g, -7.6, -11, 15.4, 14.6, 1.2);
  g.fill();
  g.fillStyle = '#d4b606';
  g.fillRect(-7.6, -11, 15.4, 3.6);
  g.fillStyle = '#fff7bf';
  g.beginPath();
  g.arc(-6.2, -9.2, 0.72, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(-4.2, -9.2, 0.72, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(-2.2, -9.2, 0.72, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.fillRect(-7.6, -7.9, 15.4, 0.6);
  /* тулбар-кнопки */
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.fillRect(-6.6, -6.4, 2.6, 1.8);
  g.fillRect(-3.2, -6.4, 2.6, 1.8);
  g.fillStyle = '#fff7bf';
  g.fillRect(0.2, -6.4, 2.6, 1.8);
  /* трещина стекла */
  g.strokeStyle = 'rgba(0,0,0,.3)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(6.4, -4.4);
  g.lineTo(4.8, -3);
  g.lineTo(5.6, -1.2);
  g.moveTo(4.8, -3);
  g.lineTo(3.4, -3.6);
  g.stroke();
  /* паническое лицо */
  const dy = Math.max(-1.3, Math.min(1.3, ay)) * 0.6;
  eyePair(g, -3, 2.6, -2.6 + dy * 0.3, ay, t, '#fff7bf', '#3a3000');
  g.strokeStyle = '#3a3000';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-2.6, 1.6 + Math.sin(t * 4) * 0.3);
  g.quadraticCurveTo(-0.6, 0.7, 1.4, 1.6 + Math.cos(t * 3.4) * 0.3);
  g.stroke();
  g.restore();
  /* warning-уведомление */
  const bx = 11,
    by = -13.8 + Math.sin(t * 2.6) * 0.8;
  g.fillStyle = '#1d231c';
  g.beginPath();
  g.moveTo(bx - 3, by + 2.6);
  g.lineTo(bx, by - 2.6);
  g.lineTo(bx + 3, by + 2.6);
  g.closePath();
  g.fill();
  g.fillStyle = '#f5d90a';
  g.beginPath();
  g.moveTo(bx - 2.3, by + 2);
  g.lineTo(bx, by - 1.7);
  g.lineTo(bx + 2.3, by + 2);
  g.closePath();
  g.fill();
  g.fillStyle = '#1d231c';
  g.fillRect(bx - 0.25, by - 0.7, 0.5, 1.3);
  g.fillRect(bx - 0.25, by + 0.9, 0.5, 0.6);
}
/* --- СВМ 1995: два клина вдоль пунктирной гиперплоскости, опорные векторы --- */
function svmArt(g, wp, mv, t, _ay) {
  const col = CHARCOL.svm;
  const gap = 1.5 + Math.sin(mv ? wp * 1.3 : t * 2) * 0.35;
  /* верхний клин */
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(-7.4, -8.8);
  g.lineTo(7.4, -8.8);
  g.lineTo(4.1, -1.7 - gap);
  g.lineTo(-4.1, -1.7 - gap);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.16)';
  g.fillRect(-6, -7.8, 12, 2);
  /* нижний клин */
  g.fillStyle = shade(col, -0.27);
  g.beginPath();
  g.moveTo(-4.1, 1.7 + gap);
  g.lineTo(4.1, 1.7 + gap);
  g.lineTo(7.4, 8.8);
  g.lineTo(-7.4, 8.8);
  g.closePath();
  g.fill();
  /* гиперплоскость */
  g.strokeStyle = 'rgba(255,255,255,.85)';
  g.lineWidth = 1;
  g.setLineDash([2.4, 1.8]);
  g.beginPath();
  g.moveTo(-9.6, 0);
  g.lineTo(9.6, 0);
  g.stroke();
  g.setLineDash([]);
  /* опорные векторы */
  g.strokeStyle = '#dfe9ee';
  g.lineWidth = 1.1;
  for (const p of [
    [-8.8, -4.4],
    [8.9, -2.8],
    [-8.4, 4.6],
    [8.5, 5.6],
  ]) {
    g.beginPath();
    g.moveTo(p[0] * 0.7, p[1] * 0.7);
    g.lineTo(p[0], p[1]);
    g.stroke();
    g.fillStyle = p[1] < 0 ? '#e2f4ff' : '#9fc4d8';
    g.beginPath();
    g.arc(p[0], p[1], 1.15, 0, TAU);
    g.fill();
  }
  /* визор-глаз на верхнем клине */
  g.fillStyle = '#0f2733';
  g.beginPath();
  rr(g, -4, -5.8, 8.8, 2.7, 1.2);
  g.fill();
  const dx = Math.max(-1.2, Math.min(1.2, Math.sin(wp * 0.7)));
  g.fillStyle = '#e2f4ff';
  g.fillRect(-1.3 + dx, -5.4, 2.6, 1.9);
  /* рот-линейка */
  g.fillStyle = '#0f2733';
  g.fillRect(-3.2, 4.6, 6.4, 0.9);
  /* штатив */
  g.strokeStyle = '#5b7482';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-4, 8.4);
  g.lineTo(-6.2, 11.6);
  g.stroke();
  g.beginPath();
  g.moveTo(0, 8.4);
  g.lineTo(0, 11.8);
  g.stroke();
  g.beginPath();
  g.moveTo(4, 8.4);
  g.lineTo(6.2, 11.6);
  g.stroke();
}
/* --- ЭХО 1997: кассета с катушками-глазами и лентой-хвостом --- */
function cassetteArt(g, wp, mv, t, ay) {
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
/* --- ГИТ 2005: созвездие коммитов, лицо на HEAD, тег на шнурке --- */
function gitArt(g, wp, mv, t, ay) {
  const b1 = Math.sin(t * 2.1) * 0.8,
    b2 = Math.sin(t * 2.1 + 1) * 0.9,
    b3 = Math.sin(t * 2.1 + 2) * 0.7;
  /* связи */
  g.strokeStyle = '#8a5a56';
  g.lineWidth = 1.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, -8.6 + b1);
  g.quadraticCurveTo(-1, -2.2 + b2, -2.6, 1.6 + b2);
  g.stroke();
  g.beginPath();
  g.moveTo(-2.6, 1.6 + b2);
  g.quadraticCurveTo(-3.8, 5.2, -2.2, 8.2 + b3);
  g.stroke();
  g.beginPath();
  g.moveTo(0, -8.6 + b1);
  g.quadraticCurveTo(5.6, -4.6 + b2, 5.8, 0.6 + b3);
  g.stroke();
  /* узлы */
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(-2.6, 1.6 + b2, 3.3, 0, TAU);
  g.fill();
  g.fillStyle = '#f87171';
  g.beginPath();
  g.arc(-2.2, 8.2 + b3, 2.6, 0, TAU);
  g.fill();
  g.fillStyle = '#7eea9d';
  g.beginPath();
  g.arc(5.8, 0.6 + b3, 2.5, 0, TAU);
  g.fill();
  g.fillStyle = '#4ade80';
  g.beginPath();
  g.arc(0, -8.6 + b1, 4.3, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(0, -8.6 + b1, 4.3, 0, TAU);
  g.stroke();
  g.beginPath();
  g.arc(-2.6, 1.6 + b2, 3.3, 0, TAU);
  g.stroke();
  /* лицо на HEAD */
  const dy = Math.max(-1, Math.min(1, ay)) * 0.5;
  const bl = t % 3.7 < 0.13;
  for (const p of [
    [-1.4, -9.1 + b1],
    [1.4, -9.1 + b1],
  ]) {
    g.fillStyle = '#0c110d';
    if (bl) g.fillRect(p[0] - 0.8, p[1] - 0.15, 1.6, 0.35);
    else {
      g.beginPath();
      g.arc(p[0], p[1], 0.85, 0, TAU);
      g.fill();
      g.fillStyle = '#d0ffe0';
      g.beginPath();
      g.arc(p[0] + 0.2, p[1] + dy * 0.4, 0.35, 0, TAU);
      g.fill();
    }
  }
  g.strokeStyle = '#0c110d';
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(0, -7 + b1, 1, Math.PI * 0.12, Math.PI * 0.88);
  g.stroke();
  /* тег на шнурке */
  g.save();
  g.translate(-2.2, 8.2 + b3);
  g.rotate(Math.sin(t * 2.2) * 0.16);
  g.strokeStyle = '#8a5a56';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 2.2);
  g.stroke();
  g.fillStyle = '#e8dcae';
  g.beginPath();
  rr(g, -2.6, 2.2, 5.2, 3.2, 0.8);
  g.fill();
  g.fillStyle = '#8a5a56';
  g.beginPath();
  g.arc(0, 2.9, 0.5, 0, TAU);
  g.fill();
  g.restore();
}
/* --- РЕВАРД 2013: автомат гатяпон — купол с шарами, тумба-лицо, рычаг --- */
function gachaArt(g, wp, mv, t, ay) {
  const stp = mv ? Math.sin(wp) * 1.8 : 0;
  /* колёсики-касторы */
  g.fillStyle = '#2c3520';
  g.beginPath();
  g.arc(-4.8 + stp * 0.6, 10.2, 1.7, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(4.8 - stp * 0.6, 10.2, 1.7, 0, TAU);
  g.fill();
  g.fillStyle = '#a3e635';
  g.beginPath();
  g.arc(-4.8 + stp * 0.6, 10.2, 0.55, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(4.8 - stp * 0.6, 10.2, 0.55, 0, TAU);
  g.fill();
  /* тумба */
  g.fillStyle = '#3a4526';
  g.beginPath();
  rr(g, -6.8, 1.6, 13.6, 7.8, 1.6);
  g.fill();
  g.fillStyle = '#242d20';
  g.fillRect(-6.8, 3.4, 13.6, 1);
  /* экран-лицо */
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, -4.8, 4.4, 9.6, 3.6, 0.9);
  g.fill();
  const dy = Math.max(-1, Math.min(1, ay)) * 0.45;
  eyePair(g, -2, 2, 6.2 + dy * 0.2, ay, t, '#d9ffa8', '#2c4a12');
  /* щель выдачи */
  g.fillStyle = '#0c110d';
  g.fillRect(-1.8, 8.4, 3.6, 0.9);
  /* шары в куполе */
  const jig = mv ? Math.sin(wp * 2) * 0.7 : 0;
  g.fillStyle = 'rgba(224,255,190,.13)';
  g.beginPath();
  g.arc(0, -3, 8.6, Math.PI, 0);
  g.closePath();
  g.fill();
  for (const b of [
    [-3.4, -4.9, '#f87171'],
    [0.7, -6.5, '#38bdf8'],
    [3.9, -4.7, '#ffe066'],
  ]) {
    g.fillStyle = b[2];
    g.beginPath();
    g.arc(b[0], b[1] + jig, 2.3, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.beginPath();
    g.arc(b[0] - 0.7, b[1] + jig - 0.7, 0.7, 0, TAU);
    g.fill();
  }
  /* обруч купола + блик */
  g.fillStyle = '#3a4526';
  g.fillRect(-8.6, -3.6, 17.2, 1.4);
  g.strokeStyle = 'rgba(224,255,190,.45)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(0, -3, 8.2, Math.PI * 1.08, Math.PI * 1.6);
  g.stroke();
  /* рычаг-джойстик */
  const jx = Math.sin(mv ? wp : t * 2.2) * 0.5;
  g.strokeStyle = '#57654a';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(8.6, 2.4);
  g.lineTo(10.2 + jx * 2.6, -1.4);
  g.stroke();
  g.fillStyle = '#a3e635';
  g.beginPath();
  g.arc(10.2 + jx * 2.6, -1.8, 1.4, 0, TAU);
  g.fill();
}
/* --- ГАН 2014: сиамские близнецы — шумовая и чистая половины со швом --- */
function ganArt(g, wp, mv, t, ay) {
  const stp = mv ? Math.sin(wp) * 2.4 : 0;
  /* ноги: своя у каждой половины */
  g.fillStyle = '#4a3f63';
  g.beginPath();
  rr(g, -5.6 + stp, 5.8, 3.7, 6.4, 1.6);
  g.fill();
  g.fillStyle = '#3c4f42';
  g.beginPath();
  rr(g, 1.9 - stp, 5.8, 3.7, 6.4, 1.6);
  g.fill();
  /* тело: две половины */
  g.fillStyle = '#4a3f63';
  g.beginPath();
  rr(g, -7.4, -4.4, 7.4, 10.6, 2);
  g.fill();
  g.fillStyle = '#3c4f42';
  g.beginPath();
  rr(g, 0, -4.4, 7.4, 10.6, 2);
  g.fill();
  /* шум на левой половине */
  let sd = Math.floor(t * 10) + 3;
  g.fillStyle = 'rgba(211,134,232,.45)';
  for (let i = 0; i < 6; i++) {
    sd = (sd * 16807 + 7) % 2147483647;
    g.fillRect(-6.6 + ((sd >> 2) % 6), -3.6 + ((sd >> 5) % 9), 1.1, 1.1);
  }
  /* шов-стежок */
  g.strokeStyle = '#ffd9f5';
  g.lineWidth = 0.9;
  g.beginPath();
  for (let y = -4.2; y < 6; y += 1.6) {
    g.moveTo(0, y);
    g.lineTo(0, y + 0.8);
  }
  g.stroke();
  /* индикатор правой половины */
  g.fillStyle = '#b8f5c8';
  g.fillRect(3.2, 0.6, 2.6, 1);
  /* руки: левая дёргается */
  const jit = Math.sin(t * 13) * 0.9;
  g.strokeStyle = 'rgba(0,0,0,.32)';
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-5.8, 0);
  g.lineTo(-9.6 + jit, 2.9);
  g.stroke();
  g.beginPath();
  g.moveTo(5.8, 0);
  g.lineTo(9.6, 3.2);
  g.stroke();
  /* головы */
  g.fillStyle = '#4a3f63';
  g.beginPath();
  rr(g, -10.6, -15.4, 10, 9.2, 2.4);
  g.fill();
  g.fillStyle = '#3c4f42';
  g.beginPath();
  rr(g, 0.6, -15.4, 10, 9.2, 2.4);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, -9.4, -14.4, 7.6, 7.2, 1.8);
  g.fill();
  g.beginPath();
  rr(g, 1.8, -14.4, 7.6, 7.2, 1.8);
  g.fill();
  /* лицо генератора: шум */
  sd = Math.floor(t * 11) + 1;
  g.fillStyle = 'rgba(211,134,232,.5)';
  for (let i = 0; i < 5; i++) {
    sd = (sd * 16807 + 7) % 2147483647;
    g.fillRect(-8.8 + ((sd >> 2) % 6), -13.6 + ((sd >> 5) % 5), 1, 1);
  }
  g.fillStyle = '#ffd9f5';
  g.beginPath();
  g.arc(-7.3, -10.9, 0.8, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(-4.9, -10.9, 0.8, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,217,245,.7)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-6.7, -8.8);
  g.lineTo(-5.5, -8.8);
  g.stroke();
  /* лицо дискриминатора: строгое, с бровью */
  const dy = Math.max(-1, Math.min(1, ay)) * 0.5;
  g.fillStyle = '#3c4f42';
  g.fillRect(3.1, -12.6, 4.2, 0.7);
  g.fillRect(6.6, -12.2, 1.6, 0.6);
  g.fillStyle = '#b8f5c8';
  g.beginPath();
  g.arc(3.6, -10.9 + dy * 0.3, 0.8, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(6.2, -10.9 + dy * 0.3, 0.8, 0, TAU);
  g.fill();
  g.fillStyle = '#0c110d';
  g.fillRect(3.35, -11.05 + dy * 0.3, 0.5, 0.45);
  g.fillRect(5.95, -11.05 + dy * 0.3, 0.5, 0.45);
  g.strokeStyle = '#b8f5c8';
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(4.9, -9.1, 1.2, Math.PI * 0.12, Math.PI * 0.88);
  g.stroke();
  /* антенны: у генератора вихляет */
  const swx = Math.sin(t * 3) * 1.2;
  g.strokeStyle = '#2a332b';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-7.6, -15.4);
  g.quadraticCurveTo(-8.4 + swx, -17.6, -7.4 + swx, -19.2);
  g.stroke();
  g.beginPath();
  g.moveTo(7.4, -15.4);
  g.lineTo(7.4, -19.2);
  g.stroke();
  g.fillStyle = '#d386e8';
  g.beginPath();
  g.arc(-7.4 + swx, -19.6, 1, 0, TAU);
  g.fill();
  g.fillStyle = '#b8f5c8';
  g.beginPath();
  g.arc(7.4, -19.6, 1, 0, TAU);
  g.fill();
}
/* --- АТТЕНШН 2017: ядро с главным глазом, орбитальные глаза на лучах внимания --- */
function attnArt(g, wp, mv, t, ay) {
  /* орбитальные глаза */
  const eyes = [];
  for (let i = 0; i < 4; i++) {
    const a = t * 0.8 + (i * Math.PI) / 2;
    eyes.push([Math.cos(a) * 10.6, Math.sin(a) * 6.2 - 1.2, 1.4 + (i % 2) * 0.35]);
  }
  /* лучи внимания */
  g.strokeStyle = 'rgba(192,132,252,.5)';
  g.lineWidth = 0.8;
  g.setLineDash([2.6, 2]);
  for (let i = 0; i < 4; i++) {
    const w = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7));
    g.globalAlpha = w;
    g.beginPath();
    g.moveTo(0, -1);
    g.lineTo(eyes[i][0], eyes[i][1]);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.setLineDash([]);
  for (const e of eyes) {
    g.fillStyle = '#f3d9ff';
    g.beginPath();
    g.arc(e[0], e[1], e[2], 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(e[0] + 0.2, e[1], e[2] * 0.42, 0, TAU);
    g.fill();
  }
  /* ядро */
  g.fillStyle = 'rgba(192,132,252,.2)';
  g.beginPath();
  g.arc(0, -1, 7.6, 0, TAU);
  g.fill();
  g.fillStyle = '#5a4a72';
  g.beginPath();
  rr(g, -4.6, -6.6, 9.2, 11, 3);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, -3.4, -5.4, 6.8, 8.6, 2.2);
  g.fill();
  /* главный глаз */
  const dy = Math.max(-1.6, Math.min(1.6, ay));
  if (t % 3.7 < 0.13) {
    g.fillStyle = '#f3d9ff';
    g.fillRect(-2.2, -1.35, 4.4, 0.7);
  } else {
    g.fillStyle = '#f3d9ff';
    g.beginPath();
    g.arc(0, -1, 2.3, 0, TAU);
    g.fill();
    g.fillStyle = '#c084fc';
    g.beginPath();
    g.arc(0.2, -1 + dy * 0.5, 1.2, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(0.2, -1 + dy * 0.7, 0.6, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath();
    g.arc(-0.7, -1.9 + dy * 0.4, 0.4, 0, TAU);
    g.fill();
  }
  /* нимб малых глаз */
  for (let i = 0; i < 3; i++) {
    const ax = -3.2 + i * 3.2,
      hy = -9.8 - (i === 1 ? 2.2 : 0) + Math.sin(t * 2 + i) * 0.4;
    g.strokeStyle = '#5a4a72';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(ax, hy + 1.8);
    g.lineTo(ax, hy + 0.9);
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(ax, hy, 1.15, 0, TAU);
    g.fill();
    g.fillStyle = '#c084fc';
    g.beginPath();
    g.arc(ax, hy, 0.55, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(ax, hy + 0.08, 0.26, 0, TAU);
    g.fill();
  }
}
/* --- ДИФФУЗИЯ 2020: рой частиц вокруг размытого лица, растягивается при беге --- */
function diffArt(g, wp, mv, t, ay) {
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
const AGENT_ART = {
  punch: cardArt,
  lamp: tubeArt,
  asm: pcbArt,
  lisp: parenArt,
  clang: kernArt,
  decide: treeArt,
  js: winArt,
  svm: svmArt,
  echo: cassetteArt,
  git: gitArt,
  rl: gachaArt,
  gan: ganArt,
  attn: attnArt,
  diff: diffArt,
};

function snakeArt(g, wp, mv, t, ay) {
  // ПИТОН: робо-змей из сегментов
  const col = CHARCOL.py,
    lt = shade(col, 0.35),
    dk2 = shade(col, -0.3);
  const sl = i => Math.sin(t * 4 + i * 1.1) * (mv ? 2.1 : 1.1);
  for (let i = 4; i >= 1; i--) {
    const sx = 3 - i * 4,
      sy = 1.4 + sl(i),
      r = 4.4 - i * 0.55;
    g.fillStyle = dk2;
    g.beginPath();
    g.arc(sx, sy, r, 0, TAU);
    g.fill();
    g.fillStyle = i % 2 ? col : lt;
    g.beginPath();
    g.arc(sx, sy, r * 0.72, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)';
    g.beginPath();
    g.arc(sx - r * 0.25, sy - r * 0.3, r * 0.3, 0, TAU);
    g.fill();
  }
  const tx = 3 - 5 * 4,
    ty = 1.4 + sl(5);
  g.fillStyle = '#ffd257';
  dia(g, tx, ty, 1.7);
  g.fillStyle = '#e8b13f';
  dia(g, tx - 2.2, ty + 0.4, 1.2);
  const hx = 4.6,
    hy = -0.6 + sl(0) * 0.6;
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(hx, hy, 6, 4.6, 0, 0, TAU);
  g.fill();
  g.fillStyle = lt;
  g.beginPath();
  g.ellipse(hx + 1.6, hy + 1.4, 3.4, 2.2, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#0c110d';
  g.beginPath();
  rr(g, hx - 0.6, hy - 3.4, 5.2, 4.4, 1.8);
  g.fill();
  const dy = Math.max(-1.2, Math.min(1.2, ay));
  const blink = t % 3.7 < 0.13;
  g.fillStyle = '#bff7e8';
  if (blink) {
    g.fillRect(hx + 0.6, hy - 1.4 + dy * 0.5, 1.6, 0.4);
    g.fillRect(hx + 3, hy - 1.4 + dy * 0.5, 1.4, 0.4);
  } else {
    g.beginPath();
    g.arc(hx + 1.4, hy - 1.2 + dy * 0.5, 0.95, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(hx + 3.6, hy - 1.2 + dy * 0.5, 0.8, 0, TAU);
    g.fill();
    g.fillStyle = '#0c110d';
    g.beginPath();
    g.arc(hx + 1.7, hy - 1.2 + dy * 0.5, 0.42, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(hx + 3.8, hy - 1.2 + dy * 0.5, 0.36, 0, TAU);
    g.fill();
  }
  g.strokeStyle = '#ff7d9d';
  g.lineWidth = 0.9;
  const tl = Math.sin(t * 6) * 1.2;
  g.beginPath();
  g.moveTo(hx + 5.4, hy + 1);
  g.lineTo(hx + 7.6 + tl, hy + 1.3);
  g.stroke();
  g.beginPath();
  g.moveTo(hx + 7.6 + tl, hy + 1.3);
  g.lineTo(hx + 8.8 + tl, hy + 0.7);
  g.moveTo(hx + 7.6 + tl, hy + 1.3);
  g.lineTo(hx + 8.6 + tl, hy + 2.1);
  g.stroke();
  g.fillStyle = '#4ade80';
  g.beginPath();
  rr(g, hx - 3.4, hy - 6.6, 3.4, 1.8, 0.5);
  g.fill();
  g.fillStyle = '#0c110d';
  g.fillRect(hx - 0.4, hy - 6.2, 0.8, 1);
}
function orbArt(g, wp, mv, t, ay) {
  // АГИ: парящее око с орбитами
  const gr = g.createRadialGradient(0, -1, 2, 0, -1, 17);
  gr.addColorStop(0, 'rgba(255,230,102,.5)');
  gr.addColorStop(0.6, 'rgba(255,230,102,.14)');
  gr.addColorStop(1, 'rgba(255,230,102,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, -1, 17, 0, TAU);
  g.fill();
  g.save();
  g.rotate(Math.sin(t * 0.9) * 0.22);
  g.strokeStyle = 'rgba(255,230,102,.65)';
  g.lineWidth = 1.1;
  g.beginPath();
  g.ellipse(0, -1, 13.5, 4.6, 0, 0, TAU);
  g.stroke();
  const a1 = t * 1.6;
  g.fillStyle = '#fff6cf';
  g.beginPath();
  g.arc(Math.cos(a1) * 13.5, Math.sin(a1) * 4.6 - 1, 1.3, 0, TAU);
  g.fill();
  g.restore();
  g.save();
  g.rotate(-0.5 + Math.cos(t * 0.7) * 0.2);
  g.strokeStyle = 'rgba(255,230,102,.4)';
  g.lineWidth = 0.9;
  g.beginPath();
  g.ellipse(0, -1, 10.5, 3.4, 0, 0, TAU);
  g.stroke();
  const a2 = -t * 1.2 + 2;
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(Math.cos(a2) * 10.5, Math.sin(a2) * 3.4 - 1, 1, 0, TAU);
  g.fill();
  g.restore();
  g.fillStyle = '#fff8dd';
  g.beginPath();
  g.arc(0, -1, 6.2, 0, TAU);
  g.fill();
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(0, -1, 4.9, 0, TAU);
  g.fill();
  const dy = Math.max(-1.3, Math.min(1.3, ay));
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(0, -1 + dy * 0.5, 3.1, 0, TAU);
  g.fill();
  g.fillStyle = '#8a6d1a';
  g.beginPath();
  g.arc(0.2, -1 + dy, 1.7, 0, TAU);
  g.fill();
  g.fillStyle = '#2b230a';
  g.beginPath();
  g.arc(0.2, -1 + dy, 0.85, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath();
  g.arc(-0.7, -2 + dy, 0.55, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,248,221,.85)';
  dia(g, 9, -8 + Math.sin(t * 2.2) * 1.2, 1);
  dia(g, -10, 5 + Math.cos(t * 1.9) * 1.1, 0.8);
  dia(g, 7.5, 6.5 + Math.sin(t * 2.6 + 2) * 1, 0.6);
}

function dinoArt(g, wp, mv, t) {
  // ЛЕГАСИ: динозавр (вид сбоку)
  const stp = mv ? Math.sin(wp) * 2.8 : 0;
  const sw = Math.sin(t * 2.6) * 2;
  const leg = (x, y, fc) => {
    g.fillStyle = fc;
    g.beginPath();
    rr(g, x - 1.7, y, 3.4, 5.6, 1.5);
    g.fill();
    g.beginPath();
    g.ellipse(x + 0.5, y + 5.2, 2.1, 1.1, 0, 0, TAU);
    g.fill();
  };
  leg(-3 - stp, 4.4, '#b85c2e');
  leg(5.6 + stp, 4.4, '#b85c2e'); // дальние лапы
  g.fillStyle = '#e8794a'; // хвост
  g.beginPath();
  g.moveTo(-5, -4.6);
  g.quadraticCurveTo(-12, -4.4 + sw * 0.6, -16.6, -2 + sw);
  g.quadraticCurveTo(-11.6, 1.4 + sw * 0.6, -4.6, 3.9);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffd9b0';
  dia(g, -12.4, -2.8 + sw * 0.8, 1.5);
  dia(g, -15, -1.8 + sw, 1.15); // шипы на хвосте
  g.fillStyle = '#e8794a'; // тело
  g.beginPath();
  g.ellipse(-0.4, 0, 9.9, 7.3, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#f2b98a'; // брюхо
  g.beginPath();
  g.ellipse(0.8, 2.4, 6.6, 3.7, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#ffd9b0'; // шипы на спине
  dia(g, -6.4, -5.7, 1.7);
  dia(g, -2.7, -6.8, 1.9);
  dia(g, 1.2, -6.5, 1.8);
  dia(g, 4.2, -5.1, 1.5);
  leg(0.6 + stp, 4.9, '#e8794a');
  leg(8 - stp, 4.9, '#e8794a'); // ближние лапы
  g.fillStyle = '#c96a38';
  g.beginPath();
  g.arc(6, 0.6, 1.7, 0, TAU);
  g.fill(); // ручка
  g.fillStyle = '#e8794a'; // голова
  g.beginPath();
  g.arc(9.4, -3.2, 5, 0, TAU);
  g.fill();
  g.beginPath();
  rr(g, 11.6, -4.6, 6.4, 4.8, 2.1);
  g.fill();
  g.fillStyle = '#f2a97e'; // челюсть
  g.beginPath();
  rr(g, 12.2, -2.4, 5.4, 2.4, 1.1);
  g.fill();
  g.fillStyle = '#8a4526';
  g.beginPath();
  g.arc(16.9, -3.6, 0.6, 0, TAU);
  g.fill(); // ноздря
  g.strokeStyle = '#8a4526';
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(12.6, -0.4);
  g.lineTo(16.9, -1);
  g.stroke(); // рот
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(10, -4.6, 2, 0, TAU);
  g.fill(); // глаз
  g.fillStyle = '#10150f';
  g.beginPath();
  g.arc(10.7, -4.6, 1.05, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.beginPath();
  g.arc(11, -5.1, 0.4, 0, TAU);
  g.fill();
}
