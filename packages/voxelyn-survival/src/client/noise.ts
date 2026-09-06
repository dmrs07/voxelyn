// RUIDO DE PERLIN, em duas dimensoes, determinista.
//
// O que ele da ao jogo e FORMA: uma bola de fogo que nao e um circulo, uma
// coluna de fumaca que nao e uma pilha de elipses, uma onda de choque cuja
// borda ondula — sem nenhum sorteio. Tudo aqui e funcao pura de (x, y) e de
// uma semente inteira, entao dois quadros com o mesmo tempo desenham a mesma
// coisa, dois clientes do co-op desenham a mesma explosao, e um teste pode
// conferir cada valor.
//
// E o Perlin classico (gradientes por celula, interpolacao suave em quintica,
// tabela de permutacao embaralhada pela semente), mais o `fbm` — a soma de
// oitavas que transforma ondulacao lisa em turbulencia. Sem DOM, sem relogio.

const PERM_SIZE = 256;

/** A tabela de permutacao de uma semente: o mesmo inteiro, a mesma tabela. */
const permutation = (seed: number): Uint8Array => {
  const table = new Uint8Array(PERM_SIZE * 2);
  const base: number[] = [];
  for (let i = 0; i < PERM_SIZE; i++) base.push(i);
  // xorshift32 semeado — a mesma familia que as particulas usam.
  let s = seed | 0 || 0x9e3779b9;
  const next = (): number => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    const j = next() % (i + 1);
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < PERM_SIZE * 2; i++) table[i] = base[i & (PERM_SIZE - 1)];
  return table;
};

const tables = new Map<number, Uint8Array>();
const tableFor = (seed: number): Uint8Array => {
  const key = seed | 0;
  let t = tables.get(key);
  if (!t) {
    t = permutation(key);
    // Poucas sementes vivem ao mesmo tempo (uma por detonacao recente); um
    // teto evita que uma run longa acumule tabelas.
    if (tables.size > 64) tables.clear();
    tables.set(key, t);
  }
  return t;
};

/** Os oito gradientes classicos, pelos tres bits baixos do hash. */
const GRAD: readonly [number, number][] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Ruido de Perlin em `(x, y)` para a `seed`, em [-1, 1]. Zero em toda
 * coordenada inteira (e a propriedade do Perlin classico: o sinal vive entre
 * os nos), continuo em toda parte.
 */
export const perlin2 = (x: number, y: number, seed = 0): number => {
  const p = tableFor(seed);
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const X = xi & (PERM_SIZE - 1);
  const Y = yi & (PERM_SIZE - 1);
  const g = (hash: number, dx: number, dy: number): number => {
    const [gx, gy] = GRAD[hash & 7];
    return gx * dx + gy * dy;
  };
  const aa = p[p[X] + Y];
  const ab = p[p[X] + Y + 1];
  const ba = p[p[X + 1] + Y];
  const bb = p[p[X + 1] + Y + 1];
  const u = fade(xf);
  const v = fade(yf);
  const x1 = lerp(g(aa, xf, yf), g(ba, xf - 1, yf), u);
  const x2 = lerp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u);
  // Os gradientes diagonais chegam a |g| = sqrt(2)/2 por eixo: escala para
  // o resultado ocupar [-1, 1] de verdade — e prende, porque a quintica
  // deixa uns por cento passarem nos cantos.
  const v2 = lerp(x1, x2, v) * Math.SQRT2;
  return v2 < -1 ? -1 : v2 > 1 ? 1 : v2;
};

/**
 * Movimento browniano fracionario: `octaves` camadas de Perlin, cada uma com
 * o dobro da frequencia e metade da amplitude (`gain`), normalizadas para
 * [-1, 1]. Uma oitava e ondulacao; quatro sao turbulencia.
 */
export const fbm2 = (
  x: number,
  y: number,
  seed = 0,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    sum += perlin2(fx, fy, seed + i * 131) * amp;
    norm += amp;
    amp *= gain;
    fx *= lacunarity;
    fy *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
};

/** Ruido em [0, 1], para quem quer um fator e nao um sinal. */
export const fbm01 = (x: number, y: number, seed = 0, octaves = 4): number =>
  Math.max(0, Math.min(1, 0.5 + 0.5 * fbm2(x, y, seed, octaves)));

/**
 * O raio de uma FORMA irregular em volta de um centro: para um angulo e um
 * tempo, um fator em [1 - amount, 1 + amount] que varia suave pelo angulo e
 * evolui com o tempo. `lobes` e quantas ondulacoes cabem numa volta; para a
 * forma FECHAR (o ultimo ponto igual ao primeiro), o angulo entra como um
 * ponto num circulo no plano do ruido, e nao como uma reta.
 */
export const blobRadius = (
  angle: number,
  timeSeconds: number,
  seed: number,
  amount: number,
  lobes = 1.6,
): number => {
  const cx = Math.cos(angle) * lobes;
  const cy = Math.sin(angle) * lobes;
  const n = fbm2(cx + timeSeconds * 0.9, cy + 7.3 + timeSeconds * 0.6, seed, 3);
  return 1 + amount * n;
};
