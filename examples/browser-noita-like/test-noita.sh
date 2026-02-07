#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENTRY_FILE="$ROOT_DIR/examples/browser-noita-like/index.ts"
DIST_DIR="$ROOT_DIR/dist/examples/browser-noita-like"
DIST_TARGET="$DIST_DIR/index.js"

cd "$ROOT_DIR"

mkdir -p "$DIST_DIR"

npx --yes esbuild "$ENTRY_FILE" \
  --bundle \
  --format=esm \
  --platform=browser \
  --target=es2020 \
  --sourcemap \
  --outfile="$DIST_TARGET"

if [[ ! -f "$DIST_TARGET" ]]; then
  echo "Build failed: $DIST_TARGET not found."
  exit 1
fi

PORT="5173"

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT"
else
  npx --yes http-server -p "$PORT" -c-1
fi
