'use strict';

import { $, clamp, fmt, fmtT } from './core/utils.js';
import { save, saveGame } from './core/save.js';
import { S, P, run, cam } from './core/state.js';
import { sfx } from './core/audio.js';
import { keys, joy, inputDir } from './core/input.js';
import { WEAPONS } from './data/weapons.js';
import { PASSIVES, KEYSTATS, MODTXT } from './data/upgrades.js';
import { HYPERS } from './data/hypers.js';
import { recompute } from './run/stats.js';
import { resetRun, finishRun } from './run/lifecycle.js';
import { hooks } from './core/hooks.js';
import { gainXP, rollChoices, findEvo1, findHyper, applyEvo, openChestLogic } from './run/progression.js';
import { spawnBoss, director } from './run/director.js';
import { lvDesc, updWeapons } from './combat/weapons.js';
import { gridRebuild, updBullets, updateEnemies, updPools, updPickups, updFx } from './combat/world.js';
import { render } from './render/canvas.js';
import { toast } from './ui/toast.js';
import { checkAch, grantBackUnlocks } from './ui/achievements.js';
import { hideTip, mkWIcon, mkPIcon, mkAbsIcon, buildIcons } from './ui/tooltips.js';
import { ui, goRow, openScreen, hideAllScreens, endlessUnlocked } from './ui/screens.js';
import { syncAutomod } from './ui/settings.js';

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
    if (
      e.target.closest('button') ||
      e.target.closest('.modal') ||
      e.target.closest('.screen') ||
      e.target.closest('#hudIcons')
    )
      return;
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

/* ================= BUTTONS ================= */
$('pauseBtn').onclick = () => {
  sfx('click');
  pauseGame();
};
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
  if (!ui.selStage || !save.stages[ui.selStage]) return;
  sfx('click');
  startRun(ui.selChar, ui.selStage, ui.endless);
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
  if (!ui.selStage || !endlessUnlocked(ui.selStage)) return;
  sfx('click');
  ui.endless = !ui.endless;
  $('endlessTgl').classList.toggle('on', ui.endless);
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
