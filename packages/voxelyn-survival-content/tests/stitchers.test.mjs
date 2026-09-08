import { describe, expect, it } from 'vitest';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { STITCHER_SPECS, stitcherModel } from '../tools/stitchers.mjs';
import { renderVoxels } from '../tools/voxel.mjs';

describe('Cerzideira: atlas de oito rumos e anti-corduroy', () => {
  const spec = STITCHER_SPECS[1];
  const manifest = JSON.parse(
    readFileSync(new URL('../assets/atlases/enemy-seamstress.json', import.meta.url)),
  );
  const png = PNG.sync.read(
    readFileSync(new URL('../assets/atlases/enemy-seamstress.png', import.meta.url)),
  );

  it('publica oito vistas distintas, sem mirroring, em todas as animacoes', () => {
    expect(manifest.directions).toBe(8);
    expect(manifest.authoredDirs).toEqual(['dr', 'dl', 'ur', 'ul', 'r', 'd', 'l', 'u']);
    expect(manifest.flipPairs).toEqual({});
    const views = spec.authoredDirs.map((dir) =>
      createHash('sha256')
        .update(spec.draw(dir, 'special', 2).buf)
        .digest('hex'),
    );
    expect(new Set(views).size).toBe(8);
    for (const dir of spec.authoredDirs)
      for (const [anim, config] of Object.entries(spec.animations)) {
        expect(Number.isInteger(manifest.frameMap[dir][anim])).toBe(true);
        expect(manifest.animations[anim].frames).toBe(config.frames);
      }
  });

  it('as diagonais assadas sao faces projetadas do modelo original, sem rotacionar a grade', () => {
    const boxes = stitcherModel('special', 2, true);
    const before = JSON.stringify(boxes);
    for (let direction = 4; direction < 8; direction++) {
      const expected = renderVoxels(
        boxes,
        direction,
        spec.frameWidth,
        spec.frameHeight,
        spec.anchorX,
        spec.anchorY,
      );
      const frame = manifest.frameMap[spec.authoredDirs[direction]].special + 2;
      const ox = (frame % manifest.columns) * manifest.frameWidth;
      const oy = Math.floor(frame / manifest.columns) * manifest.frameHeight;
      for (let y = 0; y < spec.frameHeight; y++) {
        const offset = ((oy + y) * png.width + ox) * 4;
        expect(png.data.subarray(offset, offset + spec.frameWidth * 4)).toEqual(
          Buffer.from(
            expected.buf.subarray(y * spec.frameWidth * 4, (y + 1) * spec.frameWidth * 4),
          ),
        );
      }
    }
    expect(JSON.stringify(boxes)).toBe(before);
  });
});
