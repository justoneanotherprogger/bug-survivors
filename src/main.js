'use strict';

import { $, TAU, clamp, lerp, rnd, fmt, fmtT } from './core/utils.js';
import { SAVE_KEY, save, saveGame, reloadSave } from './core/save.js';
import { S, P, run, enemies, bullets, gems, pickups, pools, fx, parts, dmgNums, notes, cam } from './core/state.js';
import { sfx } from './core/audio.js';
import { keys, joy, inputDir } from './core/input.js';
import { CHARS } from './data/chars.js';
import { WEAPONS } from './data/weapons.js';
import { PASSIVES, KEYSTATS, MODTXT } from './data/upgrades.js';
import { HYPERS } from './data/hypers.js';
import { STAGES } from './data/stages.js';
import { META, META_ACH, META_ACH_NAME } from './data/meta.js';
import { ACH } from './data/achievements.js';
import { wUnlocked, pUnlocked, recompute, threat, rew } from './run/stats.js';
import { resetRun, finishRun } from './run/lifecycle.js';
import { hooks } from './core/hooks.js';
import { gainXP, rollChoices, findEvo1, findHyper, applyEvo, openChestLogic } from './run/progression.js';
import { spawnBoss, director } from './run/director.js';
import { wstats, lvDesc, updWeapons } from './combat/weapons.js';
import { gridRebuild, updBullets, updateEnemies, updPools, updPickups, updFx } from './combat/world.js';
import { cellH, pRack, pVent, pDesk, pMoon, pTape, pCard, pStars, pScan } from './render/scenes.js';
import { charArtURL, stageArtURL, drawAgentArt } from './render/sprites.js';

/* ================= STATE ================= */

/* ================= TOAST ================= */
function toast(msg, cls = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + cls;
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 450);
  }, 2600);
}

/* ================= INPUT ================= */
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.repeat) return;
  if (S.appState === 'run' && (e.code === 'Escape' || e.code === 'KeyP')) pauseGame();
  else if (S.appState === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) resumeGame();
  else if (S.appState === 'chest' && e.code === 'Space') {
    if (!chestEvo) {
      e.preventDefault();
      $('chestOk').click();
    }
  } else if (S.appState === 'levelup') {
    const m = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
    if (e.code in m) {
      const c = $('lvlCards').children[m[e.code]];
      if (c) c.click();
    }
  }
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
});
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  if (S.appState === 'run') pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.appState === 'run') pauseGame();
});

/* virtual joystick (touch) */
const joyEl = $('joy'),
  joyKnob = $('joyKnob');
window.addEventListener(
  'pointerdown',
  e => {
    if (S.appState !== 'run') return;
    if (e.target.closest('button') || e.target.closest('.modal') || e.target.closest('.screen')) return;
    joy.on = true;
    joy.id = e.pointerId;
    joy.bx = e.clientX;
    joy.by = e.clientY;
    joy.dx = 0;
    joy.dy = 0;
    joyEl.style.left = e.clientX - 55 + 'px';
    joyEl.style.top = e.clientY - 55 + 'px';
    joyEl.classList.remove('hidden');
    joyKnob.style.left = '32px';
    joyKnob.style.top = '32px';
  },
  { passive: true }
);
window.addEventListener(
  'pointermove',
  e => {
    if (!joy.on || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.bx,
      dy = e.clientY - joy.by;
    const d = Math.hypot(dx, dy);
    if (d > 52) {
      dx = (dx / d) * 52;
      dy = (dy / d) * 52;
    }
    joy.dx = dx / 52;
    joy.dy = dy / 52;
    joyKnob.style.left = 32 + dx + 'px';
    joyKnob.style.top = 32 + dy + 'px';
  },
  { passive: true }
);
function joyEnd(e) {
  if (joy.on && e.pointerId === joy.id) {
    joy.on = false;
    joy.dx = 0;
    joy.dy = 0;
    joyEl.classList.add('hidden');
  }
}
window.addEventListener('pointerup', joyEnd, { passive: true });
window.addEventListener('pointercancel', joyEnd, { passive: true });

/* ================= RUN LIFECYCLE ================= */
function startRun(charId, stageId, endless) {
  resetRun(charId, stageId, endless);
  S.appState = 'run';
  hideAllScreens();
  $('hud').classList.remove('hidden');
  buildIcons();
  save.stats.runs++;
  saveGame();
  showHint('ВЫЖИВИ', 3);
}
function showHint(txt, ms) {
  const h = $('hint');
  h.textContent = txt;
  h.classList.remove('on');
  void h.offsetWidth; /* рестарт анимации при повторном показе */
  if (ms) h.style.animationDuration = ms + 's';
  else h.style.animationDuration = '';
  h.classList.add('on');
}
function endRun(win, quit) {
  if (S.appState === 'over') return;
  S.appState = 'over';
  hideTip();
  const { got, greed } = finishRun(win, quit);
  /* ачивки, «дозревшие» за забег, оформляются только здесь: без тостов посреди боя.
     Открытые ими пассивки/агенты/карты доступны со следующего забега */
  const newAch = checkAch(true);
  saveGame();
  $('hud').classList.add('hidden');
  $('bossBarWrap').classList.add('hidden');
  $('levelup').classList.add('hidden');
  $('chestModal').classList.add('hidden');
  $('pauseModal').classList.add('hidden');
  $('goTitle').textContent = win ? 'СБРОС ПРОИЗОШЁЛ!' : 'АГЕНТ ПАЛ';
  $('goTitle').style.color = win ? 'var(--grn)' : 'var(--red)';
  $('goSub').textContent = win ? 'легион багов отступил... пока что' : 'баги празднуют. до следующего деплоя';
  $('goStats').innerHTML =
    goRow('ВРЕМЯ', fmtT(run.t)) +
    goRow('УРОВЕНЬ', P.lvl) +
    goRow('УБИЙСТВ', fmt(run.kills)) +
    goRow('ОПЫТА', fmt(run.xpTotal)) +
    goRow('КАРТА', run.stage.name);
  $('goRewards').textContent =
    '+' +
    fmt(got) +
    ' монет' +
    (greed > 1 ? ' (жадность ×' + greed.toFixed(1) + ')' : ''); /* ◉ рисует .coinsTag::before — вручную не дублируем */
  $('goAch').innerHTML = newAch.length
    ? '<div class="goAchT">ПОЛУЧЕННЫЕ ДОСТИЖЕНИЯ</div>' +
      newAch
        .map(
          x =>
            '<div class="r"><span>🏆 ' +
            x.name +
            (x.extra || '') +
            '<i>' +
            x.d +
            '</i></span><span>◉ +' +
            x.r +
            '</span></div>'
        )
        .join('')
    : '';
  $('goAch').style.display = newAch.length ? '' : 'none';
  $('gameover').classList.remove('hidden');
  sfx(win ? 'chest' : 'boss');
}
function goRow(k, v) {
  return '<div class="r"><span>' + k + '</span><span>' + v + '</span></div>';
}
function pauseGame() {
  if (S.appState !== 'run') return;
  S.appState = 'pause';
  hideTip();
  const pb = $('pauseBuild');
  pb.innerHTML = '';
  const wRow = document.createElement('div');
  wRow.className = 'iconRow';
  for (const w of P.weapons) wRow.appendChild(mkWIcon(w));
  const pRow = document.createElement('div');
  pRow.className = 'iconRow';
  for (const p of P.passives) pRow.appendChild(mkPIcon(p));
  for (const id in P.absorbed) pRow.appendChild(mkAbsIcon(id, 'p'));
  for (const id in P.usedW) pRow.appendChild(mkAbsIcon(id, 'w'));
  if (!P.passives.length && !Object.keys(P.absorbed).length && !Object.keys(P.usedW).length)
    pRow.innerHTML = '<span style="color:var(--mut);font-size:12px">пассивов пока нет</span>';
  pb.appendChild(wRow);
  pb.appendChild(pRow);
  $('pauseModal').classList.remove('hidden');
}
function resumeGame() {
  if (S.appState !== 'pause') return;
  S.appState = 'run';
  $('pauseModal').classList.add('hidden');
  hideTip();
}

/* ================= XP / LEVELUP ================= */
let lvlChoices = [];
function openLevelup() {
  S.appState = 'levelup';
  lvlChoices = rollChoices();
  /* страховка: пул не может быть пуст (моды есть всегда, когда всё выкачано), но пусть игра не зависнет */
  if (!lvlChoices.length) {
    P.pendLv--;
    if (P.pendLv > 0) openLevelup();
    else S.appState = 'run';
    return;
  }
  const hasMods = lvlChoices.some(c => c.type === 'mod');
  $('lvlAutoRow').classList.toggle('hidden', !hasMods);
  $('lvlAutoHint').classList.toggle('hidden', !hasMods);
  $('lvlAutoTgl').classList.toggle('on', !!save.set.automod);
  const box = $('lvlCards');
  box.innerHTML = '';
  lvlChoices.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'lcard';
    let icon, name, tag, desc;
    if (c.type === 'w') {
      const def = WEAPONS[c.id];
      icon = def.icon;
      name = def.name;
      desc = c.to === 1 ? def.d : lvDesc(c.id, c.to);
      tag =
        c.to === 1
          ? '<span class="tNew">НОВОЕ ОРУЖИЕ</span>'
          : '<span class="tUp">УР. ' + (c.to - 1) + ' → ' + c.to + '</span>';
    } else if (c.type === 'p') {
      const def = PASSIVES[c.id];
      icon = def.icon;
      name = def.name;
      desc = def.d;
      tag =
        c.to === 1
          ? '<span class="tNew">НОВЫЙ ПАССИВ</span>'
          : '<span class="tUp">УР. ' + (c.to - 1) + ' → ' + c.to + '</span>';
    } else if (c.type === 'mod') {
      const w = P.weapons.find(x => x.id === c.id),
        def = WEAPONS[c.id];
      const nm = w && w.hyper ? HYPERS[c.id].name : w && w.ev ? def.evo.name : def.name;
      icon = w && w.hyper ? HYPERS[c.id].icon : w && w.ev ? def.evo.icon : def.icon;
      name = 'МОД · ' + nm;
      desc = MODTXT[KEYSTATS[c.id]];
      tag = '<span class="tMod">МОДИФИКАЦИЯ ×' + c.to + '</span>';
    }
    d.innerHTML =
      '<div class="cKey">' +
      (i + 1) +
      '</div><div class="cIcon">' +
      icon +
      '</div><div class="cName">' +
      name +
      '</div><div class="cTag">' +
      tag +
      '</div><div class="cDesc">' +
      desc +
      '</div>';
    d.onclick = () => chooseLevel(i);
    box.appendChild(d);
  });
  /* автовыбор случайного мода, когда на выбор идут ТОЛЬКО моды (галочка ниже включается прямо в окне выбора) */
  if (save.set.automod && lvlChoices.every(c => c.type === 'mod')) {
    chooseLevel(Math.floor(Math.random() * lvlChoices.length));
    return;
  }
  $('levelup').classList.remove('hidden');
}
function chooseLevel(i) {
  if (S.appState !== 'levelup') return;
  const c = lvlChoices[i];
  if (!c) return;
  if (c.type === 'w') {
    const ex = P.weapons.find(w => w.id === c.id);
    if (ex) ex.lvl = c.to;
    else P.weapons.push({ id: c.id, lvl: 1, timer: 0.4, active: false, pend: null });
    if (c.to > save.stats.maxlvl) save.stats.maxlvl = c.to;
    if (c.to > (save.stats.maxLvlBy[c.id] || 0)) save.stats.maxLvlBy[c.id] = c.to;
  } else if (c.type === 'p') {
    const ex = P.passives.find(p => p.id === c.id);
    if (ex) ex.lvl = c.to;
    else P.passives.push({ id: c.id, lvl: 1 });
  } else if (c.type === 'mod') {
    const w = P.weapons.find(w => w.id === c.id);
    if (w) w.mk = (w.mk || 0) + 1;
  }
  recompute();
  buildIcons();
  sfx('pick');
  P.pendLv--;
  $('levelup').classList.add('hidden');
  if (P.pendLv > 0) openLevelup();
  else S.appState = 'run';
}

/* описание того, что даёт уров. TO оружия ID (автодиф уровней) */
/* ================= CHEST ================= */
/* приоритет: эволюция (мерж оружия+пассивки) → гипер (мерж ДВУХ эволюций) → апгрейды (окно) + случайный СПАГЕТТИ-КОД → монеты (тост без паузы).
   СПАГЕТТИ-КОД добывается ТОЛЬКО здесь: шанс растёт с числом убийств (чем больше фармишь — тем выше шанс, что они станут сильнее), слоты пассивок не занимает */
let chestEvo = null;
function openEvoModal(c) {
  S.appState = 'chest';
  chestEvo = c;
  const items = $('chestItems');
  if (c.mode === 'evo') {
    const def = WEAPONS[c.w.id],
      e = def.evo,
      pd = PASSIVES[e.need];
    $('chestTitle').innerHTML = '⚗️ СЛИЯНИЕ!';
    items.innerHTML =
      '<div class="chestItem"><span class="ci">' +
      def.icon +
      '</span><div><div>' +
      def.name +
      ' <span style="color:var(--amb)">УР. МАКС</span> + ' +
      pd.icon +
      ' ' +
      pd.name +
      ' <span style="color:var(--amb)">МАКС</span></div>' +
      '<div class="cd">пассивка поглощается — её эффект останется навсегда, а слот освободится под новую. МОДы оружия сохраняются</div></div></div>' +
      '<div class="chestItem evo"><span class="ci">' +
      e.icon +
      '</span><div><div>ЭВОЛЮЦИЯ: ' +
      e.name +
      '</div><div class="cd">' +
      e.d +
      '</div></div></div>';
  } else {
    const h = HYPERS[c.w.id],
      uw = WEAPONS[c.u.id],
      e = WEAPONS[c.w.id].evo,
      ue = uw.evo;
    $('chestTitle').innerHTML = '⚗️ ГИПЕР-СЛИЯНИЕ!';
    items.innerHTML =
      '<div class="chestItem"><span class="ci">' +
      e.icon +
      '</span><div><div>' +
      e.name +
      ' + ' +
      ue.name +
      '</div>' +
      '<div class="cd">фиксированная пара: обе старые атаки заменяются новой гипер-атакой, слот партнёра освободится, МОДы обеих эволюций перейдут форме</div></div></div>' +
      '<div class="chestItem evo"><span class="ci">' +
      h.icon +
      '</span><div><div>ГИПЕР-ФОРМА: ' +
      h.name +
      '</div><div class="cd">' +
      h.d +
      '</div></div></div>';
  }
  $('chestOk').textContent = 'СЛИТЬ';
  $('chestNo').classList.remove('hidden');
  $('chestHint').classList.add('hidden');
  $('chestModal').classList.remove('hidden');
  sfx('evo');
}
function openChest() {
  const r = openChestLogic();
  if (!r) return;
  if (r.mode === 'evo') {
    openEvoModal(r.c);
    return;
  }
  if (r.mode === 'coins') return;
  chestEvo = null;
  S.appState = 'chest';
  $('chestTitle').innerHTML = '🎁 СУНДУК';
  const items = $('chestItems');
  items.innerHTML = '';
  if (r.spagHit) {
    const sl = P.passives.find(p => p.id === 'spag');
    const d = document.createElement('div');
    d.className = 'chestItem evo';
    d.innerHTML =
      '<span class="ci">🍝</span><div><div>СПАГЕТТИ-КОД → УР. ' +
      sl.lvl +
      ' <span style="color:var(--amb)">(ИЗ СУНДУКА)</span></div><div class="cd">' +
      PASSIVES.spag.d +
      '</div></div>';
    items.appendChild(d);
  }
  for (const rw of r.rewards) {
    const d = document.createElement('div');
    if (rw.w) {
      d.className = 'chestItem';
      d.innerHTML =
        '<span class="ci">' +
        WEAPONS[rw.w.id].icon +
        '</span><div><div>' +
        WEAPONS[rw.w.id].name +
        ' → УР. ' +
        rw.w.lvl +
        '</div><div class="cd">' +
        lvDesc(rw.w.id, rw.w.lvl) +
        '</div></div>';
    } else {
      d.className = 'chestItem';
      d.innerHTML =
        '<span class="ci">' +
        PASSIVES[rw.p.id].icon +
        '</span><div><div>' +
        PASSIVES[rw.p.id].name +
        ' → УР. ' +
        rw.p.lvl +
        '</div><div class="cd">' +
        PASSIVES[rw.p.id].d +
        '</div></div>';
    }
    items.appendChild(d);
  }
  const dc = document.createElement('div');
  dc.className = 'chestItem';
  dc.innerHTML = '<span class="ci">💰</span><div><div>+' + r.coins + ' монет</div></div>';
  items.appendChild(dc);
  $('chestOk').textContent = 'ЗАБРАТЬ';
  $('chestNo').classList.add('hidden');
  $('chestHint').classList.remove('hidden');
  $('chestModal').classList.remove('hidden');
  sfx('chest');
  recompute();
  buildIcons();
}

/* ================= PLAYER UPDATE ================= */
function updatePlayer(dt) {
  const d = inputDir();
  if (d.x || d.y) {
    P.aim.x = d.x;
    P.aim.y = d.y;
    P.x += d.x * P.spd * dt;
    P.y += d.y * P.spd * dt;
  }
  P.iv = Math.max(0, P.iv - dt);
  if (P.regen > 0) P.hp = Math.min(P.maxhp, P.hp + P.regen * dt);
}

/* ================= MAIN UPDATE ================= */
function update(dt) {
  run.t += dt;
  updatePlayer(dt);
  updWeapons(dt);
  gridRebuild();
  updBullets(dt);
  updateEnemies(dt);
  updPools(dt);
  updPickups(dt);
  updFx(dt);
  director(dt);
  cam.x = P.x;
  cam.y = P.y;
  S.shake = Math.max(0, Math.min(S.shake, 16) - 30 * dt); /* кап: тряска не копится бесконечно */
  updateHUD(dt);
}
function updateHUD(dt) {
  $('xpbar').style.width = clamp((P.xp / P.need) * 100, 0, 100) + '%';
  const hpr = clamp(P.hp / P.maxhp, 0, 1);
  const hb = $('hpbar');
  hb.style.width = hpr * 100 + '%';
  hb.classList.toggle('low', hpr < 0.35);
  S.hudTxtT -= dt;
  if (S.hudTxtT <= 0) {
    S.hudTxtT = 0.25;
    $('hudTimer').textContent = fmtT(run.t);
    $('lvlTag').textContent = 'LV ' + P.lvl;
    $('hudKills').textContent = '☠ ' + fmt(run.kills);
    $('hudCoins').textContent = '◉ ' + fmt(run.coins);
    $('hpText2').textContent = Math.max(0, Math.ceil(P.hp)) + '/' + P.maxhp;
  }
  if (run.boss && run.boss.hp > 0)
    $('bossBarFill').style.width = clamp((run.boss.hp / run.boss.maxhp) * 100, 0, 100) + '%';
}

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

function render() {
  ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  const st = run.stage;
  ctx.fillStyle = st.bg;
  ctx.fillRect(0, 0, S.W, S.H);
  const sh = save.set.shake ? S.shake : 0;
  const shx = sh > 0 ? rnd(-sh, sh) : 0,
    shy = sh > 0 ? rnd(-sh, sh) : 0;
  const ox = S.W / 2 - cam.x + shx,
    oy = S.H / 2 - cam.y + shy;
  drawGrid(st, ox, oy);
  drawDecor(st, ox, oy);
  drawPools(ox, oy);
  drawGems(ox, oy);
  drawPickups(ox, oy);
  drawEnemies(ox, oy);
  drawAura(ox, oy);
  drawPlayer(ox, oy);
  drawOrbits(ox, oy);
  drawBullets(ox, oy);
  drawFx(ox, oy);
  drawParts(ox, oy);
  drawDmgNums(ox, oy);
  drawNotes(ox, oy);
  if (save.meta.minimap && run && S.appState !== 'over') drawMinimap();
}
function drawMinimap() {
  const mw = 150,
    mh = 150,
    mx = S.W - mw - 12,
    my = S.H - mh - 12;
  ctx.fillStyle = 'rgba(4,9,6,.82)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#1e4d2f';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 0.5, my + 0.5, mw, mh);
  const R = 850,
    k = (mw / 2 - 4) / R,
    cx = mx + mw / 2,
    cy = my + mh / 2;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - P.x,
      dy = e.y - P.y;
    if (dx < -R || dx > R || dy < -R || dy > R) continue;
    ctx.fillStyle = e.boss ? '#f87171' : e.elite ? '#fbbf24' : e.col;
    const s = e.boss ? 5 : e.elite ? 3.5 : 2;
    ctx.fillRect(cx + dx * k - s / 2, cy + dy * k - s / 2, s, s);
  }
  for (const p of pickups) {
    if (p.type !== 'chest') continue;
    const dx = p.x - P.x,
      dy = p.y - P.y;
    if (dx < -R || dx > R || dy < -R || dy > R) continue;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(cx + dx * k - 2.5, cy + dy * k - 2.5, 5, 5);
  }
  ctx.fillStyle = '#38e07f';
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
}
function drawGrid(st, ox, oy) {
  const sp = 56;
  ctx.strokeStyle = st.grid;
  ctx.lineWidth = 1;
  const x0 = Math.floor((ox * -1) / sp) * sp,
    y0 = Math.floor((oy * -1) / sp) * sp;
  ctx.beginPath();
  for (let x = x0; x < ox * -1 + S.W + sp; x += sp) {
    ctx.moveTo(x + ox, 0);
    ctx.lineTo(x + ox, S.H);
  }
  for (let y = y0; y < oy * -1 + S.H + sp; y += sp) {
    ctx.moveTo(0, y + oy);
    ctx.lineTo(S.W, y + oy);
  }
  ctx.stroke();
  // deterministic props
  const ps = 168;
  const cx0 = Math.floor((cam.x - S.W / 2) / ps),
    cx1 = Math.floor((cam.x + S.W / 2) / ps);
  const cy0 = Math.floor((cam.y - S.H / 2) / ps),
    cy1 = Math.floor((cam.y + S.H / 2) / ps);
  ctx.fillStyle = st.accent;
  for (let ix = cx0; ix <= cx1; ix++)
    for (let iy = cy0; iy <= cy1; iy++) {
      const h = Math.abs(Math.sin(ix * 127.1 + iy * 311.7) * 43758.5) % 1;
      if (h < 0.18) {
        const px = ix * ps + h * ps,
          py = iy * ps + ((h * 7) % 1) * ps;
        ctx.globalAlpha = 0.12;
        if (h < 0.06) ctx.fillRect(px + ox, py + oy, 3, 3);
        else {
          ctx.fillRect(px + ox, py + oy, 6, 1);
          ctx.fillRect(px + ox + 2, py + oy - 2, 1, 6);
        }
        ctx.globalAlpha = 1;
      }
    }
}
/* ===== сцены карт: не безликая сетка, а место из истории программирования =====
   ПРОДАКШЕН — серверный зал дата-центра (стойки с LED, венты фальшпола)
   НОЧНОЙ БИЛД — офис в 03:00 (столы с мониторами, кофе, луна, звёзды)
   ЛЕГАСИ-АД — машинный зал мейнфрейма 1962 (ленточные приводы, перфокарты, сканлайны) */
function drawDecor(st, ox, oy) {
  /* подсветка в цвете карты */
  const g = ctx.createRadialGradient(S.W / 2, S.H / 2, 60, S.W / 2, S.H / 2, Math.max(S.W, S.H) * 0.65);
  g.addColorStop(0, 'rgba(' + (st.glowRGB || '56,224,127') + ',0.06)');
  g.addColorStop(1, 'rgba(' + (st.glowRGB || '56,224,127') + ',0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S.W, S.H);
  const t = run.t;
  /* крупные пропы сцены: детерминированные по мировым ячейкам, не мерцают при движении камеры */
  const ps = st.decor === 'night' ? 300 : 270;
  const cx0 = Math.floor((cam.x - S.W / 2 - 150) / ps),
    cx1 = Math.floor((cam.x + S.W / 2 + 150) / ps);
  const cy0 = Math.floor((cam.y - S.H / 2 - 150) / ps),
    cy1 = Math.floor((cam.y + S.H / 2 + 150) / ps);
  for (let ix = cx0; ix <= cx1; ix++)
    for (let iy = cy0; iy <= cy1; iy++) {
      const h = cellH(ix, iy, 1);
      const px = ix * ps + h * ps * 0.4 + ox,
        py = iy * ps + ((h * 7) % 1) * ps * 0.4 + oy;
      if (px < -150 || px > S.W + 20 || py < -130 || py > S.H + 20) continue;
      if (st.decor === 'server') {
        if (h < 0.24) pRack(ctx, px, py, h, t);
        else if (h < 0.33) pVent(ctx, px, py);
      } else if (st.decor === 'night') {
        if (h < 0.22) pDesk(ctx, px, py, h, t);
      } else if (st.decor === 'mainframe') {
        if (h < 0.22) pTape(ctx, px, py, h, t);
        else if (h < 0.36) pCard(ctx, px, py, h);
      }
    }
  if (st.decor === 'night') {
    pStars(ctx, S.W, S.H, t, ox, oy);
    pMoon(ctx, S.W);
  } else if (st.decor === 'mainframe') {
    pScan(ctx, S.W, S.H, t);
  }
}
function drawPools(ox, oy) {
  for (const p of pools) {
    const a = clamp(p.life / p.T, 0, 1);
    const col = p.col || '#38e07f';
    ctx.globalAlpha = 0.16 * a + 0.06;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p.x + ox, p.y + oy, p.r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.5 * a;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x + ox, p.y + oy, p.r * (0.9 + 0.1 * Math.sin(run.t * 6)), 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function gemCol(v) {
  return v >= 40 ? '#fbbf24' : v >= 15 ? '#a78bfa' : v >= 4 ? '#38bdf8' : '#38e07f';
}
function drawGems(ox, oy) {
  for (const g of gems) {
    const bob = Math.sin(run.t * 4 + g.x * 0.05) * 2;
    ctx.fillStyle = gemCol(g.v);
    ctx.save();
    ctx.translate(g.x + ox, g.y + oy + bob);
    ctx.rotate(0.785);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
}
function drawPickups(ox, oy) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of pickups) {
    const bob = Math.sin(run.t * 5 + p.ph) * 3;
    const x = p.x + ox,
      y = p.y + oy + bob;
    if (p.type === 'coin') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#b47a0e';
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, TAU);
      ctx.fill();
    } else {
      const ic = { heal: '🍗', magnet: '🧲', bomb: '💥', chest: '🎁' }[p.type];
      ctx.font = (p.type === 'chest' ? '24px' : '18px') + ' serif';
      ctx.fillText(ic, x, y);
    }
  }
}
function drawEnemies(ox, oy) {
  const t = run.t;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const x = e.x + ox,
      y = e.y + oy;
    if (x < -70 || x > S.W + 70 || y < -70 || y > S.H + 70) continue;
    const dxp = P.x - e.x,
      dyp = P.y - e.y,
      angP = Math.atan2(dyp, dxp);
    ctx.save();
    ctx.translate(x, y);
    if (e.elite || e.boss) {
      ctx.strokeStyle = e.col;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 5, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.type === 'ghost') ctx.globalAlpha = 0.68;
    // body
    ctx.fillStyle = e.col;
    if (e.type === 'tank') {
      ctx.beginPath();
      const r = e.r;
      ctx.roundRect ? ctx.roundRect(-r, -r * 0.85, r * 2, r * 1.7, 5) : ctx.rect(-r, -r * 0.85, r * 2, r * 1.7);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(-r + 3, -r * 0.85 + 3, r * 2 - 6, 3);
      ctx.fillRect(-r + 3, r * 0.85 - 6, r * 2 - 6, 3);
    } else if (e.type === 'boss') {
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.62, 0, TAU);
      ctx.fill();
      ctx.fillStyle = e.col;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
        ctx.lineTo(Math.cos(a) * e.r * 1.35, Math.sin(a) * e.r * 1.35);
        ctx.lineTo(Math.cos(a + 0.18) * e.r, Math.sin(a + 0.18) * e.r);
        ctx.fill();
      }
    } else if (e.type === 'spawner') {
      const pul = 1 + 0.12 * Math.sin(t * 6 + e.ph);
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.55 * pul, 0, TAU);
      ctx.fill();
      ctx.fillStyle = e.col;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.34 * pul, 0, TAU);
      ctx.fill();
    } else {
      const elong = e.type === 'crawler' ? 1.25 : 1.15;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.r * elong, e.r, angP, 0, TAU);
      ctx.fill();
      if (e.type === 'crawler') {
        ctx.strokeStyle = 'rgba(0,0,0,.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, e.r * elong * 0.6, e.r * 0.6, angP, 0, TAU);
        ctx.stroke();
      }
    }
    // legs for ground types
    if (e.type === 'bug' || e.type === 'mini' || e.type === 'crawler' || e.type === 'tank') {
      ctx.strokeStyle = e.col;
      ctx.lineWidth = 1.5;
      const lw = e.r * 1.5;
      for (let s = -1; s <= 1; s += 2) {
        for (let l = 0; l < 3; l++) {
          const wig = Math.sin(t * 12 + e.ph + l) * 0.3;
          const bx = Math.cos(angP + s * (1.1 + l * 0.4)) * e.r * 0.6;
          const by = Math.sin(angP + s * (1.1 + l * 0.4)) * e.r * 0.6;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(angP + s * 1.5 + wig) * lw * 0.5, by + Math.sin(angP + s * 1.5 + wig) * lw * 0.5);
          ctx.stroke();
        }
      }
    }
    // eyes
    ctx.fillStyle = '#040906';
    const exo = Math.cos(angP) * e.r * 0.35,
      eyo = Math.sin(angP) * e.r * 0.35;
    const ew = Math.max(1.5, e.r * 0.14);
    ctx.beginPath();
    ctx.arc(exo - Math.cos(angP + Math.PI / 2) * e.r * 0.3, eyo - Math.sin(angP + Math.PI / 2) * e.r * 0.3, ew, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(exo + Math.cos(angP + Math.PI / 2) * e.r * 0.3, eyo + Math.sin(angP + Math.PI / 2) * e.r * 0.3, ew, 0, TAU);
    ctx.fill();
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(1, e.flash / 0.12) * 0.75;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // hp bar for elite/boss
    if ((e.elite || e.boss) && e.hp < e.maxhp) {
      const bw = e.boss ? 70 : 44;
      ctx.fillStyle = '#160b0b';
      ctx.fillRect(x - bw / 2, y - e.r - 12, bw, 4);
      ctx.fillStyle = e.boss ? '#f87171' : '#fbbf24';
      ctx.fillRect(x - bw / 2, y - e.r - 12, bw * clamp(e.hp / e.maxhp, 0, 1), 4);
    }
  }
}
function drawAura(ox, oy) {
  for (const w of P.weapons) {
    if (w.id !== 'aura') continue;
    const R = w.auraR || 90;
    const pul = 1 + 0.03 * Math.sin(run.t * 4);
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = w.ev ? '#fbbf24' : '#38e07f';
    ctx.beginPath();
    ctx.arc(P.x + ox, P.y + oy, R * pul, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = w.ev ? '#fbbf24' : '#38e07f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(P.x + ox, P.y + oy, R * pul, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawPlayer(ox, oy) {
  const x = P.x + ox,
    y = P.y + oy;
  if (P.iv > 0 && Math.floor(run.t * 14) % 2 === 0) return;
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + P.r * 0.85, P.r * 1.05, P.r * 0.45, 0, 0, TAU);
  ctx.fill();
  const mv = !!(keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || joy.on);
  const va = Math.atan2(P.aim.y, P.aim.x);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(P.r / 10, P.r / 10);
  drawAgentArt(ctx, run.charId, va, mv ? run.t * 11.5 : 0, mv, run.t);
  ctx.restore();
  if (P.hp < P.maxhp) {
    ctx.fillStyle = '#160b0b';
    ctx.fillRect(x - 16, y + P.r + 7, 32, 4);
    ctx.fillStyle = P.hp / P.maxhp < 0.35 ? '#f87171' : '#38e07f';
    ctx.fillRect(x - 16, y + P.r + 7, 32 * clamp(P.hp / P.maxhp, 0, 1), 4);
  }
}
function drawOrbits(ox, oy) {
  for (const w of P.weapons) {
    if (w.hyper && w.id === 'whip' && w.bladeR) {
      /* ДЕБАГГЕР: лезвие-карусель */
      const a = w.bladeA || 0,
        R = w.bladeR;
      ctx.strokeStyle = 'rgba(251,191,36,.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(P.x + ox, P.y + oy, R, 0, TAU);
      ctx.stroke();
      const bx = P.x + Math.cos(a) * R,
        by = P.y + Math.sin(a) * R;
      ctx.save();
      ctx.translate(bx + ox, by + oy);
      ctx.rotate(a);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-26, -7, 52, 14);
      ctx.fillStyle = '#fff';
      ctx.fillRect(8, -2, 28, 4);
      ctx.restore();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(P.x + ox, P.y + oy, 5, 0, TAU);
      ctx.fill();
    }
    if (w.id !== 'orbit' || !w.active) continue;
    for (let i = 0; i < w.n; i++) {
      const a = w.ang + (i * TAU) / w.n;
      const x = P.x + Math.cos(a) * w.or + ox,
        y = P.y + Math.sin(a) * w.or + oy;
      ctx.fillStyle = w.hyper ? '#7dd3fc' : w.ev ? '#fbbf24' : '#a78bfa';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(4,9,6,.6)';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 10, run.t * 6, run.t * 6 + 1.8);
      ctx.stroke();
    }
  }
}
function drawBullets(ox, oy) {
  for (const b of bullets) {
    const x = b.x + ox,
      y = b.y + oy;
    if (x < -40 || x > S.W + 40 || y < -40 || y > S.H + 40) continue;
    if (b.kind === 'knife') {
      ctx.strokeStyle = '#eafff3';
      ctx.lineWidth = b.big ? 4.5 : 3;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(b.ang) * 10, y - Math.sin(b.ang) * 10);
      ctx.lineTo(x + Math.cos(b.ang) * 8, y + Math.sin(b.ang) * 8);
      ctx.stroke();
    } else if (b.kind === 'shur') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.rot || 0);
      ctx.strokeStyle = '#7ef29a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-b.r, 0);
      ctx.lineTo(b.r, 0);
      ctx.moveTo(0, -b.r);
      ctx.lineTo(0, b.r);
      ctx.stroke();
      ctx.fillStyle = '#eafff3';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (b.kind === 'saw') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.rot);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(0, 0, b.r * 0.75, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#e8c14a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0.3, 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, b.r, Math.PI + 0.3, Math.PI + 1.2);
      ctx.stroke();
      ctx.restore();
    } else if (b.kind === 'fire') {
      if (b.dark) {
        /* СИНГУЛЯРНОСТЬ: чёрная бомба */
        ctx.fillStyle = 'rgba(167,139,250,.4)';
        ctx.beginPath();
        ctx.arc(x, y, b.r + 6 + 2 * Math.sin(run.t * 9), 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2b1d4e';
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath();
        ctx.arc(x, y, b.r * 0.4, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(x, y, b.r + 2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(x, y, b.r * 0.55, 0, TAU);
        ctx.fill();
      }
    } else if (b.kind === 'axe') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.rot);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-3, -b.r, b.r * 0.4, b.r * 2);
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.moveTo(b.r * 0.3, -b.r);
      ctx.lineTo(b.r, -b.r * 0.5);
      ctx.lineTo(b.r, b.r * 0.5);
      ctx.lineTo(b.r * 0.3, b.r);
      ctx.fill();
      ctx.restore();
    } else if (b.kind === 'boom') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.rot);
      if (b.sawLook) {
        /* гипер-лезвие: диск-фрагмент */
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 0, b.r * 0.75, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, b.r, 0.3, 1.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, b.r, Math.PI + 0.3, Math.PI + 1.2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#e8c14a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, b.r, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, b.r, Math.PI - 0.6, Math.PI + 0.6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (b.kind === 'lob') {
      const k = clamp(b.t / b.T, 0, 1);
      const px = lerp(b.x, b.tx, k) + ox;
      const py = lerp(b.y, b.ty, k) + oy - Math.sin(Math.PI * k) * 38;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      ctx.ellipse(lerp(b.x, b.tx, k) + ox, lerp(b.y, b.ty, k) + oy, 5, 2.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = b.col || '#38e07f';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, TAU);
      ctx.fill();
    }
  }
}
function drawFx(ox, oy) {
  for (const f of fx) {
    const k = clamp(f.life / f.T, 0, 1);
    if (f.type === 'slash') {
      ctx.globalAlpha = k * 0.7;
      ctx.strokeStyle = '#a3e635';
      ctx.lineWidth = 4;
      const rot = f.vert ? Math.PI / 2 : 0;
      const rx = f.vert ? f.h / 2 : f.w / 2,
        ry = f.vert ? f.w / 2 : f.h / 2;
      ctx.beginPath();
      ctx.ellipse(f.x + ox, f.y + oy, rx, ry, rot, f.side > 0 ? -0.9 : Math.PI - 0.9, f.side > 0 ? 0.9 : Math.PI + 0.9);
      ctx.stroke();
      ctx.globalAlpha = k * 0.15;
      ctx.fillStyle = '#a3e635';
      ctx.fillRect(f.x + ox - f.w / 2, f.y + oy - f.h / 2, f.w, f.h);
      ctx.globalAlpha = 1;
    } else if (f.type === 'ring') {
      const r = lerp(f.r0, f.r1, 1 - k);
      ctx.globalAlpha = k * 0.8;
      ctx.strokeStyle = f.col || '#38e07f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(f.x + ox, f.y + oy, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.type === 'bolt') {
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#cfe8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < f.pts.length; i++) {
        const p = f.pts[i];
        if (i === 0) ctx.moveTo(p[0] + ox, p[1] + oy);
        else ctx.lineTo(p[0] + ox, p[1] + oy);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(157,180,255,.5)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.type === 'laser') {
      const tel = f.fired;
      ctx.globalAlpha = tel ? k : 0.3 + 0.25 * Math.sin(run.t * 30);
      ctx.strokeStyle = f.col || '#f87171';
      ctx.lineWidth = tel ? f.w : 1.5;
      ctx.beginPath();
      if (f.horiz) {
        ctx.moveTo(0, f.coord + oy);
        ctx.lineTo(S.W, f.coord + oy);
      } else {
        ctx.moveTo(f.coord + ox, 0);
        ctx.lineTo(f.coord + ox, S.H);
      }
      ctx.stroke();
      if (tel) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1, f.w * 0.25);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (f.type === 'rail') {
      ctx.globalAlpha = k * 0.9;
      ctx.strokeStyle = f.col || '#eafff3';
      ctx.lineWidth = f.wid * k + 1;
      ctx.beginPath();
      ctx.moveTo(f.x + ox, f.y + oy);
      ctx.lineTo(f.x + ox + Math.cos(f.a) * f.len, f.y + oy + Math.sin(f.a) * f.len);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1, f.wid * 0.3 * k);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
function drawParts(ox, oy) {
  for (const p of parts) {
    ctx.globalAlpha = clamp(p.life / p.T, 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x + ox - p.sz / 2, p.y + oy - p.sz / 2, p.sz, p.sz);
  }
  ctx.globalAlpha = 1;
}
function drawDmgNums(ox, oy) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 12px monospace';
  for (const d of dmgNums) {
    ctx.globalAlpha = clamp(d.life / d.T, 0, 1);
    ctx.fillStyle = '#040906';
    ctx.fillText(d.txt, d.x + ox + 1, d.y + oy + 1);
    ctx.fillStyle = d.col;
    ctx.fillText(d.txt, d.x + ox, d.y + oy);
  }
  ctx.globalAlpha = 1;
}
function drawNotes(ox, oy) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px monospace';
  for (const n of notes) {
    ctx.globalAlpha = clamp(n.life > n.T - 0.25 ? (n.T - n.life) / 0.25 : Math.min(1, n.life / 0.6), 0, 1);
    const ls = n.txt.split('\n');
    for (let i = 0; i < ls.length; i++) {
      const yy = n.y + oy + i * 18 - (ls.length - 1) * 9;
      ctx.fillStyle = '#040906';
      ctx.fillText(ls[i], n.x + ox + 1.5, yy + 1.5);
      ctx.fillStyle = n.col;
      ctx.fillText(ls[i], n.x + ox, yy);
    }
  }
  ctx.globalAlpha = 1;
}

/* ================= ACHIEVEMENTS ================= */
/* silent=true — выдача без тостов/звука со списком «что выдано» (экран окончания забега);
   посреди забега ачивки не выдаются вообще: условия копятся, оформление — только по итогам */
function checkAch(silent) {
  const got = [],
    UNL = {
      char: 'АГЕНТ ОТКРЫТ',
      stage: 'КАРТА ОТКРЫТА',
      w: '⚙️ ОРУЖИЕ ОТКРЫТО',
      p: '🧩 ПАССИВ ОТКРЫТ',
      meta: 'МОДУЛЬ ОТКРЫТ',
    },
    LOW = { char: 'агент', stage: 'карта', w: 'оружие', p: 'пассив', meta: 'модуль' };
  for (const a of ACH) {
    if (save.ach[a.id]) continue;
    let ok = false;
    try {
      ok = a.c(save.stats);
    } catch (e) {}
    if (ok) {
      save.ach[a.id] = true;
      save.coins += a.r;
      save.stats.coins += a.r;
      const unl = [];
      for (const c of CHARS)
        if (c.lockAch === a.id) {
          save.chars[c.id] = true;
          unl.push(['char', c.name]);
        }
      for (const s of STAGES)
        if (s.unlockAch === a.id) {
          save.stages[s.id] = true;
          unl.push(['stage', s.name]);
        }
      for (const id in WEAPONS) if (WEAPONS[id].lockAch === a.id) unl.push(['w', WEAPONS[id].name]);
      for (const id in PASSIVES) if (PASSIVES[id].lockAch === a.id) unl.push(['p', PASSIVES[id].name]);
      if (META_ACH[a.id] && !save.meta[META_ACH[a.id]]) {
        save.meta[META_ACH[a.id]] = 1;
        unl.push(['meta', META_ACH_NAME[META_ACH[a.id]]]);
      }
      if (silent)
        got.push({
          name: a.name,
          d: a.d,
          r: a.r,
          extra: unl.length ? ' → открыто: ' + unl.map(u => LOW[u[0]] + ' ' + u[1]).join(', ') : '',
        });
      else {
        toast('🏆 ' + a.name + ' (+' + a.r + ')', 'amb');
        sfx('chest');
        for (const u of unl) toast(UNL[u[0]] + ': ' + u[1], 'amb');
      }
    }
  }
  saveGame();
  return got;
}
function grantBackUnlocks() {
  for (const c of CHARS) if (c.lockAch && save.ach[c.lockAch]) save.chars[c.id] = true;
  for (const s of STAGES) if (s.unlockAch && save.ach[s.unlockAch]) save.stages[s.id] = true;
  for (const id in META_ACH) if (save.ach[id]) save.meta[META_ACH[id]] = 1;
}

/* ================= SCREENS ================= */
function hideAllScreens() {
  document.querySelectorAll('.screen,.modal').forEach(e => e.classList.add('hidden'));
}
function openScreen(name) {
  S.appState = name;
  hideAllScreens();
  if (name === 'menu') {
    $('menu').classList.remove('hidden');
    $('menuCoins').textContent = fmt(save.coins);
    $('btnCodex').classList.toggle('hidden', !save.meta.codex);
  } else if (name === 'chars') {
    renderCharGrid();
    $('charSelect').classList.remove('hidden');
    $('charCoins').textContent = fmt(save.coins);
  } else if (name === 'stages') {
    renderStageGrid();
    $('stageSelect').classList.remove('hidden');
  } else if (name === 'shop') {
    renderShop();
    $('shop').classList.remove('hidden');
  } else if (name === 'ach') {
    renderAch();
    $('achScreen').classList.remove('hidden');
  } else if (name === 'codex') {
    renderCodex();
    $('codexScreen').classList.remove('hidden');
  } else if (name === 'stats') {
    renderStats();
    $('statsScreen').classList.remove('hidden');
  } else if (name === 'settings') {
    $('settingsScreen').classList.remove('hidden');
  }
  /* каждый экран открывается с верха (на display:none scrollTop не сбросить) */
  const scr = {
    menu: 'menu',
    chars: 'charSelect',
    stages: 'stageSelect',
    shop: 'shop',
    ach: 'achScreen',
    codex: 'codexScreen',
    stats: 'statsScreen',
    settings: 'settingsScreen',
  }[name];
  if (scr) $(scr).scrollTop = 0;
}
let selChar = CHARS.find(c => c.id === save.lastChar) ? save.lastChar : CHARS[0].id;
function charUnlocked(c) {
  if (save.chars[c.id]) return true;
  if (c.lockAch && save.ach[c.lockAch]) {
    save.chars[c.id] = true;
    return true;
  }
  return false;
}
function growTxt(c) {
  const g = c.grow;
  if (!g) return '';
  const M = {
    dmg: 'урон',
    cd: 'перезарядка',
    area: 'площадь',
    proj: 'скор. снарядов',
    dur: 'длительность',
    hp: 'макс. HP',
    mspd: 'скорость бега',
    magnet: 'радиус подбора',
    luck: 'удача',
    growth: 'опыт',
    all: 'все параметры',
  };
  const v = Math.round(g.per * 1000) / 10;
  return (g.s === 'cd' ? '−' + v + '%' : '+' + v + '%') + ' ' + M[g.s] + ' за ур.';
}
function renderCharGrid() {
  const g = $('charGrid');
  g.innerHTML = '';
  for (const c of CHARS) {
    const un = charUnlocked(c);
    const d = document.createElement('div');
    d.className = 'card' + (un ? '' : ' lock') + (selChar === c.id ? ' sel' : '');
    let foot;
    if (un)
      foot =
        '<div class="cost" style="color:var(--mut)">' +
        (c.cost ? 'куплен' : 'доступен') +
        ' · старт: ' +
        (c.weapon ? WEAPONS[c.weapon].icon + ' ' + WEAPONS[c.weapon].name : 'собирает сам') +
        (c.grow ? ' · рост: ' + growTxt(c) : '') +
        '</div>';
    else if (c.lockAch) foot = '<div class="lockd">🔒 ' + c.lockTxt + '</div>';
    else foot = '<div class="cost">◉ ' + c.cost + ' — купить</div>';
    d.innerHTML =
      '<img class="faceImg" src="' +
      charArtURL(c.id) +
      '" alt="' +
      c.face +
      '"><div class="nm">' +
      c.name +
      '</div><div class="ds">' +
      c.d +
      '</div>' +
      foot;
    d.onclick = () => {
      sfx('click');
      if (un) {
        selChar = c.id;
        save.lastChar = c.id;
        saveGame();
        renderCharGrid();
      } else if (c.cost && save.coins >= c.cost) {
        save.coins -= c.cost;
        save.chars[c.id] = true;
        selChar = c.id;
        save.lastChar = c.id;
        saveGame();
        toast('АГЕНТ КУПЛЕН: ' + c.name, 'amb');
        renderCharGrid();
        $('charCoins').textContent = fmt(save.coins);
      } else if (c.cost) toast('НЕ ХВАТАЕТ МОНЕТ: нужно ◉' + c.cost, 'red');
    };
    g.appendChild(d);
  }
  $('charOk').disabled = !charUnlocked(CHARS.find(c => c.id === selChar));
}
let endlessOn = false,
  selStage = null;
/* ♾ на карте открывается только победой на НЕЙ (winsBy), а не глобальным «поиграл куда-то» */
const endlessUnlocked = id => (save.stats.winsBy[id] || 0) >= 1;
function renderStageGrid() {
  const ac = CHARS.find(c => c.id === selChar) || CHARS[0];
  $('stageAgentInfo').innerHTML =
    'агент: <img class="miniFace" src="' +
    charArtURL(ac.id) +
    '" alt="' +
    ac.face +
    '"> <b>' +
    ac.name +
    '</b> · ' +
    (ac.weapon ? WEAPONS[ac.weapon].icon + ' ' + WEAPONS[ac.weapon].name : 'соберёт сам');
  const g = $('stageGrid');
  g.innerHTML = '';
  for (const s of STAGES) {
    let un = save.stages[s.id];
    if (!un && s.unlockAch && save.ach[s.unlockAch]) {
      un = true;
      save.stages[s.id] = true;
    }
    const d = document.createElement('div');
    d.className = 'card' + (un ? '' : ' lock') + (selStage === s.id ? ' sel' : '');
    d.style.width = '290px';
    const best = save.stats.best[s.id] || 0;
    let foot;
    if (un)
      foot =
        '<div class="cost" style="color:var(--mut)">рекорд: ' +
        fmtT(best) +
        (save.stats.winsBy[s.id] ? ' · ★ ПОБЕДА' : '') +
        (endlessUnlocked(s.id) ? ' · ♾' : '') +
        '</div>';
    else {
      const a = ACH.find(x => x.id === s.unlockAch);
      foot = '<div class="lockd">🔒 откроется: «' + (a ? a.name : '') + '»</div>';
    }
    d.innerHTML =
      '<img class="stageImg" src="' +
      stageArtURL(s.id) +
      '" style="border-color:' +
      s.accent +
      '55" alt="' +
      s.name +
      '">' +
      '<div class="nm" style="font-size:16px">' +
      s.name +
      '</div>' +
      (s.era ? '<div class="era">' + s.era + '</div>' : '') +
      '<div class="ds">' +
      s.desc +
      '</div>' +
      foot;
    d.onclick = () => {
      sfx('click');
      if (!un) {
        toast('СНАЧАЛА ОТКРОЙ КАРТУ', 'red');
        return;
      }
      /* клик = только выбор; старт — кнопкой «ИГРАТЬ» в шапке */
      selStage = s.id;
      if (!endlessUnlocked(s.id)) endlessOn = false;
      renderStageGrid();
      $('stagePanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    g.appendChild(d);
  }
  updateStagePanel();
  saveGame();
}
function updateStagePanel() {
  const s = STAGES.find(x => x.id === selStage);
  $('stageGo').disabled = !(s && save.stages[s.id]);
  const panel = $('stagePanel');
  if (!s) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  const eu = endlessUnlocked(s.id);
  $('endlessWrap').classList.toggle('hidden', !eu);
  $('endlessLock').classList.toggle('hidden', eu);
  $('endlessTgl').classList.toggle('on', endlessOn);
}
function renderShop() {
  const g = $('shopGrid');
  g.innerHTML = '';
  $('shopCoins').textContent = fmt(save.coins);
  for (const m of META) {
    const lv = save.meta[m.id];
    const d = document.createElement('div');
    d.className = 'card';
    let prog;
    if (m.max === Infinity) {
      const curTxt =
        m.id === 'dinf'
          ? lv + '% урона'
          : m.id === 'cinf'
            ? lv + '% монет'
            : m.id === 'hpinf'
              ? '+' + lv + ' макс. HP'
              : lv + '% силы багов';
      prog =
        '<div class="pips"><div class="pip gold on"></div><div style="color:var(--mut);font-size:11px">уровень ' +
        lv +
        ' · сейчас: +' +
        curTxt +
        '</div></div>';
    } else {
      prog = '<div class="pips">';
      for (let i = 0; i < m.max; i++) prog += '<div class="pip' + (i < lv ? ' on' : '') + '"></div>';
      prog += '</div>';
    }
    const maxed = lv >= m.max;
    const cost = maxed ? 0 : m.cost(lv);
    d.innerHTML =
      '<div class="face" style="font-size:26px">' +
      m.icon +
      '</div><div class="nm">' +
      m.name +
      '</div><div class="ds">' +
      m.d +
      '</div>' +
      prog +
      '<div class="shopCost cost">' +
      (maxed
        ? '<span style="color:var(--grn2)">' + (m.max === Infinity ? '×∞' : 'МАКСИМУМ') + '</span>'
        : '◉ ' + fmt(cost)) +
      '</div>';
    if (!maxed) {
      d.onclick = () => {
        if (save.coins >= cost) {
          save.coins -= cost;
          save.meta[m.id]++;
          saveGame();
          sfx('coin');
          toast(m.name + ' → УР. ' + save.meta[m.id]);
          renderShop();
        } else toast('НЕ ХВАТАЕТ МОНЕТ', 'red');
      };
    } else d.classList.add('lock');
    g.appendChild(d);
  }
}
function renderCodex() {
  const g = $('codexGrid');
  g.innerHTML = '';
  /* в кодекс попадает только УВИДЕННОЕ: оружие — если разблокировано в пуле
     или это стартовое оружие открытого агента; пассивки — если разблокированы.
     Скрытое не занимает место в сетке, итог — счётчиком в шапке */
  const wSeen = id =>
    wUnlocked(id) || CHARS.some(c => c.weapon === id && (save.chars[c.id] || !c.lockAch || save.ach[c.lockAch]));
  let shown = 0,
    total = 0;
  for (const id in WEAPONS) {
    total++;
    if (!wSeen(id)) continue;
    shown++;
    const def = WEAPONS[id];
    const d = document.createElement('div');
    d.className = 'card';
    let extra = '';
    if (def.evo) {
      const e = def.evo,
        h = HYPERS[id];
      extra +=
        '<div class="lockd" style="color:var(--amb);margin-top:8px">эволюция: ' +
        e.icon +
        ' ' +
        e.name +
        '<br>мерж: оружие ур.8 + ' +
        PASSIVES[e.need].icon +
        ' ' +
        PASSIVES[e.need].name +
        ' (макс)</div>' +
        '<div class="lockd" style="color:var(--vio);margin-top:6px">гипер: ' +
        h.icon +
        ' ' +
        h.name +
        '<br>мерж: ' +
        e.name +
        ' + ' +
        WEAPONS[h.with].evo.name +
        ' — новая атака' +
        (h.host ? '' : ' (поглощается партнёром)') +
        '</div>';
    }
    d.innerHTML =
      '<div class="face">' +
      def.icon +
      '</div><div class="nm">' +
      def.name +
      '</div><div class="ds">' +
      def.d +
      '</div>' +
      extra;
    g.appendChild(d);
  }
  for (const id in PASSIVES) {
    total++;
    if (!pUnlocked(id)) continue;
    shown++;
    const p = PASSIVES[id];
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML =
      '<div class="face" style="font-size:22px">' +
      p.icon +
      '</div><div class="nm" style="font-size:12px">' +
      p.name +
      '</div><div class="ds" style="min-height:30px">' +
      p.d +
      '</div><div class="cost" style="color:var(--mut)">макс. ур. ' +
      p.max +
      '</div>';
    g.appendChild(d);
  }
  $('codexProgress').textContent = 'увидено: ' + shown + ' / ' + total;
}
function renderAch() {
  const g = $('achGrid');
  g.innerHTML = '';
  const done = ACH.filter(a => save.ach[a.id]).length;
  $('achProgress').textContent = 'открыто: ' + done + ' / ' + ACH.length;
  for (const a of ACH) {
    const d = document.createElement('div');
    d.className = 'card' + (save.ach[a.id] ? ' achDone' : ' lock');
    d.innerHTML =
      '<div class="nm">' +
      (save.ach[a.id] ? '🏆 ' : '🔒 ') +
      a.name +
      '</div><div class="ds">' +
      a.d +
      '</div><div class="cost">◉ +' +
      a.r +
      '</div>';
    g.appendChild(d);
  }
}
function renderStats() {
  const s = save.stats;
  $('statsBody').innerHTML =
    goRow('УБИЙСТВ ВСЕГО', fmt(s.kills)) +
    goRow('МОНЕТ ЗАРАБОТАНО', fmt(s.coins)) +
    goRow('ОПЫТА ВСЕГО', fmt(s.xp)) +
    goRow('БОССОВ УБИТО', s.bosses) +
    goRow('ЗАБЕГОВ', s.runs) +
    goRow('ПОБЕД', s.wins) +
    goRow('СМЕРТЕЙ', s.deaths) +
    goRow('ЭВОЛЮЦИЙ', s.evos) +
    goRow('ЛУЧШИЙ УРОВЕНЬ', s.bestLvl) +
    goRow('УБИЙСТВ ЗА ЗАБЕГ (рекорд)', fmt(s.bestKills)) +
    goRow('РЕКОРД · ПРОДАКШЕН', fmtT(s.best.prod)) +
    goRow('РЕКОРД · НОЧНОЙ БИЛД', fmtT(s.best.night)) +
    goRow('РЕКОРД · ЛЕГАСИ-АД', fmtT(s.best.legacy)) +
    goRow(
      'ЦЕПОЧКА ОТКРЫТИЙ',
      (function () {
        let n = 0;
        for (let i = 1; i <= 32; i++) if (save.ach['c' + i]) n++;
        return n;
      })() + ' / 32'
    );
}
/* ===== ТУЛТИПЫ ЭКИПИРОВКИ (HUD + пауза): ховер/тап по иконке → название, статы, эффекты ===== */
let tipSticky = null;
function showTip(anchor, html, cls) {
  const t = $('wtip');
  t.className = cls || '';
  t.innerHTML = html;
  t.classList.remove('hidden');
  const r = anchor.getBoundingClientRect(),
    tr = t.getBoundingClientRect();
  let x = r.right + 8,
    y = r.top - 4;
  if (x + tr.width > innerWidth - 8) x = Math.max(8, r.left - tr.width - 8);
  if (y + tr.height > innerHeight - 8) y = innerHeight - tr.height - 8;
  if (y < 8) y = 8;
  t.style.left = x + 'px';
  t.style.top = y + 'px';
}
function hideTip() {
  tipSticky = null;
  $('wtip').classList.add('hidden');
}
function bindTip(el, fn, clsFn) {
  el.addEventListener('mouseenter', () => {
    if (!tipSticky) showTip(el, fn(), clsFn && clsFn());
  });
  el.addEventListener('mouseleave', () => {
    if (!tipSticky) $('wtip').classList.add('hidden');
  });
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (tipSticky === el) hideTip();
    else {
      tipSticky = el;
      showTip(el, fn(), clsFn && clsFn());
    }
  }); /* тап на мобильном — закрепить/скрыть */
}
document.addEventListener('pointerdown', e => {
  if (tipSticky && !(e.target.closest && e.target.closest('.wIco'))) hideTip();
});
/* текущие статы оружия (wstats) → строка тултипа */
function tipStatsW(w) {
  const s = wstats(w),
    r = [];
  r.push('УРОН <b>' + Math.round(s.dmg * 10) / 10 + '</b>');
  r.push('ОТКАТ <b>' + s.cd.toFixed(2) + 'с</b>');
  r.push('ПЛОЩАДЬ <b>×' + Math.round(s.area * 100) / 100 + '</b>');
  if (s.count) r.push('ШТ. <b>' + s.count + '</b>');
  if (s.speed) r.push('СКОР. <b>' + Math.round(s.speed) + '</b>');
  if (s.dur) r.push('ДЛИТ. <b>' + s.dur.toFixed(1) + 'с</b>');
  if (s.pierce !== undefined) r.push(s.pierce >= 99 ? '<b>пробивает всё</b>' : 'ПРОБИТИЕ <b>' + s.pierce + '</b>');
  if (s.crit) r.push('КРИТ <b>' + Math.round(s.crit * 100) + '%</b>');
  if (s.vamp) r.push('<b>+' + s.vamp + ' HP за убийство</b>');
  if (s.chain) r.push('<b>цепная молния</b>');
  if (s.stun) r.push('<b>оглушение</b>');
  if (s.burn) r.push('<b>поджиг</b>');
  if (s.push) r.push('<b>выталкивает</b>');
  if (w.id === 'axe' && s.explode) r.push('ВЗРЫВ <b>R' + Math.round(95 * s.area) + '</b>');
  if (s.pull) r.push('<b>тянет врагов</b>');
  if (s.perm) r.push('<b>постоянная</b>');
  return '<div class="tStat">' + r.join(' · ') + '</div>';
}
function tipW(w) {
  const def = WEAPONS[w.id];
  let name,
    icon,
    tag,
    desc,
    extra = '';
  const mk = w.mk ? ' +' + w.mk + ' МОД' : '';
  if (w.hyper) {
    const h = HYPERS[w.id];
    name = h.name;
    icon = h.icon;
    tag = 'ГИПЕР-ФОРМА · УР. ' + w.lvl + mk;
    desc = h.d;
    extra = 'Слияние: ' + def.evo.name + ' + ' + WEAPONS[h.with].evo.name;
  } else if (w.ev) {
    name = def.evo.name;
    icon = def.evo.icon;
    tag = 'ЭВОЛЮЦИЯ · УР. ' + w.lvl + mk;
    desc = def.evo.d;
  } else {
    name = def.name;
    icon = def.icon;
    tag = 'ОРУЖИЕ · УР. ' + w.lvl + '/8' + mk;
    desc = def.d;
  }
  return (
    '<div class="tName">' +
    icon +
    ' ' +
    name +
    '</div><div class="tTag">' +
    tag +
    '</div>' +
    tipStatsW(w) +
    '<div class="tSep"></div><div class="tDesc">' +
    desc +
    '</div>' +
    (extra ? '<div class="tTag" style="margin-top:5px">' + extra + '</div>' : '') +
    '<div class="tTag" style="margin-top:5px;opacity:.72">значения уже включают пассивки, МОДы и мета-бонусы</div>'
  );
}
function passiveTotals(id, lvl) {
  /* итоговый эффект пассивки на её текущем уровне */
  switch (id) {
    case 'dmg':
      return ['+' + 10 * lvl + '% урона', '+10% урона'];
    case 'cd':
      return ['−' + 8 * lvl + '% перезарядки', '−8% перезарядки'];
    case 'area':
      return ['+' + 10 * lvl + '% площади атак', '+10% площади атак'];
    case 'proj':
      return ['+' + 10 * lvl + '% скорости снарядов', '+10% скорости снарядов'];
    case 'dur':
      return ['+' + 12 * lvl + '% длительности', '+12% длительности'];
    case 'amount':
      return ['+' + lvl + (lvl === 1 ? ' снаряд' : ' снаряда') + ' ко всему', '+1 снаряд ко всему'];
    case 'armor':
      return ['−' + lvl + ' урона от каждого удара', '−1 урона от удара'];
    case 'regen':
      return ['+' + Math.round(25 * lvl) / 100 + ' HP/сек', '+0.25 HP/сек'];
    case 'mspd':
      return ['+' + 7 * lvl + '% скорости бега', '+7% скорости бега'];
    case 'magnet':
      return ['+' + 25 * lvl + '% радиуса подбора', '+25% радиуса подбора'];
    case 'luck':
      return ['+' + 10 * lvl + '% шанса дропа', '+10% шанса дропа'];
    case 'growth':
      return ['+' + 8 * lvl + '% получаемого опыта', '+8% опыта'];
    default:
      return null; /* spag: живые множители считаются ниже */
  }
}
function tipP(p) {
  const def = PASSIVES[p.id];
  let html =
    '<div class="tName">' +
    def.icon +
    ' ' +
    def.name +
    '</div>' +
    '<div class="tTag">ПАССИВ · УР. ' +
    p.lvl +
    '/' +
    def.max +
    '</div>';
  const t = passiveTotals(p.id, p.lvl);
  if (t) {
    html +=
      '<div class="tStat">итог сейчас: <b>' +
      t[0] +
      '</b></div>' +
      (p.lvl >= def.max
        ? '<div class="tTag">максимальный уровень</div>'
        : '<div class="tStat">след. ур.: <b>' + t[1] + '</b></div>');
  }
  html += '<div class="tSep"></div><div class="tDesc">' + def.d + '</div>';
  if (p.id === 'spag') {
    /* живые числа текущей угрозы (весь стак: ТЕХДОЛГ + спаг) */
    const th = threat();
    html +=
      '<div class="tStat">сейчас: спавн <b>×' +
      th.cnt.toFixed(2) +
      '</b> · HP <b>×' +
      th.hp.toFixed(2) +
      '</b> · скорость <b>×' +
      th.spd.toFixed(2) +
      '</b> · лут <b>×' +
      rew().toFixed(2) +
      '</b></div>';
  }
  return html;
}
function tipAbs(id, kind) {
  const def = kind === 'p' ? PASSIVES[id] : WEAPONS[id];
  return (
    '<div class="tName">' +
    def.icon +
    ' ' +
    def.name +
    '</div>' +
    '<div class="tTag">ПОГЛОЩЕНО ГИПЕР-СЛИЯНИЕМ</div>' +
    '<div class="tSep"></div><div class="tDesc">слот освобождён, МОДы перешли гипер-форме</div>'
  );
}
/* общие фабрики иконок — один источник для HUD (buildIcons) и паузы (pauseGame) */
function mkWIcon(w) {
  const d = document.createElement('div');
  d.className = 'wIco' + (w.hyper ? ' hyper' : w.ev ? ' evo' : '') + (w.lvl >= 8 ? ' max' : '');
  d.innerHTML =
    (w.hyper ? HYPERS[w.id].icon : w.ev ? WEAPONS[w.id].evo.icon : WEAPONS[w.id].icon) +
    '<span class="lv">' +
    w.lvl +
    (w.mk ? '+' + w.mk : '') +
    '</span>';
  bindTip(
    d,
    () => tipW(w),
    () => (w.hyper ? 'hyperTip' : w.ev ? 'evoTip' : '')
  );
  return d;
}
function mkPIcon(p) {
  const d = document.createElement('div');
  d.className = 'wIco';
  d.innerHTML = PASSIVES[p.id].icon + '<span class="lv">' + p.lvl + '</span>';
  bindTip(d, () => tipP(p));
  return d;
}
function mkAbsIcon(id, kind) {
  const d = document.createElement('div');
  d.className = 'wIco abs';
  d.innerHTML = (kind === 'p' ? PASSIVES[id] : WEAPONS[id]).icon + '<span class="lv">✦</span>';
  bindTip(d, () => tipAbs(id, kind));
  return d;
}
function buildIcons() {
  const wi = $('weaponIcons');
  wi.innerHTML = '';
  for (const w of P.weapons) wi.appendChild(mkWIcon(w));
  const pi = $('passiveIcons');
  pi.innerHTML = '';
  for (const p of P.passives) pi.appendChild(mkPIcon(p));
  for (const id in P.absorbed) pi.appendChild(mkAbsIcon(id, 'p'));
  for (const id in P.usedW) pi.appendChild(mkAbsIcon(id, 'w'));
}

/* ================= SETTINGS ================= */
function bindTgl(el, get, set) {
  el.classList.toggle('on', get());
  el.onclick = () => {
    set(!get());
    el.classList.toggle('on', get());
    sfx('click');
    saveGame();
  };
}
/* все три зеркала галочки «автовыбор модов» — в синхроне (настройки, пауза, окно уровня) */
function syncAutomod() {
  $('automodTgl').classList.toggle('on', save.set.automod);
  $('lvlAutoTgl').classList.toggle('on', save.set.automod);
  $('pauseAutoTgl').classList.toggle('on', save.set.automod);
}
bindTgl(
  $('sfxTgl'),
  () => save.set.sfx,
  v => (save.set.sfx = v)
);
bindTgl(
  $('shakeTgl'),
  () => save.set.shake,
  v => (save.set.shake = v)
);
bindTgl(
  $('automodTgl'),
  () => save.set.automod,
  v => {
    save.set.automod = v;
    syncAutomod();
  }
);
/* галочка и в меню паузы — автоворд можно выключить не выходя из забега */
bindTgl(
  $('pauseAutoTgl'),
  () => save.set.automod,
  v => {
    save.set.automod = v;
    syncAutomod();
  }
);
/* галочка автовыбора мода ПРЯМО в окне повышения уровня (показывается, только когда среди выбора есть моды) */
$('lvlAutoTgl').onclick = () => {
  if (S.appState !== 'levelup') return;
  save.set.automod = !save.set.automod;
  syncAutomod();
  sfx('click');
  saveGame();
  /* включили прямо в окне «только моды» — срабатывает немедленно */
  if (save.set.automod && lvlChoices.length && lvlChoices.every(c => c.type === 'mod'))
    chooseLevel(Math.floor(Math.random() * lvlChoices.length));
};
let resetArmed = false;
$('resetBtn').onclick = () => {
  if (!resetArmed) {
    resetArmed = true;
    $('resetBtn').textContent = 'ТОЧНО?? НАЖМИ ЕЩЁ РАЗ';
    setTimeout(() => {
      resetArmed = false;
      $('resetBtn').textContent = 'СБРОСИТЬ ВЕСЬ ПРОГРЕСС';
    }, 3000);
    return;
  }
  localStorage.removeItem(SAVE_KEY);
  reloadSave();
  resetArmed = false;
  $('resetBtn').textContent = 'СБРОСИТЬ ВЕСЬ ПРОГРЕСС';
  /* полный сброс = немедленная перезагрузка: галочки и экраны биндятся один
     раз при загрузке скрипта, и любая пауза перед reload оставляет окно,
     куда можно успеть накликать со старой картинкой. Тост до reload не
     переживёт перезагрузку — передаём его через sessionStorage и показываем
     уже в свежем меню (см. BOOT). */
  try {
    sessionStorage.setItem('bsResetToast', '1');
  } catch (e) {}
  location.reload();
};

/* ================= BUTTONS ================= */
$('btnPlay').onclick = () => {
  sfx('click');
  openScreen('chars');
};
$('charBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('btnShop').onclick = () => {
  sfx('click');
  openScreen('shop');
};
$('btnCodex').onclick = () => {
  sfx('click');
  openScreen('codex');
};
$('btnAch').onclick = () => {
  sfx('click');
  openScreen('ach');
};
$('btnStats').onclick = () => {
  sfx('click');
  openScreen('stats');
};
$('btnSettings').onclick = () => {
  sfx('click');
  openScreen('settings');
};
$('charOk').onclick = () => {
  sfx('click');
  openScreen('stages');
};
$('stageBack').onclick = () => {
  sfx('click');
  openScreen('chars');
};
$('stageGo').onclick = () => {
  if (!selStage || !save.stages[selStage]) return;
  sfx('click');
  startRun(selChar, selStage, endlessOn);
};
$('shopBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('achBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('codexBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('statsBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('settingsBack').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('resumeBtn').onclick = () => {
  sfx('click');
  resumeGame();
};
$('quitBtn').onclick = () => {
  sfx('click');
  $('pauseModal').classList.add('hidden');
  endRun(false, true);
};
$('goRetry').onclick = () => {
  sfx('click');
  startRun(run.charId, run.stageId, run.endless);
};
$('goMenu').onclick = () => {
  sfx('click');
  openScreen('menu');
};
$('chestOk').onclick = () => {
  if (S.appState !== 'chest') return;
  sfx('click');
  if (chestEvo) {
    applyEvo(chestEvo);
    chestEvo = null;
  }
  $('chestModal').classList.add('hidden');
  $('chestNo').classList.add('hidden');
  $('chestHint').classList.add('hidden');
  if (P.pendLv > 0) openLevelup();
  else S.appState = 'run';
};
$('chestNo').onclick = () => {
  if (S.appState !== 'chest') return;
  sfx('click');
  chestEvo = null;
  $('chestModal').classList.add('hidden');
  $('chestNo').classList.add('hidden');
  $('chestHint').classList.add('hidden');
  if (P.pendLv > 0) openLevelup();
  else S.appState = 'run';
};
$('endlessTgl').onclick = () => {
  if (!selStage || !endlessUnlocked(selStage)) return;
  sfx('click');
  endlessOn = !endlessOn;
  $('endlessTgl').classList.toggle('on', endlessOn);
};

/* ================= MAIN LOOP / BOOT ================= */
let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastTs) {
    lastTs = ts;
    return;
  }
  const dt = Math.min(0.05, Math.max(0.0001, (ts - lastTs) / 1000));
  lastTs = ts;
  if (S.appState === 'run') update(dt);
  else S.shake = 0; /* на паузах/окнах выбора экран не трясётся */
  if (S.hasRun) render();
}
hooks.openLevelup = openLevelup;
hooks.buildIcons = buildIcons;
hooks.openChest = openChest;
hooks.endRun = endRun;
hooks.bossBar = name => {
  if (!name) {
    $('bossBarWrap').classList.add('hidden');
    return;
  }
  $('bossBarWrap').classList.remove('hidden');
  $('bossName').textContent = name;
};
grantBackUnlocks();
checkAch();
openScreen('menu');
/* возврат после полного сброса: страница уже перезагрузилась с чистым сейвом — теперь можно честно показать тост */
try {
  if (sessionStorage.getItem('bsResetToast')) {
    sessionStorage.removeItem('bsResetToast');
    toast('ПРОГРЕСС СБРОШЕН', 'red');
  }
} catch (e) {}
requestAnimationFrame(frame);

/* debug handle (для тестов) */
window.G = {
  state: () => S.appState,
  P: () => P,
  run: () => run,
  save: () => save,
  giveXP: v => {
    if (P) gainXP(v || 100);
  },
  coins: v => {
    if (run) run.coins += v || 100;
  },
  chest: () => openChest(),
  boss: () => spawnBoss(6),
  lvl: () => {
    if (P) {
      P.pendLv++;
      if (S.appState === 'run') openLevelup();
    }
  },
  evo: () => {
    if (S.appState === 'run') {
      const c = findEvo1() || findHyper();
      if (c) openEvoModal(c);
      else toast('нет кандидатов на слияние', 'red');
    }
  },
  maxW: () => {
    if (P) {
      for (const w of P.weapons) w.lvl = 8;
      buildIcons();
    }
  },
};
