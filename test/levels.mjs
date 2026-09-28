// Симулира всеки свят с бот в ускорено време и отчита смъртите.
// node test/levels.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.APPDATA, 'npm/node_modules/playwright'));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.waitForTimeout(300);

const report = await page.evaluate(() => {
  const out = [];
  for (let li = 0; li < LEVELS.length; li++) {
    G.levelIdx = li; G.lives = 99; G.checkpoint = false;
    loadLevel(li, false); G.state = 'play';
    const deaths = [];
    let hold = 0, simT = 0;
    while (simT < 400 && G.levelIdx === li && G.state !== 'win') {
      if (G.state === 'play') {
        const p = G.p, L = G.L;
        if (hold > 0 && --hold === 0) input.held = false;
        if (p.onGround) {
          const c = Math.floor((p.x + p.w) / T), rF = Math.floor((p.y + p.h - 1) / T);
          let need = false;
          const pit = col => { for (let r = rF + 1; r < ROWS; r++) if (isSolid(tileAt(L, col, r))) return false; return true; };
          if (pit(c) || pit(c + 1)) need = true;
          if (isSolid(tileAt(L, c, rF)) && isSolid(tileAt(L, c, rF - 1))) need = true;
          for (const e of G.ents) {
            if (e.dead || !e.active) continue;
            const dx = e.x - (p.x + p.w);
            if ((e.type === 'spiky' && dx < 60 && dx > -10) || (e.type === 'flyer' && e.baseY + e.h + 36 > p.y && dx < 50 && dx > 0)) need = true;
          }
          if (need && hold === 0) { input.pressed = true; input.held = true; hold = 40; }
        }
      }
      if (G.state === 'dying' && G.timer > 2.79) deaths.push(Math.round(G.p.x / T) + (G.p.hidden ? ' яма' : ' враг/време'));
      update(STEP); simT += STEP;
    }
    out.push({ level: LEVELS[li].name, cleared: G.levelIdx > li || G.state === 'win', deaths, simT: Math.round(simT), score: G.score });
  }
  return out;
});
for (const r of report) console.log(JSON.stringify(r));
console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
await browser.close();
