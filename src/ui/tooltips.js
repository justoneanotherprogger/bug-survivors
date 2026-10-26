import { $ } from '../core/utils.js';
import { P } from '../core/state.js';
import { WEAPONS } from '../data/weapons.js';
import { PASSIVES } from '../data/upgrades.js';
import { HYPERS } from '../data/hypers.js';
import { threat, rew } from '../run/stats.js';
import { wstats } from '../combat/weapons.js';

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
export function hideTip() {
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
export function mkWIcon(w) {
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
export function mkPIcon(p) {
  const d = document.createElement('div');
  d.className = 'wIco';
  d.innerHTML = PASSIVES[p.id].icon + '<span class="lv">' + p.lvl + '</span>';
  bindTip(d, () => tipP(p));
  return d;
}
export function mkAbsIcon(id, kind) {
  const d = document.createElement('div');
  d.className = 'wIco abs';
  d.innerHTML = (kind === 'p' ? PASSIVES[id] : WEAPONS[id]).icon + '<span class="lv">✦</span>';
  bindTip(d, () => tipAbs(id, kind));
  return d;
}
export function buildIcons() {
  const wi = $('weaponIcons');
  wi.innerHTML = '';
  for (const w of P.weapons) wi.appendChild(mkWIcon(w));
  const pi = $('passiveIcons');
  pi.innerHTML = '';
  for (const p of P.passives) pi.appendChild(mkPIcon(p));
  for (const id in P.absorbed) pi.appendChild(mkAbsIcon(id, 'p'));
  for (const id in P.usedW) pi.appendChild(mkAbsIcon(id, 'w'));
}
