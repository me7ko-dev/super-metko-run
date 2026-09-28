// Smoke тест: зарежда играта, стартира, играе с прост бот и прави снимки.
// node test/smoke.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.APPDATA, 'npm/node_modules/playwright'));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'test', 'shots');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 960, height: 544 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, '0-title.png') });

await page.keyboard.press('Space');
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, '1-intro.png') });
await page.waitForTimeout(2000);

// Бот: скача, когато пред него има яма, стена или опасен враг.
await page.evaluate(() => {
  const G = window.__G;
  const down = () => dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  const up = () => dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  let holding = 0;
  window.__bot = setInterval(() => {
    if (G.state !== 'play') return;
    const p = G.p, L = G.L;
    if (holding > 0 && --holding === 0) up();
    if (!p.onGround) return;
    const c = Math.floor((p.x + p.w) / T), rFeet = Math.floor((p.y + p.h - 1) / T);
    let need = false;
    for (let d = 1; d <= 2; d++) {
      if (!isSolid(tileAt(L, c + d, rFeet + 1)) && !isSolid(tileAt(L, c + d, rFeet))) need = true;
      if (isSolid(tileAt(L, c + d, rFeet - 1))) need = true;
    }
    for (const e of G.ents) {
      if (!e.dead && (e.type === 'spiky' || e.type === 'flyer') && e.x - (p.x + p.w) < 70 && e.x > p.x) need = true;
    }
    if (need) { down(); holding = 20; }
  }, 16);
});
const shots = [4000, 9000, 16000];
let prev = 0;
for (let i = 0; i < shots.length; i++) {
  await page.waitForTimeout(shots[i] - prev); prev = shots[i];
  await page.screenshot({ path: path.join(out, `${2 + i}-play.png`) });
}
const state = await page.evaluate(() => {
  const G = window.__G;
  return { state: G.state, level: G.levelIdx, x: Math.round(G.p.x), lives: G.lives, score: G.score, coins: G.coins, big: G.p.big };
});
console.log('STATE', JSON.stringify(state));
console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
await browser.close();
