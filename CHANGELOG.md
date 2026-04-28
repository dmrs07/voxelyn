# Changelog

All notable changes to this project are documented in this file.

## [0.1.1] - 2026-02-19

### Added
- Added monorepo publish automation scripts:
  - `pnpm run publish:dry-run`
  - `pnpm run publish:packages`

### Changed
- Bumped public npm packages to `0.1.1`:
  - `@voxelyn/core`
  - `@voxelyn/cli`
  - `@voxelyn/ai`
  - `@voxelyn/animation`
- Added `publishConfig.access: "public"` to all publishable packages.
- Added `prepublishOnly` build hooks to all publishable packages.

### Fixed
- Fixed `@voxelyn/animation` package output layout:
  - Set `rootDir` to `./src` in TypeScript config.
  - Removed cross-package TS path mapping that leaked `@voxelyn/core` sources into animation tarballs.
  - Updated build script to clean `dist` before compile (`rm -rf dist && tsc`).

### Published
- Published to npm:
  - `@voxelyn/core@0.1.1`
  - `@voxelyn/cli@0.1.1`
  - `@voxelyn/ai@0.1.1`
  - `@voxelyn/animation@0.1.1`
