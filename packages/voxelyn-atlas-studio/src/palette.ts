// Paleta mestra veio-fungico — ESPELHO de
// packages/voxelyn-survival-content/tools/lib.mjs (COLORS).
//
// O editor roda no browser e o gerador em Node puro (.mjs); importar o arquivo
// do gerador arrastaria o pipeline inteiro para o bundle. O espelho e mantido
// honesto por src/tests/palette.test.ts, que importa os DOIS lados e falha se
// uma cor divergir — mexeu na paleta mestra, o teste cobra este arquivo.
export const COLORS: Record<string, [number, number, number]> = {
  dark: [11, 14, 20],
  rockShadow: [29, 36, 48],
  rock: [46, 58, 77],
  rockLight: [70, 86, 110],
  mist: [123, 139, 163],
  char: [61, 42, 34],
  rust: [110, 74, 51],
  brass: [138, 113, 84],
  bone: [184, 169, 143],
  chalk: [213, 205, 186],
  fungusDark: [31, 61, 51],
  fungus: [47, 107, 79],
  moss: [63, 138, 94],
  fungusLight: [102, 194, 138],
  biolum: [89, 242, 194],
  acid: [168, 230, 60],
  fire: [255, 122, 47],
  amber: [255, 166, 63],
  beam: [255, 233, 184],
  blood: [217, 59, 76],
  electric: [122, 184, 255],
  loot: [255, 209, 102],
  player: [232, 241, 255],
};

export const PALETTE_NAME = 'veio-fungico.v01';

/** Teto de cores POR ATLAS — espelho de MAX_ATLAS_COLORS em tools/validate.mjs. */
export const MAX_ATLAS_COLORS = 20;

/** Teto real de largura de textura em GPU mobile (tools/generate.mjs). */
export const MAX_TEXTURE = 4096;

/** Margem obrigatoria de respiro nas bordas de cada frame (Art Bible). */
export const FRAME_MARGIN = 2;

export const toHex = ([r, g, b]: readonly [number, number, number] | number[]): string =>
  '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');

export const HEX: Record<string, string> = Object.fromEntries(
  Object.entries(COLORS).map(([k, v]) => [k, toHex(v)]),
);

export const ALLOWED_HEX = new Set(Object.values(HEX));

/** Cores emissivas — espelho de EMISSIVE_HEX em survival-content/src/manifest.ts. */
export const EMISSIVE_HEX = new Set([
  HEX.biolum,
  HEX.electric,
  HEX.fire,
  HEX.acid,
  HEX.amber,
  HEX.beam,
]);

export const PALETTE_ENTRIES = Object.entries(COLORS).map(([name, rgb]) => ({
  name,
  rgb,
  hex: toHex(rgb),
}));

/** Cor da paleta mais proxima (distancia RGB simples) — para quantizar imports. */
export const nearestPaletteRgb = (r: number, g: number, b: number): [number, number, number] => {
  let best: [number, number, number] = COLORS.dark;
  let bestD = Infinity;
  for (const rgb of Object.values(COLORS)) {
    const d = (rgb[0] - r) ** 2 + (rgb[1] - g) ** 2 + (rgb[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = rgb;
    }
  }
  return best;
};
