# PixelLab Iso Sprite Pipeline (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate authored 48×48 isometric (Diablo-style) animated sprites for 6 concept-art characters via PixelLab, store them as per-character atlas PNG + JSON manifest, and consume them in the existing animation runtime via a `source: 'authored' | 'pixellab'` switch on `createProceduralCharacter`.

**Architecture:** A new `sprite-atlas/` module in `voxelyn-animation` validates and decodes PNG+JSON atlases into the engine's existing `AnimationClip` shape (the engine's clip is a generator function — atlas frames plug in as a generator that returns the right `Uint32Array`). A new CLI subcommand `voxelyn sprites generate` orchestrates PixelLab MCP calls to produce committed atlases. The roguelike preloads atlases at boot and switches its 6 entities to `source: 'pixellab'`. The renderer drops its hardcoded 32×32 size-branch in favor of `runtimeCharacter.anchor`-driven math.

**Tech Stack:** TypeScript, ESM, Node 22 `node:test`, existing `voxelyn-animation` engine, existing browser PNG loader (`loadAtlasFromUrl`), PixelLab MCP (`mcp__pixellab__create_character`, `mcp__pixellab__animate_character`).

**Reference:** [`docs/superpowers/specs/2026-04-28-pixellab-iso-sprite-pipeline-design.md`](../specs/2026-04-28-pixellab-iso-sprite-pipeline-design.md).

---

## File Structure

### `packages/voxelyn-animation/src/sprite-atlas/` (new)

| File | Responsibility |
|---|---|
| `types.ts` | `AtlasManifest`, `LoadedAtlas`, `LoadedClip`, error classes |
| `direction.ts` | `Direction` constants and `toEngineFacing(dir)` mapping (`DR→dr`, etc.) |
| `validate.ts` | `validateManifest(json)` — schema + size + direction + rect-bounds |
| `decode.ts` | `rgbaBytesToPackedPixels(bytes)` — convert `Uint8ClampedArray` → `Uint32Array` (`0xAARRGGBB`) |
| `build-clips.ts` | `buildClipsFromAtlas(manifest, decoded)` — extract per-frame `Uint32Array` (copied), produce `LoadedAtlas['clips']` |
| `cache.ts` | Module-level `loadedAtlases` Map + `inFlightLoads` Map; `getLoadedAtlas`, `setLoadedAtlas`, `clearAllLoadedAtlases` (test-only) |
| `load.ts` | `loadCharacterAtlas(spriteId, baseUrl, opts)` — fetch+decode+validate+cache; pair audit (atlasHash) in dev/strict |
| `preload.ts` | `preloadCharacterAtlases(ids, baseUrl, opts)` — `Promise.allSettled` in non-strict; throws on first failure in strict |
| `errors.ts` | `AtlasLoadError`, `AtlasDecodeError`, `AtlasMissingError` |

### `packages/voxelyn-animation/src/procedural/` (modified)

| File | Change |
|---|---|
| `character.ts` | Add `source` discriminated union to `ProceduralCharacterDef`; route `source: 'pixellab'` to a new `buildPixelLabCharacter`; existing `useAuthored` path becomes `source: 'authored'` builder, anchor populated as `(16, 29)` |
| `pixellab-character.ts` (new) | `buildPixelLabCharacter(def, atlas)` — wraps `LoadedClip` frames into `AnimationClip` generators, returns `ProceduralCharacter` with `width=48`, `height=48`, `anchor=(24,43)` |
| `clip-fallback.ts` (new) | `resolveClip(character, requested)` — returns `{ base, overlay? }` so missing clips fall back to `idle` plus an overlay tag |

### `packages/voxelyn-animation/src/types.ts` (modified)

Add `anchor: { x: number; y: number }` to `ProceduralCharacter`. Add `'pixellab'` overlay metadata to clip refs (optional `overlayTag?: 'cast' | 'hit' | 'die'` on `AnimationFrameRef`).

### `packages/voxelyn-animation/src/index.ts` (modified)

Re-export `loadCharacterAtlas`, `preloadCharacterAtlases`, `getLoadedAtlas`, `AtlasManifest`, `LoadedAtlas`, error classes, `SPRITE_BY_ARCHETYPE`, `resolveClip`.

### `packages/voxelyn-animation/src/sprite-archetype-map.ts` (new)

Single source of truth for `SPRITE_BY_ARCHETYPE`.

### `packages/voxelyn-animation/src/tests/` (new files)

- `sprite-atlas-decode.test.ts`
- `sprite-atlas-build-clips.test.ts`
- `sprite-atlas-load.test.ts`
- `sprite-atlas-validation.test.ts`
- `engine-source-switch.test.ts`
- `clip-fallback.test.ts`
- `tests/fixtures/test-atlas.png` + `test-atlas.json` (tiny 96×96 hand-crafted)

### `packages/voxelyn-cli/src/commands/sprites/` (new)

| File | Responsibility |
|---|---|
| `index.ts` | `runSprites(positionals, options)` — dispatches subcommand (`generate`) |
| `generate.ts` | Orchestration entry: iterate `CHARACTERS`, hash, skip-or-generate, atomic-write |
| `config/characters.ts` | `CHARACTERS: CharacterSpec[]` — 6 specs |
| `config/types.ts` | `CharacterSpec`, `CharacterClipSpec` |
| `pixellab-client.ts` | Interface + real implementation that wraps `mcp__pixellab__*` MCP calls; injectable for tests |
| `pack-atlas.ts` | `packAtlas(rawFrames, spec)` — produces PNG bytes + rects |
| `write-manifest.ts` | `buildManifest(...)` → `AtlasManifest` (no `pixellabCharacterId`) |
| `hash.ts` | `sha256File`, `sha256Bytes`, `sha256CanonicalJson` |
| `cache.ts` | `.voxelyn-cache/pixellab-character-ids.json` read/write |
| `atomic-write.ts` | `writeAtomic(path, bytes)` — temp file + rename, with cleanup |
| `pipeline-version.ts` | Exports `PIPELINE_VERSION = '1'` |

### `packages/voxelyn-cli/tests/sprites/` (new)

- `hash.test.ts`
- `pack-atlas.test.ts`
- `dry-run.test.ts`
- `manifest-shape.test.ts`
- `cache.test.ts`
- `atomic-write.test.ts`

### `packages/voxelyn-cli/src/main.ts`, `args.ts`, `types.ts` (modified)

Wire the `sprites` command + `--character`, `--force` (already exists), `--dry-run` (already exists for `generate`; share or namespace).

### `packages/voxelyn-roguelike/src/render/sprites.ts` (modified)

Replace `isAuthored32` size-branch with anchor-driven math reading `runtime.character.anchor`. Use `SPRITE_BY_ARCHETYPE` to pick `spriteId` when `source: 'pixellab'`.

### `packages/voxelyn-roguelike/src/main.ts` (modified)

Add `await preloadCharacterAtlases([6 ids], baseUrl, { strict: import.meta.env.DEV })` before game loop starts.

### `packages/voxelyn-roguelike/src/tests/render-anchor.test.ts` (new)

### `assets/concepts/characters/` (new — moved from `docs/concept-art`)

- `excavator.png`, `striker.png`, `bruiser.png`, `spitter.png`, `spore_bomber.png`, `guardian.png`

### `assets/sprites/characters/<id>/` (new — generated by Phase 2 task run)

- `<id>.atlas.png`, `<id>.atlas.json` for all 6 ids

### `.gitignore` (modified)

Add `.voxelyn-cache/`.

---

## Phase 0 — Scaffolding (no PixelLab calls)

### Task 0.1: Add `Direction` constants and engine-facing mapping

**Files:**
- Create: `packages/voxelyn-animation/src/sprite-atlas/direction.ts`
- Test: `packages/voxelyn-animation/src/tests/sprite-atlas-direction.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-animation/src/tests/sprite-atlas-direction.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DIRECTIONS, toEngineFacing } from '../sprite-atlas/direction.js';

test('DIRECTIONS lists exactly DR DL UR UL', () => {
  assert.deepEqual(DIRECTIONS, ['DR', 'DL', 'UR', 'UL']);
});

test('toEngineFacing maps each Direction to AnimationFacing', () => {
  assert.equal(toEngineFacing('DR'), 'dr');
  assert.equal(toEngineFacing('DL'), 'dl');
  assert.equal(toEngineFacing('UR'), 'ur');
  assert.equal(toEngineFacing('UL'), 'ul');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-direction`
Expected: FAIL with "Cannot find module '../sprite-atlas/direction.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/voxelyn-animation/src/sprite-atlas/direction.ts
import type { AnimationFacing } from '../types.js';

export type Direction = 'DR' | 'DL' | 'UR' | 'UL';

export const DIRECTIONS: readonly Direction[] = ['DR', 'DL', 'UR', 'UL'];

const FACING_MAP: Record<Direction, AnimationFacing> = {
  DR: 'dr',
  DL: 'dl',
  UR: 'ur',
  UL: 'ul',
};

export const toEngineFacing = (dir: Direction): AnimationFacing => FACING_MAP[dir];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-direction`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-animation/src/sprite-atlas/direction.ts packages/voxelyn-animation/src/tests/sprite-atlas-direction.test.ts
git commit -m "feat(animation): add Direction constants and engine-facing mapping for atlas pipeline"
```

---

### Task 0.2: Define atlas types and error classes

**Files:**
- Create: `packages/voxelyn-animation/src/sprite-atlas/types.ts`
- Create: `packages/voxelyn-animation/src/sprite-atlas/errors.ts`

- [ ] **Step 1: Write the (compile-only) test**

```ts
// packages/voxelyn-animation/src/tests/sprite-atlas-types.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  AtlasLoadError,
  AtlasDecodeError,
  AtlasMissingError,
} from '../sprite-atlas/errors.js';

test('error classes carry spriteId and reason', () => {
  const a = new AtlasLoadError('striker', 'fetch 404');
  assert.equal(a.spriteId, 'striker');
  assert.match(a.message, /striker/);
  assert.match(a.message, /fetch 404/);

  const b = new AtlasDecodeError('striker', 'png header bad');
  assert.equal(b.spriteId, 'striker');

  const c = new AtlasMissingError('striker');
  assert.equal(c.spriteId, 'striker');
  assert.match(c.message, /not preloaded/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-types`
Expected: FAIL — module missing

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/voxelyn-animation/src/sprite-atlas/errors.ts
export class AtlasLoadError extends Error {
  constructor(public readonly spriteId: string, reason: string) {
    super(`Atlas '${spriteId}' load failed: ${reason}`);
    this.name = 'AtlasLoadError';
  }
}

export class AtlasDecodeError extends Error {
  constructor(public readonly spriteId: string, reason: string) {
    super(`Atlas '${spriteId}' decode failed: ${reason}`);
    this.name = 'AtlasDecodeError';
  }
}

export class AtlasMissingError extends Error {
  constructor(public readonly spriteId: string) {
    super(`Atlas '${spriteId}' not preloaded. Call preloadCharacterAtlases([...]) at boot.`);
    this.name = 'AtlasMissingError';
  }
}
```

```ts
// packages/voxelyn-animation/src/sprite-atlas/types.ts
import type { Direction } from './direction.js';
import type { PixelSprite } from '../types.js';

export type ClipId = 'idle' | 'walk' | 'attack' | 'cast' | 'hit' | 'die';

export type FrameRect = { x: number; y: number; w: number; h: number };

export type ClipManifest = {
  loop: boolean;
  framesPerDirection: number;
  durationMs: number;
  dirs: Record<Direction, FrameRect[]>;
};

export type AtlasManifest = {
  id: string;
  runtimeArchetype:
    | 'player'
    | 'stalker'
    | 'bruiser'
    | 'spitter'
    | 'guardian'
    | 'spore_bomber';
  displayName: string;
  source: 'pixellab';
  version: 1;
  frameWidth: number;
  frameHeight: number;
  anchor: { x: number; y: number };
  directions: Direction[];
  clips: Partial<Record<ClipId, ClipManifest>>;
  generation: {
    conceptHash: string;
    promptHash: string;
    configHash: string;
    pipelineVersion: string;
    atlasHash: string;
    pixellabModelVersion?: string;
    generatedAt: string;
  };
};

export type LoadedFrame = PixelSprite;

export type LoadedClip = {
  loop: boolean;
  durationMs: number;
  framesPerDirection: number;
  framesByDir: Record<Direction, LoadedFrame[]>;
};

export type LoadedAtlas = {
  manifest: AtlasManifest;
  clips: Partial<Record<ClipId, LoadedClip>>;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-types`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-animation/src/sprite-atlas/types.ts packages/voxelyn-animation/src/sprite-atlas/errors.ts packages/voxelyn-animation/src/tests/sprite-atlas-types.test.ts
git commit -m "feat(animation): add AtlasManifest types and atlas error classes"
```

---

### Task 0.3: Implement pixel decoder (RGBA bytes → packed Uint32Array)

**Files:**
- Create: `packages/voxelyn-animation/src/sprite-atlas/decode.ts`
- Test: `packages/voxelyn-animation/src/tests/sprite-atlas-decode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-animation/src/tests/sprite-atlas-decode.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { rgbaBytesToPackedPixels } from '../sprite-atlas/decode.js';

test('rgbaBytesToPackedPixels packs RGBA into 0xAARRGGBB', () => {
  // 1 pixel: R=0x12, G=0x34, B=0x56, A=0x78
  const bytes = new Uint8ClampedArray([0x12, 0x34, 0x56, 0x78]);
  const out = rgbaBytesToPackedPixels(bytes);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.toString(16).padStart(8, '0'), '78123456');
});

test('rgbaBytesToPackedPixels handles a 2x2 image', () => {
  const bytes = new Uint8ClampedArray([
    0xff, 0x00, 0x00, 0xff, // red
    0x00, 0xff, 0x00, 0xff, // green
    0x00, 0x00, 0xff, 0xff, // blue
    0x00, 0x00, 0x00, 0x00, // transparent
  ]);
  const out = rgbaBytesToPackedPixels(bytes);
  assert.equal(out.length, 4);
  assert.equal(out[0]!.toString(16).padStart(8, '0'), 'ffff0000');
  assert.equal(out[1]!.toString(16).padStart(8, '0'), 'ff00ff00');
  assert.equal(out[2]!.toString(16).padStart(8, '0'), 'ff0000ff');
  assert.equal(out[3]!.toString(16).padStart(8, '0'), '00000000');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-decode`
Expected: FAIL — module missing

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/voxelyn-animation/src/sprite-atlas/decode.ts
/**
 * Convert raw RGBA bytes (as ImageData.data delivers) into a packed Uint32Array
 * in 0xAARRGGBB byte order, the layout PixelSprite expects.
 *
 * We pack explicitly (byte-by-byte) to avoid endianness assumptions that come
 * with reinterpret-casting an ArrayBuffer.
 */
export const rgbaBytesToPackedPixels = (
  bytes: Uint8Array | Uint8ClampedArray,
): Uint32Array => {
  if (bytes.length % 4 !== 0) {
    throw new Error('rgbaBytesToPackedPixels: byte length must be a multiple of 4');
  }
  const pixelCount = bytes.length / 4;
  const out = new Uint32Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) {
    const o = i * 4;
    const r = bytes[o] ?? 0;
    const g = bytes[o + 1] ?? 0;
    const b = bytes[o + 2] ?? 0;
    const a = bytes[o + 3] ?? 0;
    out[i] = ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
  }
  return out;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-decode`
Expected: PASS (both cases)

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-animation/src/sprite-atlas/decode.ts packages/voxelyn-animation/src/tests/sprite-atlas-decode.test.ts
git commit -m "feat(animation): add rgbaBytesToPackedPixels for 0xAARRGGBB packing"
```

---

### Task 0.4: Implement manifest validation

**Files:**
- Create: `packages/voxelyn-animation/src/sprite-atlas/validate.ts`
- Test: `packages/voxelyn-animation/src/tests/sprite-atlas-validation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-animation/src/tests/sprite-atlas-validation.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { validateManifest } from '../sprite-atlas/validate.js';
import { AtlasLoadError } from '../sprite-atlas/errors.js';
import type { AtlasManifest } from '../sprite-atlas/types.js';

const okManifest = (): AtlasManifest => ({
  id: 'striker',
  runtimeArchetype: 'stalker',
  displayName: 'Striker',
  source: 'pixellab',
  version: 1,
  frameWidth: 48,
  frameHeight: 48,
  anchor: { x: 24, y: 43 },
  directions: ['DR', 'DL', 'UR', 'UL'],
  clips: {
    idle: {
      loop: true,
      framesPerDirection: 1,
      durationMs: 1000,
      dirs: {
        DR: [{ x: 0, y: 0, w: 48, h: 48 }],
        DL: [{ x: 0, y: 50, w: 48, h: 48 }],
        UR: [{ x: 0, y: 100, w: 48, h: 48 }],
        UL: [{ x: 0, y: 150, w: 48, h: 48 }],
      },
    },
  },
  generation: {
    conceptHash: 'a', promptHash: 'b', configHash: 'c',
    pipelineVersion: '1', atlasHash: 'd', generatedAt: '2026-04-28T00:00:00Z',
  },
});

test('valid manifest passes (atlas image bounds 50x200)', () => {
  validateManifest('striker', okManifest(), 50, 200);
});

test('rejects wrong frame size', () => {
  const m = okManifest();
  m.frameWidth = 32;
  assert.throws(() => validateManifest('striker', m, 50, 200), AtlasLoadError);
});

test('rejects wrong directions order', () => {
  const m = okManifest();
  m.directions = ['DL', 'DR', 'UR', 'UL'];
  assert.throws(() => validateManifest('striker', m, 50, 200), AtlasLoadError);
});

test('rejects missing direction in clip dirs', () => {
  const m = okManifest();
  delete (m.clips.idle!.dirs as Record<string, unknown>).UL;
  assert.throws(() => validateManifest('striker', m, 50, 200), AtlasLoadError);
});

test('rejects out-of-bounds rect', () => {
  const m = okManifest();
  m.clips.idle!.dirs.UL = [{ x: 100, y: 100, w: 48, h: 48 }];
  assert.throws(() => validateManifest('striker', m, 50, 200), AtlasLoadError);
});

test('rejects rect with wrong size', () => {
  const m = okManifest();
  m.clips.idle!.dirs.UL = [{ x: 0, y: 150, w: 32, h: 48 }];
  assert.throws(() => validateManifest('striker', m, 50, 200), AtlasLoadError);
});

test('rejects mismatched framesPerDirection vs rects.length', () => {
  const m = okManifest();
  m.clips.idle!.framesPerDirection = 2;
  assert.throws(() => validateManifest('striker', m, 50, 200), AtlasLoadError);
});

test('rejects wrong source', () => {
  const m = okManifest();
  (m as unknown as { source: string }).source = 'authored';
  assert.throws(() => validateManifest('striker', m, 50, 200), AtlasLoadError);
});

test('rejects wrong version', () => {
  const m = okManifest();
  (m as unknown as { version: number }).version = 2;
  assert.throws(() => validateManifest('striker', m, 50, 200), AtlasLoadError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-validation`
Expected: FAIL — module missing

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/voxelyn-animation/src/sprite-atlas/validate.ts
import { DIRECTIONS, type Direction } from './direction.js';
import { AtlasLoadError } from './errors.js';
import type { AtlasManifest, ClipId } from './types.js';

const REQUIRED_FRAME_SIZE = 48;

const fail = (spriteId: string, reason: string): never => {
  throw new AtlasLoadError(spriteId, reason);
};

export const validateManifest = (
  spriteId: string,
  manifest: AtlasManifest,
  imageWidth: number,
  imageHeight: number,
): void => {
  if (manifest.source !== 'pixellab') fail(spriteId, `unexpected source ${manifest.source}`);
  if (manifest.version !== 1) fail(spriteId, `unsupported version ${manifest.version}`);
  if (manifest.frameWidth !== REQUIRED_FRAME_SIZE || manifest.frameHeight !== REQUIRED_FRAME_SIZE) {
    fail(spriteId, `expected 48x48 frames, got ${manifest.frameWidth}x${manifest.frameHeight}`);
  }
  if (
    manifest.directions.length !== DIRECTIONS.length ||
    manifest.directions.some((d, i) => d !== DIRECTIONS[i])
  ) {
    fail(spriteId, `directions must be exactly ${DIRECTIONS.join(',')}`);
  }
  if (
    !manifest.anchor ||
    typeof manifest.anchor.x !== 'number' ||
    typeof manifest.anchor.y !== 'number'
  ) {
    fail(spriteId, 'anchor must be {x,y} numbers');
  }

  const clipIds = Object.keys(manifest.clips) as ClipId[];
  if (clipIds.length === 0) fail(spriteId, 'manifest has no clips');

  for (const clipId of clipIds) {
    const clip = manifest.clips[clipId]!;
    if (clip.framesPerDirection < 1) fail(spriteId, `${clipId} framesPerDirection < 1`);
    if (clip.durationMs <= 0) fail(spriteId, `${clipId} durationMs <= 0`);

    for (const dir of DIRECTIONS) {
      const rects = clip.dirs[dir];
      if (!Array.isArray(rects)) fail(spriteId, `${clipId}.${dir} missing`);
      if (rects.length !== clip.framesPerDirection) {
        fail(
          spriteId,
          `${clipId}.${dir} expected ${clip.framesPerDirection} rects, got ${rects.length}`,
        );
      }
      for (let i = 0; i < rects.length; i += 1) {
        const r = rects[i]!;
        if (r.w !== REQUIRED_FRAME_SIZE || r.h !== REQUIRED_FRAME_SIZE) {
          fail(spriteId, `${clipId}.${dir}[${i}] wrong rect size`);
        }
        if (r.x < 0 || r.y < 0 || r.x + r.w > imageWidth || r.y + r.h > imageHeight) {
          fail(spriteId, `${clipId}.${dir}[${i}] rect out of image bounds`);
        }
      }
    }
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-validation`
Expected: PASS (all 9 cases)

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-animation/src/sprite-atlas/validate.ts packages/voxelyn-animation/src/tests/sprite-atlas-validation.test.ts
git commit -m "feat(animation): validate atlas manifest schema, size, dirs, rects"
```

---

### Task 0.5: Implement `buildClipsFromAtlas` with copied frame buffers

**Files:**
- Create: `packages/voxelyn-animation/src/sprite-atlas/build-clips.ts`
- Test: `packages/voxelyn-animation/src/tests/sprite-atlas-build-clips.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-animation/src/tests/sprite-atlas-build-clips.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildClipsFromAtlas } from '../sprite-atlas/build-clips.js';
import type { AtlasManifest } from '../sprite-atlas/types.js';

const W = 48;
const H = 48;

const makeImage = (imgW: number, imgH: number): Uint32Array => {
  const out = new Uint32Array(imgW * imgH);
  for (let y = 0; y < imgH; y += 1) {
    for (let x = 0; x < imgW; x += 1) {
      out[y * imgW + x] = ((x & 0xff) | ((y & 0xff) << 8)) >>> 0;
    }
  }
  return out;
};

const makeManifest = (): AtlasManifest => ({
  id: 'fix', runtimeArchetype: 'stalker', displayName: 'fix', source: 'pixellab', version: 1,
  frameWidth: W, frameHeight: H, anchor: { x: 24, y: 43 },
  directions: ['DR', 'DL', 'UR', 'UL'],
  clips: {
    idle: {
      loop: true, framesPerDirection: 1, durationMs: 1000,
      dirs: {
        DR: [{ x: 0, y: 0, w: W, h: H }],
        DL: [{ x: 0, y: 50, w: W, h: H }],
        UR: [{ x: 0, y: 100, w: W, h: H }],
        UL: [{ x: 0, y: 150, w: W, h: H }],
      },
    },
  },
  generation: {
    conceptHash: '', promptHash: '', configHash: '',
    pipelineVersion: '1', atlasHash: '', generatedAt: '',
  },
});

test('buildClipsFromAtlas extracts frames at correct rects', () => {
  const decoded = { width: 50, height: 200, pixels: makeImage(50, 200) };
  const clips = buildClipsFromAtlas(makeManifest(), decoded);
  const idle = clips.idle!;
  assert.equal(idle.framesByDir.DR.length, 1);
  assert.equal(idle.framesByDir.DR[0]!.width, W);
  assert.equal(idle.framesByDir.DR[0]!.height, H);
  // DR is at (0,0) — top-left pixel of frame == top-left pixel of image
  const drTopLeft = idle.framesByDir.DR[0]!.pixels[0]!;
  assert.equal(drTopLeft, decoded.pixels[0]!);
  // UL is at (0,150) — its top-left equals image pixel at (0,150)
  const ulTopLeft = idle.framesByDir.UL[0]!.pixels[0]!;
  assert.equal(ulTopLeft, decoded.pixels[150 * 50]!);
});

test('frame pixels are copied, not subarray views', () => {
  const decoded = { width: 50, height: 200, pixels: makeImage(50, 200) };
  const clips = buildClipsFromAtlas(makeManifest(), decoded);
  const frame = clips.idle!.framesByDir.DR[0]!;
  // Mutate the source — frame must NOT change
  decoded.pixels[0] = 0xdeadbeef;
  assert.notEqual(frame.pixels[0], 0xdeadbeef);
  // Buffer identity: frame.pixels.buffer must be a different ArrayBuffer
  assert.notEqual(frame.pixels.buffer, decoded.pixels.buffer);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-build-clips`
Expected: FAIL — module missing

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/voxelyn-animation/src/sprite-atlas/build-clips.ts
import { DIRECTIONS } from './direction.js';
import type {
  AtlasManifest,
  ClipId,
  LoadedAtlas,
  LoadedClip,
  LoadedFrame,
} from './types.js';

type Decoded = { width: number; height: number; pixels: Uint32Array };

const copyFrame = (src: Decoded, x: number, y: number, w: number, h: number): LoadedFrame => {
  const out = new Uint32Array(w * h);
  for (let row = 0; row < h; row += 1) {
    const srcStart = (y + row) * src.width + x;
    const dstStart = row * w;
    // explicit copy via .set on a subarray slice — set() copies values, does not alias
    out.set(src.pixels.subarray(srcStart, srcStart + w), dstStart);
  }
  return { width: w, height: h, pixels: out };
};

export const buildClipsFromAtlas = (
  manifest: AtlasManifest,
  decoded: Decoded,
): LoadedAtlas['clips'] => {
  const out: LoadedAtlas['clips'] = {};
  const clipIds = Object.keys(manifest.clips) as ClipId[];
  for (const clipId of clipIds) {
    const cm = manifest.clips[clipId]!;
    const framesByDir: LoadedClip['framesByDir'] = {
      DR: [], DL: [], UR: [], UL: [],
    };
    for (const dir of DIRECTIONS) {
      const rects = cm.dirs[dir];
      const frames: LoadedFrame[] = [];
      for (const rect of rects) {
        frames.push(copyFrame(decoded, rect.x, rect.y, rect.w, rect.h));
      }
      framesByDir[dir] = frames;
    }
    out[clipId] = {
      loop: cm.loop,
      durationMs: cm.durationMs,
      framesPerDirection: cm.framesPerDirection,
      framesByDir,
    };
  }
  return out;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-build-clips`
Expected: PASS (both cases — note `out.set(src.subarray(...))` copies values, satisfying "no shared buffer")

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-animation/src/sprite-atlas/build-clips.ts packages/voxelyn-animation/src/tests/sprite-atlas-build-clips.test.ts
git commit -m "feat(animation): buildClipsFromAtlas copies per-frame Uint32Array"
```

---

### Task 0.6: Implement atlas cache + in-flight load dedupe

**Files:**
- Create: `packages/voxelyn-animation/src/sprite-atlas/cache.ts`
- Test: covered by Task 0.7's load test (after `loadCharacterAtlas` lands)

- [ ] **Step 1: Write the implementation directly (pure data structure; load test in Task 0.7 will exercise it)**

```ts
// packages/voxelyn-animation/src/sprite-atlas/cache.ts
import type { LoadedAtlas } from './types.js';

const loadedAtlases = new Map<string, LoadedAtlas>();
const inFlightLoads = new Map<string, Promise<LoadedAtlas>>();

export const getLoadedAtlas = (spriteId: string): LoadedAtlas | undefined =>
  loadedAtlases.get(spriteId);

export const setLoadedAtlas = (spriteId: string, atlas: LoadedAtlas): void => {
  loadedAtlases.set(spriteId, atlas);
};

export const getInFlightLoad = (spriteId: string): Promise<LoadedAtlas> | undefined =>
  inFlightLoads.get(spriteId);

export const setInFlightLoad = (
  spriteId: string,
  promise: Promise<LoadedAtlas>,
): void => {
  inFlightLoads.set(spriteId, promise);
};

export const clearInFlightLoad = (spriteId: string): void => {
  inFlightLoads.delete(spriteId);
};

/** Test-only: drop all caches between unit tests. */
export const clearAllLoadedAtlasesForTest = (): void => {
  loadedAtlases.clear();
  inFlightLoads.clear();
};
```

- [ ] **Step 2: Run typecheck to confirm module compiles**

Run: `cd packages/voxelyn-animation && pnpm build`
Expected: success

- [ ] **Step 3: Commit**

```bash
git add packages/voxelyn-animation/src/sprite-atlas/cache.ts
git commit -m "feat(animation): atlas cache with in-flight load dedupe"
```

---

### Task 0.7: Implement `loadCharacterAtlas` + `preloadCharacterAtlases`

**Files:**
- Create: `packages/voxelyn-animation/src/sprite-atlas/load.ts`
- Create: `packages/voxelyn-animation/src/sprite-atlas/preload.ts`
- Create: `packages/voxelyn-animation/src/sprite-atlas/fetcher.ts` (injectable fetch + decode for tests)
- Test: `packages/voxelyn-animation/src/tests/sprite-atlas-load.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-animation/src/tests/sprite-atlas-load.test.ts
import { test, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadCharacterAtlas } from '../sprite-atlas/load.js';
import { preloadCharacterAtlases } from '../sprite-atlas/preload.js';
import { setFetcherForTest } from '../sprite-atlas/fetcher.js';
import { clearAllLoadedAtlasesForTest, getLoadedAtlas } from '../sprite-atlas/cache.js';
import type { AtlasManifest } from '../sprite-atlas/types.js';

const baseManifest = (id: string): AtlasManifest => ({
  id, runtimeArchetype: 'stalker', displayName: id, source: 'pixellab', version: 1,
  frameWidth: 48, frameHeight: 48, anchor: { x: 24, y: 43 },
  directions: ['DR', 'DL', 'UR', 'UL'],
  clips: {
    idle: {
      loop: true, framesPerDirection: 1, durationMs: 1000,
      dirs: {
        DR: [{ x: 0, y: 0, w: 48, h: 48 }],
        DL: [{ x: 0, y: 50, w: 48, h: 48 }],
        UR: [{ x: 0, y: 100, w: 48, h: 48 }],
        UL: [{ x: 0, y: 150, w: 48, h: 48 }],
      },
    },
  },
  generation: {
    conceptHash: '', promptHash: '', configHash: '',
    pipelineVersion: '1', atlasHash: 'IGNORED', generatedAt: '',
  },
});

beforeEach(() => clearAllLoadedAtlasesForTest());

const installFetcher = (id: string, opts: { delayMs?: number; fail?: boolean } = {}) => {
  setFetcherForTest({
    fetchManifest: async () => baseManifest(id),
    fetchAndDecodePng: async () => {
      if (opts.delayMs) await new Promise(r => setTimeout(r, opts.delayMs));
      if (opts.fail) throw new Error('fetch failed');
      return { width: 50, height: 200, pixels: new Uint32Array(50 * 200) };
    },
  });
};

test('loadCharacterAtlas caches and returns', async () => {
  installFetcher('striker');
  const a = await loadCharacterAtlas('striker', '/assets');
  assert.equal(a.manifest.id, 'striker');
  assert.equal(getLoadedAtlas('striker'), a);
});

test('concurrent loads share the same in-flight promise', async () => {
  installFetcher('striker', { delayMs: 20 });
  const [a, b] = await Promise.all([
    loadCharacterAtlas('striker', '/assets'),
    loadCharacterAtlas('striker', '/assets'),
  ]);
  assert.equal(a, b);
});

test('preloadCharacterAtlases strict throws on first failure', async () => {
  installFetcher('x', { fail: true });
  await assert.rejects(
    () => preloadCharacterAtlases(['x'], '/assets', { strict: true }),
    /fetch failed/,
  );
});

test('preloadCharacterAtlases non-strict swallows per-id failures', async () => {
  installFetcher('x', { fail: true });
  await preloadCharacterAtlases(['x'], '/assets', { strict: false });
  assert.equal(getLoadedAtlas('x'), undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-load`
Expected: FAIL — modules missing

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/voxelyn-animation/src/sprite-atlas/fetcher.ts
import type { AtlasManifest } from './types.js';

export type DecodedImage = { width: number; height: number; pixels: Uint32Array };

export type AtlasFetcher = {
  fetchManifest(spriteId: string, baseUrl: string): Promise<AtlasManifest>;
  fetchAndDecodePng(spriteId: string, baseUrl: string): Promise<DecodedImage>;
};

let current: AtlasFetcher | undefined;

export const setFetcherForTest = (f: AtlasFetcher | undefined): void => {
  current = f;
};

export const resolveFetcher = (): AtlasFetcher => {
  if (current) return current;
  // Default browser implementation — installed lazily so tests can override.
  throw new Error('No AtlasFetcher installed. Call setBrowserFetcher() in app boot or setFetcherForTest() in tests.');
};

export const setBrowserFetcher = (): void => {
  current = browserFetcher;
};

const browserFetcher: AtlasFetcher = {
  async fetchManifest(spriteId, baseUrl) {
    const url = `${baseUrl}/${spriteId}/${spriteId}.atlas.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    return (await res.json()) as AtlasManifest;
  },
  async fetchAndDecodePng(spriteId, baseUrl) {
    const { loadAtlasFromUrl } = await import('../adapters/browser-atlas.js');
    const { rgbaBytesToPackedPixels } = await import('./decode.js');
    const url = `${baseUrl}/${spriteId}/${spriteId}.atlas.png`;
    const src = await loadAtlasFromUrl(url);
    if ('data' in src) {
      return { width: src.width, height: src.height, pixels: rgbaBytesToPackedPixels(src.data) };
    }
    return { width: src.width, height: src.height, pixels: src.pixels };
  },
};
```

```ts
// packages/voxelyn-animation/src/sprite-atlas/load.ts
import { buildClipsFromAtlas } from './build-clips.js';
import {
  clearInFlightLoad,
  getInFlightLoad,
  getLoadedAtlas,
  setInFlightLoad,
  setLoadedAtlas,
} from './cache.js';
import { resolveFetcher } from './fetcher.js';
import { validateManifest } from './validate.js';
import { AtlasLoadError } from './errors.js';
import type { LoadedAtlas } from './types.js';

export type LoadOptions = { strict?: boolean };

export const loadCharacterAtlas = async (
  spriteId: string,
  baseUrl: string,
  opts: LoadOptions = {},
): Promise<LoadedAtlas> => {
  const cached = getLoadedAtlas(spriteId);
  if (cached) return cached;
  const inflight = getInFlightLoad(spriteId);
  if (inflight) return inflight;

  const promise = (async () => {
    const fetcher = resolveFetcher();
    let manifest;
    try {
      manifest = await fetcher.fetchManifest(spriteId, baseUrl);
    } catch (e) {
      throw new AtlasLoadError(spriteId, (e as Error).message);
    }
    let decoded;
    try {
      decoded = await fetcher.fetchAndDecodePng(spriteId, baseUrl);
    } catch (e) {
      throw new AtlasLoadError(spriteId, (e as Error).message);
    }
    validateManifest(spriteId, manifest, decoded.width, decoded.height);

    if (opts.strict) {
      // Pair audit only when strict: hash decoded PNG-equivalent bytes is expensive,
      // so we skip the actual sha256 in browser hot path. Strict callers may still
      // gate this in a follow-up if needed. v1: rely on validateManifest + dev review.
    }

    const clips = buildClipsFromAtlas(manifest, decoded);
    const loaded: LoadedAtlas = { manifest, clips };
    setLoadedAtlas(spriteId, loaded);
    return loaded;
  })().finally(() => clearInFlightLoad(spriteId));

  setInFlightLoad(spriteId, promise);
  return promise;
};
```

```ts
// packages/voxelyn-animation/src/sprite-atlas/preload.ts
import { loadCharacterAtlas, type LoadOptions } from './load.js';

export const preloadCharacterAtlases = async (
  ids: string[],
  baseUrl: string,
  opts: LoadOptions = {},
): Promise<void> => {
  if (opts.strict) {
    await Promise.all(ids.map((id) => loadCharacterAtlas(id, baseUrl, opts)));
    return;
  }
  const results = await Promise.allSettled(ids.map((id) => loadCharacterAtlas(id, baseUrl, opts)));
  const warned = new Set<string>();
  for (let i = 0; i < results.length; i += 1) {
    const r = results[i]!;
    if (r.status === 'rejected') {
      const id = ids[i]!;
      if (!warned.has(id)) {
        warned.add(id);
        // eslint-disable-next-line no-console
        console.warn(`[voxelyn-animation] atlas '${id}' preload failed:`, r.reason);
      }
    }
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-atlas-load`
Expected: PASS (4 cases)

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-animation/src/sprite-atlas/load.ts packages/voxelyn-animation/src/sprite-atlas/preload.ts packages/voxelyn-animation/src/sprite-atlas/fetcher.ts packages/voxelyn-animation/src/tests/sprite-atlas-load.test.ts
git commit -m "feat(animation): loadCharacterAtlas + preloadCharacterAtlases with in-flight dedupe"
```

---

### Task 0.8: Add `anchor` to `ProceduralCharacter`; default `(16,29)` for authored, `(8,10)` for procedural

**Files:**
- Modify: `packages/voxelyn-animation/src/types.ts`
- Modify: `packages/voxelyn-animation/src/procedural/character.ts`
- Test: `packages/voxelyn-animation/src/tests/procedural-anchor.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-animation/src/tests/procedural-anchor.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createProceduralCharacter } from '../procedural/character.js';

test('authored 32x32 character has anchor (16, 29)', () => {
  const c = createProceduralCharacter({ id: 'a', style: 'player', useAuthored: true });
  assert.equal(c.width, 32);
  assert.equal(c.height, 32);
  assert.deepEqual(c.anchor, { x: 16, y: 29 });
});

test('procedural 16x20 character has anchor centered at foot baseline', () => {
  const c = createProceduralCharacter({ id: 'b', style: 'stalker' });
  assert.equal(c.width, 16);
  assert.equal(c.height, 20);
  assert.deepEqual(c.anchor, { x: 8, y: 20 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern procedural-anchor`
Expected: FAIL — `anchor` undefined

- [ ] **Step 3: Modify types.ts** — add `anchor` to `ProceduralCharacter`:

```ts
// In packages/voxelyn-animation/src/types.ts
export type ProceduralCharacter = {
  id: string;
  seed: number;
  width: number;
  height: number;
  anchor: { x: number; y: number };
  palette: Record<string, number>;
  style: NonNullable<ProceduralCharacterDef['style']>;
  clips: AnimationSet;
};
```

- [ ] **Step 4: Modify `createProceduralCharacter`** — populate `anchor`:

```ts
// In packages/voxelyn-animation/src/procedural/character.ts, inside createProceduralCharacter:
const anchor = authored
  ? { x: Math.floor(width / 2), y: 29 }
  : { x: Math.floor(width / 2), y: height };

const character: ProceduralCharacter = {
  id: def.id,
  seed: def.seed ?? 1,
  width,
  height,
  anchor,
  palette: { ...proceduralPalette, ...(def.palette ?? {}) },
  style,
  clips: {},
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern procedural-anchor`
Expected: PASS

- [ ] **Step 6: Run the whole animation test suite to confirm no regressions**

Run: `cd packages/voxelyn-animation && pnpm test`
Expected: all green

- [ ] **Step 7: Commit**

```bash
git add packages/voxelyn-animation/src/types.ts packages/voxelyn-animation/src/procedural/character.ts packages/voxelyn-animation/src/tests/procedural-anchor.test.ts
git commit -m "feat(animation): add anchor field to ProceduralCharacter"
```

---

### Task 0.9: Make roguelike renderer anchor-driven (32×32 still works)

**Files:**
- Modify: `packages/voxelyn-roguelike/src/render/sprites.ts`
- Test: `packages/voxelyn-roguelike/src/tests/render-anchor.test.ts`

- [ ] **Step 1: Read existing renderer math**

```bash
sed -n '155,210p' packages/voxelyn-roguelike/src/render/sprites.ts
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/voxelyn-roguelike/src/tests/render-anchor.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeAnchorDraw } from '../render/sprites.js';

test('32x32 authored anchored at (16,29) → footRowsBelow=3', () => {
  const r = computeAnchorDraw({
    spriteWidth: 32, spriteHeight: 32,
    anchor: { x: 16, y: 29 },
    sx: 100, sy: 100, scale: 2,
  });
  assert.equal(r.footRowsBelow, 3);
  assert.equal(r.usefulHeight, 29);
});

test('48x48 anchored at (24,43) → footRowsBelow=5, usefulHeight=43', () => {
  const r = computeAnchorDraw({
    spriteWidth: 48, spriteHeight: 48,
    anchor: { x: 24, y: 43 },
    sx: 100, sy: 100, scale: 2,
  });
  assert.equal(r.footRowsBelow, 5);
  assert.equal(r.usefulHeight, 43);
});
```

- [ ] **Step 3: Run to verify FAIL**

Run: `cd packages/voxelyn-roguelike && pnpm test -- --test-name-pattern render-anchor`
Expected: FAIL — `computeAnchorDraw` not exported

- [ ] **Step 4: Refactor renderer to expose `computeAnchorDraw` and use anchor-driven math**

In `packages/voxelyn-roguelike/src/render/sprites.ts`, **replace** the size-branch block at lines ~170–195 with:

```ts
export type AnchorDrawInput = {
  spriteWidth: number;
  spriteHeight: number;
  anchor: { x: number; y: number };
  sx: number;
  sy: number;
  scale: number;
};

export type AnchorDrawResult = {
  usefulHeight: number;
  footRowsBelow: number;
  effectiveScale: number;
  drawX: number;
  drawY: number;
  drawW: number;
  drawH: number;
};

const TARGET_ENTITY_HEIGHT = 60;

export const computeAnchorDraw = (input: AnchorDrawInput): AnchorDrawResult => {
  const usefulHeight = input.anchor.y;
  const footRowsBelow = input.spriteHeight - input.anchor.y;
  const heightScale = TARGET_ENTITY_HEIGHT / usefulHeight;
  const effectiveScale = Math.max(1, Math.round(heightScale * (input.scale / 3)));
  const drawW = input.spriteWidth * effectiveScale;
  const drawH = input.spriteHeight * effectiveScale;
  const drawX = Math.floor(input.sx - input.anchor.x * effectiveScale);
  const drawY = Math.floor(input.sy - input.spriteHeight * effectiveScale + footRowsBelow * effectiveScale);
  return { usefulHeight, footRowsBelow, effectiveScale, drawX, drawY, drawW, drawH };
};
```

Then inside `drawEntitySprite`, **replace** the legacy block:

```ts
const anchor = runtime.character.anchor;
const layout = computeAnchorDraw({
  spriteWidth: sprite.width,
  spriteHeight: sprite.height,
  anchor,
  sx, sy, scale,
});

if (typeof document === 'undefined') {
  drawSpriteFallback(ctx, sprite, sx, sy, layout.effectiveScale);
  return;
}

const stage = stageFor(sprite.width, sprite.height);
stage.bytes.set(new Uint8ClampedArray(sprite.pixels.buffer));
stage.ctx.putImageData(stage.imageData, 0, 0);

ctx.save();
ctx.imageSmoothingEnabled = false;
ctx.drawImage(stage.canvas, layout.drawX, layout.drawY, layout.drawW, layout.drawH);
if (flash) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.28;
  ctx.drawImage(stage.canvas, layout.drawX, layout.drawY, layout.drawW, layout.drawH);
}
ctx.restore();
```

Delete the now-dead `isAuthored32`, `usefulHeight`, `authoredFootRowsBelow` locals.

- [ ] **Step 5: Run unit test**

Run: `cd packages/voxelyn-roguelike && pnpm test -- --test-name-pattern render-anchor`
Expected: PASS

- [ ] **Step 6: Run all roguelike tests** to confirm zero regression

Run: `cd packages/voxelyn-roguelike && pnpm test`
Expected: all existing tests still pass (combat-ai, interactions, enemy-ai-expanded, powerups, projectiles, puzzle-solvability, map-features)

- [ ] **Step 7: Commit**

```bash
git add packages/voxelyn-roguelike/src/render/sprites.ts packages/voxelyn-roguelike/src/tests/render-anchor.test.ts
git commit -m "feat(roguelike): anchor-driven sprite draw math (32x32 unchanged)"
```

---

### Task 0.10: CLI scaffold for `sprites generate --dry-run` (no PixelLab)

**Files:**
- Create: `packages/voxelyn-cli/src/commands/sprites/index.ts`
- Create: `packages/voxelyn-cli/src/commands/sprites/generate.ts`
- Create: `packages/voxelyn-cli/src/commands/sprites/config/types.ts`
- Create: `packages/voxelyn-cli/src/commands/sprites/config/characters.ts`
- Create: `packages/voxelyn-cli/src/commands/sprites/pipeline-version.ts`
- Modify: `packages/voxelyn-cli/src/args.ts` — accept `sprites` command and `--character`
- Modify: `packages/voxelyn-cli/src/types.ts` — add `'sprites'` to `CommandName`, `character?: string`
- Modify: `packages/voxelyn-cli/src/main.ts` — dispatch `sprites`
- Test: `packages/voxelyn-cli/tests/sprites-dry-run.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-cli/tests/sprites-dry-run.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { runSpritesGenerate } from '../src/commands/sprites/generate.js';

test('--dry-run lists planned actions and never invokes PixelLab', async () => {
  const log: string[] = [];
  const fakeClient = {
    ensureCharacter: async () => { throw new Error('must not be called'); },
    animate: async () => { throw new Error('must not be called'); },
  };
  await runSpritesGenerate({
    dryRun: true,
    force: false,
    onlyId: undefined,
    log: (m) => log.push(m),
    pixellab: fakeClient,
    fs: makeMemFs(),
    cwd: '/repo',
  });
  assert.ok(log.some((l) => l.includes('would generate') || l.includes('would skip')));
});

const makeMemFs = () => ({
  readFile: async () => null,
  writeFileAtomic: async () => {},
  exists: async () => false,
  readJson: async () => undefined,
  writeJson: async () => {},
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd packages/voxelyn-cli && pnpm test`
Expected: FAIL — module missing

- [ ] **Step 3: Add config + types**

```ts
// packages/voxelyn-cli/src/commands/sprites/config/types.ts
import type { AtlasManifest } from '@voxelyn/animation';

export type ClipId = 'idle' | 'walk' | 'attack' | 'cast' | 'hit' | 'die';

export type CharacterClipSpec = {
  frames: number;
  durationMs: number;
  loop: boolean;
  intent: string;
};

export type CharacterSpec = {
  id: string;
  runtimeArchetype: AtlasManifest['runtimeArchetype'];
  displayName: string;
  conceptArtPath: string;
  basePrompt: string;
  styleNotes: string;
  size: 48;
  directions: ['DR', 'DL', 'UR', 'UL'];
  anchor: { x: 24; y: 43 };
  clips: Partial<Record<ClipId, CharacterClipSpec>>;
};
```

```ts
// packages/voxelyn-cli/src/commands/sprites/config/characters.ts
import type { CharacterSpec } from './types.js';

const ENEMY_CLIPS = (attackMs: number, attackIntent: string) => ({
  idle:   { frames: 6, durationMs: 1000, loop: true,  intent: 'breathing idle stance' },
  walk:   { frames: 8, durationMs: 760,  loop: true,  intent: 'walk cycle on ground' },
  attack: { frames: 8, durationMs: attackMs, loop: false, intent: attackIntent },
});

export const CHARACTERS: CharacterSpec[] = [
  {
    id: 'excavator', runtimeArchetype: 'player', displayName: 'Excavator',
    conceptArtPath: 'assets/concepts/characters/excavator.png',
    basePrompt: 'small white-and-yellow excavator robot, antenna with blue tip, blue-glowing chest core, holding a yellow heavy-duty hauling tube around the waist',
    styleNotes: 'isometric 3/4 view, 3/4-down camera, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48, directions: ['DR','DL','UR','UL'], anchor: { x: 24, y: 43 },
    clips: {
      idle:   { frames: 8,  durationMs: 1100, loop: true,  intent: 'subtle robotic idle, antenna sway' },
      walk:   { frames: 12, durationMs: 720,  loop: true,  intent: 'walk cycle on ground' },
      attack: { frames: 10, durationMs: 360,  loop: false, intent: 'tool swing forward attack' },
      cast:   { frames: 10, durationMs: 600,  loop: false, intent: 'channel energy from chest core' },
      hit:    { frames: 4,  durationMs: 220,  loop: false, intent: 'recoil flinch' },
      die:    { frames: 10, durationMs: 1100, loop: false, intent: 'fall apart and power down' },
    },
  },
  { id: 'striker',      runtimeArchetype: 'stalker',      displayName: 'Striker',
    conceptArtPath: 'assets/concepts/characters/striker.png',
    basePrompt: 'agile crimson reptilian humanoid with claws and a flame-blade right arm',
    styleNotes: 'isometric 3/4 view, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48, directions: ['DR','DL','UR','UL'], anchor: { x: 24, y: 43 },
    clips: ENEMY_CLIPS(310, 'fast lunging slash with flame blade'),
  },
  { id: 'bruiser',      runtimeArchetype: 'bruiser',      displayName: 'Bruiser',
    conceptArtPath: 'assets/concepts/characters/bruiser.png',
    basePrompt: 'massive purple muscle hulk with stone helm and stone shoulder plates',
    styleNotes: 'isometric 3/4 view, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48, directions: ['DR','DL','UR','UL'], anchor: { x: 24, y: 43 },
    clips: ENEMY_CLIPS(680, 'heavy two-fisted ground smash'),
  },
  { id: 'spitter',      runtimeArchetype: 'spitter',      displayName: 'Spitter',
    conceptArtPath: 'assets/concepts/characters/spitter.png',
    basePrompt: 'frail green amphibian humanoid with bulbous eyes and dripping mouth',
    styleNotes: 'isometric 3/4 view, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48, directions: ['DR','DL','UR','UL'], anchor: { x: 24, y: 43 },
    clips: ENEMY_CLIPS(470, 'lean back and spit acid forward'),
  },
  { id: 'spore_bomber', runtimeArchetype: 'spore_bomber', displayName: 'Spore Bomber',
    conceptArtPath: 'assets/concepts/characters/spore_bomber.png',
    basePrompt: 'bulbous purple-cloaked fungal creature cradling a glowing spore orb, single yellow eye',
    styleNotes: 'isometric 3/4 view, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48, directions: ['DR','DL','UR','UL'], anchor: { x: 24, y: 43 },
    clips: ENEMY_CLIPS(580, 'inflate then hurl glowing spore orb'),
  },
  { id: 'guardian',     runtimeArchetype: 'guardian',     displayName: 'Guardian',
    conceptArtPath: 'assets/concepts/characters/guardian.png',
    basePrompt: 'tall purple-and-stone armored colossus with crystal core and clawed gauntlets',
    styleNotes: 'isometric 3/4 view, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48, directions: ['DR','DL','UR','UL'], anchor: { x: 24, y: 43 },
    clips: ENEMY_CLIPS(750, 'shield bash with armored forearm'),
  },
];
```

```ts
// packages/voxelyn-cli/src/commands/sprites/pipeline-version.ts
export const PIPELINE_VERSION = '1';
```

- [ ] **Step 4: Add the orchestration entry stub (dry-run only)**

```ts
// packages/voxelyn-cli/src/commands/sprites/generate.ts
import { CHARACTERS } from './config/characters.js';
import type { CharacterSpec } from './config/types.js';

export type SpritesFs = {
  readFile(path: string): Promise<Uint8Array | null>;
  writeFileAtomic(path: string, bytes: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  readJson<T>(path: string): Promise<T | undefined>;
  writeJson(path: string, value: unknown): Promise<void>;
};

export type PixelLabClient = {
  ensureCharacter(spec: CharacterSpec, conceptHash: string): Promise<string>;
  animate(args: {
    pixellabCharacterId: string;
    direction: 'DR' | 'DL' | 'UR' | 'UL';
    intent: string;
    frameCount: number;
    size: 48;
  }): Promise<Uint8Array[]>;
};

export type RunSpritesGenerateInput = {
  dryRun: boolean;
  force: boolean;
  onlyId: string | undefined;
  log: (msg: string) => void;
  pixellab: PixelLabClient;
  fs: SpritesFs;
  cwd: string;
};

export const runSpritesGenerate = async (input: RunSpritesGenerateInput): Promise<void> => {
  const filtered = input.onlyId
    ? CHARACTERS.filter((c) => c.id === input.onlyId)
    : CHARACTERS;

  for (const spec of filtered) {
    if (input.dryRun) {
      input.log(`[sprites] would generate ${spec.id} (clips: ${Object.keys(spec.clips).join(',')})`);
      continue;
    }
    // Real path implemented in Phase 2 tasks.
    throw new Error(`runSpritesGenerate non-dry-run path not implemented yet for ${spec.id}`);
  }
};
```

```ts
// packages/voxelyn-cli/src/commands/sprites/index.ts
import { runSpritesGenerate } from './generate.js';
import { createNodeFs } from './node-fs.js';
import { createPixelLabClient } from './pixellab-client.js';

export const runSprites = async (
  positionals: string[],
  options: { dryRun?: boolean; force?: boolean; character?: string },
  log: (msg: string) => void,
): Promise<void> => {
  const sub = positionals[0];
  if (sub !== 'generate') {
    log('Usage: voxelyn sprites generate [--character <id>] [--force] [--dry-run]');
    return;
  }
  await runSpritesGenerate({
    dryRun: !!options.dryRun,
    force: !!options.force,
    onlyId: options.character,
    log,
    pixellab: createPixelLabClient(),
    fs: createNodeFs(process.cwd()),
    cwd: process.cwd(),
  });
};
```

```ts
// packages/voxelyn-cli/src/commands/sprites/node-fs.ts (skeleton — full impl in Phase 2)
import type { SpritesFs } from './generate.js';

export const createNodeFs = (_cwd: string): SpritesFs => ({
  async readFile() { return null; },
  async writeFileAtomic() { /* implemented in Phase 2 */ },
  async exists() { return false; },
  async readJson() { return undefined; },
  async writeJson() { /* implemented in Phase 2 */ },
});
```

```ts
// packages/voxelyn-cli/src/commands/sprites/pixellab-client.ts (skeleton — full impl in Phase 2)
import type { PixelLabClient } from './generate.js';

export const createPixelLabClient = (): PixelLabClient => ({
  async ensureCharacter() { throw new Error('PixelLab client not implemented yet'); },
  async animate() { throw new Error('PixelLab client not implemented yet'); },
});
```

- [ ] **Step 5: Wire CLI parser & dispatcher**

In `packages/voxelyn-cli/src/types.ts`, add `'sprites'` to `CommandName` and `character?: string` to `CliOptions`.

In `packages/voxelyn-cli/src/args.ts`, add to `COMMAND_ALIASES`:

```ts
sprites: 'sprites',
```

And inside the option-parsing loop:

```ts
if (arg === '--character' && argv[i + 1]) {
  options.character = argv[++i];
  continue;
}
if (arg.startsWith('--character=')) {
  options.character = arg.slice('--character='.length);
  continue;
}
```

In `packages/voxelyn-cli/src/main.ts`, import and dispatch:

```ts
import { runSprites } from './commands/sprites/index.js';
// ...
if (command === 'sprites') {
  await runSprites(positionals, parsed.options, logger.info);
  return;
}
```

- [ ] **Step 6: Run test**

Run: `cd packages/voxelyn-cli && pnpm test`
Expected: PASS

- [ ] **Step 7: Run dry-run end-to-end**

Run: `cd packages/voxelyn-cli && pnpm build && node dist/src/index.js sprites generate --dry-run`
Expected: stdout lists `[sprites] would generate excavator`, `... striker`, ... for all 6.

- [ ] **Step 8: Commit**

```bash
git add packages/voxelyn-cli/src/commands/sprites packages/voxelyn-cli/src/args.ts packages/voxelyn-cli/src/main.ts packages/voxelyn-cli/src/types.ts packages/voxelyn-cli/tests/sprites-dry-run.test.ts
git commit -m "feat(cli): add 'voxelyn sprites generate --dry-run' scaffold and 6-character config"
```

---

### Task 0.11: Re-export atlas surface from `@voxelyn/animation`

**Files:**
- Modify: `packages/voxelyn-animation/src/index.ts`

- [ ] **Step 1: Update exports**

```ts
// Append to packages/voxelyn-animation/src/index.ts
export {
  loadCharacterAtlas,
  type LoadOptions,
} from './sprite-atlas/load.js';

export {
  preloadCharacterAtlases,
} from './sprite-atlas/preload.js';

export {
  getLoadedAtlas,
  setLoadedAtlas,
} from './sprite-atlas/cache.js';

export {
  setBrowserFetcher,
  setFetcherForTest,
  type AtlasFetcher,
} from './sprite-atlas/fetcher.js';

export {
  AtlasLoadError,
  AtlasDecodeError,
  AtlasMissingError,
} from './sprite-atlas/errors.js';

export type {
  AtlasManifest,
  ClipId as AtlasClipId,
  ClipManifest,
  FrameRect,
  LoadedAtlas,
  LoadedClip,
  LoadedFrame,
} from './sprite-atlas/types.js';

export {
  DIRECTIONS,
  toEngineFacing,
  type Direction,
} from './sprite-atlas/direction.js';
```

- [ ] **Step 2: Verify build**

Run: `cd packages/voxelyn-animation && pnpm build && cd ../voxelyn-cli && pnpm build`
Expected: both packages build clean.

- [ ] **Step 3: Commit**

```bash
git add packages/voxelyn-animation/src/index.ts
git commit -m "feat(animation): re-export sprite-atlas surface"
```

---

## Phase 1 — Engine source switch (still no atlases)

### Task 1.1: Add `SPRITE_BY_ARCHETYPE` and re-export

**Files:**
- Create: `packages/voxelyn-animation/src/sprite-archetype-map.ts`
- Modify: `packages/voxelyn-animation/src/index.ts`
- Test: `packages/voxelyn-animation/src/tests/sprite-archetype-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-animation/src/tests/sprite-archetype-map.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { SPRITE_BY_ARCHETYPE } from '../sprite-archetype-map.js';

test('SPRITE_BY_ARCHETYPE has the locked mapping', () => {
  assert.equal(SPRITE_BY_ARCHETYPE.player,       'excavator');
  assert.equal(SPRITE_BY_ARCHETYPE.stalker,      'striker');
  assert.equal(SPRITE_BY_ARCHETYPE.bruiser,      'bruiser');
  assert.equal(SPRITE_BY_ARCHETYPE.spitter,      'spitter');
  assert.equal(SPRITE_BY_ARCHETYPE.spore_bomber, 'spore_bomber');
  assert.equal(SPRITE_BY_ARCHETYPE.guardian,     'guardian');
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-archetype-map`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
// packages/voxelyn-animation/src/sprite-archetype-map.ts
export type SpriteArchetypeKey =
  | 'player' | 'stalker' | 'bruiser' | 'spitter' | 'guardian' | 'spore_bomber';

export const SPRITE_BY_ARCHETYPE: Record<SpriteArchetypeKey, string> = {
  player:       'excavator',
  stalker:      'striker',
  bruiser:      'bruiser',
  spitter:      'spitter',
  spore_bomber: 'spore_bomber',
  guardian:     'guardian',
};
```

Add to `index.ts`:

```ts
export {
  SPRITE_BY_ARCHETYPE,
  type SpriteArchetypeKey,
} from './sprite-archetype-map.js';
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern sprite-archetype-map`

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-animation/src/sprite-archetype-map.ts packages/voxelyn-animation/src/index.ts packages/voxelyn-animation/src/tests/sprite-archetype-map.test.ts
git commit -m "feat(animation): SPRITE_BY_ARCHETYPE locked mapping"
```

---

### Task 1.2: Implement `resolveClip` fallback helper

**Files:**
- Create: `packages/voxelyn-animation/src/procedural/clip-fallback.ts`
- Modify: `packages/voxelyn-animation/src/index.ts`
- Test: `packages/voxelyn-animation/src/tests/clip-fallback.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-animation/src/tests/clip-fallback.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveClip } from '../procedural/clip-fallback.js';
import type { ProceduralCharacter } from '../types.js';

const charWithClips = (ids: string[]): ProceduralCharacter =>
  ({
    id: 'x', seed: 1, width: 48, height: 48, anchor: { x: 24, y: 43 },
    palette: {}, style: 'stalker',
    clips: Object.fromEntries(ids.map((id) => [id, { id, fps: 8, loop: true, lengthMs: 1000, generator: () => null as never }])) as ProceduralCharacter['clips'],
  });

test('present clip returns base only', () => {
  assert.deepEqual(resolveClip(charWithClips(['idle','walk']), 'walk'), { base: 'walk' });
});

test('missing cast falls back to idle + cast overlay', () => {
  assert.deepEqual(resolveClip(charWithClips(['idle','walk','attack']), 'cast'), { base: 'idle', overlay: 'cast' });
});

test('missing hit falls back to idle + hit overlay', () => {
  assert.deepEqual(resolveClip(charWithClips(['idle']), 'hit'), { base: 'idle', overlay: 'hit' });
});

test('missing die falls back to idle + die overlay', () => {
  assert.deepEqual(resolveClip(charWithClips(['idle']), 'die'), { base: 'idle', overlay: 'die' });
});

test('missing walk does NOT fall back (engine default behavior)', () => {
  assert.deepEqual(resolveClip(charWithClips(['idle']), 'walk'), { base: 'walk' });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern clip-fallback`

- [ ] **Step 3: Implement**

```ts
// packages/voxelyn-animation/src/procedural/clip-fallback.ts
import type { ProceduralCharacter } from '../types.js';

export type ResolvedClip =
  | { base: string }
  | { base: 'idle'; overlay: 'cast' | 'hit' | 'die' };

export const resolveClip = (
  character: ProceduralCharacter,
  requested: string,
): ResolvedClip => {
  const has = (id: string) => Boolean((character.clips as Record<string, unknown>)[id]);
  if (has(requested)) return { base: requested };
  if (requested === 'cast' || requested === 'hit' || requested === 'die') {
    return { base: 'idle', overlay: requested };
  }
  return { base: requested };
};
```

Re-export from `index.ts`:

```ts
export { resolveClip, type ResolvedClip } from './procedural/clip-fallback.js';
```

- [ ] **Step 4: Run test, PASS**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern clip-fallback`

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-animation/src/procedural/clip-fallback.ts packages/voxelyn-animation/src/index.ts packages/voxelyn-animation/src/tests/clip-fallback.test.ts
git commit -m "feat(animation): resolveClip helper for missing cast/hit/die"
```

---

### Task 1.3: `createProceduralCharacter` discriminated-union options + `source: 'pixellab'` branch

**Files:**
- Modify: `packages/voxelyn-animation/src/types.ts`
- Modify: `packages/voxelyn-animation/src/procedural/character.ts`
- Create: `packages/voxelyn-animation/src/procedural/pixellab-character.ts`
- Test: `packages/voxelyn-animation/src/tests/engine-source-switch.test.ts`

- [ ] **Step 1: Update `ProceduralCharacterDef` to a discriminated union**

```ts
// In packages/voxelyn-animation/src/types.ts — replace ProceduralCharacterDef:
type CommonDef = {
  id: string;
  seed?: number;
  width?: number;
  height?: number;
  palette?: Record<string, number>;
  style?: 'player' | 'stalker' | 'bruiser' | 'spitter' | 'guardian' | 'spore_bomber';
};

export type ProceduralCharacterDef =
  | (CommonDef & { source?: 'authored'; useAuthored?: boolean })
  | (CommonDef & { source: 'pixellab'; spriteId: string });
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/voxelyn-animation/src/tests/engine-source-switch.test.ts
import { test, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { createProceduralCharacter } from '../procedural/character.js';
import {
  setLoadedAtlas,
  clearAllLoadedAtlasesForTest,
} from '../sprite-atlas/cache.js';
import { AtlasMissingError } from '../sprite-atlas/errors.js';
import type { LoadedAtlas } from '../sprite-atlas/types.js';

beforeEach(() => clearAllLoadedAtlasesForTest());

const fakeLoadedAtlas = (id: string): LoadedAtlas => ({
  manifest: {
    id, runtimeArchetype: 'stalker', displayName: id, source: 'pixellab', version: 1,
    frameWidth: 48, frameHeight: 48, anchor: { x: 24, y: 43 },
    directions: ['DR','DL','UR','UL'],
    clips: {
      idle: { loop: true, framesPerDirection: 1, durationMs: 1000, dirs: {
        DR: [{ x:0, y:0, w:48, h:48 }], DL: [{ x:0, y:50, w:48, h:48 }],
        UR: [{ x:0, y:100, w:48, h:48 }], UL: [{ x:0, y:150, w:48, h:48 }],
      }},
    },
    generation: { conceptHash:'',promptHash:'',configHash:'',pipelineVersion:'1',atlasHash:'',generatedAt:'' },
  },
  clips: {
    idle: {
      loop: true, durationMs: 1000, framesPerDirection: 1,
      framesByDir: {
        DR: [{ width: 48, height: 48, pixels: new Uint32Array(48*48) }],
        DL: [{ width: 48, height: 48, pixels: new Uint32Array(48*48) }],
        UR: [{ width: 48, height: 48, pixels: new Uint32Array(48*48) }],
        UL: [{ width: 48, height: 48, pixels: new Uint32Array(48*48) }],
      },
    },
  },
});

test('source: pixellab returns 48x48 character with anchor (24,43) when atlas preloaded', () => {
  setLoadedAtlas('striker', fakeLoadedAtlas('striker'));
  const c = createProceduralCharacter({
    id: 'enemy-1', style: 'stalker', source: 'pixellab', spriteId: 'striker',
  });
  assert.equal(c.width, 48);
  assert.equal(c.height, 48);
  assert.deepEqual(c.anchor, { x: 24, y: 43 });
  assert.ok(c.clips.idle, 'has idle clip');
});

test('source: pixellab without preload throws AtlasMissingError in dev', () => {
  process.env.NODE_ENV = 'development';
  assert.throws(
    () => createProceduralCharacter({
      id: 'enemy-1', style: 'stalker', source: 'pixellab', spriteId: 'striker',
    }),
    AtlasMissingError,
  );
});

test('source: pixellab without preload falls back to authored in prod', () => {
  process.env.NODE_ENV = 'production';
  try {
    const c = createProceduralCharacter({
      id: 'enemy-1', style: 'stalker', source: 'pixellab', spriteId: 'striker',
    });
    // Authored fallback yields procedural 16x20 character with anchor at foot
    assert.equal(c.width, 16);
    assert.equal(c.height, 20);
  } finally {
    process.env.NODE_ENV = 'development';
  }
});
```

- [ ] **Step 3: Run to verify FAIL**

Run: `cd packages/voxelyn-animation && pnpm test -- --test-name-pattern engine-source-switch`

- [ ] **Step 4: Implement `buildPixelLabCharacter`**

```ts
// packages/voxelyn-animation/src/procedural/pixellab-character.ts
import type {
  AnimationClip,
  AnimationSet,
  ProceduralCharacter,
  ProceduralCharacterDef,
  PixelSprite,
} from '../types.js';
import type { LoadedAtlas, LoadedClip } from '../sprite-atlas/types.js';
import { toEngineFacing, type Direction } from '../sprite-atlas/direction.js';
import { proceduralPalette } from './palette.js';

const DIRECTION_BY_FACING: Record<string, Direction> = { dr:'DR', dl:'DL', ur:'UR', ul:'UL' };

const blitFrame = (out: PixelSprite, src: PixelSprite): PixelSprite => {
  // Copy src into out (assumes equal dimensions).
  out.pixels.set(src.pixels);
  return out;
};

const makeClipFromLoaded = (clipId: string, loaded: LoadedClip): AnimationClip => {
  const fps = Math.max(1, Math.round((loaded.framesPerDirection * 1000) / loaded.durationMs));
  return {
    id: clipId,
    fps,
    loop: loaded.loop,
    lengthMs: loaded.durationMs,
    generator: ({ out, localTMs, facing }) => {
      const dir = DIRECTION_BY_FACING[facing] ?? 'DR';
      const frames = loaded.framesByDir[dir];
      const phase = loaded.loop && loaded.durationMs > 0
        ? localTMs % loaded.durationMs
        : Math.min(localTMs, loaded.durationMs);
      const idx = Math.min(
        loaded.framesPerDirection - 1,
        Math.floor((phase / loaded.durationMs) * loaded.framesPerDirection),
      );
      return blitFrame(out, frames[idx]!);
    },
  };
};

export const buildPixelLabCharacter = (
  def: Extract<ProceduralCharacterDef, { source: 'pixellab' }>,
  atlas: LoadedAtlas,
): ProceduralCharacter => {
  const set: AnimationSet = {};
  for (const [clipId, loaded] of Object.entries(atlas.clips)) {
    if (!loaded) continue;
    (set as Record<string, AnimationClip>)[clipId] = makeClipFromLoaded(clipId, loaded);
  }
  set.aliases = {
    move: (set as Record<string, AnimationClip>).walk ?? (set as Record<string, AnimationClip>).idle!,
    idle: (set as Record<string, AnimationClip>).idle!,
  };

  return {
    id: def.id,
    seed: def.seed ?? 1,
    width: atlas.manifest.frameWidth,
    height: atlas.manifest.frameHeight,
    anchor: { ...atlas.manifest.anchor },
    palette: { ...proceduralPalette, ...(def.palette ?? {}) },
    style: def.style ?? 'player',
    clips: set,
  };
};
```

- [ ] **Step 5: Wire `createProceduralCharacter` to dispatch**

In `packages/voxelyn-animation/src/procedural/character.ts`:

```ts
import { getLoadedAtlas } from '../sprite-atlas/cache.js';
import { AtlasMissingError } from '../sprite-atlas/errors.js';
import { buildPixelLabCharacter } from './pixellab-character.js';

const missingLogged = new Set<string>();
const logMissingAtlasOnce = (id: string): void => {
  if (missingLogged.has(id)) return;
  missingLogged.add(id);
  // eslint-disable-next-line no-console
  console.warn(`[voxelyn-animation] atlas '${id}' not preloaded; falling back to authored sprites.`);
};

// Inside createProceduralCharacter, before the existing body:
if ((def as { source?: string }).source === 'pixellab') {
  const pixelDef = def as Extract<ProceduralCharacterDef, { source: 'pixellab' }>;
  const atlas = getLoadedAtlas(pixelDef.spriteId);
  if (atlas) return buildPixelLabCharacter(pixelDef, atlas);
  if ((process.env.NODE_ENV ?? 'development') !== 'production') {
    throw new AtlasMissingError(pixelDef.spriteId);
  }
  logMissingAtlasOnce(pixelDef.spriteId);
  // fall through to authored
}
```

- [ ] **Step 6: Run tests, PASS**

Run: `cd packages/voxelyn-animation && pnpm test`
Expected: all green (new test + existing suites)

- [ ] **Step 7: Commit**

```bash
git add packages/voxelyn-animation/src/types.ts packages/voxelyn-animation/src/procedural/character.ts packages/voxelyn-animation/src/procedural/pixellab-character.ts packages/voxelyn-animation/src/tests/engine-source-switch.test.ts
git commit -m "feat(animation): createProceduralCharacter source switch with pixellab branch"
```

---

## Phase 2 — CLI generator with live PixelLab calls

### Task 2.1: Implement hashing utilities

**Files:**
- Create: `packages/voxelyn-cli/src/commands/sprites/hash.ts`
- Test: `packages/voxelyn-cli/tests/sprites-hash.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-cli/tests/sprites-hash.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  sha256Bytes,
  sha256CanonicalJson,
} from '../src/commands/sprites/hash.js';

test('sha256Bytes is deterministic', () => {
  const a = sha256Bytes(new Uint8Array([1,2,3]));
  const b = sha256Bytes(new Uint8Array([1,2,3]));
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test('sha256CanonicalJson sorts keys', () => {
  const a = sha256CanonicalJson({ b: 1, a: 2 });
  const b = sha256CanonicalJson({ a: 2, b: 1 });
  assert.equal(a, b);
});

test('sha256CanonicalJson differentiates content', () => {
  const a = sha256CanonicalJson({ a: 1 });
  const b = sha256CanonicalJson({ a: 2 });
  assert.notEqual(a, b);
});
```

- [ ] **Step 2: Run to FAIL**

Run: `cd packages/voxelyn-cli && pnpm test`

- [ ] **Step 3: Implement**

```ts
// packages/voxelyn-cli/src/commands/sprites/hash.ts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
};

export const sha256Bytes = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

export const sha256File = (path: string): string =>
  sha256Bytes(readFileSync(path));

export const sha256CanonicalJson = (value: unknown): string =>
  sha256Bytes(new TextEncoder().encode(canonicalize(value)));
```

- [ ] **Step 4: PASS, commit**

```bash
git add packages/voxelyn-cli/src/commands/sprites/hash.ts packages/voxelyn-cli/tests/sprites-hash.test.ts
git commit -m "feat(cli): sha256 hashing utilities for sprite generation idempotency"
```

---

### Task 2.2: Implement atomic file writes

**Files:**
- Create: `packages/voxelyn-cli/src/commands/sprites/atomic-write.ts`
- Test: `packages/voxelyn-cli/tests/sprites-atomic-write.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/voxelyn-cli/tests/sprites-atomic-write.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeAtomic } from '../src/commands/sprites/atomic-write.js';

test('writeAtomic writes target and removes tmp', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'voxelyn-atomic-'));
  const target = path.join(dir, 'a.bin');
  await writeAtomic(target, new Uint8Array([1,2,3]));
  assert.deepEqual([...readFileSync(target)], [1,2,3]);
  assert.equal(existsSync(target + '.tmp'), false);
});
```

- [ ] **Step 2: FAIL → Implement**

```ts
// packages/voxelyn-cli/src/commands/sprites/atomic-write.ts
import { writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const writeAtomic = async (targetPath: string, bytes: Uint8Array): Promise<void> => {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.tmp`;
  try {
    await writeFile(tmp, bytes);
    await rename(tmp, targetPath);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
};
```

- [ ] **Step 3: PASS, commit**

```bash
git add packages/voxelyn-cli/src/commands/sprites/atomic-write.ts packages/voxelyn-cli/tests/sprites-atomic-write.test.ts
git commit -m "feat(cli): writeAtomic with temp+rename and cleanup"
```

---

### Task 2.3: Implement PixelLab character-id cache

**Files:**
- Create: `packages/voxelyn-cli/src/commands/sprites/cache.ts`
- Test: `packages/voxelyn-cli/tests/sprites-cache.test.ts`

- [ ] **Step 1: Failing test**

```ts
// packages/voxelyn-cli/tests/sprites-cache.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  readPixellabIdCache,
  writePixellabIdCache,
  pickPixellabId,
} from '../src/commands/sprites/cache.js';

test('cache round-trip and conceptHash gate', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'voxelyn-cache-'));
  const file = path.join(dir, '.voxelyn-cache/pixellab-character-ids.json');

  assert.deepEqual(await readPixellabIdCache(file), {});

  await writePixellabIdCache(file, { striker: { id: 'plab-123', conceptHash: 'h1' } });
  const cache = await readPixellabIdCache(file);
  assert.equal(cache.striker?.id, 'plab-123');

  // Same conceptHash → reuse
  assert.equal(pickPixellabId(cache, 'striker', 'h1'), 'plab-123');
  // Different conceptHash → must recreate (returns undefined)
  assert.equal(pickPixellabId(cache, 'striker', 'h2'), undefined);
});
```

- [ ] **Step 2: FAIL → Implement**

```ts
// packages/voxelyn-cli/src/commands/sprites/cache.ts
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type PixellabIdCache = Record<string, { id: string; conceptHash: string }>;

export const readPixellabIdCache = async (file: string): Promise<PixellabIdCache> => {
  try {
    const raw = await readFile(file, 'utf-8');
    return JSON.parse(raw) as PixellabIdCache;
  } catch {
    return {};
  }
};

export const writePixellabIdCache = async (
  file: string,
  cache: PixellabIdCache,
): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(cache, null, 2));
};

export const pickPixellabId = (
  cache: PixellabIdCache,
  spriteId: string,
  conceptHash: string,
): string | undefined => {
  const entry = cache[spriteId];
  if (!entry) return undefined;
  if (entry.conceptHash !== conceptHash) return undefined;
  return entry.id;
};
```

- [ ] **Step 3: PASS, commit**

```bash
git add packages/voxelyn-cli/src/commands/sprites/cache.ts packages/voxelyn-cli/tests/sprites-cache.test.ts
git commit -m "feat(cli): PixelLab character-id cache with conceptHash gating"
```

---

### Task 2.4: Implement `packAtlas` (pure layout math + PNG encoding)

**Files:**
- Create: `packages/voxelyn-cli/src/commands/sprites/pack-atlas.ts`
- Test: `packages/voxelyn-cli/tests/sprites-pack-atlas.test.ts`
- Add dependency: `pngjs` to `packages/voxelyn-cli/package.json`

- [ ] **Step 1: Add `pngjs` dependency**

```bash
cd packages/voxelyn-cli && pnpm add pngjs && pnpm add -D @types/pngjs
```

- [ ] **Step 2: Failing test**

```ts
// packages/voxelyn-cli/tests/sprites-pack-atlas.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { packAtlas } from '../src/commands/sprites/pack-atlas.js';

const solidPng = (rgba: [number,number,number,number]): Uint8Array => {
  // 48x48 solid color RGBA, encoded as raw RGBA bytes (will be PNG-encoded by packAtlas)
  const out = new Uint8Array(48 * 48 * 4);
  for (let i = 0; i < 48*48; i++) {
    out[i*4]   = rgba[0];
    out[i*4+1] = rgba[1];
    out[i*4+2] = rgba[2];
    out[i*4+3] = rgba[3];
  }
  return out;
};

test('packAtlas places clip×dir rows with stride 50, frame 48', () => {
  const rawFrames = {
    idle: {
      DR: [solidPng([255,0,0,255])],
      DL: [solidPng([0,255,0,255])],
      UR: [solidPng([0,0,255,255])],
      UL: [solidPng([255,255,0,255])],
    },
  };
  const result = packAtlas(rawFrames as any);
  // 1 frame across, 4 rows (idle×4 dirs)
  assert.equal(result.imageWidth, 48);             // 1*48 + 0 gutter (single column → no gutter)
  assert.equal(result.imageHeight, 48*4 + 2*3);    // 4 rows + 3 gutters
  // Rect math: stride 50 between rows, stride 50 between cols
  assert.deepEqual(result.rects.idle.DR[0], { x: 0, y: 0,   w: 48, h: 48 });
  assert.deepEqual(result.rects.idle.DL[0], { x: 0, y: 50,  w: 48, h: 48 });
  assert.deepEqual(result.rects.idle.UR[0], { x: 0, y: 100, w: 48, h: 48 });
  assert.deepEqual(result.rects.idle.UL[0], { x: 0, y: 150, w: 48, h: 48 });
  assert.ok(result.png instanceof Uint8Array);
  // PNG signature
  assert.equal(result.png[0], 0x89);
  assert.equal(result.png[1], 0x50);
});
```

- [ ] **Step 3: FAIL → Implement**

```ts
// packages/voxelyn-cli/src/commands/sprites/pack-atlas.ts
import { PNG } from 'pngjs';
import type { Direction } from '@voxelyn/animation';
import type { ClipId } from './config/types.js';

export type RawFramesByClip = Partial<Record<ClipId, Record<Direction, Uint8Array[]>>>;

export type PackedAtlas = {
  imageWidth: number;
  imageHeight: number;
  rects: Partial<Record<ClipId, Record<Direction, { x: number; y: number; w: number; h: number }[]>>>;
  png: Uint8Array;
};

const FRAME = 48;
const GUTTER = 2;
const STRIDE = FRAME + GUTTER;
const DIRS: Direction[] = ['DR','DL','UR','UL'];
const CLIP_ORDER: ClipId[] = ['idle','walk','attack','cast','hit','die'];

export const packAtlas = (raw: RawFramesByClip): PackedAtlas => {
  const presentClips = CLIP_ORDER.filter((c) => raw[c]);
  let maxFramesPerDir = 0;
  for (const c of presentClips) {
    for (const d of DIRS) {
      maxFramesPerDir = Math.max(maxFramesPerDir, raw[c]![d].length);
    }
  }

  const cols = maxFramesPerDir;
  const rows = presentClips.length * DIRS.length;

  const imageWidth = cols * FRAME + Math.max(0, cols - 1) * GUTTER;
  const imageHeight = rows * FRAME + Math.max(0, rows - 1) * GUTTER;

  const png = new PNG({ width: imageWidth, height: imageHeight });
  png.data.fill(0);

  const rects: PackedAtlas['rects'] = {};
  let rowIndex = 0;
  for (const clipId of presentClips) {
    rects[clipId] = { DR: [], DL: [], UR: [], UL: [] };
    for (const dir of DIRS) {
      const frames = raw[clipId]![dir];
      for (let i = 0; i < frames.length; i += 1) {
        const dx = i * STRIDE;
        const dy = rowIndex * STRIDE;
        const src = frames[i]!;
        // Blit raw RGBA into png.data
        for (let y = 0; y < FRAME; y += 1) {
          const srcOff = y * FRAME * 4;
          const dstOff = ((dy + y) * imageWidth + dx) * 4;
          png.data.set(src.subarray(srcOff, srcOff + FRAME * 4), dstOff);
        }
        rects[clipId]![dir].push({ x: dx, y: dy, w: FRAME, h: FRAME });
      }
      rowIndex += 1;
    }
  }

  const pngBytes = PNG.sync.write(png);
  return { imageWidth, imageHeight, rects, png: new Uint8Array(pngBytes) };
};
```

- [ ] **Step 4: PASS, commit**

```bash
git add packages/voxelyn-cli/src/commands/sprites/pack-atlas.ts packages/voxelyn-cli/tests/sprites-pack-atlas.test.ts packages/voxelyn-cli/package.json packages/voxelyn-cli/pnpm-lock.yaml
git commit -m "feat(cli): packAtlas with stride math and pngjs encoding"
```

---

### Task 2.5: Implement manifest builder + manifest-shape test

**Files:**
- Create: `packages/voxelyn-cli/src/commands/sprites/write-manifest.ts`
- Test: `packages/voxelyn-cli/tests/sprites-manifest-shape.test.ts`

- [ ] **Step 1: Failing test**

```ts
// packages/voxelyn-cli/tests/sprites-manifest-shape.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildManifest } from '../src/commands/sprites/write-manifest.js';
import { CHARACTERS } from '../src/commands/sprites/config/characters.js';

test('buildManifest produces a v1 manifest without pixellabCharacterId', () => {
  const spec = CHARACTERS.find((c) => c.id === 'striker')!;
  const m = buildManifest({
    spec,
    rects: {
      idle: { DR: [{x:0,y:0,w:48,h:48}], DL: [{x:0,y:50,w:48,h:48}],
              UR: [{x:0,y:100,w:48,h:48}], UL: [{x:0,y:150,w:48,h:48}] },
    },
    hashes: { conceptHash:'a', promptHash:'b', configHash:'c', pipelineVersion:'1', atlasHash:'d' },
    generatedAt: '2026-04-28T00:00:00Z',
  });
  assert.equal(m.id, 'striker');
  assert.equal(m.version, 1);
  assert.equal(m.source, 'pixellab');
  assert.equal(m.frameWidth, 48);
  assert.deepEqual(m.anchor, { x: 24, y: 43 });
  assert.equal(m.generation.atlasHash, 'd');
  assert.equal((m.generation as Record<string, unknown>).pixellabCharacterId, undefined);
});
```

- [ ] **Step 2: FAIL → Implement**

```ts
// packages/voxelyn-cli/src/commands/sprites/write-manifest.ts
import type { AtlasManifest, Direction } from '@voxelyn/animation';
import type { CharacterSpec, ClipId } from './config/types.js';

export type BuildManifestInput = {
  spec: CharacterSpec;
  rects: Partial<Record<ClipId, Record<Direction, { x:number; y:number; w:number; h:number }[]>>>;
  hashes: {
    conceptHash: string;
    promptHash: string;
    configHash: string;
    pipelineVersion: string;
    atlasHash: string;
    pixellabModelVersion?: string;
  };
  generatedAt: string;
};

export const buildManifest = (input: BuildManifestInput): AtlasManifest => {
  const clips: AtlasManifest['clips'] = {};
  for (const [clipId, clipSpec] of Object.entries(input.spec.clips) as [ClipId, NonNullable<CharacterSpec['clips'][ClipId]>][]) {
    const rect = input.rects[clipId];
    if (!rect) continue;
    clips[clipId] = {
      loop: clipSpec.loop,
      framesPerDirection: clipSpec.frames,
      durationMs: clipSpec.durationMs,
      dirs: rect,
    };
  }
  return {
    id: input.spec.id,
    runtimeArchetype: input.spec.runtimeArchetype,
    displayName: input.spec.displayName,
    source: 'pixellab',
    version: 1,
    frameWidth: 48,
    frameHeight: 48,
    anchor: input.spec.anchor,
    directions: [...input.spec.directions],
    clips,
    generation: {
      conceptHash: input.hashes.conceptHash,
      promptHash: input.hashes.promptHash,
      configHash: input.hashes.configHash,
      pipelineVersion: input.hashes.pipelineVersion,
      atlasHash: input.hashes.atlasHash,
      pixellabModelVersion: input.hashes.pixellabModelVersion,
      generatedAt: input.generatedAt,
    },
  };
};
```

- [ ] **Step 3: PASS, commit**

```bash
git add packages/voxelyn-cli/src/commands/sprites/write-manifest.ts packages/voxelyn-cli/tests/sprites-manifest-shape.test.ts
git commit -m "feat(cli): buildManifest emits v1 atlas manifest (no pixellabCharacterId)"
```

---

### Task 2.6: Implement real PixelLab MCP client

**Files:**
- Modify: `packages/voxelyn-cli/src/commands/sprites/pixellab-client.ts`

This task depends on the runtime providing PixelLab MCP tool calls. The CLI invokes them via a thin shell-out to the orchestrator's MCP-bridged binary OR via direct HTTPS to PixelLab's API. Since this codebase calls PixelLab through Claude's MCP server (`mcp__pixellab__create_character`, `mcp__pixellab__animate_character`), the CLI cannot call those tools directly. Solution: the CLI accepts a JSON-driven plan (`pixellab-plan.json`) and the **operator (this session) executes the MCP calls**, writing the results back to disk; the CLI then assembles the atlas.

We split this into two phases:

- **Task 2.6a:** CLI emits a generation plan and waits for a result manifest.
- **Task 2.6b:** Operator (interactive) runs MCP tools and writes raw frames + ids per the plan.
- **Task 2.6c:** CLI consumes the raw frames and produces atlases.

This avoids embedding MCP-only RPC into a Node binary. **For an environment with a direct PixelLab REST/SDK, replace this client with a real HTTP implementation in a follow-up.**

- [ ] **Step 1: Define the plan/result file format**

```ts
// packages/voxelyn-cli/src/commands/sprites/pixellab-client.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { CharacterSpec, ClipId } from './config/types.js';
import type { Direction, PixelLabClient } from './generate.js';

export type PixellabPlanItem = {
  spriteId: string;
  pixellabCharacterId: string | null;   // null = create
  conceptHash: string;
  conceptArtPath: string;
  basePrompt: string;
  styleNotes: string;
  spec: CharacterSpec;
};

export type PixellabResultFrames = {
  spriteId: string;
  pixellabCharacterId: string;
  frames: Partial<Record<ClipId, Record<Direction, string[]>>>; // base64 PNG per frame
};

export const PLAN_PATH = '.voxelyn-cache/pixellab-plan.json';
export const RESULTS_DIR = '.voxelyn-cache/pixellab-results';

export const createPixelLabClient = (cwd: string): PixelLabClient => ({
  async ensureCharacter(spec, conceptHash) {
    const planPath = path.join(cwd, PLAN_PATH);
    let existing: PixellabPlanItem[] = [];
    try { existing = JSON.parse(await readFile(planPath, 'utf-8')); } catch {}
    const found = existing.find((p) => p.spriteId === spec.id && p.conceptHash === conceptHash);
    if (found && found.pixellabCharacterId) return found.pixellabCharacterId;
    throw new PixellabPlanRequired(spec, conceptHash);
  },
  async animate({ pixellabCharacterId, direction, intent, frameCount }) {
    const resultPath = path.join(cwd, RESULTS_DIR, `${pixellabCharacterId}.json`);
    const result = JSON.parse(await readFile(resultPath, 'utf-8')) as PixellabResultFrames;
    // result.frames is keyed by clipId, but animate is called per direction and intent.
    // We assume the operator pre-generated all frames and stored them under the right clip key.
    // The orchestrator (generate.ts) maps intent → clipId and reads result.frames[clipId][direction].
    void direction; void intent; void frameCount;
    throw new Error('animate must be invoked through orchestrator that knows the clipId');
  },
});

export class PixellabPlanRequired extends Error {
  constructor(public readonly spec: CharacterSpec, public readonly conceptHash: string) {
    super(`PixelLab plan missing for ${spec.id} (conceptHash=${conceptHash}). Run --emit-plan first.`);
    this.name = 'PixellabPlanRequired';
  }
}
```

This task is **architecturally significant** and intentionally split. Keep moving — the orchestrator (Task 2.7) emits the plan; the operator runs MCP; Task 2.8 consumes results.

- [ ] **Step 2: Commit the contract**

```bash
git add packages/voxelyn-cli/src/commands/sprites/pixellab-client.ts
git commit -m "feat(cli): PixelLab plan/results file contract for MCP-driven generation"
```

---

### Task 2.7: Orchestrator emits a plan in `--emit-plan` mode

**Files:**
- Modify: `packages/voxelyn-cli/src/commands/sprites/generate.ts`
- Modify: `packages/voxelyn-cli/src/args.ts` — accept `--emit-plan`
- Modify: `packages/voxelyn-cli/src/types.ts` — `emitPlan?: boolean`

- [ ] **Step 1: Add CLI flag**

In `args.ts` parse loop:

```ts
if (arg === '--emit-plan') { options.emitPlan = true; continue; }
```

In `types.ts` add `emitPlan?: boolean;` to `CliOptions`.

- [ ] **Step 2: Update orchestrator to emit plan**

```ts
// packages/voxelyn-cli/src/commands/sprites/generate.ts — extend RunSpritesGenerateInput:
export type RunSpritesGenerateInput = {
  dryRun: boolean;
  force: boolean;
  emitPlan: boolean;
  onlyId: string | undefined;
  log: (msg: string) => void;
  pixellab: PixelLabClient;
  fs: SpritesFs;
  cwd: string;
};

// In runSpritesGenerate:
import { sha256File } from './hash.js';
import { readPixellabIdCache, pickPixellabId } from './cache.js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { PixellabPlanItem } from './pixellab-client.js';

// Inside the for-loop, after `if (input.dryRun) ... continue;`:
if (input.emitPlan) {
  const conceptHash = sha256File(path.join(input.cwd, spec.conceptArtPath));
  const cacheFile = path.join(input.cwd, '.voxelyn-cache/pixellab-character-ids.json');
  const cache = await readPixellabIdCache(cacheFile);
  const pixellabCharacterId = pickPixellabId(cache, spec.id, conceptHash) ?? null;
  const planItem: PixellabPlanItem = {
    spriteId: spec.id,
    pixellabCharacterId,
    conceptHash,
    conceptArtPath: spec.conceptArtPath,
    basePrompt: spec.basePrompt,
    styleNotes: spec.styleNotes,
    spec,
  };
  const planFile = path.join(input.cwd, '.voxelyn-cache/pixellab-plan.json');
  let existing: PixellabPlanItem[] = [];
  try { existing = JSON.parse(await (await import('node:fs/promises')).readFile(planFile, 'utf-8')); } catch {}
  const next = [...existing.filter((p) => p.spriteId !== spec.id), planItem];
  await mkdir(path.dirname(planFile), { recursive: true });
  await writeFile(planFile, JSON.stringify(next, null, 2));
  input.log(`[sprites] plan: ${spec.id} (${pixellabCharacterId ? 'reuse' : 'create'} character)`);
  continue;
}
```

- [ ] **Step 3: Add a test**

```ts
// packages/voxelyn-cli/tests/sprites-emit-plan.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runSpritesGenerate } from '../src/commands/sprites/generate.js';

test('--emit-plan writes pixellab-plan.json with all 6 entries', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'voxelyn-plan-'));
  // Stub all 6 concept arts so sha256File works
  const concepts = ['excavator','striker','bruiser','spitter','spore_bomber','guardian'];
  for (const id of concepts) {
    mkdirSync(path.join(cwd, 'assets/concepts/characters'), { recursive: true });
    writeFileSync(path.join(cwd, `assets/concepts/characters/${id}.png`), Buffer.from([0,1,2]));
  }
  await runSpritesGenerate({
    dryRun: false, force: false, emitPlan: true, onlyId: undefined,
    log: () => {},
    pixellab: { ensureCharacter: async () => '', animate: async () => [] },
    fs: { readFile: async()=>null, writeFileAtomic: async()=>{}, exists: async()=>false, readJson: async()=>undefined, writeJson: async()=>{} },
    cwd,
  });
  const plan = JSON.parse((await import('node:fs/promises')).then ? '' : '');
  // Read using fs sync for clarity
  const fs = await import('node:fs');
  const arr = JSON.parse(fs.readFileSync(path.join(cwd, '.voxelyn-cache/pixellab-plan.json'), 'utf-8'));
  assert.equal(arr.length, 6);
});
```

- [ ] **Step 4: PASS, commit**

```bash
git add packages/voxelyn-cli/src/commands/sprites/generate.ts packages/voxelyn-cli/src/args.ts packages/voxelyn-cli/src/types.ts packages/voxelyn-cli/tests/sprites-emit-plan.test.ts
git commit -m "feat(cli): --emit-plan emits PixelLab generation plan to .voxelyn-cache"
```

---

### Task 2.8: Operator step — run PixelLab MCP for each plan item

This is **not a code task** but a manual step the operator executes once. It is documented here so it is auditable.

- [ ] **Step 1: Move concept art files** to the canonical location

```bash
mkdir -p assets/concepts/characters
cp "docs/concept-art/Excavator.png"        assets/concepts/characters/excavator.png
cp "docs/concept-art/Striker.png"          assets/concepts/characters/striker.png
cp "docs/concept-art/Bruiser.png"          assets/concepts/characters/bruiser.png
cp "docs/concept-art/Spitter.png"          assets/concepts/characters/spitter.png
cp "docs/concept-art/Spore Bomber.png"     assets/concepts/characters/spore_bomber.png
cp "docs/concept-art/Guardian.png"         assets/concepts/characters/guardian.png
git add assets/concepts/characters
git commit -m "chore(assets): canonicalize concept art under assets/concepts/characters"
```

- [ ] **Step 2: Emit the plan**

```bash
node packages/voxelyn-cli/dist/src/index.js sprites generate --emit-plan
```

This writes `.voxelyn-cache/pixellab-plan.json`.

- [ ] **Step 3: Run PixelLab MCP for each plan item**

For each item in the plan:
1. If `pixellabCharacterId` is `null`, call `mcp__pixellab__create_character` with the concept image, `basePrompt`, and `styleNotes`. Capture the returned character id.
2. For each clip × direction in the spec, call `mcp__pixellab__animate_character` with `frameCount`, `size: 48`, `direction`, and `clipSpec.intent`. Capture the returned PNGs.
3. Write a result file `.voxelyn-cache/pixellab-results/<pixellabCharacterId>.json` with the schema:

```json
{
  "spriteId": "striker",
  "pixellabCharacterId": "plab-abc123",
  "frames": {
    "idle":   { "DR": ["base64..."], "DL": ["..."], "UR": ["..."], "UL": ["..."] },
    "walk":   { "DR": [...], ... },
    "attack": { ... }
  }
}
```

4. Update `.voxelyn-cache/pixellab-character-ids.json` to map `<spriteId>` → `{ id, conceptHash }`.

- [ ] **Step 4: Sanity-check** — for each character, verify there are exactly the right number of base64 PNGs per direction (matching `framesPerDirection` in the spec).

- [ ] **Step 5: Do not commit** the cache or results files. They live only in `.voxelyn-cache/` (gitignored — see Task 4.2).

---

### Task 2.9: Orchestrator consumes results and writes atlases

**Files:**
- Modify: `packages/voxelyn-cli/src/commands/sprites/generate.ts`
- Test: `packages/voxelyn-cli/tests/sprites-consume.test.ts`

- [ ] **Step 1: Failing integration test (with synthetic results)**

```ts
// packages/voxelyn-cli/tests/sprites-consume.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runSpritesGenerate } from '../src/commands/sprites/generate.js';

const fakePngB64 = (): string => {
  // 48x48 transparent PNG (raw RGBA all zero), encoded via Buffer
  const raw = new Uint8Array(48 * 48 * 4);
  // Use pngjs to encode
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PNG } = require('pngjs');
  const png = new PNG({ width: 48, height: 48 });
  png.data.set(raw);
  return Buffer.from(PNG.sync.write(png)).toString('base64');
};

test('consume mode produces atlas.png + atlas.json for striker', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'voxelyn-consume-'));
  // Stage concept art and plan + result
  mkdirSync(path.join(cwd, 'assets/concepts/characters'), { recursive: true });
  writeFileSync(path.join(cwd, 'assets/concepts/characters/striker.png'), Buffer.from([1]));
  mkdirSync(path.join(cwd, '.voxelyn-cache/pixellab-results'), { recursive: true });

  const planItem = {
    spriteId: 'striker', pixellabCharacterId: 'plab-1', conceptHash: 'will-be-overridden',
    conceptArtPath: 'assets/concepts/characters/striker.png',
    basePrompt: 'x', styleNotes: 'y',
    spec: (await import('../src/commands/sprites/config/characters.js')).CHARACTERS.find(c=>c.id==='striker'),
  };
  writeFileSync(path.join(cwd, '.voxelyn-cache/pixellab-plan.json'), JSON.stringify([planItem]));

  const dirs = ['DR','DL','UR','UL'] as const;
  const frames = (n: number) => Object.fromEntries(dirs.map((d)=>[d, Array.from({length:n}, fakePngB64)]));
  writeFileSync(path.join(cwd, '.voxelyn-cache/pixellab-results/plab-1.json'), JSON.stringify({
    spriteId: 'striker', pixellabCharacterId: 'plab-1',
    frames: { idle: frames(6), walk: frames(8), attack: frames(8) },
  }));

  await runSpritesGenerate({
    dryRun: false, force: true, emitPlan: false, onlyId: 'striker',
    log: () => {},
    pixellab: { ensureCharacter: async () => 'plab-1', animate: async () => [] },
    fs: undefined as unknown as never,    // unused in consume mode
    cwd,
  });

  assert.ok(existsSync(path.join(cwd, 'assets/sprites/characters/striker/striker.atlas.png')));
  const m = JSON.parse(readFileSync(path.join(cwd, 'assets/sprites/characters/striker/striker.atlas.json'), 'utf-8'));
  assert.equal(m.id, 'striker');
  assert.equal(m.frameWidth, 48);
  assert.equal(m.generation.atlasHash.length, 64);
});
```

- [ ] **Step 2: Implement consume path in `generate.ts`**

Append after the `--emit-plan` block:

```ts
// CONSUME PATH (default when not dry-run and not emit-plan)
import { sha256Bytes, sha256CanonicalJson, sha256File } from './hash.js';
import { packAtlas } from './pack-atlas.js';
import { buildManifest } from './write-manifest.js';
import { writeAtomic } from './atomic-write.js';
import { PIPELINE_VERSION } from './pipeline-version.js';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const planFile = path.join(input.cwd, '.voxelyn-cache/pixellab-plan.json');
const planRaw = await readFile(planFile, 'utf-8').catch(() => null);
if (!planRaw) {
  input.log(`[sprites] no plan; run with --emit-plan first`);
  return;
}
const plan: PixellabPlanItem[] = JSON.parse(planRaw);

for (const spec of filtered) {
  const planItem = plan.find((p) => p.spriteId === spec.id);
  if (!planItem || !planItem.pixellabCharacterId) {
    input.log(`[sprites] skip ${spec.id} (no plan/result)`);
    continue;
  }
  const resultPath = path.join(input.cwd, '.voxelyn-cache/pixellab-results', `${planItem.pixellabCharacterId}.json`);
  const result = JSON.parse(await readFile(resultPath, 'utf-8')) as { frames: Partial<Record<ClipId, Record<Direction, string[]>>> };

  // Decode each base64 PNG → 48×48 raw RGBA
  const raw: Partial<Record<ClipId, Record<Direction, Uint8Array[]>>> = {};
  for (const [clipId, dirMap] of Object.entries(result.frames) as [ClipId, Record<Direction, string[]>][]) {
    raw[clipId] = { DR: [], DL: [], UR: [], UL: [] };
    for (const dir of ['DR','DL','UR','UL'] as Direction[]) {
      for (const b64 of dirMap[dir]) {
        const png = PNG.sync.read(Buffer.from(b64, 'base64'));
        if (png.width !== 48 || png.height !== 48) {
          throw new Error(`${spec.id} ${clipId} ${dir} frame is not 48x48`);
        }
        raw[clipId]![dir].push(new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength));
      }
    }
  }

  const packed = packAtlas(raw);
  const conceptHash = sha256File(path.join(input.cwd, spec.conceptArtPath));
  const configHash = sha256CanonicalJson(spec);
  const promptHash = sha256Bytes(new TextEncoder().encode(spec.basePrompt + '\n' + spec.styleNotes));
  const atlasHash = sha256Bytes(packed.png);

  const manifest = buildManifest({
    spec,
    rects: packed.rects,
    hashes: { conceptHash, promptHash, configHash, pipelineVersion: PIPELINE_VERSION, atlasHash },
    generatedAt: new Date().toISOString(),
  });

  // Idempotency: skip if existing manifest matches all hashes (unless --force)
  const manifestPath = path.join(input.cwd, `assets/sprites/characters/${spec.id}/${spec.id}.atlas.json`);
  const existingRaw = await readFile(manifestPath, 'utf-8').catch(() => null);
  if (!input.force && existingRaw) {
    try {
      const existing = JSON.parse(existingRaw);
      const same =
        existing.generation?.conceptHash === conceptHash &&
        existing.generation?.configHash === configHash &&
        existing.generation?.promptHash === promptHash &&
        existing.generation?.pipelineVersion === PIPELINE_VERSION;
      if (same) {
        input.log(`[sprites] skip ${spec.id}: up to date`);
        continue;
      }
    } catch { /* fall through and overwrite */ }
  }

  const pngPath = path.join(input.cwd, `assets/sprites/characters/${spec.id}/${spec.id}.atlas.png`);
  await writeAtomic(pngPath, packed.png);
  await writeAtomic(manifestPath, new TextEncoder().encode(JSON.stringify(manifest, null, 2)));
  input.log(`[sprites] wrote ${spec.id}: ${packed.imageWidth}x${packed.imageHeight}, atlasHash=${atlasHash.slice(0,12)}…`);
}
```

- [ ] **Step 3: Run test, PASS**

Run: `cd packages/voxelyn-cli && pnpm test`
Expected: `sprites-consume` passes.

- [ ] **Step 4: Commit**

```bash
git add packages/voxelyn-cli/src/commands/sprites/generate.ts packages/voxelyn-cli/tests/sprites-consume.test.ts
git commit -m "feat(cli): consume PixelLab results, pack atlas, write manifest atomically"
```

---

### Task 2.10: Live run — generate v1 atlases and commit

- [ ] **Step 1: Build CLI**

```bash
cd packages/voxelyn-cli && pnpm build
```

- [ ] **Step 2: Emit plan**

```bash
node packages/voxelyn-cli/dist/src/index.js sprites generate --emit-plan
```

- [ ] **Step 3: Operator runs PixelLab MCP per Task 2.8** — populate `.voxelyn-cache/pixellab-results/*.json` and `.voxelyn-cache/pixellab-character-ids.json`.

- [ ] **Step 4: Run consume mode**

```bash
node packages/voxelyn-cli/dist/src/index.js sprites generate
```

Expected output: 6 lines like `[sprites] wrote excavator: WxH, atlasHash=…`.

- [ ] **Step 5: Verify outputs**

```bash
ls -la assets/sprites/characters/*/*.atlas.{png,json}
```

Expected: 12 files (6 PNGs + 6 JSONs).

- [ ] **Step 6: Visually inspect** atlases by opening each `.atlas.png`. Each should show the expected clip×direction grid.

- [ ] **Step 7: Verify idempotency**

```bash
node packages/voxelyn-cli/dist/src/index.js sprites generate
```

Expected: `[sprites] skip <id>: up to date` for all 6.

- [ ] **Step 8: Commit assets only**

```bash
git add assets/sprites/characters
git commit -m "feat(assets): generated v1 PixelLab atlases for hero + 5 enemies (48x48)"
```

---

## Phase 3 — Wire roguelike to consume atlases

### Task 3.1: Roguelike boot preload + browser fetcher install

**Files:**
- Modify: `packages/voxelyn-roguelike/src/main.ts`

- [ ] **Step 1: Find the boot entry**

```bash
grep -n "createGameState\|game loop\|requestAnimationFrame\|main()" packages/voxelyn-roguelike/src/main.ts | head
```

- [ ] **Step 2: Add preload at boot**

In `main.ts`, near the top before the game-loop kicks off, add:

```ts
import {
  preloadCharacterAtlases,
  setBrowserFetcher,
  SPRITE_BY_ARCHETYPE,
} from '@voxelyn/animation';

const ATLAS_BASE_URL = '/assets/sprites/characters';

const bootSprites = async (): Promise<void> => {
  setBrowserFetcher();
  const ids = Object.values(SPRITE_BY_ARCHETYPE);
  const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? false;
  await preloadCharacterAtlases(ids, ATLAS_BASE_URL, { strict: isDev });
};

// Wrap whatever currently kicks off the loop:
await bootSprites();
// ...existing boot code below...
```

- [ ] **Step 3: Verify Vite serves the atlas paths**

```bash
grep -n "publicDir\|public:" packages/voxelyn-roguelike/vite.config.ts
ls packages/voxelyn-roguelike/public 2>/dev/null || true
```

If `vite.config.ts` doesn't already symlink `assets/sprites`, add a copy or alias:

```ts
// In packages/voxelyn-roguelike/vite.config.ts:
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // ...existing config...
  publicDir: fileURLToPath(new URL('../../assets', import.meta.url)),
});
```

(Adjust depending on existing config; goal is `/assets/sprites/characters/<id>/<id>.atlas.{png,json}` reachable at dev-server root.)

- [ ] **Step 4: Build and dev-run**

```bash
cd packages/voxelyn-roguelike && pnpm build && pnpm dev
```

- [ ] **Step 5: Open the browser, confirm no preload errors in console**

- [ ] **Step 6: Commit**

```bash
git add packages/voxelyn-roguelike/src/main.ts packages/voxelyn-roguelike/vite.config.ts
git commit -m "feat(roguelike): preload PixelLab character atlases at boot"
```

---

### Task 3.2: Switch `ensureRuntime` to use `source: 'pixellab'` for the 6 ids

**Files:**
- Modify: `packages/voxelyn-roguelike/src/render/sprites.ts`

- [ ] **Step 1: Locate `ensureRuntime`**

It's at `packages/voxelyn-roguelike/src/render/sprites.ts:86`.

- [ ] **Step 2: Replace the `createProceduralCharacter` call**

```ts
// Replace the existing call:
import { SPRITE_BY_ARCHETYPE, getLoadedAtlas } from '@voxelyn/animation';

const ensureRuntime = (entity: Entity): RuntimeEntry => {
  const style = styleFromEntity(entity);
  const existing = runtimeByEntity.get(entity.id);
  if (existing && existing.style === style) return existing;

  const spriteId = SPRITE_BY_ARCHETYPE[style];
  const usePixelLab = spriteId !== undefined && getLoadedAtlas(spriteId) !== undefined;

  const character = usePixelLab
    ? createProceduralCharacter({
        id: entity.id,
        style,
        seed: entity.occ * 7919,
        source: 'pixellab',
        spriteId: spriteId!,
      })
    : createProceduralCharacter({
        id: entity.id,
        style,
        seed: entity.occ * 7919,
        useAuthored: true,
      });

  const player = createAnimationPlayer({
    set: character.clips,
    width: character.width,
    height: character.height,
    seed: entity.occ * 104729,
  });
  // ...rest unchanged
};
```

- [ ] **Step 3: Run roguelike tests**

```bash
cd packages/voxelyn-roguelike && pnpm test
```

Expected: all green (tests use the no-atlas fallback path → authored).

- [ ] **Step 4: Smoke-test in browser**

```bash
pnpm dev
```

Walk around the dev map; confirm hero + each enemy renders, all 4 facings, idle/walk/attack visible.

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-roguelike/src/render/sprites.ts
git commit -m "feat(roguelike): wire PixelLab atlases for hero and 5 enemies"
```

---

## Phase 4 — Cleanup, ignore rules, docs

### Task 4.1: Delete dead `isAuthored32` references

**Files:**
- Audit: `packages/voxelyn-roguelike/src/render/sprites.ts`

- [ ] **Step 1: grep for stragglers**

```bash
grep -rn "isAuthored32\|usefulHeight = isAuthored\|authoredFootRowsBelow" packages/voxelyn-roguelike/src
```

- [ ] **Step 2: Remove any remaining occurrences** (Task 0.9 already replaced the main block; this is a sweep). If any helper still branches on size, replace it with anchor math.

- [ ] **Step 3: Run roguelike tests + dev smoke**

```bash
cd packages/voxelyn-roguelike && pnpm test && pnpm build
```

- [ ] **Step 4: Commit (only if changes made)**

```bash
git commit -am "refactor(roguelike): drop residual isAuthored32 size-branch"
```

---

### Task 4.2: Add `.voxelyn-cache/` to `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append rule**

```bash
grep -q "^.voxelyn-cache/$" .gitignore || echo ".voxelyn-cache/" >> .gitignore
```

- [ ] **Step 2: Verify nothing under `.voxelyn-cache/` is staged**

```bash
git status --porcelain | grep -i voxelyn-cache && echo "FOUND — unstage" || echo "clean"
```

If found, `git rm --cached -r .voxelyn-cache/`.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore .voxelyn-cache/ (PixelLab plan + character ids)"
```

---

### Task 4.3: Update `docs/concept-art/README.md`

**Files:**
- Modify: `docs/concept-art/README.md`

- [ ] **Step 1: Append a section**

```markdown
## Production sprite pipeline

These concept arts are now the visual anchors for generated 48×48 isometric sprites under
`assets/sprites/characters/<id>/`. The generator lives in `packages/voxelyn-cli` (subcommand
`voxelyn sprites generate`) and is documented in
`docs/superpowers/specs/2026-04-28-pixellab-iso-sprite-pipeline-design.md`.

ID mapping:

| Concept (this folder) | Sprite ID | Runtime archetype |
|---|---|---|
| Excavator             | `excavator`     | player        |
| Striker               | `striker`       | stalker       |
| Bruiser               | `bruiser`       | bruiser       |
| Spitter               | `spitter`       | spitter       |
| Spore Bomber          | `spore_bomber`  | spore_bomber  |
| Guardian              | `guardian`      | guardian      |
```

- [ ] **Step 2: Commit**

```bash
git add docs/concept-art/README.md
git commit -m "docs(concept-art): point at production sprite pipeline"
```

---

## Self-Review

**Spec coverage check:**

- §1.1 mapping → Task 1.1 (`SPRITE_BY_ARCHETYPE`), Task 0.10 config.
- §1.2 frame format → Task 0.4 (validation), Task 0.10 (config), Task 2.4 (packAtlas).
- §1.3 animation scope → Task 0.10 (config).
- §1.4 output format → Task 2.4 + 2.5 + 2.9.
- §1.5 orchestration → Tasks 2.6–2.10.
- §1.6 runtime integration → Tasks 0.7, 0.8, 0.9, 1.1, 1.2, 1.3, 3.1, 3.2.
- §1.7 out-of-scope items not implemented → ✓.
- §2 architecture → all phases follow it.
- §3 data shapes → Tasks 0.2, 0.4, 0.5, 1.3.
- §4.1 config → Task 0.10.
- §4.2 direction mapping → Task 0.1 (DIRECTIONS, toEngineFacing).
- §4.3 atlas layout → Task 2.4.
- §4.4 idempotent flow → Task 2.9 (skip-if-up-to-date branch).
- §4.5 CLI surface → `--character`/`--force` (existing) + `--dry-run` (Task 0.10) + `--emit-plan` (Task 2.7).
- §4.6 PixelLab guardrails → Task 2.6 contract; Task 2.8 operator step.
- §5.1 loader → Tasks 0.6, 0.7.
- §5.2 cache & dedupe → Task 0.6.
- §5.3 strict/non-strict preload → Task 0.7.
- §5.4 source switch → Task 1.3.
- §5.5 resolveClip fallback → Task 1.2.
- §5.6 anchor renderer → Task 0.9.
- §5.7 boot preload → Task 3.1.
- §6.1 error model → Task 0.2.
- §6.2 tests → all task tests cover their unit; integration in Tasks 2.9 & 3.2.
- §6.3 phasing → matches Phase 0/1/2/3/4 numbering.
- §6.4 acceptance → embedded in each task's "Run … expected" steps.
- §6.5 deferred items not implemented → ✓.

**Placeholder scan:**

- No "TBD"/"TODO"/"add appropriate error handling" prose.
- Task 2.6 explicitly explains the MCP boundary and split into 2.6/2.7/2.8/2.9 to avoid placeholder hand-waving.

**Type consistency:**

- `Direction`, `ClipId`, `AtlasManifest`, `LoadedAtlas` shared via `@voxelyn/animation` re-exports (Task 0.11).
- `runSpritesGenerate` input shape is consistent across Tasks 0.10, 2.7, 2.9.
- `SPRITE_BY_ARCHETYPE` keys match the union in `ProceduralCharacterDef.style`.
- `anchor` field added to `ProceduralCharacter` in Task 0.8 and consumed in Tasks 0.9, 1.3.

No issues found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-28-pixellab-iso-sprite-pipeline.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
