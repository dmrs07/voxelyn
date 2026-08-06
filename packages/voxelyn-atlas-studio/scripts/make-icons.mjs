// Gera os icones PWA do Atlas Studio: um "sprite" pixelado com cores da paleta
// mestra veio-fungico sobre o fundo do jogo. Deterministico — rodar duas vezes
// produz os mesmos bytes.
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public');
mkdirSync(OUT, { recursive: true });

const BG = [11, 14, 20];
// Paleta usada no desenho (subconjunto da veio-fungico).
const C = {
  rock: [46, 58, 77],
  rockLight: [70, 86, 110],
  biolum: [89, 242, 194],
  fire: [255, 122, 47],
  loot: [255, 209, 102],
  blood: [217, 59, 76],
  electric: [122, 184, 255],
  player: [232, 241, 255],
};

// Grade 12x12 de um "personagem" segurando um pincel — leitura de editor de
// sprites. '.' = fundo, letras = cores acima.
const ART = [
  '............',
  '....rrrr....',
  '...rLLLLr...',
  '...rLbLbr...',
  '...rLLLLr...',
  '....rrrr....',
  '..e.pppp.f..',
  '....pppp.f..',
  '..y.pppp.y..',
  '....p..p....',
  '....r..r....',
  '............',
];
const KEY = {
  r: C.rock,
  L: C.rockLight,
  b: C.biolum,
  p: C.player,
  f: C.fire,
  y: C.loot,
  e: C.electric,
};

const render = (size, { maskable }) => {
  const png = new PNG({ width: size, height: size });
  const cells = ART.length;
  // Area util: maskable exige a arte dentro da "safe zone" (80% central).
  const usable = maskable ? Math.floor(size * 0.6) : Math.floor(size * 0.84);
  const cell = Math.floor(usable / cells);
  const offset = Math.floor((size - cell * cells) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let color = BG;
      const cx = Math.floor((x - offset) / cell);
      const cy = Math.floor((y - offset) / cell);
      if (cx >= 0 && cy >= 0 && cx < cells && cy < cells) {
        const ch = ART[cy][cx];
        if (ch !== '.') color = KEY[ch];
      }
      png.data[i] = color[0];
      png.data[i + 1] = color[1];
      png.data[i + 2] = color[2];
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png, { colorType: 6, inputColorType: 6 });
};

writeFileSync(resolve(OUT, 'icon-192.png'), render(192, { maskable: false }));
writeFileSync(resolve(OUT, 'icon-512.png'), render(512, { maskable: false }));
writeFileSync(resolve(OUT, 'icon-maskable-512.png'), render(512, { maskable: true }));
console.log('icones gerados em', OUT);
