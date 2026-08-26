import { CAT_UI } from './assets/catUi.js';

/**
 * CatUI: os recortes da folha de UI de gato (CatMegaBundle) viram data-URIs
 * e entram no CSS como custom properties `--cui-<nome>` — o style.css usa em
 * border-image/background. Display-only; nada disto toca a simulacao.
 */

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const pieceUrl = (name: string): string => {
  const piece = CAT_UI[name]!;
  const canvas = document.createElement('canvas');
  canvas.width = piece.w;
  canvas.height = piece.h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(piece.w, piece.h);
  piece.rows.forEach((row, y) => {
    for (let x = 0; x < piece.w; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const value = parseInt(piece.palette[CHARS.indexOf(ch)]!, 16);
      const i = (y * piece.w + x) * 4;
      img.data[i] = (value >> 16) & 255;
      img.data[i + 1] = (value >> 8) & 255;
      img.data[i + 2] = value & 255;
      img.data[i + 3] = 255;
    }
  });
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
};

/** Publica todas as pecas como `--cui-*` no :root. Chamar uma vez no boot. */
export const applyCatUi = (): void => {
  const root = document.documentElement.style;
  for (const name of Object.keys(CAT_UI)) {
    root.setProperty(`--cui-${name}`, `url("${pieceUrl(name)}")`);
  }
};
