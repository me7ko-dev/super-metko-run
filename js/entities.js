'use strict';
// Физика, играч, врагове и взаимодействия.
const GRAV = 2200, JUMP_V = 720, RUN = 230, MAX_FALL = 900;
const SMALL_H = 30, BIG_H = 58;

function tileAt(L, c, r) {
  if (c < 0) return GRD;
  if (c >= L.cols || r < 0 || r >= ROWS) return EMPTY;
  return L.grid[r * L.cols + c];
}
const solidAt = (L, c, r) => isSolid(tileAt(L, c, r));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Движение с колизии по оси X, после по Y. Връща в какво се е ударило тялото.
function moveBody(L, b, dt) {
  const res = { wall: 0, ceil: null, ground: false };
  b.x += b.vx * dt;
  let r0 = Math.floor(b.y / T), r1 = Math.floor((b.y + b.h - 1) / T);
  if (b.vx > 0) {
    const c = Math.floor((b.x + b.w - 1) / T);
    for (let r = r0; r <= r1; r++) if (solidAt(L, c, r)) { b.x = c * T - b.w; res.wall = 1; break; }
  } else if (b.vx < 0) {
    const c = Math.floor(b.x / T);
    for (let r = r0; r <= r1; r++) if (solidAt(L, c, r)) { b.x = (c + 1) * T; res.wall = -1; break; }
  }
  b.y += b.vy * dt;
  const c0 = Math.floor(b.x / T), c1 = Math.floor((b.x + b.w - 1) / T);
  if (b.vy > 0) {
    const r = Math.floor((b.y + b.h - 1) / T);
    for (let c = c0; c <= c1; c++) if (solidAt(L, c, r)) { b.y = r * T - b.h; b.vy = 0; res.ground = true; break; }
  } else if (b.vy < 0) {
    const r = Math.floor(b.y / T), mid = b.x + b.w / 2;
    let best = null, bd = 1e9;
    for (let c = c0; c <= c1; c++) {
      if (!solidAt(L, c, r)) continue;
      const d = Math.abs((c + 0.5) * T - mid);
      if (d < bd) { bd = d; best = [c, r]; }
    }
    if (best) { b.y = (best[1] + 1) * T; b.vy = 0; res.ceil = best; }
  }
  return res;
}

function makePlayer(x) {
  return { x, y: GROUND * T - SMALL_H, w: 22, h: SMALL_H, vx: RUN * 0.6, vy: 0, big: false, onGround: true,
           coyote: 0, jumpBuf: 0, jumpT: 0, jumping: false, inv: 0, runT: 0, dead: false, hidden: false };
}

function makeEntity(s) {
  switch (s.type) {
    case 'walker': return { type: 'walker', x: s.x + 2, y: GROUND * T - 28, w: 28, h: 28, vx: -60, vy: 0 };
    case 'spiky': return { type: 'spiky', x: s.x + 2, y: GROUND * T - 26, w: 28, h: 26, vx: -40, vy: 0 };
    case 'flyer': return { type: 'flyer', x: s.x, y: s.y, baseY: s.y, w: 30, h: 24, vx: -70, vy: 0, t: 0 };
    case 'plant': return { type: 'plant', x: s.x - 12, y: s.y, pipeTop: s.y, w: 24, h: 40, vx: 0, vy: 0, t: 0, o: 0 };
    case 'checkpoint': return { type: 'checkpoint', x: s.x, y: GROUND * T - 3 * T, w: 8, h: 3 * T, reached: false };
  }
  return null;
}

function addScore(G, n, x, y) {
  G.score += n;
  if (x !== undefined) G.fx.push({ type: 'text', text: String(n), x, y, t: 0 });
}

function addCoin(G) {
  G.coins++;
  G.score += 200;
  Sound.sfx.coin();
  if (G.coins >= 100) { G.coins -= 100; oneUp(G); }
}

function oneUp(G) {
  G.lives = Math.min(9, G.lives + 1);
  Sound.sfx.oneup();
  G.fx.push({ type: 'text', text: '1UP', x: G.p.x, y: G.p.y - 20, t: 0, color: '#7CFC7C' });
}

function setGrow(p, big) {
  if (p.big === big) return;
  p.big = big;
  const nh = big ? BIG_H : SMALL_H;
  p.y += p.h - nh;
  p.h = nh;
}

function hurt(G) {
  const p = G.p;
  if (p.inv > 0 || p.dead) return;
  if (p.big) { setGrow(p, false); p.inv = 2; Sound.sfx.hurt(); }
  else die(G, false);
}

function bumpBlock(G, c, r) {
  const L = G.L, t = tileAt(L, c, r);
  G.bumps.push({ c, r, t: 0 });
  if (t === QCOIN) {
    L.grid[r * L.cols + c] = USED;
    addCoin(G);
    G.fx.push({ type: 'coinpop', x: c * T + 16, y: r * T - 8, vy: -520, t: 0 });
  } else if (t === QMUSH) {
    L.grid[r * L.cols + c] = USED;
    G.ents.push({ type: 'mushroom', x: c * T + 4, y: r * T, w: 24, h: 24, vx: 100, vy: 0, rise: 26, active: true });
    Sound.sfx.sprout();
  } else if (t === BRICK && G.p.big) {
    L.grid[r * L.cols + c] = EMPTY;
    for (let i = 0; i < 4; i++) G.fx.push({ type: 'frag', x: c * T + 8 + (i % 2) * 16, y: r * T + 8 + (i >> 1) * 16,
      vx: (i % 2 ? 1 : -1) * 140, vy: -520 + (i >> 1) * 180, t: 0, color: L.theme.brick });
    addScore(G, 50);
    Sound.sfx.brick();
  } else Sound.sfx.bump();
  // Враговете отгоре на блока отлитат.
  const above = { x: c * T, y: (r - 1) * T, w: T, h: T };
  for (const e of G.ents) {
    if (!e.dead && (e.type === 'walker' || e.type === 'spiky') && overlap(e, above)) {
      e.dead = true; e.flip = true; e.vy = -420; e.vx = 60;
      addScore(G, 200, e.x, e.y);
    }
  }
}

function updatePlayer(G, dt, input) {
  const p = G.p, L = G.L;
  p.vx = Math.min(RUN, p.vx + 900 * dt);
  if (input.pressed) { p.jumpBuf = 0.13; input.pressed = false; }
  p.jumpBuf -= dt;
  p.coyote = p.onGround ? 0.09 : p.coyote - dt;
  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = -JUMP_V; p.jumping = true; p.jumpT = 0; p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
    Sound.sfx.jump();
  }
  let g = GRAV;
  if (p.jumping) {
    p.jumpT += dt;
    if (input.held && p.jumpT < 0.28 && p.vy < 0) g *= 0.42;
    else if (!input.held && p.vy < -280) p.vy = -280;
    if (p.vy >= 0) p.jumping = false;
  }
  p.vy = Math.min(MAX_FALL, p.vy + g * dt);
  const res = moveBody(L, p, dt);
  p.onGround = res.ground;
  if (p.onGround) { p.runT += dt; G.combo = 0; }
  if (res.ceil) { bumpBlock(G, res.ceil[0], res.ceil[1]); p.jumping = false; }
  // Авто-прескачане на препятствие, високо 1 плочка (като в Super Mario Run).
  if (res.wall === 1 && p.onGround) {
    const c = Math.floor((p.x + p.w) / T), rFeet = Math.floor((p.y + p.h - 1) / T);
    if (!solidAt(L, c, rFeet - 1) && !(p.big && solidAt(L, c, rFeet - 2))) { p.vy = -500; p.onGround = false; }
  }
  if (p.inv > 0) p.inv -= dt;
  // Монети
  const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 1) / T);
  const r0 = Math.max(0, Math.floor(p.y / T)), r1 = Math.min(ROWS - 1, Math.floor((p.y + p.h - 1) / T));
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
    if (tileAt(L, c, r) === COIN) { L.grid[r * L.cols + c] = EMPTY; addCoin(G); }
  }
  if (p.y > ROWS * T + 40) die(G, true);
}

function updateEnemies(G, dt) {
  const L = G.L, p = G.p;
  for (const e of G.ents) {
    if (!e.active) { if (e.x < G.camX + VIEW_W + 8) e.active = true; else continue; }
    if (e.flip) { e.vy += GRAV * dt; e.y += e.vy * dt; e.x += e.vx * dt; if (e.y > VIEW_H + 80) e.gone = true; continue; }
    if (e.dead) { e.deadT = (e.deadT || 0.5) - dt; if (e.deadT <= 0) e.gone = true; continue; }
    switch (e.type) {
      case 'walker': case 'spiky': case 'mushroom': {
        if (e.rise > 0) { const d = 32 * dt; e.y -= d; e.rise -= d; break; }
        e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt);
        const res = moveBody(L, e, dt);
        if (res.wall) e.vx = -e.vx;
        if (e.y > VIEW_H + 80) e.gone = true;
        break;
      }
      case 'flyer':
        e.t += dt; e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.t * 3) * 36;
        break;
      case 'plant': {
        e.t += dt;
        const cyc = e.t % 4, near = Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < 90;
        let target = cyc < 1 ? 0 : cyc < 3 ? 1 : 0;
        if (near && e.o < 0.05) target = 0;
        e.o += Math.sign(target - e.o) * Math.min(Math.abs(target - e.o), dt * 1.8);
        e.y = e.pipeTop - e.o * e.h;
        break;
      }
    }
    if (e.x < G.camX - 200) e.gone = true;
  }
  G.ents = G.ents.filter(e => !e.gone);
}

function playerVsEnemies(G, input) {
  const p = G.p;
  for (const e of G.ents) {
    if (!e.active || e.dead || p.dead) continue;
    if (e.type === 'checkpoint') {
      if (!e.reached && p.x > e.x) { e.reached = true; G.checkpoint = true; Sound.sfx.check(); }
      continue;
    }
    if (e.type === 'plant') {
      if (e.o > 0.2 && overlap(p, { x: e.x + 3, y: e.y + 2, w: e.w - 6, h: e.pipeTop - e.y })) hurt(G);
      continue;
    }
    if (!overlap(p, e)) continue;
    if (e.type === 'mushroom') {
      if (e.rise > 0) continue;
      e.gone = true;
      if (!p.big) setGrow(p, true);
      addScore(G, 1000, e.x, e.y);
      Sound.sfx.power();
      continue;
    }
    const fromAbove = p.vy > 0 && p.y + p.h - e.y < 18;
    if (fromAbove && e.type !== 'spiky') {
      e.dead = true; e.deadT = 0.5;
      if (e.type === 'flyer') { e.flip = true; e.vy = 0; e.vx = 0; }
      p.vy = input.held ? -660 : -430; p.jumping = input.held; p.jumpT = 0.2;
      G.combo++;
      addScore(G, 100 * Math.min(8, G.combo), e.x, e.y - 10);
      Sound.sfx.stomp();
    } else if (e.type === 'walker') {
      if (p.vy >= 0) { p.vy = -520; p.onGround = false; } // авто-прескачане на Кестенко
    } else hurt(G);
  }
}

function updateFx(G, dt) {
  for (const f of G.fx) {
    f.t += dt;
    if (f.type === 'text') f.y -= 40 * dt;
    else if (f.type === 'coinpop') { f.vy += GRAV * dt; f.y += f.vy * dt; if (f.t > 0.45) { f.gone = true; G.fx.push({ type: 'text', text: '200', x: f.x - 10, y: f.y, t: 0 }); } }
    else if (f.type === 'frag' || f.type === 'spark') { f.vy += (f.type === 'frag' ? GRAV : 300) * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    if (f.t > (f.type === 'spark' ? 1.4 : 0.9)) f.gone = true;
  }
  G.fx = G.fx.filter(f => !f.gone);
  for (const b of G.bumps) b.t += dt;
  G.bumps = G.bumps.filter(b => b.t < 0.16);
}
