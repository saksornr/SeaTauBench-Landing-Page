import { mkdir, cp, rm, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await rm(`${root}dist`, { recursive: true, force: true });
await mkdir(`${root}dist`, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'data', 'assets', '404.html']) {
  await access(`${root}${file}`);
  await cp(`${root}${file}`, `${root}dist/${file}`, { recursive: true });
}
console.log('Static production build ready in dist/.');
