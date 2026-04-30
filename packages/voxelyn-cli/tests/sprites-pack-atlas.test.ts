import test from 'node:test';
import assert from 'node:assert/strict';
import { packAtlas } from '../src/commands/sprites/pack-atlas.js';

const solidRgba = (rgba: [number, number, number, number], width = 48, height = 48): Uint8Array => {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    out[i * 4] = rgba[0];
    out[i * 4 + 1] = rgba[1];
    out[i * 4 + 2] = rgba[2];
    out[i * 4 + 3] = rgba[3];
  }
  return out;
};

test('packAtlas places clip x direction rows with stride 50, frame 48', () => {
  const result = packAtlas({
    idle: {
      DR: [solidRgba([255, 0, 0, 255])],
      DL: [solidRgba([0, 255, 0, 255])],
      UR: [solidRgba([0, 0, 255, 255])],
      UL: [solidRgba([255, 255, 0, 255])],
    },
  });

  assert.equal(result.imageWidth, 48);
  assert.equal(result.imageHeight, 48 * 4 + 2 * 3);
  assert.deepEqual(result.rects.idle?.DR[0], { x: 0, y: 0, w: 48, h: 48 });
  assert.deepEqual(result.rects.idle?.DL[0], { x: 0, y: 50, w: 48, h: 48 });
  assert.deepEqual(result.rects.idle?.UR[0], { x: 0, y: 100, w: 48, h: 48 });
  assert.deepEqual(result.rects.idle?.UL[0], { x: 0, y: 150, w: 48, h: 48 });
  assert.equal(result.png[0], 0x89);
  assert.equal(result.png[1], 0x50);
});

test('packAtlas preserves native frame dimensions when requested', () => {
  const result = packAtlas(
    {
      idle: {
        DR: [solidRgba([255, 0, 0, 255], 181, 167)],
        DL: [solidRgba([0, 255, 0, 255], 181, 167)],
        UR: [solidRgba([0, 0, 255, 255], 181, 167)],
        UL: [solidRgba([255, 255, 0, 255], 181, 167)],
      },
    },
    { frameWidth: 181, frameHeight: 167 },
  );

  assert.equal(result.imageWidth, 181);
  assert.equal(result.imageHeight, 167 * 4 + 2 * 3);
  assert.deepEqual(result.rects.idle?.DR[0], { x: 0, y: 0, w: 181, h: 167 });
  assert.deepEqual(result.rects.idle?.DL[0], { x: 0, y: 169, w: 181, h: 167 });
});
