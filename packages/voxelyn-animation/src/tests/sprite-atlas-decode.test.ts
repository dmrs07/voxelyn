import { describe, expect, it } from 'vitest';
import { rgbaBytesToPackedPixels } from '../sprite-atlas/decode.js';

describe('rgbaBytesToPackedPixels', () => {
  it('packs RGBA into 0xAARRGGBB', () => {
    const bytes = new Uint8ClampedArray([0x12, 0x34, 0x56, 0x78]);
    const out = rgbaBytesToPackedPixels(bytes);
    expect(out.length).toBe(1);
    expect(out[0]!.toString(16).padStart(8, '0')).toBe('78123456');
  });

  it('handles a 2x2 image', () => {
    const bytes = new Uint8ClampedArray([
      0xff, 0x00, 0x00, 0xff,
      0x00, 0xff, 0x00, 0xff,
      0x00, 0x00, 0xff, 0xff,
      0x00, 0x00, 0x00, 0x00,
    ]);
    const out = rgbaBytesToPackedPixels(bytes);
    expect(out.length).toBe(4);
    expect(out[0]!.toString(16).padStart(8, '0')).toBe('ffff0000');
    expect(out[1]!.toString(16).padStart(8, '0')).toBe('ff00ff00');
    expect(out[2]!.toString(16).padStart(8, '0')).toBe('ff0000ff');
    expect(out[3]!.toString(16).padStart(8, '0')).toBe('00000000');
  });

  it('rejects non-RGBA byte lengths', () => {
    expect(() => rgbaBytesToPackedPixels(new Uint8Array([1, 2, 3]))).toThrow(/multiple of 4/);
  });
});
