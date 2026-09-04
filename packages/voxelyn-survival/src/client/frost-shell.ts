// A GEADA NO PROSPECTOR: como o medidor de congelamento se veste no corpo.
//
// O visual acompanha o medidor continuamente, em quatro degraus que sao
// tambem a leitura do risco: geada nas extremidades (cano, pes, juntas),
// placas de gelo sobre arma e pernas, cristais crescendo para o nucleo do
// chassi — e, cheio, a ESTATUA: o corpo inteiro selado numa crosta angular
// que preserva a silhueta por baixo e nao se mexe.
//
// Geometria pura, semeada pela identidade do corpo: o mesmo Prospector no
// mesmo medidor veste a mesma geada em qualquer maquina, e o teste confere
// que os degraus sao MONOTONICOS (mais frio nunca tira gelo) e que a estatua
// cobre o corpo inteiro. O render so traduz isto em quads e polilinhas.
//
// Unidades: `x` em larguras de corpo (-1..1, centro 0), `y` em alturas de
// corpo (0 = pes, 1 = topo). O render multiplica por `size` (largura) e por
// `size * FROST_BODY_HEIGHT` (altura do sprite).
import type { Tint } from './sprites';

/** Abaixo disto o medidor nao pinta nada: o primeiro sinal tem de dizer algo. */
export const FROST_VISIBLE_AT = 0.08;
/** A partir daqui, placas de gelo sobre arma e pernas. */
export const FROST_PLATES_AT = 0.38;
/** A partir daqui, cristais crescendo para o nucleo. */
export const FROST_CRYSTALS_AT = 0.68;

export type FrostTier = 'none' | 'rime' | 'plates' | 'crystals' | 'statue';

export const frostTier = (frac: number, frostbitten: boolean): FrostTier => {
  if (frostbitten) return 'statue';
  if (frac >= FROST_CRYSTALS_AT) return 'crystals';
  if (frac >= FROST_PLATES_AT) return 'plates';
  if (frac >= FROST_VISIBLE_AT) return 'rime';
  return 'none';
};

/**
 * O veu frio sobre o sprite. Chapado como o `gunHeatTint`, e pela mesma
 * razao: opacidade alta apaga as faces, entao o teto fora da estatua fica
 * baixo — e a estatua, que E uma coisa diferente, e a unica que chega perto.
 */
export const frostTint = (frac: number, frostbitten: boolean): Tint | undefined => {
  if (frostbitten) return { color: 'rgb(214, 232, 255)', alpha: 0.62 };
  const t = Math.max(0, Math.min(1, frac));
  if (t < FROST_VISIBLE_AT) return undefined;
  const eased = (t - FROST_VISIBLE_AT) / (1 - FROST_VISIBLE_AT);
  return { color: 'rgb(214, 232, 255)', alpha: 0.1 + eased * 0.32 };
};

export type FrostPiece = {
  kind: 'speck' | 'plate' | 'crystal';
  x: number;
  y: number;
  /** Largura e altura em unidades de corpo. */
  w: number;
  h: number;
  /** Para o cristal: a direcao (radianos, espaco de tela) em que ele aponta. */
  angle: number;
};

const xorshift = (seed: number): (() => number) => {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
};

/** Onde a geada COMECA: cano (ombro direito), pes, joelhos, cotovelo. */
const EXTREMITIES: ReadonlyArray<readonly [number, number]> = [
  [0.62, 0.66],
  [0.74, 0.6],
  [-0.42, 0.06],
  [0.38, 0.05],
  [-0.36, 0.3],
  [0.34, 0.32],
  [-0.62, 0.5],
  [0.1, 0.08],
];
/** Onde as placas assentam: arma, coxas, antebraco. */
const PLATE_SITES: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.58, 0.62, 0.34, 0.14],
  [-0.3, 0.22, 0.26, 0.2],
  [0.26, 0.2, 0.26, 0.2],
  [-0.56, 0.48, 0.22, 0.16],
  [0.12, 0.4, 0.3, 0.16],
];
/** De onde os cristais nascem, apontando para o nucleo (0, 0.5). */
const CRYSTAL_ROOTS: ReadonlyArray<readonly [number, number]> = [
  [-0.7, 0.2],
  [0.7, 0.3],
  [-0.5, 0.85],
  [0.55, 0.9],
  [0, 0.02],
  [-0.65, 0.6],
];

/**
 * As pecas de gelo para um medidor `frac`. Cumulativo por construcao: cada
 * degrau ACRESCENTA ao anterior, entao mais frio nunca tira gelo do corpo —
 * o que o teste confere. A estatua nao usa pecas: usa a concha.
 */
export const frostPieces = (seed: number, frac: number): FrostPiece[] => {
  const rnd = xorshift(seed);
  const t = Math.max(0, Math.min(1, frac));
  const out: FrostPiece[] = [];
  if (t < FROST_VISIBLE_AT) return out;
  const rime = Math.min(1, (t - FROST_VISIBLE_AT) / (FROST_PLATES_AT - FROST_VISIBLE_AT));
  const specks = 2 + Math.round(rime * (EXTREMITIES.length - 2));
  for (let i = 0; i < EXTREMITIES.length; i++) {
    const [x, y] = EXTREMITIES[i];
    const jx = (rnd() - 0.5) * 0.08;
    const jy = (rnd() - 0.5) * 0.04;
    if (i < specks) out.push({ kind: 'speck', x: x + jx, y: y + jy, w: 0.1, h: 0.05, angle: 0 });
  }
  if (t >= FROST_PLATES_AT) {
    const plates =
      1 +
      Math.round(
        ((t - FROST_PLATES_AT) / (FROST_CRYSTALS_AT - FROST_PLATES_AT)) * (PLATE_SITES.length - 1),
      );
    for (let i = 0; i < PLATE_SITES.length; i++) {
      const [x, y, w, h] = PLATE_SITES[i];
      const a = (rnd() - 0.5) * 0.5;
      if (i < Math.min(PLATE_SITES.length, plates))
        out.push({ kind: 'plate', x, y, w, h, angle: a });
    }
  }
  if (t >= FROST_CRYSTALS_AT) {
    const crystals =
      2 +
      Math.round(((t - FROST_CRYSTALS_AT) / (1 - FROST_CRYSTALS_AT)) * (CRYSTAL_ROOTS.length - 2));
    for (let i = 0; i < CRYSTAL_ROOTS.length; i++) {
      const [x, y] = CRYSTAL_ROOTS[i];
      const len = 0.22 + rnd() * 0.16;
      if (i < Math.min(CRYSTAL_ROOTS.length, crystals)) {
        // Aponta para o nucleo do chassi: e o que diz "esta chegando no motor".
        const angle = Math.atan2(0.5 - y, 0 - x);
        out.push({ kind: 'crystal', x, y, w: len, h: 0.06, angle });
      }
    }
  }
  return out;
};

/**
 * A CONCHA da estatua: um poligono facetado, em unidades de corpo, que sela
 * a silhueta por fora. Doze vertices com um tremor semeado, para nunca ser
 * uma elipse — gelo que fechou de uma vez e angular.
 */
export const frostShell = (seed: number): Array<readonly [number, number]> => {
  const rnd = xorshift(seed ^ 0x5a5a);
  const pts: Array<readonly [number, number]> = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rx = 0.98 + (rnd() - 0.5) * 0.18;
    const ry = 0.56 + (rnd() - 0.5) * 0.1;
    pts.push([Math.cos(a) * rx, 0.5 + Math.sin(a) * ry]);
  }
  return pts;
};

export type FrostCrack = { x0: number; y0: number; x1: number; y1: number };

/**
 * As FISSURAS do degelo: nascem no motor (nucleo) e na arma e se espalham
 * pela crosta. `count` no total; o render mostra as primeiras
 * `round(progresso * count)` — a crosta racha na proporcao do que derreteu.
 */
export const frostCracks = (seed: number, count = 9): FrostCrack[] => {
  const rnd = xorshift(seed ^ 0xc4ac);
  const out: FrostCrack[] = [];
  for (let i = 0; i < count; i++) {
    const fromGun = i % 3 === 2;
    const x0 = fromGun ? 0.6 : (rnd() - 0.5) * 0.2;
    const y0 = fromGun ? 0.62 : 0.5 + (rnd() - 0.5) * 0.2;
    const a = rnd() * Math.PI * 2;
    const len = 0.3 + rnd() * 0.45;
    out.push({ x0, y0, x1: x0 + Math.cos(a) * len, y1: y0 + Math.sin(a) * len * 0.6 });
  }
  return out;
};

/** O ciclo termico visto de fora: pulso do nucleo, tremor da estatua, vapor. */
export type ThermalPulse = {
  /** 0..1, o nucleo aceso em laranja sob o gelo. */
  glow: number;
  /** Deslocamento do corpo, em px por unidade de zoom. */
  dx: number;
  dy: number;
  /** Vapor escapando pelas juntas. */
  steam: boolean;
};

export const THERMAL_PULSE_MS = 260;

export const thermalPulse = (sinceCycleMs: number, reduced = false): ThermalPulse => {
  if (sinceCycleMs < 0 || sinceCycleMs >= THERMAL_PULSE_MS) {
    return { glow: 0, dx: 0, dy: 0, steam: false };
  }
  const u = sinceCycleMs / THERMAL_PULSE_MS;
  const glow = 1 - u * u;
  const shake = reduced || u > 0.55 ? 0 : (1 - u / 0.55) * 1.2;
  const dx = shake * Math.sin(sinceCycleMs / 9);
  const dy = shake * 0.5 * Math.cos(sinceCycleMs / 7);
  return { glow, dx, dy, steam: u < 0.7 };
};
