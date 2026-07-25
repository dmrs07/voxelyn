import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8');
const match = sw.match(/^self\.__VOXELYN_PRECACHE__ = (\[[^\n]+\]);/);
if (!match) throw new Error('precache manifest ausente do sw.js');
const precache = new Set(JSON.parse(match[1]));
const emittedPngs = readdirSync(resolve(dist, 'assets')).filter((name) => name.endsWith('.png'));
for (const png of emittedPngs) {
  if (![...precache].some((entry) => entry.endsWith(`/\${png}`) || entry.endsWith(`/${png}`))) {
    throw new Error(`atlas fora do precache: ${png}`);
  }
}
if (emittedPngs.length < 8) throw new Error(`esperava ao menos 8 PNGs emitidos, recebeu ${emittedPngs.length}`);
console.log(`precache OK: ${emittedPngs.length} PNGs`);
