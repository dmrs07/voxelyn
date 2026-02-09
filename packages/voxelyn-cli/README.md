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

By default, `create` installs dependencies unless `--no-install` or `--dry-run` is used.

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
