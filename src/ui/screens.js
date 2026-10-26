import { $, fmt, fmtT } from '../core/utils.js';
import { S } from '../core/state.js';
import { save, saveGame } from '../core/save.js';
import { sfx } from '../core/audio.js';
import { CHARS } from '../data/chars.js';
import { STAGES } from '../data/stages.js';
import { WEAPONS } from '../data/weapons.js';
import { PASSIVES } from '../data/upgrades.js';
import { HYPERS } from '../data/hypers.js';
import { META } from '../data/meta.js';
import { ACH } from '../data/achievements.js';
import { pUnlocked, wUnlocked } from '../run/stats.js';
import { charArtURL, stageArtURL } from '../render/sprites.js';
import { toast } from './toast.js';

export const ui = {
  selChar: CHARS.find(c => c.id === save.lastChar) ? save.lastChar : CHARS[0].id,
  selStage: null,
  endless: false,
};

export function goRow(k, v) {
  return '<div class="r"><span>' + k + '</span><span>' + v + '</span></div>';
}

/* ================= SCREENS ================= */
export function hideAllScreens() {
  document.querySelectorAll('.screen,.modal').forEach(e => e.classList.add('hidden'));
}
export function openScreen(name) {
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
    d.className = 'card' + (un ? '' : ' lock') + (ui.selChar === c.id ? ' sel' : '');
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
        ui.selChar = c.id;
        save.lastChar = c.id;
        saveGame();
        renderCharGrid();
      } else if (c.cost && save.coins >= c.cost) {
        save.coins -= c.cost;
        save.chars[c.id] = true;
        ui.selChar = c.id;
        save.lastChar = c.id;
        saveGame();
        toast('АГЕНТ КУПЛЕН: ' + c.name, 'amb');
        renderCharGrid();
        $('charCoins').textContent = fmt(save.coins);
      } else if (c.cost) toast('НЕ ХВАТАЕТ МОНЕТ: нужно ◉' + c.cost, 'red');
    };
    g.appendChild(d);
  }
  $('charOk').disabled = !charUnlocked(CHARS.find(c => c.id === ui.selChar));
}
/* ♾ на карте открывается только победой на НЕЙ (winsBy), а не глобальным «поиграл куда-то» */
export const endlessUnlocked = id => (save.stats.winsBy[id] || 0) >= 1;
function renderStageGrid() {
  const ac = CHARS.find(c => c.id === ui.selChar) || CHARS[0];
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
    d.className = 'card' + (un ? '' : ' lock') + (ui.selStage === s.id ? ' sel' : '');
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
      ui.selStage = s.id;
      if (!endlessUnlocked(s.id)) ui.endless = false;
      renderStageGrid();
      $('stagePanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    g.appendChild(d);
  }
  updateStagePanel();
  saveGame();
}
function updateStagePanel() {
  const s = STAGES.find(x => x.id === ui.selStage);
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
  $('endlessTgl').classList.toggle('on', ui.endless);
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
