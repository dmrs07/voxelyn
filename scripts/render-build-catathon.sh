#!/usr/bin/env bash
#
# BUILD DE PUBLICACAO (Render) — CATATHON.
#
# Vive num arquivo, e nao colado no painel do Render, porque um comando de build
# que so existe na nuvem nao pode ser lido em revisao nem versionado junto com a
# mudanca que o quebra. Aqui ele entra no diff como qualquer outro codigo.
#
# O resultado e uma pasta estatica: nao ha servidor, nao ha banco, nao ha
# segredo. O jogo inteiro roda no navegador.
set -euo pipefail

echo "==> pnpm"
# `packageManager` no package.json fixa a versao; o corepack so a ativa. Assim a
# nuvem usa exatamente o pnpm do lockfile, e nao o que estiver mais novo no dia.
corepack enable
corepack prepare --activate

echo "==> dependencias"
pnpm install --frozen-lockfile

echo "==> build (catathon)"
pnpm --filter @voxelyn/catathon build

echo "==> pronto: packages/voxelyn-catathon/dist"
du -sh packages/voxelyn-catathon/dist
