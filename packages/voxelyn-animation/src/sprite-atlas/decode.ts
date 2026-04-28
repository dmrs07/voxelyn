export const rgbaBytesToPackedPixels = (
  bytes: Uint8Array | Uint8ClampedArray
): Uint32Array => {
  if (bytes.length % 4 !== 0) {
    throw new Error('rgbaBytesToPackedPixels: byte length must be a multiple of 4');
  }

  const pixels = new Uint32Array(bytes.length / 4);
  for (let i = 0; i < pixels.length; i += 1) {
    const offset = i * 4;
    const r = bytes[offset] ?? 0;
    const g = bytes[offset + 1] ?? 0;
    const b = bytes[offset + 2] ?? 0;
    const a = bytes[offset + 3] ?? 0;
    pixels[i] = ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
  }
  return pixels;
};
