// Codec PNG via canvas — so roda no browser (os testes cobrem a logica pura de
// atlas, que nao passa por aqui).
import type { Grid } from './types';
import { createGrid } from './grid';
import { nearestPaletteRgb } from './palette';

export const gridToBlob = async (g: Grid): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = g.w;
  canvas.height = g.h;
  const ctx = canvas.getContext('2d')!;
  const image = new ImageData(new Uint8ClampedArray(g.buf), g.w, g.h);
  ctx.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('falha ao codificar PNG');
  return blob;
};

export const blobToGrid = async (blob: Blob): Promise<Grid> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const g = createGrid(canvas.width, canvas.height);
  g.buf.set(data.data);
  return g;
};

/**
 * Normaliza um grid importado para o contrato do jogo: alpha binario
 * (limiar 128) e, opcionalmente, quantizacao para a cor mais proxima da
 * paleta mestra — essencial ao importar arte gerada fora do pipeline.
 */
export const normalizeGrid = (g: Grid, quantize: boolean): void => {
  for (let i = 0; i < g.buf.length; i += 4) {
    if (g.buf[i + 3] < 128) {
      g.buf[i] = 0;
      g.buf[i + 1] = 0;
      g.buf[i + 2] = 0;
      g.buf[i + 3] = 0;
      continue;
    }
    g.buf[i + 3] = 255;
    if (quantize) {
      const [r, gr, b] = nearestPaletteRgb(g.buf[i], g.buf[i + 1], g.buf[i + 2]);
      g.buf[i] = r;
      g.buf[i + 1] = gr;
      g.buf[i + 2] = b;
    }
  }
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

/** Compartilha os arquivos exportados via Web Share (celular) se disponivel. */
export const shareFiles = async (files: File[], title: string): Promise<boolean> => {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title: string }) => Promise<void>;
  };
  if (!nav.canShare || !nav.share || !nav.canShare({ files })) return false;
  try {
    await nav.share({ files, title });
    return true;
  } catch {
    return false;
  }
};
