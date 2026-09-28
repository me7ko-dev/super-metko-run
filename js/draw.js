'use strict';
// Цялата графика е процедурна пиксел-графика — без картинки.

function tileCanvas(fn) {
  const c = document.createElement('canvas');
  c.width = c.height = T;
  fn(c.getContext('2d'));
  return c;
}

function bevel(g, base, light, dark) {
  g.fillStyle = base; g.fillRect(0, 0, T, T);
  g.fillStyle = light; g.fillRect(0, 0, T, 3); g.fillRect(0, 0, 3, T);
  g.fillStyle = dark; g.fillRect(0, T - 3, T, 3); g.fillRect(T - 3, 0, 3, T);
}

function rivets(g, color) {
  g.fillStyle = color;
  [[4, 4], [T - 7, 4], [4, T - 7], [T - 7, T - 7]].forEach(([x, y]) => g.fillRect(x, y, 3, 3));
}

function drawGround(g, th) {
  g.fillStyle = th.ground; g.fillRect(0, 0, T, T);
  g.fillStyle = th.groundDark;
  g.fillRect(0, 15, T, 2); g.fillRect(0, 31, T, 1);
  g.fillRect(15, 0, 2, 15); g.fillRect(6, 17, 2, 14); g.fillRect(24, 17, 2, 14);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, T, 2);
}

function drawPipe(g, part) {
  const dark = '#0c4a14', mid = '#2aa83a', light = '#8ef07a';
  if (part === PIPE_TL || part === PIPE_TR) {
    g.fillStyle = dark; g.fillRect(0, 0, T, T);
    g.fillStyle = mid; g.fillRect(part === PIPE_TL ? 2 : 0, 2, T - 2, T - 4);
    if (part === PIPE_TL) { g.fillStyle = light; g.fillRect(6, 4, 5, T - 8); }
    else { g.fillStyle = dark; g.fillRect(T - 8, 4, 4, T - 8); }
  } else {
    const x0 = part === PIPE_L ? 4 : 0, w = T - 4;
    g.fillStyle = dark; g.fillRect(x0, 0, w, T);
    g.fillStyle = mid; g.fillRect(part === PIPE_L ? 6 : 0, 0, w - 2, T);
    if (part === PIPE_L) { g.fillStyle = light; g.fillRect(10, 0, 5, T); }
    else { g.fillStyle = dark; g.fillRect(T - 12, 0, 4, T); }
  }
}

function buildTileCache(th) {
  const k = {};
  k[GRD] = tileCanvas(g => drawGround(g, th));
  k.grass = tileCanvas(g => {
    drawGround(g, th);
    g.fillStyle = th.grass || th.ground; g.fillRect(0, 0, T, 8);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 8, T, 2);
    g.fillStyle = th.grass || th.ground;
    for (let x = 0; x < T; x += 6) g.fillRect(x + 2, 8, 3, 3);
  });
  k[BRICK] = tileCanvas(g => {
    g.fillStyle = th.brick; g.fillRect(0, 0, T, T);
    g.fillStyle = th.brickDark;
    for (let r = 0; r < 4; r++) {
      g.fillRect(0, r * 8 + 7, T, 1);
      const off = r % 2 ? 8 : 0;
      for (let x = off; x < T; x += 16) g.fillRect(x, r * 8, 1, 7);
    }
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 0, T, 2);
  });
  k[QCOIN] = k[QMUSH] = tileCanvas(g => {
    bevel(g, '#f8b800', '#ffe070', '#a05800');
    rivets(g, '#a05800');
    g.font = 'bold 22px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#a05800'; g.fillText('?', 18, 18);
    g.fillStyle = '#fff'; g.fillText('?', 16, 16);
  });
  k[USED] = tileCanvas(g => { bevel(g, '#8a5a2a', '#a8784a', '#4a2a0a'); rivets(g, '#4a2a0a'); });
  k[HARD] = tileCanvas(g => {
    bevel(g, th.hard, 'rgba(255,255,255,.45)', 'rgba(0,0,0,.45)');
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(8, 8, T - 16, T - 16);
  });
  [PIPE_TL, PIPE_TR, PIPE_L, PIPE_R].forEach(p => { k[p] = tileCanvas(g => drawPipe(g, p)); });
  return k;
}

function drawCoin(g, cx, cy, t, phase = 0) {
  const w = Math.max(2, Math.abs(Math.cos(t * 5 + phase)) * 10);
  g.fillStyle = '#a05800';
  g.beginPath(); g.ellipse(cx + 1, cy + 1, w, 13, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd23f';
  g.beginPath(); g.ellipse(cx, cy, w, 13, 0, 0, Math.PI * 2); g.fill();
  if (w > 5) { g.fillStyle = '#fff6b0'; g.fillRect(cx - 2, cy - 7, 3, 12); }
}

function repeatLayer(camX, factor, period, fn) {
  const off = camX * factor, k0 = Math.floor(off / period) - 1, k1 = k0 + Math.ceil(VIEW_W / period) + 2;
  for (let k = k0; k <= k1; k++) fn(k * period - off, k);
}

function drawBackground(g, th, camX, t) {
  const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, th.sky[0]); grd.addColorStop(1, th.sky[1]);
  g.fillStyle = grd; g.fillRect(0, 0, VIEW_W, VIEW_H);
  const base = GROUND * T;

  if (th.stars) {
    g.fillStyle = '#fff';
    for (let i = 0; i < 80; i++) {
      const x = (((i * 137.5 - camX * 0.05) % VIEW_W) + VIEW_W) % VIEW_W, y = (i * 71) % 320;
      g.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + i));
      g.fillRect(x, y, 2, 2);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#fff8d0'; g.beginPath(); g.arc(800, 100, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = th.sky[0]; g.beginPath(); g.arc(786, 90, 30, 0, Math.PI * 2); g.fill();
  }
  if (th.sun) {
    g.fillStyle = 'rgba(255,240,180,.9)'; g.beginPath(); g.arc(720, 330, 70, 0, Math.PI * 2); g.fill();
  }
  if (th.cave) {
    repeatLayer(camX, 0.3, 90, (x, k) => {
      g.fillStyle = '#23234e';
      const h = 40 + ((k * 53) % 70);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 45, 0); g.lineTo(x + 22, h); g.fill();
    });
  }
  repeatLayer(camX, 0.15, 460, (x, k) => {
    g.fillStyle = th.hills2;
    const r = 150 + ((k * 37) % 60);
    g.beginPath(); g.arc(x + 200, base, r, Math.PI, 0); g.fill();
  });
  repeatLayer(camX, 0.35, 560, (x, k) => {
    g.fillStyle = th.hills;
    const r = 90 + ((k * 29) % 40);
    g.beginPath(); g.arc(x + 120, base, r, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(0,0,0,.15)';
    g.fillRect(x + 100, base - r * 0.6, 6, 14); g.fillRect(x + 140, base - r * 0.4, 6, 14);
  });
  if (th.clouds) {
    repeatLayer(camX, 0.25, 380, (x, k) => {
      const y = 70 + ((k * 47) % 3) * 45;
      g.fillStyle = 'rgba(255,255,255,.95)';
      [[0, 10, 22], [24, 0, 28], [52, 10, 22], [26, 16, 24]].forEach(([dx, dy, r]) => {
        g.beginPath(); g.arc(x + 40 + dx, y + dy, r, 0, Math.PI * 2); g.fill();
      });
    });
  }
}

function drawTiles(g, L, cache, camX, bumps, t) {
  const c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(L.cols - 1, Math.floor((camX + VIEW_W) / T) + 1);
  for (let c = c0; c <= c1; c++) {
    for (let r = 0; r < ROWS; r++) {
      const id = L.grid[r * L.cols + c];
      if (!id) continue;
      const x = c * T;
      let y = r * T;
      for (const b of bumps) if (b.c === c && b.r === r) y -= Math.sin(Math.min(1, b.t / 0.16) * Math.PI) * 10;
      if (id === COIN) { drawCoin(g, x + 16, y + 16, t, c * 0.3); continue; }
      if (id === GRD && L.theme.grass && (r === 0 || L.grid[(r - 1) * L.cols + c] !== GRD)) g.drawImage(cache.grass, x, y);
      else g.drawImage(cache[id], x, y);
    }
  }
}

// Метко: червена шапка, жълта блуза, дънки.
function drawPlayer(g, p, t) {
  if (p.inv > 0 && !p.dead && Math.floor(t * 20) % 2 === 0) return;
  const x = Math.round(p.x) - 3, y = Math.round(p.y), big = p.big;
  const capH = big ? 8 : 6, faceH = big ? 12 : 9, torsoH = big ? 20 : 9, legH = p.h - capH - faceH - torsoH;
  let yy = y;
  g.fillStyle = '#d8261e'; g.fillRect(x + 5, yy, 17, capH); g.fillRect(x + 14, yy + capH - 3, 13, 3);
  g.fillStyle = '#ff6a50'; g.fillRect(x + 8, yy + 1, 8, 2);
  yy += capH;
  g.fillStyle = '#ffcc99'; g.fillRect(x + 6, yy, 18, faceH);
  g.fillStyle = '#5a2e10'; g.fillRect(x + 4, yy, 6, faceH - 2);
  g.fillStyle = '#111';
  if (p.dead) { g.fillRect(x + 16, yy + 3, 4, 1); g.fillRect(x + 16, yy + 5, 4, 1); }
  else g.fillRect(x + 17, yy + 2, 3, big ? 5 : 4);
  g.fillStyle = '#f09070'; g.fillRect(x + 23, yy + (faceH >> 1), 3, 3);
  g.fillStyle = '#8a2a1a'; g.fillRect(x + 16, yy + faceH - 3, 6, 2);
  yy += faceH;
  const run = p.onGround && !p.dead ? Math.floor(p.runT * 14) % 4 : -1;
  const swing = run === 1 ? 3 : run === 3 ? -3 : 0;
  g.fillStyle = '#ffd23f'; g.fillRect(x + 5, yy, 19, torsoH);
  g.fillStyle = '#ffcc99';
  if (run < 0) { g.fillRect(x + 22, yy - 5, 5, 5); g.fillRect(x + 1, yy + 2, 5, 5); }
  else { g.fillRect(x + 11 + swing, yy + (torsoH >> 1), 5, 5); }
  g.fillStyle = '#2e5fd8'; g.fillRect(x + 6, yy + Math.floor(torsoH * 0.5), 17, torsoH - Math.floor(torsoH * 0.5));
  g.fillStyle = '#ffd23f'; g.fillRect(x + 9, yy + Math.floor(torsoH * 0.55), 2, 2); g.fillRect(x + 18, yy + Math.floor(torsoH * 0.55), 2, 2);
  yy += torsoH;
  let lx = 7, rx = 16;
  if (run === 1) { lx = 11; rx = 13; } else if (run === 3) { lx = 4; rx = 19; } else if (run < 0) { lx = 3; rx = 19; }
  g.fillStyle = '#2e5fd8'; g.fillRect(x + lx, yy, 7, legH - 3); g.fillRect(x + rx, yy, 7, legH - 3);
  g.fillStyle = '#5a2a0a'; g.fillRect(x + lx - 1, yy + legH - 3, 9, 3); g.fillRect(x + rx, yy + legH - 3, 9, 3);
}

function drawEnemy(g, e, t) {
  const x = Math.round(e.x), y = Math.round(e.y), f = Math.floor(t * 8) % 2;
  if (e.flip) { g.save(); g.translate(x + e.w / 2, y + e.h / 2); g.scale(1, -1); g.translate(-x - e.w / 2, -y - e.h / 2); }
  switch (e.type) {
    case 'walker': // Кестенко
      if (e.dead && !e.flip) { g.fillStyle = '#8a4a1a'; g.fillRect(x, y + e.h - 9, e.w, 9); g.fillStyle = '#fff'; g.fillRect(x + 7, y + e.h - 7, 4, 2); g.fillRect(x + 17, y + e.h - 7, 4, 2); break; }
      g.fillStyle = '#9a5220'; g.beginPath(); g.ellipse(x + 14, y + 14, 15, 14, 0, Math.PI, 0); g.fill();
      g.fillRect(x - 1, y + 13, 30, 7);
      g.fillStyle = '#f0c890'; g.fillRect(x + 6, y + 18, 16, 6);
      g.fillStyle = '#fff'; g.fillRect(x + 6, y + 8, 6, 7); g.fillRect(x + 16, y + 8, 6, 7);
      g.fillStyle = '#111'; g.fillRect(x + 8, y + 10, 3, 5); g.fillRect(x + 17, y + 10, 3, 5);
      g.fillRect(x + 5, y + 6, 8, 2); g.fillRect(x + 15, y + 6, 8, 2);
      g.fillStyle = '#2a1206'; g.fillRect(x + (f ? 1 : 4), y + 24, 10, 4); g.fillRect(x + (f ? 17 : 14), y + 24, 10, 4);
      break;
    case 'spiky': // Бодливко
      g.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + 2 + i * 7, y + 10); g.lineTo(x + 5 + i * 7, y); g.lineTo(x + 9 + i * 7, y + 10); g.fill(); }
      g.fillStyle = '#d83020'; g.beginPath(); g.ellipse(x + 14, y + 16, 15, 11, 0, Math.PI, 0); g.fill();
      g.fillRect(x - 1, y + 15, 30, 6);
      g.fillStyle = '#ffd0a0'; g.fillRect(x + (e.vx < 0 ? 0 : 20), y + 12, 8, 8);
      g.fillStyle = '#111'; g.fillRect(x + (e.vx < 0 ? 2 : 24), y + 14, 2, 3);
      g.fillStyle = '#7a1a10'; g.fillRect(x + (f ? 2 : 5), y + 21, 9, 5); g.fillRect(x + (f ? 17 : 14), y + 21, 9, 5);
      break;
    case 'flyer': { // Бръмчо
      const wing = Math.sin(t * 30) * 6;
      g.fillStyle = 'rgba(255,255,255,.8)';
      g.beginPath(); g.ellipse(x + 12, y + 2 - wing * 0.3, 7, 5 + Math.abs(wing) * 0.4, -0.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + 20, y + 2 + wing * 0.3, 7, 5, 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffcf1a'; g.beginPath(); g.ellipse(x + 15, y + 14, 15, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#222'; g.fillRect(x + 12, y + 5, 4, 18); g.fillRect(x + 20, y + 6, 4, 16);
      g.beginPath(); g.moveTo(x + 29, y + 13); g.lineTo(x + 35, y + 15); g.lineTo(x + 29, y + 17); g.fill();
      g.fillStyle = '#fff'; g.fillRect(x + 2, y + 9, 6, 6); g.fillStyle = '#111'; g.fillRect(x + 3, y + 11, 3, 3);
      break;
    }
    case 'plant': { // Хапльо
      const open = Math.abs(Math.sin(t * 6)) * 8;
      g.fillStyle = '#1e8a2a'; g.fillRect(x + 10, y + 22, 5, e.h - 22);
      g.fillStyle = '#3cc04a';
      g.beginPath(); g.ellipse(x + 5, y + 30, 7, 3, 0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + 20, y + 32, 7, 3, -0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d82a20';
      g.beginPath(); g.arc(x + 12, y + 10 - open / 2, 12, Math.PI, 0); g.fill();
      g.beginPath(); g.arc(x + 12, y + 12 + open / 2, 12, 0, Math.PI); g.fill();
      g.fillStyle = '#fff';
      g.fillRect(x + 5, y + 2 - open / 2, 3, 3); g.fillRect(x + 15, y - open / 2, 3, 3); g.fillRect(x + 9, y + 17 + open / 2, 3, 3);
      g.fillRect(x + 2, y + 10 - open / 2, 20, 2); g.fillRect(x + 2, y + 12 + open / 2, 20, 2);
      break;
    }
    case 'mushroom': // Силогъбка
      g.fillStyle = '#f0e0c0'; g.fillRect(x + 5, y + 11, 14, 13);
      g.fillStyle = '#111'; g.fillRect(x + 8, y + 14, 2, 4); g.fillRect(x + 14, y + 14, 2, 4);
      g.fillStyle = '#ff8a1a'; g.beginPath(); g.ellipse(x + 12, y + 12, 13, 12, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 12, y + 5, 3, 0, Math.PI * 2); g.arc(x + 4, y + 9, 2, 0, Math.PI * 2); g.arc(x + 20, y + 9, 2, 0, Math.PI * 2); g.fill();
      break;
  }
  if (e.flip) g.restore();
}

function drawFlagAndCastle(g, L, flagY, th) {
  const fx = L.flagX, top = (GROUND - 11) * T;
  g.fillStyle = '#c8c8c8'; g.fillRect(fx - 2, top, 4, (GROUND - 1) * T - top);
  g.fillStyle = '#3cc04a'; g.beginPath(); g.arc(fx, top, 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(fx - 2, flagY); g.lineTo(fx - 34, flagY + 13); g.lineTo(fx - 2, flagY + 26); g.fill();
  g.fillStyle = '#d8261e'; g.beginPath(); g.arc(fx - 12, flagY + 13, 5, 0, Math.PI * 2); g.fill();

  const cx = L.castleX, by = GROUND * T;
  g.fillStyle = th.brick; g.fillRect(cx, by - 3 * T, 5 * T, 3 * T); g.fillRect(cx + T, by - 5 * T, 3 * T, 2 * T);
  g.fillStyle = th.brickDark;
  for (let yy = by - 5 * T; yy < by; yy += 12) g.fillRect(cx + (yy < by - 3 * T ? T : 0), yy, yy < by - 3 * T ? 3 * T : 5 * T, 2);
  for (let i = 0; i < 5; i++) { g.fillStyle = th.brick; g.fillRect(cx + i * T + 4, by - 3 * T - 14, 22, 14); }
  for (let i = 0; i < 3; i++) g.fillRect(cx + T + i * T + 4, by - 5 * T - 14, 22, 14);
  g.fillStyle = '#111';
  g.fillRect(cx + 2 * T, by - 1.6 * T, T, 1.6 * T); g.beginPath(); g.arc(cx + 2.5 * T, by - 1.6 * T, T / 2, Math.PI, 0); g.fill();
  g.fillRect(cx + 1.5 * T, by - 4.5 * T, 10, 20); g.fillRect(cx + 3.2 * T, by - 4.5 * T, 10, 20);
}

function drawCheckpoint(g, e, t) {
  const x = e.x + 12, top = GROUND * T - 3 * T;
  g.fillStyle = '#ddd'; g.fillRect(x, top, 4, 3 * T);
  g.fillStyle = e.reached ? '#3cc04a' : '#d8261e';
  const wave = Math.sin(t * 6) * 3;
  g.beginPath(); g.moveTo(x + 4, top + 2); g.lineTo(x + 30, top + 11 + wave); g.lineTo(x + 4, top + 22); g.fill();
}
