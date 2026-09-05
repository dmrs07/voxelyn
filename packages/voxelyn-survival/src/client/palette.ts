// A PALETA MESTRA do cliente, num modulo proprio.
//
// Ela vivia como `const PAL` dentro de `render.ts`, e todo modulo que precisava
// de uma cor "do jogo" tinha duas saidas: importar o renderer inteiro (e
// arrastar o ciclo de dependencias que isso cria) ou copiar o hex a mao — e as
// copias divergem no primeiro ajuste de tom. A barra de vida dos chefes e o
// primeiro consumidor que precisa da paleta SEM o renderer: ela e desenhada
// por ele, mas a tabela de acentos por chefe e pura e testada em Node.
//
// Os valores sao os do Art Bible (secao 6, "Paleta mestra"). Mudar um aqui
// muda em todo lugar — que e o ponto.

export const PAL = {
  dark: '#0b0e14',
  rockShadow: '#1d2430',
  rock: '#2e3a4d',
  rockLight: '#46566e',
  /** O cinza-azulado palido da paleta mestra: gelo, e a espuma que ele levanta. */
  mist: '#7b8ba3',
  rust: '#6e4a33',
  bone: '#b8a98f',
  fungusDark: '#1f3d33',
  fungus: '#2f6b4f',
  fungusLight: '#66c28a',
  biolum: '#59f2c2',
  acid: '#a8e63c',
  fire: '#ff7a2f',
  blood: '#d93b4c',
  electric: '#7ab8ff',
  loot: '#ffd166',
  player: '#e8f1ff',
};

const hexChannels = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/** Mistura linear de dois hex, `t` em 0..1 (0 = `a`, 1 = `b`). */
export const mixHex = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexChannels(a);
  const [br, bg, bb] = hexChannels(b);
  const k = Math.max(0, Math.min(1, t));
  return toHex(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
};

/** Escurece (< 1) ou clareia (> 1) um hex multiplicando os canais. */
export const scaleHex = (hex: string, factor: number): string => {
  const [r, g, b] = hexChannels(hex);
  return toHex(r * factor, g * factor, b * factor);
};

/** `rgba()` a partir de um hex e um alfa — para os veus e brilhos. */
export const hexAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = hexChannels(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
};
