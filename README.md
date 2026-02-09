# Voxelyn

Biblioteca headless ultra leve e determinística para pixels, simulação por célula 2D (Noita-like), ordenações/travessias 2D e extras opcionais (iso faux-3D, sprites/blit, voxels). Sem dependências.

## Visão geral

- **Core (headless)**
  - `Surface2D`: buffer RGBA em `Uint32Array`
  - `Grid2D`: simulação por célula 2D chunkada (active/dirty)
  - `Traversal2D`: row-major, bottom-up, morton, chunkOrder
  - `RNG` determinístico
  - `Palette`
- **Extras (opt-in)**
  - `Iso`: projeção isométrica + ordem de desenho
  - `Sprites`: blit com colorkey (alpha simples opcional)
  - `Voxels`: grade 3D densa + render slices + raycast CPU simples
  - `Animation` (`@voxelyn/animation`): runtime procedural pixel + importers Aseprite/TexturePacker
- **Adapters (opt-in)**
  - `Canvas2D`: `Surface2D` -> `ImageData`
  - `WebGL`: upload de textura 2D

## Como rodar

1. Instale dependências e compile:

```
npm install
npm run build
```

2. Abra os exemplos no browser com um servidor simples (a partir da raiz):

```
python3 -m http.server 8080
```

- Noita-like: `http://localhost:8080/examples/browser-noita-like/index.html`
- Iso Diablo-like: `http://localhost:8080/examples/browser-iso-diablo-like/index.html`

## Pacote de animação

- Desenvolvimento: `pnpm run dev:animation`
- Build: `pnpm run build:animation`
- Testes: `pnpm run test:animation`

## Guia rápido (Noita-like)

- Use `createGrid2D` com `chunkSize` 64.
- Pinte materiais com `paintRect` e `paintCircle`.
- Em cada frame:
  - `grid.stepActiveChunks('bottom-up', perCellFn)`
  - `grid.renderToSurface(surface, palette)`
- Marque `ACTIVE`/`DIRTY` quando células mudarem para evitar varrer tudo.

## Guia rápido (Iso Diablo-like)

- Use `projectIso` para converter (x,y,z) em (sx,sy).
- Desenhe tiles em `forEachIsoOrder(mapW,mapH,fn)` (ordem painter).
- Blite sprites com `blitColorkey`.

## Notas de performance e determinismo

- `TypedArrays` sempre; sem alocações no hot loop.
- Travessias determinísticas evitam viés e ajudam em replays.
- `chunkOrder(seed)` fornece ordem pseudoaleatória determinística.
- Core é headless: adapters ficam separados.
