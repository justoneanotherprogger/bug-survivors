import { save, saveGame } from '../core/save.js';
import { sfx } from '../core/audio.js';
import { ACH } from '../data/achievements.js';
import { CHARS } from '../data/chars.js';
import { STAGES } from '../data/stages.js';
import { WEAPONS } from '../data/weapons.js';
import { PASSIVES } from '../data/upgrades.js';
import { META_ACH, META_ACH_NAME } from '../data/meta.js';
import { toast } from './toast.js';

/* ================= ACHIEVEMENTS ================= */
/* silent=true — выдача без тостов/звука со списком «что выдано» (экран окончания забега);
   посреди забега ачивки не выдаются вообще: условия копятся, оформление — только по итогам */
export function checkAch(silent) {
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
export function grantBackUnlocks() {
  for (const c of CHARS) if (c.lockAch && save.ach[c.lockAch]) save.chars[c.id] = true;
  for (const s of STAGES) if (s.unlockAch && save.ach[s.unlockAch]) save.stages[s.id] = true;
  for (const id in META_ACH) if (save.ach[id]) save.meta[META_ACH[id]] = 1;
}
