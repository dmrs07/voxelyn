# @voxelyn/cli

Voxelyn CLI for scaffolding small game projects and demos.

## Install

```bash
npm i -g @voxelyn/cli
# or
pnpm add -g @voxelyn/cli
```

## Usage

```bash
voxelyn create my-game vanilla
voxelyn create my-game --no-install
voxelyn dev
voxelyn build
voxelyn preview
voxelyn deploy --build --channel=alpha
voxelyn generate texture --prompt "stone"
voxelyn generate scenario --prompt "vast volcanic island" --size 256 --depth 64 --scale 0.5
voxelyn generate object --prompt "modular sci-fi crate" --scale 1.25
voxelyn plugin list
```

## Commands

- `create <name> [template]`: scaffold a project
- `dev` / `serve`: start dev server (runs `pm run dev`)
- `build`: production build (runs `pm run build`)
- `preview`: preview build (runs `pm run preview`)
- `deploy`: deploy build to itch.io using butler
- `generate`: generate assets/scenarios (AI or procedural)
- `plugin`: manage CLI plugins

## Options

- `--name <dir>`: project folder name
- `--template <name>`: one of `vanilla`, `react`, `svelte`
- `--install`: force dependency install after create
- `--no-install`: skip dependency install after create
- `--list`: list available templates
- `--yes`: non-interactive, accept defaults
- `--force`: allow writing into non-empty folder
- `--pm npm|pnpm|yarn|bun`: select package manager
- `--git`: run `git init` if available
- `--dry-run`: print actions without writing
- `--verbose`: verbose logging
- `--quiet`: suppress non-error output
- `--no-color`: disable ANSI colors
- `--version`: show CLI version

Deploy options:
- `--dir <path>`: directory to deploy (default `dist`)
- `--channel <name>`: itch.io channel (default `alpha`)
- `--build`: run build before deploy

Generate options:
- `--prompt <text>`: prompt for generation
- `--provider <auto|gemini|openai|anthropic|groq|ollama|copilot>`: provider selection (default: `auto`)
- `--model <id>`: explicit model id
- `--seed <int>`: deterministic seed
- `--size <N|WxH>`: scenario/texture size
- `--texture-size <N|WxH>`: texture size override (takes precedence over `--size` for `texture`)
- `--depth <int>`: scenario depth in Z voxels
- `--scale <float>`: world/voxel scale multiplier
- `--out-format <bundle|layout|terrain-spec>`: scenario output mode (default: `bundle`)
- `--enhanced-terrain` / `--no-enhanced-terrain`: enable/disable enhanced terrain pipeline
- `--workers <auto|N>`: optional chunk worker parallelism hint for scenario generation
- `--intent-mode <fast|balanced|deep>`: ScenarioIntent pipeline mode
- `--intent-strict`: enforce stricter intent conflict resolution
- `--debug-ai`: print stage/provider debug timings

By default, `create` installs dependencies unless `--no-install` or `--dry-run` is used.

## Unified Generate Pipeline

`voxelyn generate` now supports:

- `texture`
- `scenario`
- `object`

The command always uses one orchestrated flow:

1. Parse flags and resolution controls.
2. Resolve provider (`auto` or override).
3. Try `@voxelyn/ai` generation.
4. If AI is unavailable/fails, fallback to deterministic procedural generation.
5. Write output with a stable contract.

Legacy usage remains valid:

```bash
voxelyn generate texture --prompt "stone"
voxelyn generate scenario --prompt "forest valley with river"
```

## ScenarioIntent 2.0

Scenario generation uses centralized intent resolution from `@voxelyn/ai`:

- deterministic PT/EN parser + semantic scoring
- optional normalization pass (`--intent-mode`)
- conflict handling (`--intent-strict`)
- directive compilation into topology/biome/composition decisions

This intent now influences full world generation (terrain, biome strategy, traversal/composition cues), not only terrain tags.

## Output Contract

Default output format is `bundle`.

### Texture bundle

- `manifest.json`
- `texture.params.json`
- `texture.ppm`
- `texture.meta.json`

### Scenario bundle

- `manifest.json`
- `scenario.layout.json`
- `scenario.intent.json`
- `scenario.stats.json`
- `scenario.heightmap.f32`
- `scenario.biome.u8`
- `scenario.lighting.f32`
- `scenario.terrain.u16`
- `scenario.preview.ppm`
- `terrain.spec.json`
- `scenario.scale.json`

### Object bundle

- `manifest.json`
- `object.blueprint.json`
- `object.voxels.u16`
- `object.meta.json`

Alternative scenario outputs:

- `--out-format layout`: emits layout-focused output.
- `--out-format terrain-spec`: emits `terrain.spec.json`.

## High-Resolution and Safety Guardrails

- Defaults:
  - scenario: `128x128x32`
  - texture: `64x64`
  - scale: `1`
  - provider: `auto`
  - intent mode: `balanced`
- Large scenario warning above `16M` voxels.
- Hard safety block above `64M` voxels unless `--force` is set.

## Deploy config (itch.io)

Add to `package.json`:

```json
{
  "voxelyn": {
    "deploy": {
      "itch": {
        "user": "yourUser",
        "game": "yourGame",
        "channel": "alpha",
        "dir": "dist"
      }
    }
  }
}
```

## Notes

- Node-only tool. Generated projects are browser-based.
- The core library remains zero-deps and browser-friendly.
