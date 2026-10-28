import { cardArt } from './agents/punch.js';
import { tubeArt } from './agents/lamp.js';
import { pcbArt } from './agents/asm.js';
import { parenArt } from './agents/lisp.js';
import { kernArt } from './agents/clang.js';
import { treeArt } from './agents/decide.js';
import { winArt } from './agents/js.js';
import { svmArt } from './agents/svm.js';
import { cassetteArt } from './agents/echo.js';
import { gitArt } from './agents/git.js';
import { gachaArt } from './agents/rl.js';
import { ganArt } from './agents/gan.js';
import { attnArt } from './agents/attn.js';
import { diffArt } from './agents/diff.js';
import { dinoArt } from './agents/legacy.js';
import { snakeArt } from './agents/py.js';
import { orbArt } from './agents/agi.js';
export { stageArtURL } from './stage-preview.js';

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
