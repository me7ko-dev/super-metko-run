// Събира файловете на играта в www/ — оттам Capacitor ги слага в приложението за iPhone
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of ['index.html', 'js', 'fonts']) fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });
console.log('www готово');
