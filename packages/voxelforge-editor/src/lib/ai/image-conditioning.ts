import type { TerrainConditioning } from '@voxelyn/core';

export type ImageConditioningOptions = {
  biomeBins?: number;
  detailStrength?: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const conditioningFromImageData = (
  imageData: ImageData,
  options: ImageConditioningOptions = {}
): TerrainConditioning => {
  const { width, height, data } = imageData;
  const heightMap = new Float32Array(width * height);
  const biomeMask = new Uint8Array(width * height);
  const detailNoise = new Float32Array(width * height);
  const biomeBins = Math.max(1, options.biomeBins ?? 4);
  const detailStrength = options.detailStrength ?? 0.1;

  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const luminance = clamp01((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255);
    heightMap[i] = luminance;
    const biomeValue = clamp01(g / 255);
    biomeMask[i] = Math.min(biomeBins - 1, Math.floor(biomeValue * biomeBins));
    detailNoise[i] = ((b / 255) * 2 - 1) * detailStrength;
  }

  return {
    width,
    height,
    heightMap,
    biomeMask,
    detailNoise,
  };
};

export const loadImageDataFromFile = (file: File): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(data);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load conditioning image'));
    };

    image.src = url;
  });
};
