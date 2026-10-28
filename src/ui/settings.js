import { $ } from '../core/utils.js';
import { SAVE_KEY, save, saveGame, reloadSave } from '../core/save.js';
import { sfx } from '../core/audio.js';

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
export function syncAutomod() {
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
