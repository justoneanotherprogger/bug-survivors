import { TAU } from '../../core/utils.js';
import { rr, dia } from './kit.js';

export function dinoArt(g, wp, mv, t) {
  // ЛЕГАСИ: динозавр (вид сбоку)
  const stp = mv ? Math.sin(wp) * 2.8 : 0;
  const sw = Math.sin(t * 2.6) * 2;
  const leg = (x, y, fc) => {
    g.fillStyle = fc;
    g.beginPath();
    rr(g, x - 1.7, y, 3.4, 5.6, 1.5);
    g.fill();
    g.beginPath();
    g.ellipse(x + 0.5, y + 5.2, 2.1, 1.1, 0, 0, TAU);
    g.fill();
  };
  leg(-3 - stp, 4.4, '#b85c2e');
  leg(5.6 + stp, 4.4, '#b85c2e'); // дальние лапы
  g.fillStyle = '#e8794a'; // хвост
  g.beginPath();
  g.moveTo(-5, -4.6);
  g.quadraticCurveTo(-12, -4.4 + sw * 0.6, -16.6, -2 + sw);
  g.quadraticCurveTo(-11.6, 1.4 + sw * 0.6, -4.6, 3.9);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffd9b0';
  dia(g, -12.4, -2.8 + sw * 0.8, 1.5);
  dia(g, -15, -1.8 + sw, 1.15); // шипы на хвосте
  g.fillStyle = '#e8794a'; // тело
  g.beginPath();
  g.ellipse(-0.4, 0, 9.9, 7.3, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#f2b98a'; // брюхо
  g.beginPath();
  g.ellipse(0.8, 2.4, 6.6, 3.7, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#ffd9b0'; // шипы на спине
  dia(g, -6.4, -5.7, 1.7);
  dia(g, -2.7, -6.8, 1.9);
  dia(g, 1.2, -6.5, 1.8);
  dia(g, 4.2, -5.1, 1.5);
  leg(0.6 + stp, 4.9, '#e8794a');
  leg(8 - stp, 4.9, '#e8794a'); // ближние лапы
  g.fillStyle = '#c96a38';
  g.beginPath();
  g.arc(6, 0.6, 1.7, 0, TAU);
  g.fill(); // ручка
  g.fillStyle = '#e8794a'; // голова
  g.beginPath();
  g.arc(9.4, -3.2, 5, 0, TAU);
  g.fill();
  g.beginPath();
  rr(g, 11.6, -4.6, 6.4, 4.8, 2.1);
  g.fill();
  g.fillStyle = '#f2a97e'; // челюсть
  g.beginPath();
  rr(g, 12.2, -2.4, 5.4, 2.4, 1.1);
  g.fill();
  g.fillStyle = '#8a4526';
  g.beginPath();
  g.arc(16.9, -3.6, 0.6, 0, TAU);
  g.fill(); // ноздря
  g.strokeStyle = '#8a4526';
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(12.6, -0.4);
  g.lineTo(16.9, -1);
  g.stroke(); // рот
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(10, -4.6, 2, 0, TAU);
  g.fill(); // глаз
  g.fillStyle = '#10150f';
  g.beginPath();
  g.arc(10.7, -4.6, 1.05, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.beginPath();
  g.arc(11, -5.1, 0.4, 0, TAU);
  g.fill();
}
