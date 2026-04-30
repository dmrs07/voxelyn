import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runSpritesGenerate } from '../src/commands/sprites/generate.js';
import { PNG } from '../src/commands/sprites/pack-atlas.js';

const writeFakeGptSheet = (file: string): void => {
  const png = new PNG({ width: 1024, height: 1536 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      const checker = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 246 : 236;
      png.data[offset] = checker;
      png.data[offset + 1] = checker;
      png.data[offset + 2] = checker;
      png.data[offset + 3] = 255;
    }
  }

  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const cx = col * 128 + 50;
      const cy = row * 128 + 32;
      for (let y = 0; y < 70; y += 1) {
        for (let x = 0; x < 30; x += 1) {
          const offset = ((cy + y) * png.width + cx + x) * 4;
          png.data[offset] = 120 + row;
          png.data[offset + 1] = 20 + col;
          png.data[offset + 2] = 30;
          png.data[offset + 3] = 255;
        }
      }
    }
  }

  writeFileSync(file, PNG.sync.write(png));
};

const writeFakeCutterSheet = (imageFile: string, jsonFile: string, frameCount = 76): void => {
  const frameWidth = 32;
  const frameHeight = 40;
  const cols = 4;
  const png = new PNG({
    width: cols * frameWidth,
    height: Math.ceil(frameCount / cols) * frameHeight,
  });
  png.data.fill(0);

  const frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
  for (let index = 0; index < frameCount; index += 1) {
    const x0 = (index % cols) * frameWidth;
    const y0 = Math.floor(index / cols) * frameHeight;
    frames[`frame_${String(index).padStart(3, '0')}`] = {
      frame: { x: x0, y: y0, w: frameWidth, h: frameHeight },
    };

    for (let y = 5; y < frameHeight - 2; y += 1) {
      for (let x = 8; x < frameWidth - 7; x += 1) {
        const offset = ((y0 + y) * png.width + x0 + x) * 4;
        png.data[offset] = 80 + (index % 11);
        png.data[offset + 1] = 130 + (index % 17);
        png.data[offset + 2] = 30 + (index % 19);
        png.data[offset + 3] = 255;
      }
    }
  }

  writeFileSync(imageFile, PNG.sync.write(png));
  writeFileSync(jsonFile, JSON.stringify({ frames }, null, 2));
};

const writeFakeV2Sheet = (imageFile: string, jsonFile: string): void => {
  const frameWidth = 181;
  const frameHeight = 167;
  const maxFrameHeight = 168;
  const directions = ['UL', 'UR', 'DL', 'DR'] as const;
  const clips = [
    { id: 'idle', frames: 2 },
    { id: 'walk', frames: 3 },
    { id: 'attack', frames: 3 },
    { id: 'hit', frames: 2 },
    { id: 'die', frames: 3 },
  ] as const;
  const totalRows = clips.reduce((sum, clip) => sum + clip.frames, 0);
  const png = new PNG({
    width: directions.length * frameWidth,
    height: (totalRows - 1) * frameHeight + maxFrameHeight,
  });
  const frames: Record<
    string,
    {
      frame: { x: number; y: number; w: number; h: number };
      meta: {
        character: string;
        clip: string;
        direction: string;
        frameInClip: number;
        anchor: { x: number; y: number };
      };
    }
  > = {};
  const animations: Record<string, string[]> = {};
  const expandedAnimations: Record<string, string[]> = {};
  let row = 0;

  png.data.fill(0);
  for (const clip of clips) {
    for (let frameIndex = 0; frameIndex < clip.frames; frameIndex += 1) {
      for (const [column, direction] of directions.entries()) {
        const x0 = column * frameWidth;
        const y0 = row * frameHeight;
        const sourceFrameHeight = row === totalRows - 1 ? maxFrameHeight : frameHeight;
        const name = `striker_${clip.id}_${direction}_${String(frameIndex).padStart(2, '0')}`;
        frames[name] = {
          frame: { x: x0, y: y0, w: frameWidth, h: sourceFrameHeight },
          meta: {
            character: 'striker',
            clip: clip.id,
            direction,
            frameInClip: frameIndex,
            anchor: { x: 90, y: 144 },
          },
        };
        animations[`${clip.id}_${direction}`] ??= [];
        animations[`${clip.id}_${direction}`]!.push(name);

        for (let y = 32; y < Math.min(sourceFrameHeight, 145); y += 1) {
          for (let x = 62; x < 121; x += 1) {
            const offset = ((y0 + y) * png.width + x0 + x) * 4;
            png.data[offset] = 70 + row;
            png.data[offset + 1] = 40 + column * 30;
            png.data[offset + 2] = 90 + frameIndex * 20;
            png.data[offset + 3] = 255;
          }
        }
      }
      row += 1;
    }
  }

  for (const [key, names] of Object.entries(animations)) {
    const targetCount = key.startsWith('hit_') ? 4 : 8;
    expandedAnimations[`${key}_${targetCount}f`] = Array.from(
      { length: targetCount },
      (_, index) =>
        names[Math.min(names.length - 1, Math.floor((index * names.length) / targetCount))]!,
    );
  }

  writeFileSync(imageFile, PNG.sync.write(png));
  writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        frames,
        animations,
        expandedAnimations,
        meta: {
          app: 'test',
          schema: 'voxelyn.spritesheet.v2',
          image: 'striker.png',
          defaultAnchor: { x: 90, y: 144 },
        },
      },
      null,
      2,
    ),
  );
};

test('consume mode can build a baked atlas from a GPT sheet without PixelLab results', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'voxelyn-gpt-sheet-'));
  mkdirSync(path.join(cwd, 'assets/concepts/characters'), { recursive: true });
  mkdirSync(path.join(cwd, 'assets/source/gpt-spritesheets'), { recursive: true });
  writeFileSync(path.join(cwd, 'assets/concepts/characters/striker.png'), Buffer.from([1]));
  writeFakeGptSheet(path.join(cwd, 'assets/source/gpt-spritesheets/striker.png'));

  await runSpritesGenerate({
    dryRun: false,
    force: true,
    emitPlan: false,
    onlyId: 'striker',
    log: () => undefined,
    pixellab: { ensureCharacter: async () => 'unused', animate: async () => [] },
    fs: {
      readFile: async () => null,
      writeFileAtomic: async () => undefined,
      exists: async () => false,
      readJson: async () => undefined,
      writeJson: async () => undefined,
    },
    cwd,
  });

  const atlasPath = path.join(cwd, 'assets/sprites/characters/striker/striker.atlas.png');
  const manifestPath = path.join(cwd, 'assets/sprites/characters/striker/striker.atlas.json');
  assert.ok(existsSync(atlasPath));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  assert.equal(manifest.source, 'gpt-sheet');
  assert.equal(manifest.motion, 'baked');
  assert.equal(manifest.clips.hit.framesPerDirection, 4);
  assert.equal(manifest.clips.die.framesPerDirection, 8);
  assert.equal(manifest.generation.sourceHash.length, 64);
});

test('consume mode can build the excavator atlas from a spritesheetgen cutter export', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'voxelyn-gpt-cutter-'));
  mkdirSync(path.join(cwd, 'assets/concepts/characters'), { recursive: true });
  mkdirSync(path.join(cwd, 'assets/source/gpt-spritesheets'), { recursive: true });
  writeFileSync(path.join(cwd, 'assets/concepts/characters/excavator.png'), Buffer.from([1]));
  writeFakeCutterSheet(
    path.join(cwd, 'assets/source/gpt-spritesheets/excavator-cutter.png'),
    path.join(cwd, 'assets/source/gpt-spritesheets/excavator-cutter.json'),
  );

  await runSpritesGenerate({
    dryRun: false,
    force: true,
    emitPlan: false,
    onlyId: 'excavator',
    log: () => undefined,
    pixellab: { ensureCharacter: async () => 'unused', animate: async () => [] },
    fs: {
      readFile: async () => null,
      writeFileAtomic: async () => undefined,
      exists: async () => false,
      readJson: async () => undefined,
      writeJson: async () => undefined,
    },
    cwd,
  });

  const atlasPath = path.join(cwd, 'assets/sprites/characters/excavator/excavator.atlas.png');
  const manifestPath = path.join(cwd, 'assets/sprites/characters/excavator/excavator.atlas.json');
  assert.ok(existsSync(atlasPath));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  assert.equal(manifest.source, 'gpt-sheet');
  assert.equal(manifest.motion, 'baked');
  assert.equal(manifest.clips.cast.framesPerDirection, 10);
  assert.equal(manifest.clips.die.framesPerDirection, 10);
  assert.equal(manifest.generation.sourceHash.length, 64);
});

test('consume mode prefers local spritesheetgen exports in the character folder', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'voxelyn-local-spritesheet-'));
  mkdirSync(path.join(cwd, 'assets/concepts/characters'), { recursive: true });
  mkdirSync(path.join(cwd, 'assets/sprites/characters/striker'), { recursive: true });
  writeFileSync(path.join(cwd, 'assets/concepts/characters/striker.png'), Buffer.from([1]));
  writeFakeCutterSheet(
    path.join(cwd, 'assets/sprites/characters/striker/spritesheet.png'),
    path.join(cwd, 'assets/sprites/characters/striker/spritesheet.json'),
    129,
  );

  await runSpritesGenerate({
    dryRun: false,
    force: true,
    emitPlan: false,
    onlyId: 'striker',
    log: () => undefined,
    pixellab: { ensureCharacter: async () => 'unused', animate: async () => [] },
    fs: {
      readFile: async () => null,
      writeFileAtomic: async () => undefined,
      exists: async () => false,
      readJson: async () => undefined,
      writeJson: async () => undefined,
    },
    cwd,
  });

  const manifestPath = path.join(cwd, 'assets/sprites/characters/striker/striker.atlas.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  assert.equal(manifest.source, 'spritesheetgen');
  assert.equal(manifest.motion, 'baked');
  assert.equal(manifest.clips.attack.framesPerDirection, 8);
  assert.equal(manifest.generation.sourceHash.length, 64);
});

test('consume mode preserves native named spritesheet-v2 frame dimensions', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'voxelyn-v2-spritesheet-'));
  mkdirSync(path.join(cwd, 'assets/concepts/characters'), { recursive: true });
  mkdirSync(path.join(cwd, 'assets/sprites/characters/striker'), { recursive: true });
  writeFileSync(path.join(cwd, 'assets/concepts/characters/striker.png'), Buffer.from([1]));
  writeFakeV2Sheet(
    path.join(cwd, 'assets/sprites/characters/striker/striker.png'),
    path.join(cwd, 'assets/sprites/characters/striker/striker.spritesheet.json'),
  );

  await runSpritesGenerate({
    dryRun: false,
    force: true,
    emitPlan: false,
    onlyId: 'striker',
    log: () => undefined,
    pixellab: { ensureCharacter: async () => 'unused', animate: async () => [] },
    fs: {
      readFile: async () => null,
      writeFileAtomic: async () => undefined,
      exists: async () => false,
      readJson: async () => undefined,
      writeJson: async () => undefined,
    },
    cwd,
  });

  const manifestPath = path.join(cwd, 'assets/sprites/characters/striker/striker.atlas.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  assert.equal(manifest.source, 'spritesheet-v2');
  assert.equal(manifest.motion, 'baked');
  assert.equal(manifest.frameWidth, 181);
  assert.equal(manifest.frameHeight, 168);
  assert.deepEqual(manifest.anchor, { x: 90, y: 144 });
  assert.equal(manifest.clips.walk.dirs.DR[0].w, 181);
  assert.equal(manifest.clips.walk.dirs.DR[0].h, 168);
  assert.equal(manifest.generation.sourceHash.length, 64);
});
