import { STAGES } from '../data/stages.js';
import { pRack, pVent, pDesk, pMoon, pTape, pCard, pStars, pScan } from './scenes.js';

const STAGE_ART = {};

export function stageArtURL(id) {
  if (!STAGE_ART[id]) {
    const st = STAGES.find(s => s.id === id);
    const c = document.createElement('canvas');
    c.width = 464;
    c.height = 240;
    const g = c.getContext('2d');
    g.fillStyle = st.bg;
    g.fillRect(0, 0, 464, 240);
    g.strokeStyle = st.grid;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 28; x < 464; x += 56) {
      g.moveTo(x, 0);
      g.lineTo(x, 240);
    }
    for (let y = 16; y < 240; y += 56) {
      g.moveTo(0, y);
      g.lineTo(464, y);
    }
    g.stroke();
    const rg = g.createRadialGradient(232, 120, 30, 232, 120, 330);
    rg.addColorStop(0, 'rgba(' + st.glowRGB + ',0.14)');
    rg.addColorStop(1, 'rgba(' + st.glowRGB + ',0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 464, 240);
    const t = 2.4;
    if (st.decor === 'server') {
      pRack(g, 44, 42, 0.15, t);
      pRack(g, 268, 122, 0.4, t);
      pVent(g, 168, 58);
      pVent(g, 356, 36);
    } else if (st.decor === 'night') {
      pMoon(g, 464);
      pStars(g, 464, 240, t, 0, 0);
      pDesk(g, 48, 118, 0.2, t);
      pDesk(g, 288, 36, 0.55, t);
    } else if (st.decor === 'mainframe') {
      pTape(g, 48, 40, 0.2, t);
      pTape(g, 282, 118, 0.5, t);
      pCard(g, 186, 54, 0.3);
      pCard(g, 368, 42, 0.75);
      pScan(g, 464, 240, t);
    }
    STAGE_ART[id] = c.toDataURL('image/png');
  }
  return STAGE_ART[id];
}
