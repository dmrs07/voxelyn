/**
 * O ATLAS DE ITENS: todos os objetos da interface — consumiveis da hotbar e
 * apetrechos da lojinha — desenhados pixel a pixel numa UNICA folha, uma vez.
 * Cada slot renderiza O OBJETO (nao um icone de traco) recortando a folha por
 * background-position, com image-rendering: pixelated fazendo a escala.
 * Arte em linhas de texto: legivel no diff, sem binario no repositorio.
 */

export type ItemSpriteId =
  | 'petisco'
  | 'catnip'
  | 'laser-pointer'
  | 'teclado-mecanico'
  | 'almofada-termica'
  | 'rubber-duck'
  | 'cafeteira-pro';

const TILE = 16;

type SpriteArt = { pal: Record<string, string>; rows: readonly string[] };

/** A ordem e o layout da folha: mudar a ordem muda todos os recortes. */
const ORDER: readonly ItemSpriteId[] = [
  'petisco',
  'catnip',
  'laser-pointer',
  'teclado-mecanico',
  'almofada-termica',
  'rubber-duck',
  'cafeteira-pro',
];

const ART: Record<ItemSpriteId, SpriteArt> = {
  // O peixinho do petisco: corpo laranja, barriga clara, rabinho.
  petisco: {
    pal: { o: '#e8943e', d: '#f2b96e', s: '#b55f27', e: '#17141f' },
    rows: [
      '................',
      '................',
      '................',
      '.....ooooo......',
      '...ooooooooo....',
      '..oeooooooooo.s.',
      '..oooooooooooss.',
      '..oddddoooooos..',
      '..odddddoooooss.',
      '...ddddoooooo.s.',
      '.....ooooo......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  // Catnip: a folhinha com nervura e talo.
  catnip: {
    pal: { g: '#78d68c', G: '#4fae69', s: '#8b6a43' },
    rows: [
      '................',
      '................',
      '.......g........',
      '......ggg.......',
      '.....gGggg......',
      '....ggGgggg.....',
      '...gggGggggg....',
      '...gggGggggg....',
      '....ggGgggg.....',
      '.....gGggg......',
      '......Gg........',
      '......s.........',
      '.....s..........',
      '................',
      '................',
      '................',
    ],
  },
  // Laser: a caneta em diagonal e o PONTO no chao — o objeto e a promessa.
  'laser-pointer': {
    pal: { m: '#8c8ca0', M: '#5c5c70', r: '#f0705a', R: '#ff4a3c' },
    rows: [
      '................',
      '................',
      '...........mm...',
      '..........mMmm..',
      '.........mMm....',
      '........mMm.....',
      '.......mMm......',
      '......rMm.......',
      '......rm........',
      '................',
      '...RR...........',
      '..RRRR..........',
      '...RR...........',
      '................',
      '................',
      '................',
    ],
  },
  // Teclado mecanico: teclas em grade e a barra de espaco.
  'teclado-mecanico': {
    pal: { k: '#3a3648', K: '#5c5876', c: '#78d68c' },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kKkKkKkKkKkKkk.',
      '.kkkkkkkkkkkkkk.',
      '.kKkKkKkKkKkKkk.',
      '.kkkkkkkkkkkkkk.',
      '.kkKKKKKKKKKkck.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  // Almofada termica: o calor sobe em fiapos.
  'almofada-termica': {
    pal: { p: '#dc6fb1', P: '#a94f88', h: '#f0705a' },
    rows: [
      '................',
      '....h...h...h...',
      '...h...h...h....',
      '....h...h...h...',
      '................',
      '.....pppppp.....',
      '...pppppppppp...',
      '..pPpppppppppp..',
      '..pppppppppePp..',
      '..ppPppppppppp..',
      '...pppppppPpp...',
      '.....pppppp.....',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  // Rubber duck: o patinho do debug, bico laranja, olhar de quem entende.
  'rubber-duck': {
    pal: { y: '#e8c05a', Y: '#b98c35', b: '#e8943e', e: '#17141f' },
    rows: [
      '................',
      '................',
      '......yyy.......',
      '.....yyyyy......',
      '....yeyyyy......',
      '..bbyyyyyy......',
      '....yyyyy.......',
      '....yyyyyyyyy...',
      '...yyyyyyyyyYy..',
      '..yyyyyyyyyyyy..',
      '..yYyyyyyyyyyy..',
      '...yyyyyyyyyy...',
      '....YYYYYYYY....',
      '................',
      '................',
      '................',
    ],
  },
  // Cafeteira pro: a jarra com cafe e a luzinha de ligada.
  'cafeteira-pro': {
    pal: { m: '#565064', M: '#37324a', c: '#cfd6e0', b: '#6b4a2f', r: '#f0705a' },
    rows: [
      '................',
      '................',
      '..mmmmmmmmmm....',
      '..mMMMMMMMMm....',
      '..mMMMMMMMMm.r..',
      '..mmmmmmmmmm....',
      '..mm............',
      '..mm..cccc......',
      '..mm..cbbc......',
      '..mm..bbbb......',
      '..mm..bbbb......',
      '..mmmmmmmmmmm...',
      '..mmmmmmmmmmm...',
      '................',
      '................',
      '................',
    ],
  },
};

let cachedUrl: string | null = null;

/** Desenha a folha uma unica vez e devolve o data-URL (cacheado). */
const atlasUrl = (): string => {
  if (cachedUrl) return cachedUrl;
  const canvas = document.createElement('canvas');
  canvas.width = TILE * ORDER.length;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;
  ORDER.forEach((id, idx) => {
    const art = ART[id];
    art.rows.forEach((row, y) => {
      for (let x = 0; x < TILE; x++) {
        const color = art.pal[row[x] ?? '.'];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(idx * TILE + x, y, 1, 1);
      }
    });
  });
  cachedUrl = canvas.toDataURL();
  return cachedUrl;
};

/** Aplica o recorte do item no elemento, em escala inteira (pixel perfeito). */
export const applyItemSprite = (target: HTMLElement, id: ItemSpriteId, scale = 3): void => {
  const idx = ORDER.indexOf(id);
  target.style.width = `${TILE * scale}px`;
  target.style.height = `${TILE * scale}px`;
  target.style.backgroundImage = `url(${atlasUrl()})`;
  target.style.backgroundSize = `${TILE * ORDER.length * scale}px ${TILE * scale}px`;
  target.style.backgroundPosition = `${-idx * TILE * scale}px 0`;
};
