# PixelLab Iso Sprite Pipeline (v1) — Design

**Date:** 2026-04-28
**Status:** Approved (brainstorming)
**Owner:** Daniel Moraes
**Scope:** Generate authored isometric (Diablo-style) animated sprites for 6 concept-art characters via PixelLab, store them as per-character atlas PNG + JSON manifest, and consume them in the existing animation runtime via a `source` switch on `createProceduralCharacter`. No changes to combat, AI, or renderer behavior; only sprite construction and the minimal renderer anchor/size awareness needed to draw 48×48 authored assets correctly.

---

## 1. Goal & locked decisions

### 1.1 Character → archetype mapping

Six concept arts in `docs/concept-art/` resolve to **5 enemies + 1 hero**. The enemy enum stays untouched; the hero (`Excavator`) is the player and is **not** an enemy archetype.

| Concept | Sprite ID | Runtime archetype | Notes |
|---|---|---|---|
| Excavator | `excavator` | `player` | Robot protagonist; player only. |
| Striker | `striker` | `stalker` | Display name "Striker"; archetype enum stays `stalker`. |
| Bruiser | `bruiser` | `bruiser` | 1:1. |
| Spitter | `spitter` | `spitter` | 1:1. |
| Spore Bomber | `spore_bomber` | `spore_bomber` | 1:1. |
| Guardian | `guardian` | `guardian` | 1:1. |

The `stalker` runtime archetype maps to the `striker` `spriteId`.

### 1.2 Frame format

- **Size:** 48×48, transparent PNG.
- **Directions:** 4 isometric facings — `DR` (down-right / SE), `DL` (down-left / SW), `UR` (up-right / NE), `UL` (up-left / NW).
- **Anchor:** foot anchor at frame-local `(x: 24, y: 43)` for every character.
- **Camera framing:** isometric ¾ view, Diablo-style perspective. Concept art is the visual anchor.

### 1.3 Animation scope (locked)

| Character | Clips | Frame counts | Direction count |
|---|---|---|---|
| Excavator (hero) | idle / walk / attack / cast / hit / die | 8 / 12 / 10 / 10 / 4 / 10 | 4 |
| Striker / Bruiser / Spitter / Spore Bomber / Guardian | idle / walk / attack | 6 / 8 / 8 | 4 |

Enemy `hit` / `die` continue to use procedural overlays (`applyHitOverlay`, `applyDieDissolve`). Enemy `cast` is deferred — when `stepAnimation` requests `cast` for an enemy, it falls back to `idle` + `applyCastSpark` overlay.

Per-clip duration targets:

```
Hero:
  idle    900–1200 ms loop
  walk    650– 800 ms loop
  attack  280– 420 ms (weapon-feel dependent)
  cast    500– 700 ms
  hit     180– 260 ms
  die     900–1300 ms

Enemies (per archetype):
  idle    800–1200 ms loop
  walk    650– 900 ms loop
  attack:
    Striker        280–340 ms (fast)
    Spitter        420–520 ms (medium)
    Spore Bomber   500–650 ms (medium-slow)
    Bruiser        600–750 ms (heavy)
    Guardian       650–850 ms (heavy/defensive)
```

### 1.4 Output format

- **One atlas per character** under `assets/sprites/characters/<id>/`:
  - `<id>.atlas.png` — packed frames.
  - `<id>.atlas.json` — manifest (rects, anchor, clip metadata, generation hashes).
- **Reference concept art** under `assets/concepts/characters/<id>.png`.

### 1.5 Generation orchestration

- Committed CLI script: `voxelyn sprites generate` (and `--character`, `--force`, `--dry-run`).
- **Not** part of `prebuild` or any build step.
- Idempotent via `conceptHash`, `promptHash`, `configHash`, `pipelineVersion`.

### 1.6 Runtime integration

- Drop-in replacement via `createProceduralCharacter({ source: 'pixellab' | 'authored', spriteId })`.
- Async preload at roguelike boot: `await preloadCharacterAtlases([...ids], baseUrl)`.
- `stepAnimation`, AI, combat, and the iso renderer's logic stay unchanged. The renderer only gains anchor-driven math, replacing the `isAuthored32` size-branch.

### 1.7 Out of scope (v1)

- Enemy `cast` clips.
- Frame sizes other than 48×48.
- Dynamic atlas hot-reload at runtime.
- Atlas regeneration during builds.
- Multi-resolution variants (2×/3× atlases).
- Any change to AI, combat, balance, or item systems.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  GENERATION (offline, manual, credit-cost)                  │
│                                                             │
│  packages/voxelyn-cli/src/commands/sprites/                 │
│    config/characters.ts   ← prompts, clip specs, sizes      │
│    generate.ts            ← orchestration entry             │
│    pixellab-client.ts     ← wraps MCP create+animate calls  │
│    pack-atlas.ts          ← PNG row layout (clip × dir)     │
│    write-manifest.ts      ← JSON manifest emitter           │
│    hash.ts                ← concept/prompt/config/pipeline  │
└──────────────────────────────┬──────────────────────────────┘
                               │ writes (atomic temp+rename)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  ON-DISK ASSETS (committed)                                 │
│                                                             │
│  assets/concepts/characters/<id>.png                        │
│  assets/sprites/characters/<id>/<id>.atlas.png              │
│  assets/sprites/characters/<id>/<id>.atlas.json             │
│                                                             │
│  .voxelyn-cache/pixellab-character-ids.json   (gitignored)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ read by
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  RUNTIME LOADER (new, in voxelyn-animation)                 │
│                                                             │
│  src/sprite-atlas/                                          │
│    types.ts          ← AtlasManifest, LoadedAtlas, errors   │
│    load.ts           ← loadCharacterAtlas(id, baseUrl)      │
│    preload.ts        ← preloadCharacterAtlases(ids,baseUrl) │
│    decode.ts         ← PNG → Uint32Array (browser/node)     │
│    build-clips.ts    ← LoadedAtlas → engine ClipSet         │
│    cache.ts          ← Map + in-flight dedupe               │
└──────────────────────────────┬──────────────────────────────┘
                               │ feeds
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  EXISTING ANIMATION ENGINE (unchanged interfaces)           │
│                                                             │
│  createProceduralCharacter(opts) — gains 'pixellab' branch  │
│  stepAnimation(player, dt, intent, facing) — UNCHANGED      │
│  resolveClip(character, requestedClip) — fallback helper    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  ROGUELIKE CONSUMER (small touch)                           │
│                                                             │
│  boot:    await preloadCharacterAtlases([6 ids], base, {…}) │
│  render:  drawEntitySprite uses runtime.character.anchor    │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Layer responsibilities

- **CLI generator.** Produces committed atlas+manifest from concept art + config. Depends on PixelLab MCP (`create_character`, `animate_character`). Idempotent via hashes; atomic file writes.
- **Atlas loader.** Pure decode of PNG+JSON into engine clip set. No game logic. Dedupes concurrent loads. Browser path uses `Image` + `OffscreenCanvas` → `ImageData`; Node path uses `pngjs` (test-only).
- **Animation engine.** Existing surface; new internal branch in the constructor only. `resolveClip` centralizes "fall back to idle" for missing clips so call sites don't have to.
- **Roguelike.** Boot-time preload + anchor-driven `drawEntitySprite`. Nothing else changes.

### 2.2 Naming conventions (renderer never says "PixelLab")

The renderer respects `runtimeCharacter.width`, `runtimeCharacter.height`, `runtimeCharacter.anchor` (the engine's existing fields, populated either by the authored builder or from the manifest). It does **not** branch on the sprite source.

`source: 'authored'` = current generated-v2 / procedural PixelSprite path.
`source: 'pixellab'` = external atlas + manifest path.

### 2.3 Missing-atlas behavior

- **Dev (`NODE_ENV !== 'production'`):** throws `AtlasMissingError` from `createProceduralCharacter` when `source: 'pixellab'` but no atlas was preloaded for `spriteId`.
- **Prod:** logs once per `spriteId`, falls back to the authored/procedural path for that character.

---

## 3. Data shapes

### 3.1 Atlas manifest (on disk)

```ts
type Direction = 'DR' | 'DL' | 'UR' | 'UL';
type ClipId = 'idle' | 'walk' | 'attack' | 'cast' | 'hit' | 'die';

type FrameRect = { x: number; y: number; w: number; h: number };

type ClipManifest = {
  loop: boolean;
  framesPerDirection: number;
  durationMs: number;
  dirs: Record<Direction, FrameRect[]>;
};

type AtlasManifest = {
  id: string;
  runtimeArchetype:
    'player' | 'stalker' | 'bruiser' | 'spitter' | 'guardian' | 'spore_bomber';
  displayName: string;
  source: 'pixellab';
  version: 1;
  frameWidth: number;       // validated === 48 in v1
  frameHeight: number;      // validated === 48 in v1
  anchor: { x: number; y: number };
  directions: Direction[];  // ['DR','DL','UR','UL']
  clips: Partial<Record<ClipId, ClipManifest>>;
  generation: {
    conceptHash: string;
    promptHash: string;
    configHash: string;
    pipelineVersion: string;
    atlasHash: string;            // sha256 of the final atlas PNG bytes
    pixellabModelVersion?: string;
    generatedAt: string;
    // pixellabCharacterId is intentionally NOT in the committed manifest.
    // It lives in .voxelyn-cache/pixellab-character-ids.json (gitignored).
  };
};
```

### 3.2 Loaded atlas (runtime)

```ts
type LoadedFrame = PixelSprite;  // existing { width, height, pixels: Uint32Array }

type LoadedClip = {
  loop: boolean;
  durationMs: number;
  framesPerDirection: number;
  framesByDir: Record<Direction, LoadedFrame[]>;
};

type LoadedAtlas = {
  manifest: AtlasManifest;
  clips: Partial<Record<ClipId, LoadedClip>>;
};
```

### 3.3 Engine constructor — discriminated union

```ts
type CreateProceduralCharacterOptions =
  | {
      id: string;
      style: ProceduralCharacter['style'];
      seed: number;
      useAuthored?: boolean;
      source?: 'authored';
    }
  | {
      id: string;
      style: ProceduralCharacter['style'];
      seed: number;
      source: 'pixellab';
      spriteId: string;
    };
```

`source` wins over `useAuthored`. Omitting `source` preserves current behavior.

### 3.4 Sprite ↔ archetype map (single source of truth)

```ts
const SPRITE_BY_ARCHETYPE: Record<EnemyArchetype | 'player', string> = {
  player:       'excavator',
  stalker:      'striker',
  bruiser:      'bruiser',
  spitter:      'spitter',
  spore_bomber: 'spore_bomber',
  guardian:     'guardian',
};
```

Lives in `voxelyn-animation`, re-exported by the roguelike for `ensureRuntime`.

### 3.5 Anchor on the runtime character

```ts
ProceduralCharacter {
  width:  number;
  height: number;
  anchor: { x: number; y: number };
  clips:  ClipSet;
  // ...existing fields
}
```

`buildAuthoredCharacter` sets `anchor = { x: 16, y: 29 }` for the existing 32×32 path.
`buildPixelLabCharacter` sets `anchor` from `manifest.anchor`.

`drawEntitySprite` reads `runtime.character.anchor`; never branches on size.

### 3.6 Pixel layout

`PixelSprite.pixels` is a `Uint32Array` in `0xAARRGGBB` byte order. The decoder explicitly converts `ImageData.data` (RGBA bytes, little-endian channel order) into this packed layout. No casting an `ImageData` buffer directly.

---

## 4. Generation pipeline (CLI)

### 4.1 Config — `packages/voxelyn-cli/src/commands/sprites/config/characters.ts`

```ts
type CharacterClipSpec = {
  frames: number;
  durationMs: number;
  loop: boolean;
  intent: string;       // appended to base prompt + style notes
};

type CharacterSpec = {
  id: string;
  runtimeArchetype: AtlasManifest['runtimeArchetype'];
  displayName: string;
  conceptArtPath: string;
  basePrompt: string;
  styleNotes: string;
  size: 48;
  directions: ['DR','DL','UR','UL'];
  anchor: { x: 24, y: 43 };
  clips: Partial<Record<ClipId, CharacterClipSpec>>;
};

const CHARACTERS: CharacterSpec[] = [/* 6 entries */];
```

Hero spec includes all six clips; enemy specs only `idle/walk/attack`.

### 4.2 Direction mapping (explicit in prompts)

```
DR → isometric down-right / southeast
DL → isometric down-left / southwest
UR → isometric up-right / northeast
UL → isometric up-left / northwest
```

### 4.3 Atlas layout

Deterministic row order (only present clips emit rows):

```
idle_DR, idle_DL, idle_UR, idle_UL,
walk_DR, walk_DL, walk_UR, walk_UL,
attack_DR, attack_DL, attack_UR, attack_UL,
cast_DR,   cast_DL,   cast_UR,   cast_UL,    (hero only)
hit_DR,    hit_DL,    hit_UR,    hit_UL,     (hero only)
die_DR,    die_DL,    die_UR,    die_UL,     (hero only)
```

Cell stride = 50 px (48 cell + 2 px transparent gutter).

```
rect.x = frameIndex * 50
rect.y = rowIndex   * 50
rect.w = 48
rect.h = 48
```

Final atlas may have trailing gutter; manifest always points at 48×48 rects.

### 4.4 Orchestration flow (idempotent)

```
for each spec in CHARACTERS (filtered by --character):
  conceptHash     = sha256(file at spec.conceptArtPath)
  configHash      = sha256(canonical-json(spec))
  promptHash      = sha256(basePrompt + styleNotes + per-clip intents)
  pipelineVersion = '1'

  manifestPath = assets/sprites/characters/<id>/<id>.atlas.json
  if exists(manifestPath) and not --force:
    existing = read(manifestPath)
    if existing.generation.{conceptHash, configHash, promptHash, pipelineVersion}
       all match:
         log 'skip <id>: up to date'; continue

  pixellabCharacterId = ensurePixellabCharacter(spec, conceptHash)
    // reuse if cached id and cached conceptHash === current conceptHash
    // else: create new PixelLab character, update local cache
    // never mutates an existing PixelLab character

  rawFrames = {}
  for clipId, clipSpec in spec.clips:
    for dir in spec.directions:
      rawFrames[clipId][dir] = animate_character(
        characterId: pixellabCharacterId,
        action: clipSpec.intent,
        direction: dir (mapped to PixelLab's direction vocabulary),
        frameCount: clipSpec.frames,
        size: 48,
      )

  packed     = packAtlas(rawFrames, spec)              // stride math from §4.3
  atlasHash  = sha256(packed.png)
  manifest   = buildManifest(spec, packed.rects, {
                  conceptHash, configHash, promptHash, pipelineVersion,
                  atlasHash,                                   // pair audit
                  // pixellabCharacterId is recorded in .voxelyn-cache only
              })

  // Atomic writes — PNG first so the manifest never references a missing image
  writeFileSync(<id>.atlas.png.tmp, packed.png)
  writeFileSync(<id>.atlas.json.tmp, manifest)
  rename(<id>.atlas.png.tmp,  <id>.atlas.png)
  rename(<id>.atlas.json.tmp, <id>.atlas.json)

  log 'wrote <id>: <N> frames, <KB>'
```

Failure of any clip × direction call aborts that character (no partial atlas), leaves prior atlas in place. Re-run with `--character <id> --force` to retry. The `pixellab-character-ids.json` cache lives at `.voxelyn-cache/pixellab-character-ids.json` and is **gitignored** — it's local generation state, not an asset.

### 4.5 CLI surface

```
voxelyn sprites generate                       # all 6, idempotent
voxelyn sprites generate --character striker   # one
voxelyn sprites generate --force               # ignore hashes
voxelyn sprites generate --dry-run             # plan only, no PixelLab calls
```

`--dry-run` prints `would skip / would generate / would recreate character / would write atlas` per spec without invoking `create_character`, `animate_character`, or any polling.

### 4.6 PixelLab guardrails

- Pass concept art as reference on `create_character`.
- Style notes always include: `"isometric 3/4 view, ¾-down camera, foot-anchored, Diablo-style perspective, transparent background"`.
- Job polling: client wraps async PixelLab job IDs with `waitFor(jobId, { timeoutMs })`.
- The PixelLab client is behind an interface so tests inject a fake; real MCP calls only run in the live CLI.

---

## 5. Runtime loader & engine integration

### 5.1 Loader module (`packages/voxelyn-animation/src/sprite-atlas/`)

```ts
export async function loadCharacterAtlas(
  spriteId: string,
  baseUrl: string,
): Promise<LoadedAtlas>;

export async function preloadCharacterAtlases(
  ids: string[],
  baseUrl: string,
  opts?: { strict?: boolean },
): Promise<void>;

export function getLoadedAtlas(spriteId: string): LoadedAtlas | undefined;

export async function decodeAtlasPng(
  pngBytes: ArrayBuffer | Uint8Array,
): Promise<{ width: number; height: number; pixels: Uint32Array }>;

export function buildClipsFromAtlas(
  manifest: AtlasManifest,
  decoded: { width: number; height: number; pixels: Uint32Array },
): LoadedAtlas['clips'];
```

**Validation in `loadCharacterAtlas`:**
- `manifest.frameWidth === 48 && manifest.frameHeight === 48` else throw.
- `manifest.directions` exactly `['DR','DL','UR','UL']`.
- `manifest.source === 'pixellab'`, `version === 1`.
- Every clip × direction has `framesPerDirection` rects, all 48×48, all in-bounds.
- **Pair audit (dev only):** `sha256(pngBytes) === manifest.generation.atlasHash`. Mismatch → warn in dev, throw `AtlasLoadError` if `strict` mode is enabled. Skipped in prod to avoid the hashing cost on hot boot.

Failures throw typed errors: `AtlasLoadError`, `AtlasDecodeError`, `AtlasMissingError`.

After `buildClipsFromAtlas` runs, the raw decoded atlas buffer is dropped (only the per-frame `Uint32Array` slices are retained).

> **Implementation note.** `buildClipsFromAtlas` must **copy** frame pixels into a new `Uint32Array` per frame. Do not retain `subarray` views into the decoded atlas buffer — `subarray` shares the underlying `ArrayBuffer`, which would keep the full decoded atlas alive in memory and defeat the drop above.

### 5.2 Cache & dedupe

```ts
const loadedAtlases = new Map<string, LoadedAtlas>();
const inFlightLoads = new Map<string, Promise<LoadedAtlas>>();
```

`loadCharacterAtlas` returns the in-flight promise if a load is already running for that `spriteId`. No eviction in v1 — total decoded frame memory is expected to be ~6–8 MB across hero (~1.9 MB) + 5 enemies (~0.8 MB each), acceptable for the roguelike.

### 5.3 `preloadCharacterAtlases` semantics

- `strict: true` (dev): first failure rejects the returned promise — boot fails loudly.
- `strict: false` (prod): uses `Promise.allSettled`; per-id failures are logged once and the corresponding `spriteId` is left unloaded. `createProceduralCharacter` later falls back to the authored path for those ids.

### 5.4 Engine integration

```ts
export function createProceduralCharacter(
  opts: CreateProceduralCharacterOptions,
): ProceduralCharacter {
  if (opts.source === 'pixellab') {
    const atlas = getLoadedAtlas(opts.spriteId);
    if (!atlas) {
      if (process.env.NODE_ENV !== 'production') {
        throw new AtlasMissingError(opts.spriteId);
      }
      logMissingAtlasOnce(opts.spriteId);
      return buildAuthoredCharacter(opts);
    }
    return buildPixelLabCharacter(opts, atlas);
  }
  return buildAuthoredCharacter(opts);
}
```

`buildPixelLabCharacter` returns a `ProceduralCharacter` with:
- `width = 48`, `height = 48`
- `anchor = manifest.anchor`
- `clips` shaped as the engine expects (per-direction frames, durations, loop flag)
- `style = opts.style` (engine's existing union; `runtimeArchetype` lives on the manifest, not the engine character — `style` stays the engine's vocabulary, including `'player'` if/when added)

`stepAnimation` is unchanged.

### 5.5 Centralized clip fallback

```ts
function resolveClip(
  character: ProceduralCharacter,
  requested: ClipId,
): { base: ClipId; overlay?: 'cast' | 'hit' | 'die' };
```

Resolution rules:
- If `character.clips[requested]` exists → `{ base: requested }`.
- If missing and `requested === 'cast'` → `{ base: 'idle', overlay: 'cast' }`.
- If missing and `requested === 'hit'`  → `{ base: 'idle', overlay: 'hit' }`.
- If missing and `requested === 'die'`  → `{ base: 'idle', overlay: 'die' }`.

Every consumer (engine, renderer-side overlays) goes through `resolveClip`. No inline fallback at call sites.

### 5.6 Renderer touch (`packages/voxelyn-roguelike/src/render/sprites.ts`)

Anchor-driven; no hardcoded sizes.

```ts
const anchor =
  runtime.character.anchor ??
  getDefaultAnchorForCharacter(runtime.character);

const usefulHeight = anchor.y;
const footRowsBelow = sprite.height - anchor.y;
const drawX = Math.floor(sx - anchor.x * effectiveScale);
const drawY = Math.floor(sy - sprite.height * effectiveScale + footRowsBelow * effectiveScale);
```

`getDefaultAnchorForCharacter` returns `(16, 29)` for legacy 32×32 authored characters. Once `buildAuthoredCharacter` populates `anchor` directly, the helper becomes a safety net only.

### 5.7 Roguelike boot

```ts
import { preloadCharacterAtlases } from '@voxelyn/animation';

await preloadCharacterAtlases(
  ['excavator','striker','bruiser','spitter','spore_bomber','guardian'],
  CHARACTER_ASSET_BASE,                       // e.g. '/assets/sprites/characters'
  { strict: import.meta.env.DEV },            // tolerant in prod, strict in dev
);
```

`ensureRuntime` selects `source: 'pixellab'` + `spriteId` via `SPRITE_BY_ARCHETYPE`.

---

## 6. Error handling, testing, rollout

### 6.1 Error model

```ts
class AtlasLoadError    extends Error { constructor(spriteId, reason); }
class AtlasDecodeError  extends Error { constructor(spriteId, reason); }
class AtlasMissingError extends Error { constructor(spriteId); }
```

| Failure | Where it surfaces | Dev | Prod |
|---|---|---|---|
| Manifest fetch 404 | `loadCharacterAtlas` | throw `AtlasLoadError` | `Promise.allSettled`; log once; fall back to authored for that id |
| Manifest schema invalid | `loadCharacterAtlas` | throw | same |
| PNG decode fails | `decodeAtlasPng` | throw `AtlasDecodeError` | same |
| `frameWidth/Height !== 48` | validation | throw | same |
| Frame rect out of bounds | `buildClipsFromAtlas` | throw | same |
| Atlas not preloaded at engine ctor | engine | throw `AtlasMissingError` | log-once per `spriteId`, fall back |
| PixelLab MCP failure during gen | CLI | abort that character; existing atlas untouched; nonzero exit | n/a |
| Atomic write fails | CLI | tmp files cleaned; existing atlas untouched | n/a |

The "log-once per `spriteId`" guard is keyed by spriteId in a module-level `Set`.

### 6.2 Tests

**`packages/voxelyn-animation`:**
- `sprite-atlas/decode.test.ts` — fixture PNG → packed `0xAARRGGBB` matches reference pixel.
- `sprite-atlas/build-clips.test.ts` — manifest + decoded buffer → clips shape, frame counts, anchor pass-through.
- `sprite-atlas/load.test.ts` — concurrent loads share in-flight promise; cached on second call.
- `sprite-atlas/validation.test.ts` — wrong size, missing direction, oob rect → typed errors.
- `engine/source-switch.test.ts` — `source:'pixellab'` missing preload throws in dev; falls back in prod (mocked NODE_ENV); width/height/anchor come from manifest when loaded.
- `engine/clip-fallback.test.ts` — `resolveClip` returns idle base + overlay tag for missing cast/hit/die.

**`packages/voxelyn-roguelike`:**
- Existing tests (combat-ai, interactions, enemy-ai-expanded, powerups, projectiles, puzzle-solvability, map-features) keep running with default `source: 'authored'`.
- `render/anchor-driven-draw.test.ts` — `drawEntitySprite` uses `runtime.character.anchor` for both 32×32 (16,29) and 48×48 (24,43).

**`packages/voxelyn-cli`:**
- `commands/sprites/hash.test.ts` — deterministic hashing; canonical-JSON ordering; `atlasHash` reflects PNG bytes.
- `commands/sprites/pack-atlas.test.ts` — atlas dimensions match stride math; rects pixel-accurate.
- `commands/sprites/dry-run.test.ts` — plan emitted; PixelLab client never invoked.
- `commands/sprites/manifest-shape.test.ts` — committed manifests never include `pixellabCharacterId`; that field stays in `.voxelyn-cache` only.

### 6.3 Rollout (each phase independently mergeable)

**Phase 0 — Scaffolding (no PixelLab calls).**
- `voxelyn-animation/sprite-atlas/` skeleton, types, validation, decode, build-clips (with fixture tests).
- `voxelyn-cli/sprites/` skeleton with `--dry-run` and config (no MCP yet).
- `voxelyn-roguelike` anchor-driven `drawEntitySprite` (32×32 path still works).

**Phase 1 — Engine source switch (still no atlases).**
- `createProceduralCharacter` discriminated union.
- `resolveClip` fallback.
- `SPRITE_BY_ARCHETYPE` map.
- Dev/prod missing-atlas behavior.

**Phase 2 — Generate v1 atlases (live PixelLab calls).**
- Run `voxelyn sprites generate` once.
- Commit atlas PNGs + manifests only; keep `.voxelyn-cache/pixellab-character-ids.json` local/gitignored.
- Visual diff acceptance check.

**Phase 3 — Wire roguelike to consume atlases.**
- `main.ts` preload at boot.
- `ensureRuntime` selects `source:'pixellab'` for the 6 ids.
- Smoke-test: hero + each enemy renders in all 4 facings; idle/walk/attack visible.

**Phase 4 — Clean-up.**
- Delete hardcoded `isAuthored32` renderer branches after anchor-driven rendering is proven.
- Keep procedural authored sprite path as fallback.
- Update `docs/concept-art/README.md` to point at the new pipeline.

### 6.4 Acceptance per phase

- **0:** `pnpm test` + `pnpm build` green.
- **1:** roguelike behaves identically; new tests pass.
- **2:** atlas PNGs visually inspected; manifest hashes stable on re-run (idempotency proof).
- **3:** dev playthrough shows authored animation in all 4 facings for hero + enemies; tests still green.
- **4:** zero references to hardcoded size branches in renderer; procedural fallback path remains intact.

### 6.5 Deferred (not v1)

- Enemy `cast` clips.
- Frame sizes other than 48×48.
- Dynamic atlas hot-reload at runtime.
- Build-time atlas regen.
- Multi-resolution atlases (2×/3× variants).
- Spritesheet compression beyond PNG.
- Any change to AI, combat, balance, or item systems.
