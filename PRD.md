SÍNTESE DO DESIGN (para referência rápida)

OBJETIVO

* Biblioteca headless ultra leve para:

  1. pixels: Surface2D (Uint32Array RGBA)
  2. simulação por célula 2D (Noita-like): Grid2D chunkado + active/dirty
  3. ordenação/travessia determinística: row-major, bottom-up, morton, chunkOrder(seed)
  4. extras opcionais: isométrico faux 3D (Diablo-like), sprites/blit, voxels (3D denso + render 2D)

NÃO-OBJETIVOS (para manter leve)

* janela/input/áudio/engine
* física completa, ECS, UI
* parser/DSL de fórmulas

CORE (mínimo que “aguenta” Noita-like)

* Surface2D: clear, set/get, fillRect
* Grid2D: cells compactos (u16: material+flags), chunking, active/dirty, paint brush, stepActiveChunks, renderToSurface(palette)
* Traversal2D: row-major, bottom-up, morton (Z), chunkOrder(seed)
* RNG determinístico

EXTRAS (opt-in)

* Sprite blit: colorkey + clipped + (opcional) alpha simples
* Iso: projectIso, iso scan order (x+y), helpers de draw
* Voxels: VoxelGrid3D denso + renderSlices + raycast CPU simples

ADAPTERS

* Canvas2D: Surface2D -> ImageData
* WebGL: Surface2D -> textura

PRINCÍPIOS DE PERFORMANCE

* TypedArrays sempre
* sem alocar no hot loop
* chunk activation para evitar varrer o mundo todo
* travessias determinísticas para evitar viés e facilitar replays
* separar core de extras e adapters para manter o bundle pequeno
