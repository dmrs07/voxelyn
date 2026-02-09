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
```

## Commands

- `create <name> [template]`: scaffold a project
- `dev` / `serve`: start dev server (runs `pm run dev`)
- `build`: production build (runs `pm run build`)
- `preview`: preview build (runs `pm run preview`)

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

By default, `create` installs dependencies unless `--no-install` or `--dry-run` is used.

## Notes

- Node-only tool. Generated projects are browser-based.
- The core library remains zero-deps and browser-friendly.
