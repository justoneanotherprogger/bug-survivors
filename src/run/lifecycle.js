import { P, run, enemies, bullets, gems, pickups, pools, fx, parts, dmgNums, notes, cam, S } from '../core/state.js';
import { save } from '../core/save.js';
import { CHARS } from '../data/chars.js';
import { STAGES } from '../data/stages.js';
import { recompute, xpNeed } from './stats.js';

/* ================= RUN LIFECYCLE ================= */
export function resetRun(charId, stageId, endless) {
  const ch = CHARS.find(c => c.id === charId);
  const st = STAGES.find(s => s.id === stageId);
  enemies.length = 0;
  bullets.length = 0;
  gems.length = 0;
  pickups.length = 0;
  pools.length = 0;
  fx.length = 0;
  parts.length = 0;
  dmgNums.length = 0;
  notes.length = 0;
  Object.assign(P, {
    x: 0,
    y: 0,
    r: 13,
    hp: 50,
    maxhp: 50,
    spd: 170,
    weapons: [],
    passives: [],
    absorbed: {},
    usedW: {},
    xp: 0,
    need: xpNeed(1),
    lvl: 1,
    pendLv: 0,
    iv: 0,
    aim: { x: 1, y: 0 },
    dmgMul: 1,
    cdMul: 1,
    areaMul: 1,
    projMul: 1,
    durMul: 1,
    armor: 0,
    regen: 0,
    amount: 0,
    luck: 1,
    growthMul: 1,
    magnetR: 55,
    revive: 0,
    wCap: 6,
    pCap: 6,
  });
  Object.assign(run, {
    charId,
    stageId,
    endless: !!endless,
    stage: st,
    t: 0,
    kills: 0,
    coins: 0,
    xpTotal: 0,
    spawnT: 0.5,
    waveIdx: 0,
    nextElite: 35,
    eliteNext: false,
    nextRing: 150,
    nextEndBoss: 1740,
    bossPlan: [300, 600, 900, 1200, 1500, 1740].map((t, i) => ({ t, tier: i + 1 })),
    boss: null,
    waves: makeWaves(st),
  });
  recompute();
  P.hp = P.maxhp;
  if (ch.weapon) P.weapons.push({ id: ch.weapon, lvl: 1, timer: 0.3, active: false, pend: null });
  cam.x = 0;
  cam.y = 0;
  S.shake = 0;
  S.hasRun = true;
}
function makeWaves(st) {
  const wv = [];
  for (let m = 0; m < 30; m++) {
    const ph = Math.min(st.pool.length - 1, Math.floor(m / 5));
    wv.push({
      t: m * 60,
      types: st.pool[ph],
      itv: Math.max(0.22, 1.05 - m * 0.028),
      batch: Math.min(10, 3 + Math.floor(m * 0.26)),
    });
  }
  return wv;
}
export function finishRun(win, quit) {
  const greed = 1 + 0.1 * save.meta.greed + 0.01 * save.meta.cinf;
  const earned = run.coins + (win ? 400 : 0);
  const got = Math.round(earned * greed);
  save.coins += got;
  save.stats.coins += got;
  if (win) {
    save.stats.wins++;
    save.stats.winsBy[run.stageId] = (save.stats.winsBy[run.stageId] || 0) + 1;
  } else if (!quit) save.stats.deaths++;
  const best = Math.floor(run.t);
  if (best > save.stats.best[run.stageId]) save.stats.best[run.stageId] = best;
  if (best > save.stats.bestAny) save.stats.bestAny = best;
  save.stats.bestBy = save.stats.bestBy || {};
  if (best > (save.stats.bestBy[run.charId] || 0)) save.stats.bestBy[run.charId] = best;
  if (run.kills > save.stats.bestKills) save.stats.bestKills = run.kills;
  save.stats.xp += run.xpTotal;
  /* уровни оружия за забег попадают в статы из ЛЮБОГО источника (левелап, сундуки, будущие пути):
     без этого синка ачивки «Прокачать X до ур. 8» зависели от того, чем именно взята последняя ступень */
  save.stats.maxLvlBy = save.stats.maxLvlBy || {};
  for (const w of P.weapons) {
    if (w.lvl > save.stats.maxlvl) save.stats.maxlvl = w.lvl;
    if (w.lvl > (save.stats.maxLvlBy[w.id] || 0)) save.stats.maxLvlBy[w.id] = w.lvl;
  }
  return { got, greed };
}
