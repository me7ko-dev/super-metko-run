'use strict';
// Състояния, основен цикъл, HUD и управление.
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const input = { held: false, pressed: false, kLeft: false, kRight: false, tLeft: false, tRight: false };

// Два режима: 'run' — тича сам (като Super Mario Run), 'classic' — ← → ходене напред и назад.
const BEST_KEY = { run: 'smr_best', classic: 'smr_best_classic' };
function loadBest(k) { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } }
function saveBest() {
  const m = G.mode;
  if (G.score > G.bests[m]) { G.bests[m] = G.score; try { localStorage.setItem(BEST_KEY[m], G.score); } catch (e) {} }
}

const G = { state: 'title', mode: 'run', sel: 'run', touch: false, levelIdx: 0, lives: 3, score: 0, coins: 0,
            bests: { run: loadBest(BEST_KEY.run), classic: loadBest(BEST_KEY.classic) }, t: 0, timer: 0,
            L: null, tiles: null, p: null, ents: [], fx: [], bumps: [], camX: 0, combo: 0, time: 0,
            checkpoint: false, flagY: 0, flagPhase: '', prev: 'play' };
window.__G = G;

function loadLevel(idx, fromCheckpoint) {
  const L = G.L = buildLevel(idx);
  G.tiles = buildTileCache(L.theme);
  G.ents = L.spawns.map(makeEntity).filter(Boolean);
  G.fx = []; G.bumps = []; G.combo = 0;
  const cp = fromCheckpoint && G.checkpoint;
  G.p = makePlayer(cp ? L.checkpointX + 8 : 3 * T, G.mode);
  if (cp) G.ents.forEach(e => { if (e.type === 'checkpoint') e.reached = true; if (e.x < L.checkpointX) e.gone = true; });
  G.ents = G.ents.filter(e => !e.gone);
  G.time = L.cfg.time + (G.mode === 'classic' ? 100 : 0);
  G.flagY = (GROUND - 11) * T + 10;
  updateCamera();
}

function updateCamera() {
  const lead = G.mode === 'classic' ? 420 : 260;
  G.camX = Math.max(0, Math.min(G.p.x - lead, G.L.cols * T - VIEW_W));
}

function startGame() {
  G.mode = G.sel;
  G.levelIdx = 0; G.lives = 3; G.score = 0; G.coins = 0; G.checkpoint = false;
  loadLevel(0, false);
  G.state = 'intro'; G.timer = 2.2;
}

function die(G, fell) {
  const p = G.p;
  if (p.dead) return;
  p.dead = true; p.inv = 0;
  setGrow(p, false);
  p.vy = fell ? 0 : -650; p.hidden = fell;
  G.state = 'dying'; G.timer = 2.8;
  Sound.stopMusic(); Sound.sfx.die();
}

function afterDeath() {
  G.lives--;
  if (G.lives <= 0) { saveBest(); G.state = 'gameover'; G.timer = 1; return; }
  loadLevel(G.levelIdx, true);
  G.state = 'intro'; G.timer = 2.2;
}

function reachFlag() {
  const p = G.p, L = G.L;
  G.state = 'flag'; G.flagPhase = 'slide';
  p.x = L.flagX - p.w - 1; p.vx = 0; p.vy = 0; p.jumping = false; p.facing = 1;
  const h = Math.max(0, (GROUND - 1) * T - (p.y + p.h));
  const bonus = h > 8 * T ? 5000 : h > 6 * T ? 2000 : h > 4 * T ? 800 : h > 2 * T ? 400 : 100;
  addScore(G, bonus, p.x + 30, p.y);
  Sound.stopMusic(); Sound.sfx.flag();
}

function updateFlag(dt) {
  const p = G.p, L = G.L, base = (GROUND - 1) * T;
  if (G.flagPhase === 'slide') {
    p.y = Math.min(base - p.h, p.y + 260 * dt);
    G.flagY = Math.min(base - 28, G.flagY + 260 * dt);
    if (p.y >= base - p.h && G.flagY >= base - 28) { G.flagPhase = 'walk'; p.x += 6; p.vx = 150; }
  } else if (G.flagPhase === 'walk') {
    p.vy = Math.min(MAX_FALL, p.vy + GRAV * dt);
    const r = moveBody(L, p, dt);
    p.onGround = r.ground; if (r.ground) p.runT += dt;
    if (p.x > L.castleX + 2 * T) { p.hidden = true; G.flagPhase = 'count'; G.timer = 0; }
  } else if (G.flagPhase === 'count') {
    G.timer -= dt;
    if (G.time > 0 && G.timer <= 0) {
      const n = Math.min(Math.ceil(G.time), 3);
      G.time = Math.max(0, Math.ceil(G.time) - n); G.score += n * 50; G.timer = 0.02; Sound.sfx.tick();
    } else if (G.time <= 0) {
      G.flagPhase = 'fireworks'; G.timer = 2.2;
      for (let i = 0; i < 3; i++) setTimeout(() => burst(L.castleX + 40 + Math.random() * 100, 120 + Math.random() * 120), i * 500);
    }
  } else {
    G.timer -= dt;
    if (G.timer <= 0) nextLevel();
  }
  updateCamera();
}

function burst(x, y) {
  const colors = ['#ff5a5a', '#ffd23f', '#7CFC7C', '#6ac8ff', '#ff8af0'];
  const col = colors[Math.floor(Math.random() * colors.length)];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, s = 140 + Math.random() * 80;
    G.fx.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, color: col });
  }
  Sound.sfx.brick();
}

function nextLevel() {
  G.levelIdx++; G.checkpoint = false;
  if (G.levelIdx >= LEVELS.length) {
    saveBest(); G.state = 'win'; G.timer = 1.2; G.fx = []; Sound.sfx.win();
    return;
  }
  loadLevel(G.levelIdx, false);
  G.state = 'intro'; G.timer = 2.2;
}

function update(dt) {
  G.t += dt;
  switch (G.state) {
    case 'title':
      G.camX = (G.t * 70) % (G.L.cols * T - VIEW_W);
      break;
    case 'intro':
      G.timer -= dt;
      if (G.timer <= 0) { G.state = 'play'; input.pressed = false; Sound.startMusic(); }
      break;
    case 'play': {
      G.time -= dt;
      if (G.time <= 0) { G.time = 0; die(G, false); break; }
      updatePlayer(G, dt, input);
      if (G.state !== 'play') break;
      updateEnemies(G, dt);
      playerVsEnemies(G, input);
      if (G.state === 'play' && G.p.x + G.p.w >= G.L.flagX - 2) reachFlag();
      updateCamera();
      break;
    }
    case 'dying':
      G.timer -= dt;
      if (G.timer < 2.3) { G.p.vy += GRAV * dt; G.p.y += G.p.vy * dt; }
      if (G.timer <= 0) afterDeath();
      break;
    case 'flag':
      updateFlag(dt);
      break;
    case 'win':
      G.timer -= dt;
      if (Math.random() < dt * 2.5) burst(120 + Math.random() * 720, 90 + Math.random() * 200);
      break;
    case 'gameover':
      G.timer -= dt;
      break;
  }
  if (G.state !== 'title' && G.state !== 'paused') updateFx(G, dt);
}

// ---------- Рисуване ----------
function txt(s, x, y, size = 16, color = '#fff', align = 'left') {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = align; ctx.textBaseline = 'top';
  ctx.fillStyle = '#000'; ctx.fillText(s, x + Math.max(2, size / 8), y + Math.max(2, size / 8));
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}

function renderWorld() {
  const L = G.L, camX = Math.round(G.camX);
  drawBackground(ctx, L.theme, camX, G.t);
  ctx.save();
  ctx.translate(-camX, 0);
  for (const e of G.ents) if (e.type === 'plant' && e.o > 0.01) drawEnemy(ctx, e, G.t);
  drawFlagAndCastle(ctx, L, G.flagY, L.theme);
  drawTiles(ctx, L, G.tiles, camX, G.bumps, G.t);
  for (const e of G.ents) {
    if (e.x > camX + VIEW_W + 40 || e.x + e.w < camX - 40) continue;
    if (e.type === 'checkpoint') drawCheckpoint(ctx, e, G.t);
    else if (e.type !== 'plant') drawEnemy(ctx, e, G.t);
  }
  if (!G.p.hidden) drawPlayer(ctx, G.p, G.t);
  drawFx();
  ctx.restore();
}

function drawFx() {
  for (const f of G.fx) {
    if (f.type === 'text') txt(f.text, f.x, f.y, 10, f.color || '#fff');
    else if (f.type === 'coinpop') drawCoin(ctx, f.x, f.y, G.t * 3);
    else { ctx.fillStyle = f.color; ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4); ctx.fillRect(f.x - 4, f.y - 4, f.type === 'frag' ? 10 : 5, f.type === 'frag' ? 10 : 5); ctx.globalAlpha = 1; }
  }
}

function drawHud() {
  const y = 14;
  txt('МЕТКО', 24, y, 14); txt('×' + Math.max(0, G.lives), 24, y + 22, 14);
  txt('ТОЧКИ', 190, y, 14); txt(String(G.score).padStart(7, '0'), 190, y + 22, 14);
  drawCoin(ctx, 400, y + 27, G.t, 0); txt('×' + String(G.coins).padStart(2, '0'), 416, y + 22, 14);
  txt('СВЯТ', 560, y, 14); txt(G.L.cfg.name, 560, y + 22, 14);
  txt('ВРЕМЕ', 760, y, 14);
  txt(String(Math.ceil(G.time)).padStart(3, '0'), 760, y + 22, 14, G.time < 30 && G.state === 'play' ? '#ff6a5a' : '#fff');
}

const MODE_BOX = { run: { x: 225, y: 240, w: 230, h: 80 }, classic: { x: 505, y: 240, w: 230, h: 80 } };

// Бутони на екрана за телефон в режим КЛАСИКА.
function drawTouchPad() {
  for (const [k, x] of [['left', 66], ['right', 196], ['jump', 885]]) {
    const on = k === 'left' ? input.tLeft : k === 'right' ? input.tRight : input.held;
    ctx.globalAlpha = on ? 0.55 : 0.28; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, 472, 48, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.75; ctx.fillStyle = '#000'; ctx.beginPath();
    if (k === 'left') { ctx.moveTo(x + 12, 452); ctx.lineTo(x - 16, 472); ctx.lineTo(x + 12, 492); }
    else if (k === 'right') { ctx.moveTo(x - 12, 452); ctx.lineTo(x + 16, 472); ctx.lineTo(x - 12, 492); }
    else { ctx.moveTo(x - 20, 486); ctx.lineTo(x, 456); ctx.lineTo(x + 20, 486); }
    ctx.fill(); ctx.globalAlpha = 1;
  }
}

function center(lines) {
  for (const [s, y, size, color] of lines) txt(s, VIEW_W / 2, y, size, color, 'center');
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const blink = Math.floor(G.t * 2.5) % 2 === 0;
  if (G.state === 'title') {
    renderWorld();
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    center([['СУПЕР МЕТКО', 56, 44, '#ffd23f'], ['РЪН', 116, 44, '#ff5a4a'], ['ИЗБЕРИ РЕЖИМ', 205, 12, '#ddd']]);
    for (const m of ['run', 'classic']) {
      const b = MODE_BOX[m], on = G.sel === m;
      ctx.fillStyle = on ? 'rgba(255,210,63,.25)' : 'rgba(0,0,0,.45)'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = on ? '#ffd23f' : '#888'; ctx.lineWidth = on ? 4 : 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
      txt(m === 'run' ? 'РЪН' : 'КЛАСИКА', b.x + b.w / 2, b.y + 16, 18, on ? '#ffd23f' : '#fff', 'center');
      txt(m === 'run' ? 'тича сам, ти скачаш' : 'ходиш напред и назад', b.x + b.w / 2, b.y + 50, 9, '#ddd', 'center');
    }
    center([[G.sel === 'run' ? 'SPACE / ↑ / тап = скок · задръж = по-високо' : 'СТРЕЛКИ / A D = ход · SPACE / ↑ = скок', 345, 10, '#ddd'],
            ['СТРЕЛКИ = избор на режим · M = звук · P = пауза', 367, 10, '#ddd'],
            [blink ? 'НАТИСНИ ЗА СТАРТ' : '', 405, 18],
            ['РЕКОРД ' + String(G.bests[G.sel]).padStart(7, '0'), 460, 12, '#ffd23f']]);
    return;
  }
  if (G.state === 'intro' || G.state === 'gameover' || G.state === 'win') {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (G.state === 'win') drawFx();
    drawHud();
    if (G.state === 'intro') {
      center([['СВЯТ ' + G.L.cfg.name, 190, 26], [G.L.cfg.title, 240, 14, '#ffd23f'], [G.mode === 'classic' ? 'РЕЖИМ КЛАСИКА' : 'РЕЖИМ РЪН', 150, 10, '#aaa']]);
      drawPlayer(ctx, { x: 420, y: 300, w: 22, h: SMALL_H, big: false, inv: 0, onGround: true, runT: 0 }, G.t);
      txt('×  ' + G.lives, 470, 310, 18);
      if (G.checkpoint) center([['от контролната точка', 380, 10, '#7CFC7C']]);
    } else if (G.state === 'gameover') {
      center([['КРАЙ НА ИГРАТА', 200, 30, '#ff5a4a'], ['ТОЧКИ ' + G.score, 270, 16],
              ['РЕКОРД ' + G.bests[G.mode], 305, 12, '#ffd23f'], [G.timer <= 0 && blink ? 'НАТИСНИ ЗА НОВ ОПИТ' : '', 380, 14]]);
    } else {
      center([['ПОБЕДА!', 170, 40, '#ffd23f'], ['Метко превзе всички светове!', 245, 14],
              ['ТОЧКИ ' + G.score, 290, 16], ['РЕКОРД ' + G.bests[G.mode], 325, 12, '#ffd23f'],
              [G.timer <= 0 && blink ? 'НАТИСНИ ЗА НОВА ИГРА' : '', 400, 14]]);
    }
    return;
  }
  renderWorld();
  drawHud();
  if (G.mode === 'classic' && G.touch && G.state !== 'dying') drawTouchPad();
  if (G.state === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    center([['ПАУЗА', 230, 30], ['P / Esc за продължаване', 290, 12, '#ddd']]);
  }
  if (Sound.isMuted()) txt('🔇', VIEW_W - 44, VIEW_H - 40, 18);
}

// ---------- Управление ----------
function press() {
  Sound.init();
  if (G.state === 'title') { startGame(); return; }
  if ((G.state === 'gameover' || G.state === 'win') && G.timer <= 0) { G.state = 'title'; G.fx = []; loadLevel(0, false); return; }
  if (G.state === 'paused') return;
  input.held = true; input.pressed = true;
}
function release() { input.held = false; }
function togglePause() {
  if (G.state === 'play') { G.prev = 'play'; G.state = 'paused'; Sound.stopMusic(); }
  else if (G.state === 'paused') { G.state = G.prev; Sound.startMusic(); }
}

const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyX', 'Enter'];
const LEFT_KEYS = ['ArrowLeft', 'KeyA'], RIGHT_KEYS = ['ArrowRight', 'KeyD'];
addEventListener('keydown', e => {
  if (JUMP_KEYS.includes(e.code)) { e.preventDefault(); if (!e.repeat) press(); }
  else if (LEFT_KEYS.includes(e.code) || RIGHT_KEYS.includes(e.code)) {
    e.preventDefault();
    const right = RIGHT_KEYS.includes(e.code);
    if (G.state === 'title') G.sel = right ? 'classic' : 'run';
    else if (right) input.kRight = true; else input.kLeft = true;
  }
  else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  else if (e.code === 'KeyM') { Sound.init(); Sound.toggleMute(); }
});
addEventListener('keyup', e => {
  if (JUMP_KEYS.includes(e.code)) release();
  else if (LEFT_KEYS.includes(e.code)) input.kLeft = false;
  else if (RIGHT_KEYS.includes(e.code)) input.kRight = false;
});

// Тъч: в режим КЛАСИКА левите зони са ◀ ▶, останалото е скок. Всеки пръст се следи отделно.
const pointers = new Map();
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * VIEW_W / r.width, y: (e.clientY - r.top) * VIEW_H / r.height };
}
function zone(pos) {
  if (G.mode === 'classic' && G.state !== 'title') { if (pos.x < 132) return 'left'; if (pos.x < 262) return 'right'; }
  return 'jump';
}
function titleHit(pos) {
  for (const m in MODE_BOX) {
    const b = MODE_BOX[m];
    if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) return m;
  }
  return null;
}
function refreshTouchDirs() {
  const z = [...pointers.values()];
  input.tLeft = z.includes('left'); input.tRight = z.includes('right');
  if (!z.includes('jump')) input.held = false;
}
addEventListener('pointerdown', e => {
  e.preventDefault();
  if (e.pointerType === 'touch') G.touch = true;
  const pos = canvasPos(e);
  if (G.state === 'title') { Sound.init(); G.sel = titleHit(pos) || G.sel; startGame(); return; }
  const z = zone(pos);
  pointers.set(e.pointerId, z);
  if (z === 'jump') press(); else refreshTouchDirs();
}, { passive: false });
addEventListener('pointermove', e => {
  const old = pointers.get(e.pointerId);
  if (!old || old === 'jump') return;
  const z = zone(canvasPos(e));
  if (z !== 'jump' && z !== old) { pointers.set(e.pointerId, z); refreshTouchDirs(); }
});
const pointerEnd = e => { pointers.delete(e.pointerId); refreshTouchDirs(); };
addEventListener('pointerup', pointerEnd);
addEventListener('pointercancel', pointerEnd);
addEventListener('blur', () => {
  pointers.clear(); release(); input.kLeft = input.kRight = input.tLeft = input.tRight = false;
  if (G.state === 'play') togglePause();
});
document.addEventListener('contextmenu', e => e.preventDefault());

function fit() {
  const s = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
  cv.style.width = Math.floor(VIEW_W * s) + 'px';
  cv.style.height = Math.floor(VIEW_H * s) + 'px';
}
addEventListener('resize', fit);
fit();

// ---------- Цикъл: фиксирана стъпка 1/120 s ----------
const STEP = 1 / 120;
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (G.state !== 'paused') {
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
  }
  render();
  requestAnimationFrame(frame);
}
loadLevel(0, false);
requestAnimationFrame(frame);
