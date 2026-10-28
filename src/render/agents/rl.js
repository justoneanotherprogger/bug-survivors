import { TAU } from '../../core/utils.js';
import { rr, eyePair } from './kit.js';

/* --- РЕВАРД 2013: автомат гатяпон — купол с шарами, тумба-лицо, рычаг --- */
export function gachaArt(g, wp, mv, t, ay) {
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
