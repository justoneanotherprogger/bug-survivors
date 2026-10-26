'use strict';

import { $, clamp, fmt, fmtT } from './core/utils.js';
import { SAVE_KEY, save, saveGame, reloadSave } from './core/save.js';
import { S, P, run, cam } from './core/state.js';
import { sfx } from './core/audio.js';
import { keys, joy, inputDir } from './core/input.js';
import { CHARS } from './data/chars.js';
import { WEAPONS } from './data/weapons.js';
import { PASSIVES, KEYSTATS, MODTXT } from './data/upgrades.js';
import { HYPERS } from './data/hypers.js';
import { STAGES } from './data/stages.js';
import { META } from './data/meta.js';
import { ACH } from './data/achievements.js';
import { wUnlocked, pUnlocked, recompute } from './run/stats.js';
import { resetRun, finishRun } from './run/lifecycle.js';
import { hooks } from './core/hooks.js';
import { gainXP, rollChoices, findEvo1, findHyper, applyEvo, openChestLogic } from './run/progression.js';
import { spawnBoss, director } from './run/director.js';
import { lvDesc, updWeapons } from './combat/weapons.js';
import { gridRebuild, updBullets, updateEnemies, updPools, updPickups, updFx } from './combat/world.js';
import { render } from './render/canvas.js';
import { charArtURL, stageArtURL } from './render/sprites.js';
import { toast } from './ui/toast.js';
import { checkAch, grantBackUnlocks } from './ui/achievements.js';
import { hideTip, mkWIcon, mkPIcon, mkAbsIcon, buildIcons } from './ui/tooltips.js';

/* ================= STATE ================= */

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
