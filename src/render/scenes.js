import { TAU } from '../core/utils.js';

export const cellH = (ix, iy, k) => Math.abs(Math.sin(ix * 127.1 + iy * 311.7 + (k || 0) * 74.7) * 43758.5) % 1;
export function pRack(g, x, y, h, t) {
  /* серверная стойка: мигающие LED-панели */
  const w = 96,
    d = 56;
  g.fillStyle = 'rgba(6,18,11,.88)';
  g.fillRect(x, y, w, d);
  g.strokeStyle = 'rgba(56,224,127,.33)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, d - 1);
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 5; i++) {
      const hh = cellH(i + 1, r + 1, h * 97);
      const on = Math.sin(t * 2.6 + hh * 43) > -0.25;
      g.globalAlpha = on ? 0.9 : 0.16;
      g.fillStyle = hh < 0.12 ? '#f87171' : hh < 0.3 ? '#fbbf24' : '#38e07f';
      g.fillRect(x + 11 + i * 16, y + 13 + r * 21, 4, 4);
    }
  g.globalAlpha = 0.45;
  g.strokeStyle = 'rgba(56,224,127,.2)';
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    g.moveTo(x + 11, y + 43 + i * 3.5);
    g.lineTo(x + w - 11, y + 43 + i * 3.5);
  }
  g.stroke();
  g.globalAlpha = 1;
}
export function pVent(g, x, y) {
  /* вентиляционная плитка фальшпола */
  const s = 74;
  g.strokeStyle = 'rgba(56,224,127,.2)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, s, s);
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    g.moveTo(x + 9, y + 13 + i * 12);
    g.lineTo(x + s - 9, y + 13 + i * 12);
  }
  g.globalAlpha = 0.6;
  g.stroke();
  g.globalAlpha = 1;
}
export function pDesk(g, x, y, h, t) {
  /* ночной офис: стол, мониторы, кофе с паром */
  const w = 116,
    d = 66;
  g.fillStyle = 'rgba(15,11,30,.9)';
  g.fillRect(x, y, w, d);
  g.strokeStyle = 'rgba(167,139,250,.3)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, d - 1);
  for (let i = 0; i < 2; i++) {
    const mx = x + 13 + i * 44,
      my = y + 13;
    g.fillStyle = '#0b0918';
    g.fillRect(mx, my, 34, 24);
    g.fillStyle = 'rgba(167,139,250,' + (0.3 + 0.25 * Math.sin(t * 7 + h * 90 + i * 9)) + ')';
    g.fillRect(mx + 2, my + 2, 30, 17);
    g.fillStyle = 'rgba(167,139,250,.35)';
    g.fillRect(mx + 13, my + 27, 8, 4);
  }
  g.fillStyle = 'rgba(251,191,36,.55)';
  g.fillRect(x + w - 17, y + d - 15, 6, 6);
  g.strokeStyle = 'rgba(251,191,36,.28)';
  g.beginPath();
  const sm = Math.sin(t * 3 + h * 50);
  g.moveTo(x + w - 14, y + d - 17);
  g.quadraticCurveTo(x + w - 14 + sm * 2.5, y + d - 24, x + w - 14 - sm * 1.5, y + d - 30);
  g.stroke();
}
export function pMoon(g, w) {
  /* луна — далёкий объект, рисуется в экранных координатах */
  const mx = w - 140,
    my = 108;
  g.globalAlpha = 0.12;
  g.fillStyle = '#cfd8ff';
  g.beginPath();
  g.arc(mx, my, 62, 0, TAU);
  g.fill();
  g.globalAlpha = 0.16;
  g.beginPath();
  g.arc(mx - 18, my - 14, 10, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(mx + 15, my + 16, 7, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(mx + 24, my - 22, 4.5, 0, TAU);
  g.fill();
  g.globalAlpha = 1;
}
export function pTape(g, x, y, h, t) {
  /* ленточный привод мейнфрейма: бобины вращаются */
  const w = 94,
    d = 64;
  g.fillStyle = 'rgba(24,16,6,.88)';
  g.fillRect(x, y, w, d);
  g.strokeStyle = 'rgba(251,191,36,.38)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, d - 1);
  for (let i = 0; i < 2; i++) {
    const cx2 = x + 27 + i * 40,
      cy2 = y + 25,
      r = 14.5;
    g.strokeStyle = 'rgba(251,191,36,.5)';
    g.beginPath();
    g.arc(cx2, cy2, r, 0, TAU);
    g.stroke();
    const a0 = t * (i ? -1.4 : 1.9) + h * 9;
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = a0 + (k * TAU) / 3;
      g.moveTo(cx2, cy2);
      g.lineTo(cx2 + Math.cos(a) * r * 0.78, cy2 + Math.sin(a) * r * 0.78);
    }
    g.stroke();
    g.fillStyle = 'rgba(251,191,36,.55)';
    g.beginPath();
    g.arc(cx2, cy2, 2.4, 0, TAU);
    g.fill();
  }
  g.strokeStyle = 'rgba(251,191,36,.28)';
  g.beginPath();
  g.moveTo(x + 9, y + d - 11);
  g.lineTo(x + w - 9, y + d - 11);
  g.stroke();
}
export function pCard(g, x, y, h) {
  /* перфокарта на полу (иногда повёрнута) */
  const w = 58,
    d = 34,
    rot = cellH(3, 7, h * 31) < 0.5 ? 0 : Math.PI / 2;
  g.save();
  g.translate(x + w / 2, y + d / 2);
  g.rotate(rot);
  g.strokeStyle = 'rgba(251,191,36,.3)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-w / 2 + 9, -d / 2);
  g.lineTo(w / 2, -d / 2);
  g.lineTo(w / 2, d / 2);
  g.lineTo(-w / 2, d / 2);
  g.closePath();
  g.stroke();
  g.fillStyle = 'rgba(251,191,36,.32)';
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 8; i++) {
      if (cellH(i, r, h * 57) < 0.35) continue;
      g.fillRect(-w / 2 + 8 + i * 5.4, -d / 2 + 7 + r * 8, 2, 2);
    }
  g.restore();
}
export function pStars(g, w, h, t, ox, oy) {
  /* звёзды; ox/oy — мировой сдвиг камеры (в превью 0,0) */
  ox = ox || 0;
  oy = oy || 0;
  const ps = 90;
  const cx0 = Math.floor(-ox / ps),
    cx1 = Math.floor((w - ox) / ps);
  const cy0 = Math.floor(-oy / ps),
    cy1 = Math.floor((h - oy) / ps);
  for (let ix = cx0; ix <= cx1; ix++)
    for (let iy = cy0; iy <= cy1; iy++) {
      const hh = cellH(ix, iy, 5);
      if (hh >= 0.34) continue;
      const px = ix * ps + ((hh * 13) % 1) * ps + ox,
        py = iy * ps + ((hh * 29) % 1) * ps + oy;
      if (px < -2 || px > w + 2 || py < -2 || py > h + 2) continue;
      g.globalAlpha = 0.22 + 0.3 * Math.abs(Math.sin(t * 2 + hh * 40));
      g.fillStyle = hh < 0.08 ? '#f87171' : '#cfd8ff';
      g.fillRect(px, py, 1.6, 1.6);
    }
  g.globalAlpha = 1;
}
export function pScan(g, w, h, t) {
  /* сканлайны CRT */
  g.globalAlpha = 0.05;
  g.fillStyle = '#fbbf24';
  for (let y = ((t * 14) % 6) - 6; y < h; y += 6) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
}
