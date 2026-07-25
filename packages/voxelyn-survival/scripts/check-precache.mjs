import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8');
const match = sw.match(/^self\.__VOXELYN_PRECACHE__ = (\[[^\n]+\]);/);
if (!match) throw new Error('precache manifest ausente do sw.js');
const precache = new Set(JSON.parse(match[1]));
const emittedPngs = readdirSync(resolve(dist, 'assets')).filter((name) => name.endsWith('.png'));

for (const png of emittedPngs) {
  if (![...precache].some((entry) => entry.endsWith(`/${png}`))) {
    throw new Error(`atlas fora do precache: ${png}`);
  }
}

// Os seis personagens são assets externos por tamanho e precisam existir no
// precache. Os dois FX de 16x16 podem ser inlined pelo Vite como data URL; nesse
// caso não geram request nem arquivo para o service worker armazenar.
const requiredCharacterAtlases = [
  'player-prospector',
  'enemy-stalker',
  'enemy-spitter',
  'enemy-spore-bomber',
  'enemy-bruiser',
  'enemy-guardian',
];
for (const id of requiredCharacterAtlases) {
  const emitted = emittedPngs.find((name) => name.startsWith(`${id}-`));
  if (!emitted) throw new Error(`atlas de personagem não emitido: ${id}`);
  if (![...precache].some((entry) => entry.endsWith(`/${emitted}`))) {
    throw new Error(`atlas de personagem fora do precache: ${emitted}`);
  }
}

console.log(`precache OK: ${emittedPngs.length} PNGs externos; FX pequenos podem estar inlined`);
