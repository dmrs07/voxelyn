// O HALO DAS MATERIAS QUE EMITEM.
//
// ---------------------------------------------------------------------------
// O QUE FALTAVA
// ---------------------------------------------------------------------------
// O jogo tinha halo de emissivo desde sempre — mas so em SPRITE. `SpriteBank`
// monta uma mascara com os pixels emissivos de cada atlas de criatura e a soma
// por cima do corpo: e o que acende o visor do Prospector e o nucleo do Bispo.
//
// As MATERIAS do mundo nunca tiveram. E nao por esquecimento: os atlas de
// terreno e de chao nao contem UM pixel emissivo (conferido — `terrain-blocks`
// e `surface-tiles` dao zero contra a lista `EMISSIVE_HEX`), porque eles ja sao
// assados em oito niveis de luz e a emissao esta embutida no nivel. O resultado
// e que o cristal vivo, o fogo e a carga eletrica iluminavam a sala em volta
// SEM eles proprios parecerem fontes: a luz existia, o brilho nao.
//
// ---------------------------------------------------------------------------
// COMO
// ---------------------------------------------------------------------------
// Um degrade radial por COR, desenhado uma unica vez num canvas fora da tela e
// reaproveitado como imagem. Por celula acesa sai um `drawImage` em `lighter` —
// o mesmo custo do halo de sprite, e sem `createRadialGradient` por quadro, que
// aloca um objeto novo a cada chamada.
//
// A forma e ACHATADA em 2:1 no desenho, e nao no cache: o degrade e circular na
// textura e vira elipse ao ser esticado. Um cache por proporcao seria uma
// textura a mais para manter dizendo a mesma coisa.
//
// O nucleo NAO e branco. Um halo que clareia ate o branco no centro apaga a cor
// da fonte justamente onde ela e mais forte, e o cristal, o fogo e a corrente
// passariam a ter o mesmo miolo — os tres viram uma bolha clara. O centro e a
// propria cor, saturada; o que se perde para fora e a opacidade.

/** Lado da textura de halo, em pixels. Potencia de dois, e generosa: ela e
 *  esticada para varios tamanhos de celula e uma textura pequena mostraria as
 *  faixas do degrade nos raios maiores. */
const HALO_PX = 64;

const cache = new Map<string, HTMLCanvasElement>();

/**
 * A textura de halo de uma cor, criada sob demanda e guardada.
 *
 * O mapa cresce no maximo ate o numero de cores emissivas do jogo (seis na
 * `EMISSIVE_HEX`, mais as poucas que o renderer usa para fontes), entao nao ha
 * politica de despejo: ele e limitado pela paleta, e nao pelo tempo de jogo.
 */
export const haloTexture = (hex: string): HTMLCanvasElement | null => {
  const cached = cache.get(hex);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = HALO_PX;
  canvas.height = HALO_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const half = HALO_PX / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // Quatro paradas e nao duas: uma rampa linear le como um circulo com borda, e
  // o que se quer e uma queda que some antes de chegar na borda da textura.
  gradient.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
  gradient.addColorStop(0.25, `rgba(${r},${g},${b},0.55)`);
  gradient.addColorStop(0.6, `rgba(${r},${g},${b},0.16)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, HALO_PX, HALO_PX);

  cache.set(hex, canvas);
  return canvas;
};

/**
 * Soma o halo de uma fonte na tela, achatado pela projecao.
 *
 * `radiusPx` e o raio HORIZONTAL; o vertical e a metade, que e a proporcao 2:1
 * do jogo inteiro. `strength` escala a opacidade — e por ela que o fogo pulsa e
 * que a carga pisca sem precisar de uma textura por quadro.
 */
export const drawEmissiveHalo = (
  ctx: CanvasRenderingContext2D,
  hex: string,
  sx: number,
  sy: number,
  radiusPx: number,
  strength: number,
): void => {
  if (strength <= 0.01 || radiusPx <= 0) return;
  const texture = haloTexture(hex);
  if (!texture) return;
  const w = radiusPx * 2;
  const h = radiusPx;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, strength);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(texture, sx - radiusPx, sy - h / 2, w, h);
  ctx.restore();
};

/** Descarta as texturas. Existe para o teste; em jogo o cache vive a sessao. */
export const clearHaloCache = (): void => cache.clear();
