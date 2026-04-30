Original prompt: I need to refurbish all the props. some props, based on type or condition, should be arranged in a specific manner (cluster of mushrooms close to other clusters, a line of poisonous liquid that spans across many squares, etc), in addition, props today feel like paper on the floor and got no depth nor volume or shadow. They should be rendered at iso as well as the other sprites

Progress:
- Found prop placement in `src/world/features.ts`; current decorative props were sampled as unrelated single cells.
- Found prop visuals in `src/render/feature-sprites.ts` and `src/render/iso-renderer.ts`; current sprites are upright billboards with small ground shadows and several flat overlays.
- Reworked feature generation so biofluid expands in contiguous straight lanes and fungal/debris/crate/beacon props are placed as local colonies, piles, runs, and pairs.
- Refurbished feature sprite art into isometric volumes with stronger contact shadows; crates/debris now use iso boxes, mushrooms have stems/caps, and beacons/gates/portals sit on 3D bases.
- Replaced individual biofluid puddle stamps with connected isometric floor streams.
- Added generator tests for liquid lanes and arranged prop patterns; adjusted terminal interaction test to seed-sweep for a terminal scenario instead of relying on one brittle seed.
- Exposed `window.advanceTime(ms)` and `window.render_game_to_text()` for browser verification.
- Verified `pnpm --filter @voxelyn/roguelike test` and `pnpm --filter @voxelyn/roguelike build` after the hook changes.
- Browser capture was blocked by missing Playwright Chromium system dependency (`libnspr4.so`), so generated and inspected `/tmp/voxelyn-prop-preview.png` from the actual sprite factory functions.
- Final clean suite: `pnpm --filter @voxelyn/roguelike test` passed; `git diff --check` passed for touched roguelike files.
- Follow-up prop semantics pass:
  - Crates are now blocking route-shaping rails placed adjacent to the main route, never on it, with a final route-safety check.
  - Biofluid lanes now intentionally bias onto the main route so they act as hazard pressure instead of decoration.
  - Fungal colonies now bias into corner/wall pockets.
  - Terminals are blocking interactables, placed wall-adjacent, and drawn more like arcade cabinets.
  - Dynamic corridor candidates skip crate blockers.
- Refreshed and inspected `/tmp/voxelyn-prop-preview.png`; crate now fills a full tile footprint and terminal silhouette reads as a cabinet.
- Verified again: `pnpm --filter @voxelyn/roguelike test`, `pnpm --filter @voxelyn/roguelike build`, and `git diff --check` for touched files.
- Sprite polish pass: redrew feature sprites with larger isometric footprints, explicit top/side faces, stronger contact shadows, and clearer theme-colored silhouettes for crystals, roots, terminals, gates, portals, beacons, crates, debris, and fungi.
- Fixed hero wall-occlusion doubling by removing the extra full-sprite `drawHeroSilhouette` redraw; occluded walls now rely on the existing cutaway/dither overlay instead of drawing the player twice.
- Verified after this pass: `pnpm --filter @voxelyn/roguelike test` passed, `pnpm --filter @voxelyn/roguelike build` passed, and inspected `/tmp/voxelyn-prop-preview.png`.
- Actor sprite clarification: user meant hero/enemies, not props. Updated `packages/voxelyn-animation/src/procedural/characters/authored/generated-v2.ts` so the authored 32x32 hero/enemy frames read as small isometric actors with stronger helmets, torsos, limbs, claws/fists, spore/guardian glows, and clearer front/back facings while keeping the theme palettes.
- Generated and inspected `/tmp/voxelyn-actors-after.png` and `/tmp/voxelyn-actors-states.png` for idle/facing and animation-state sanity.
- Verified actor pass: `pnpm --filter @voxelyn/animation test`, `pnpm --filter @voxelyn/animation build`, `pnpm --filter @voxelyn/roguelike build`, and `pnpm --filter @voxelyn/roguelike test` passed.

TODO:
- Run full browser capture once the container has Playwright browser dependencies installed.
- Consider future per-biome prop variants once the current prop silhouettes are accepted.

Follow-up concept art integration pass:
- Source concept images map to: HERO Excavator (ether miner), E01 Striker/stalker (vibration ambusher), E02 Bruiser (territory blocker), E03 Spitter (corrosive bile), E04 Spore Bomber (volatile self-sacrifice), E05 Guardian (defensive sentinel).
- Planned first integrated slice: lore/theme metadata for HUD/text-state/render palette, plus gameplay hooks for Spitter bile residue, Bomber toxic ground, Guardian protection aura, and Striker vibration detection.
- Implemented `src/game/lore.ts` with floor themes and enemy codex/display labels, then surfaced the current biome in HUD/text-state/floor messages.
- Tinted floor/wall rendering by biome to push the concept art palette progression from ether mines into fungal/ancient chambers.
- Added concept gameplay hooks: Spitter blobs leave corrosive biofluid, Spore Bomber explosions seed toxic ground, Guardian protects nearby enemies, and Striker/Stalker detects loud player movement by vibration.
- Renamed core upgrades toward the Excavator kit: ether crystal, ceramic cutter, articulated legs, reinforced alloy.
- Verified: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/combat-ai.test.ts src/tests/enemy-ai-expanded.test.ts src/tests/projectiles.test.ts`, `pnpm --filter @voxelyn/roguelike build`, and full `pnpm --filter @voxelyn/roguelike test` passed.

PixelLab sprite animation follow-up:
- User noted the old `docs/concept-art/voxelyn-sprite-grid-preview-v2.html` animation reads better than the new PixelLab atlases.
- Added a PixelLab runtime motion wrapper in `@voxelyn/animation` that applies the authored-style idle/walk/attack/cast/hit/die squash, bob, lunge, tint, and fade motions over atlas frames.
- The wrapper uses opaque-bounds fitting and a 1px safety margin so transform scaling does not reintroduce frame-edge cutting.
- Added `pixellab-motion.test.ts` covering static-frame walk motion, hit tinting, and expanded attack bounds.
- Verified: `pnpm --filter @voxelyn/animation test -- pixellab-motion engine-source-switch` (Vitest ran the animation suite) and `pnpm --filter @voxelyn/animation build` passed.
- Verified renderer integration directly with `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/render-anchor.test.ts src/tests/animation-integration.test.ts`.
- Ran a direct runtime sanity pass over all six real PixelLab atlas PNG/JSON files after build; every character produced multiple unique walk frame hashes and `edgeContact=false`.
- Browser check could not run: the local server process was isolated from follow-up `curl` checks in this sandbox, and the Playwright client failed because the `playwright` package is not installed.

Vercel deployment attempt for PixelLab reference URL:
- Built `@voxelyn/roguelike`; confirmed `dist/concept-art/voxelyn-sprite-grid-preview-v2.html` and `dist/assets/sprites/characters/...` exist.
- Full `dist` is 26 MB because docs/concept-art images are copied; the no-auth claimable fallback rejected it with `FUNCTION_PAYLOAD_TOO_LARGE`.
- Created an uncommitted static staging folder at `/tmp/voxelyn-vercel-lite.YR20nK` (1.3 MB) containing the game entrypoint, Vite JS assets, PixelLab atlas assets, and the old animation reference page plus its JS data.
- Vercel CLI is installed, but `vercel whoami` reports no credentials. The claimable fallback endpoint now returns instructions to use the Vercel CLI instead of creating deployments. Next step: run `vercel login` locally, then deploy `/tmp/voxelyn-vercel-lite.YR20nK` with `vercel deploy /tmp/voxelyn-vercel-lite.YR20nK -y`.
- After login, copied the staging package to lowercase path `/tmp/voxelyn-roguelike-vercel-0428` because Vercel rejected the mixed-case temp suffix as a project name.
- Deployed successfully to Vercel. App URL: `https://voxelyn-roguelike-vercel-0428.vercel.app`; PixelLab reference URL: `https://voxelyn-roguelike-vercel-0428.vercel.app/concept-art/voxelyn-sprite-grid-preview-v2.html`.

PixelLab reference correction:
- User clarified that the pipeline works, but the `voxelyn-sprite-grid-preview-v2.html` animation page is not a good character/sprite reference for PixelLab generation.
- Added `scripts/render-pixellab-reference.mjs` to render direct PNG reference sheets from the authored v2 sprites plus concept art.
- Generated per-character annotated references and clean sprite-only PNGs in `docs/concept-art/pixellab-reference/`, plus `voxelyn-pixellab-reference-sheet-v1.png`.
- Added `docs/concept-art/pixellab-sprite-reference-v1.html` and linked it from the concept-art index.
- Updated `.voxelyn-cache/pixellab-recreate-from-vercel.mjs` to point at direct per-character reference PNGs and to fail immediately on PixelLab trial/credit-limit responses.
- Built `@voxelyn/roguelike`; verified the new reference HTML and PNGs are copied into `packages/voxelyn-roguelike/dist/concept-art/...`.
- Deployed the updated static build via Vercel CLI, then copied the new reference files into the lightweight `voxelyn-roguelike-vercel-0428` staging package and deployed a preview. Public reference URL for PixelLab: `https://voxelyn-roguelike-vercel-0428-7blx5kuy8.vercel.app/concept-art/pixellab-sprite-reference-v1.html`.
- A stale PixelLab attempt created only a new `excavator` character and one idle animation, then PixelLab returned `Trial limit reached for animating character (4 directions)` on `walk`. Archived that partial state as `.voxelyn-cache/pixellab-recreate-state.stale-reference-2026-04-28T18-20-14.json`; no atlas plan/result files were overwritten.

GPT spritesheet atlas pass:
- Added stable source copies for the GPT-generated animated sheets under `assets/source/gpt-spritesheets/` and ignored the original dated drop folder `docs/concept-art/gpt tilesets/`.
- Added a deterministic `gpt-sheet` importer to the sprites CLI. It slices the 1024x1536 sheets by row/column windows, removes checker backgrounds, fits frames into the existing 48x48 atlas contract, mirrors left-facing directions, and emits the same atlas PNG/JSON format as the PixelLab path.
- Expanded enemy specs to include `hit` and `die` clips, since the GPT sheets provide them.
- Marked GPT manifests as `source: "gpt-sheet"` and `motion: "baked"` so runtime uses the sheet's baked animation instead of applying the PixelLab squash/lunge/tint wrapper on top.
- Regenerated all six character atlases from GPT sheets. Direct validation: every manifest is `gpt-sheet/baked`, all expected clips exist, and atlas edge contact is `0` for every character.
- Verified: `pnpm --filter @voxelyn/cli test`, `pnpm --filter @voxelyn/animation test -- pixellab-motion sprite-atlas-validation engine-source-switch`, `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/render-anchor.test.ts src/tests/animation-integration.test.ts`, and `pnpm --filter @voxelyn/roguelike build`.
- Added `spritesheetgen` cutter JSON support and switched the Excavator atlas to the cleaner cutter export at `assets/source/gpt-spritesheets/excavator-cutter.*`; validation stayed at `edgeContact=0`.

Local character spritesheet conversion pass:
- Added first-priority local spritesheetgen import support for `assets/sprites/characters/<id>/spritesheet.json` + `spritesheet.png`, with manifest source widened to `spritesheetgen`.
- Regenerated all six committed `<id>.atlas.png`/`<id>.atlas.json` files from the local per-character spritesheets. All manifests now report `source: "spritesheetgen"` and `motion: "baked"`.
- Direct atlas sanity: all six generated atlases have expected clip/frame counts, `empty=0`, and `edgeContact=0`.
- Verified after the swap: `pnpm --filter @voxelyn/cli test`, `pnpm --filter @voxelyn/animation test -- pixellab-motion sprite-atlas-validation engine-source-switch`, `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/render-anchor.test.ts src/tests/animation-integration.test.ts`, and `pnpm --filter @voxelyn/roguelike build`.

Character size adjustment:
- Increased the renderer's target entity height so 48x48 character atlases draw larger in-game while keeping the sprite anchor grounded.
- Moved enemy health/alert UI to follow the scaled sprite top instead of a fixed offset, and slightly increased entity shadows.
- Verified: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/render-anchor.test.ts src/tests/animation-integration.test.ts`, `pnpm --filter @voxelyn/roguelike build`, and `git diff --check`.
- Started Vite at `http://127.0.0.1:5175/` and confirmed it responds over HTTP. Browser screenshot verification was blocked because `playwright` is not installed and `agent-browser` is not available on PATH.

Named spritesheet-v2 conversion pass:
- Swapped the character atlas pipeline to prefer `assets/sprites/characters/<id>/<id>.spritesheet.json` + `<id>.png` over Atlas/source-spritesheet inputs.
- Preserved native spritesheet fidelity by copying source pixels into a 181x168 canvas without resampling; the 167px-tall rows are padded transparently and aligned by the 90/144 anchor.
- Regenerated all six `<id>.atlas.png`/`<id>.atlas.json` files. Manifests now report `source: "spritesheet-v2"`, `motion: "baked"`, frame size `181x168`, and anchor `{ x: 90, y: 144 }`.
- Direct pixel-exact validation checked 896 emitted atlas frames against the source spritesheets.
- Verified: `pnpm --filter @voxelyn/cli test`, `pnpm --filter @voxelyn/animation test -- pixellab-motion sprite-atlas-validation engine-source-switch`, `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/render-anchor.test.ts src/tests/animation-integration.test.ts`, `pnpm --filter @voxelyn/roguelike build`, and `git diff --check`.
