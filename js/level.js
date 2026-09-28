'use strict';
// Константи, теми и процедурен генератор на нива (със seed → всяко ниво е едно и също всеки път).
const T = 32, ROWS = 17, VIEW_W = 960, VIEW_H = 544, GROUND = 15;
const EMPTY = 0, GRD = 1, BRICK = 2, QCOIN = 3, QMUSH = 4, USED = 5,
      PIPE_TL = 6, PIPE_TR = 7, PIPE_L = 8, PIPE_R = 9, HARD = 10, COIN = 12;
const isSolid = t => t >= 1 && t <= 10;

const THEMES = {
  day:    { sky: ['#5c94fc', '#a8ccff'], ground: '#c8702c', groundDark: '#7a3e10', grass: '#3cb043',
            brick: '#b8541c', brickDark: '#5e2406', hard: '#b07840', hills: '#2e9e44', hills2: '#6cc86a',
            clouds: true },
  cave:   { sky: ['#07071a', '#1c1c40'], ground: '#3c6cc8', groundDark: '#162c66', grass: null,
            brick: '#3c6cc8', brickDark: '#142a64', hard: '#5a6aa8', hills: '#12123a', hills2: '#1c1c4c',
            cave: true },
  sunset: { sky: ['#ff6f5e', '#ffd08a'], ground: '#d9a066', groundDark: '#7e4a1e', grass: '#e8c24a',
            brick: '#c0603a', brickDark: '#62240e', hard: '#b88a5a', hills: '#9a3e66', hills2: '#d0707e',
            clouds: true, sun: true },
  night:  { sky: ['#050a26', '#2a2f6e'], ground: '#6a6a7e', groundDark: '#2e2e3a', grass: '#3e8a5a',
            brick: '#8a8a9e', brickDark: '#34344a', hard: '#7c7c92', hills: '#141c44', hills2: '#222c5e',
            stars: true },
};

const LEVELS = [
  { name: '1-1', title: 'Зелена долина',  theme: 'day',    len: 260, seed: 7,  time: 120,
    gap: 0.12, maxGap: 3, walker: 0.5, spiky: 0.0,  flyer: 0.04, plant: 0.25, plat: 0.03 },
  { name: '1-2', title: 'Подземието',     theme: 'cave',   len: 300, seed: 21, time: 130,
    gap: 0.15, maxGap: 3, walker: 0.6, spiky: 0.08, flyer: 0.0,  plant: 0.35, plat: 0.06 },
  { name: '1-3', title: 'Залезни скали',  theme: 'sunset', len: 330, seed: 33, time: 140,
    gap: 0.22, maxGap: 4, walker: 0.5, spiky: 0.1,  flyer: 0.12, plant: 0.3,  plat: 0.18 },
  { name: '1-4', title: 'Нощната крепост', theme: 'night', len: 360, seed: 45, time: 150,
    gap: 0.2,  maxGap: 4, walker: 0.6, spiky: 0.15, flyer: 0.12, plant: 0.45, plat: 0.12 },
];

function rng(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLevel(idx) {
  const cfg = LEVELS[idx], R = rng(cfg.seed), cols = cfg.len;
  const grid = new Uint8Array(cols * ROWS);
  const spawns = [];
  const L = { idx, cfg, theme: THEMES[cfg.theme], cols, grid, spawns, checkpointX: 0, flagX: 0, castleX: 0 };
  const set = (c, r, t) => { if (c >= 0 && c < cols && r >= 0 && r < ROWS) grid[r * cols + c] = t; };
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const hole = (c, w) => { for (let i = 0; i < w; i++) { set(c + i, GROUND, EMPTY); set(c + i, GROUND + 1, EMPTY); } };
  const column = (c, h, t) => { for (let k = 1; k <= h; k++) set(c, GROUND - k, t); };
  const spawn = (type, c, extra) => spawns.push(Object.assign({ type, x: c * T }, extra));

  for (let c = 0; c < cols; c++) { set(c, GROUND, GRD); set(c, GROUND + 1, GRD); }

  const weights = [
    ['gap', cfg.gap], ['pipe', 0.13], ['blocks', 0.2], ['stairs', 0.07],
    ['enemies', 0.1 + cfg.walker * 0.1], ['coins', 0.08], ['flyer', cfg.flyer],
    ['plat', cfg.plat], ['spiky', cfg.spiky],
  ];
  const total = weights.reduce((s, w) => s + w[1], 0);
  const pick = () => { let r = R() * total; for (const [k, w] of weights) { if ((r -= w) < 0) return k; } return 'coins'; };

  let c = 16, cpDone = false;
  while (c < cols - 52) {
    if (!cpDone && c > cols / 2) {
      L.checkpointX = c * T;
      spawn('checkpoint', c);
      cpDone = true; c += 4; continue;
    }
    switch (pick()) {
      case 'gap': {
        const w = ri(2, cfg.maxGap);
        hole(c, w);
        if (R() < 0.6) for (let i = 0; i < w; i++) set(c + i, i === 0 || i === w - 1 ? 11 : 10, COIN);
        c += w + ri(3, 5);
        break;
      }
      case 'pipe': {
        const plant = R() < cfg.plant, h = plant ? ri(2, 3) : ri(2, 4), top = GROUND - h;
        set(c, top, PIPE_TL); set(c + 1, top, PIPE_TR);
        for (let r = top + 1; r < GROUND; r++) { set(c, r, PIPE_L); set(c + 1, r, PIPE_R); }
        if (plant) spawn('plant', c + 1, { y: top * T });
        c += 2 + ri(3, 6);
        break;
      }
      case 'blocks': {
        const n = ri(3, 6);
        for (let i = 0; i < n; i++) set(c + i, 11, R() < 0.35 ? QCOIN : BRICK);
        if (R() < 0.4) set(c + ri(0, n - 1), 11, QMUSH);
        if (R() < 0.35) for (let i = 1; i < Math.min(n, 4); i++) set(c + i, 7, R() < 0.5 ? QCOIN : BRICK);
        if (R() < cfg.walker) spawn('walker', c + n - 1);
        c += n + ri(3, 5);
        break;
      }
      case 'stairs': {
        const h = ri(3, 5), g = R() < 0.5 ? ri(1, 2) : 0;
        for (let i = 0; i < h; i++) column(c + i, i + 1, HARD);
        column(c + h, h, HARD);
        if (g) hole(c + h + 1, g);
        for (let i = 0; i < h; i++) column(c + h + 1 + g + i, h - i, HARD);
        c += 2 * h + 1 + g + ri(3, 5);
        break;
      }
      case 'enemies': {
        const n = ri(1, 3);
        for (let i = 0; i < n; i++) spawn('walker', c + 2 + i * 2);
        if (R() < 0.5) for (let i = 0; i < n * 2; i++) set(c + 2 + i, 12, COIN);
        c += n * 2 + 5;
        break;
      }
      case 'spiky':
        spawn('spiky', c + 3);
        c += 7;
        break;
      case 'coins': {
        const n = ri(4, 7), row = ri(10, 12);
        for (let i = 0; i < n; i++) set(c + i, row, COIN);
        c += n + 3;
        break;
      }
      case 'flyer':
        spawn('flyer', c + 4, { y: ri(9, 11) * T });
        c += 7;
        break;
      case 'plat': {
        const w = ri(6, 8), row = ri(11, 12);
        hole(c, w);
        for (let i = 2; i <= w - 3; i++) { set(c + i, row, i % 3 === 0 ? QCOIN : HARD); set(c + i, row - 2, COIN); }
        c += w + ri(3, 5);
        break;
      }
    }
  }

  // Финал: стълба от 8 стъпала, пилон с флаг и замък.
  const s = cols - 34;
  for (let i = 0; i < 8; i++) column(s + i, i + 1, HARD);
  column(s + 8, 8, HARD);
  const fc = s + 13;
  set(fc, GROUND - 1, HARD);
  L.flagX = fc * T + T / 2;
  L.castleX = (fc + 5) * T;
  return L;
}
