import type { AtlasSource } from '../types.js';

export const decodeBrowserAtlas = (
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap
): AtlasSource => {
  const width = source.width;
  const height = source.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Nao foi possivel criar contexto 2D para decode de atlas');
  }

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;
  return {
    width,
    height,
    data,
  };
};

export const loadAtlasFromUrl = async (url: string): Promise<AtlasSource> => {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Falha ao carregar atlas: ${url}`));
    el.src = url;
  });

  return decodeBrowserAtlas(img);
};
