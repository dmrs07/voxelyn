# VoxelForge - Editor de Ambientes 2D/2.5D/3D

> Editor WYSIWYG inspirado no Goxel, usando Voxelyn como engine de renderização

---

## Menubar Oficial

- Desktop Electron (`packages/voxelforge-electron`): o menubar oficial é o **menu nativo** do Electron (`File/Edit/View/Window`).
- UI do editor (`packages/voxelforge-editor`): em runtime desktop, a barra interna funciona como **toolbar** de ações e não replica menubar nativo.
- Runtime web (Vite/browser): a barra interna pode exibir menubar textual.

## 📋 TODO EXTENSO

### Fase 1: Setup do Projeto (Monorepo)

- [x] **1.1 Estrutura do Monorepo**
  - [x] Criar `packages/` na raiz do voxelyn
  - [x] Mover biblioteca core para `packages/voxelyn-core/`
  - [x] Criar `packages/voxelforge-editor/` para o editor
  - [x] Configurar workspace com `pnpm-workspace.yaml`
  - [x] Configurar TypeScript paths para referências entre pacotes

- [x] **1.2 Configuração de Build**
  - [x] Setup Vite para o editor (hot reload, bundling)
  - [x] Configurar alias `@voxelyn/core` → biblioteca
  - [x] Setup ESLint + Prettier compartilhado
  - [x] Configurar tsconfig.json base + extends

- [x] **1.3 Tech Stack do Editor**
  - [x] Frontend: **Svelte 5** (runes) - leve, reativo, sem virtual DOM
  - [x] Canvas: **WebGL2** via voxelyn adapters
  - [x] State: Svelte stores + Immer para undo/redo
  - [x] Layout: CSS Grid + componentes dock customizados
  - [x] Build: Vite + Electron (opcional para desktop)

---

### Fase 2: Core do Editor

- [x] **2.1 Document Model**
  - [x] Definir `EditorDocument` type
    ```ts
    type EditorDocument = {
      meta: { name: string; created: number; modified: number };
      palette: Palette;
      layers: Layer[];
      activeLayerId: string;
      viewMode: '2d' | 'iso' | '3d';
      camera: CameraState;
    };
    ```
  - [x] Definir `Layer` type (2D grid ou 3D voxel)
  - [x] Sistema de ID único para layers (nanoid)
  - [x] Serialização JSON do documento

- [ ] **2.2 Command Pattern (Undo/Redo)**
  - [x] Interface `Command { execute(), undo(), description }`
  - [ ] Comandos implementados:
    - [x] `PaintCommand` - pintar células/voxels
    - [x] `EraseCommand` - apagar
    - [x] `FillCommand` - bucket fill
    - [x] `SelectionCommand` - criar/modificar seleção
    - [x] `PasteCommand` - colar clipboard
    - [ ] `LayerCommand` - criar/deletar/reordenar layers
    - [x] `TransformCommand` - mover/rotacionar seleção
  - [x] History stack com limite configurável (default 100)
  - [ ] Merge de comandos consecutivos iguais (otimização)

- [ ] **2.3 Seleção**
  - [x] `Selection` type (rect ou máscara de bits)
  - [x] Marching ants animation
  - [x] Operações: union, intersect, subtract, invert
  - [x] Clipboard interno (copiar seleção)
  - [ ] Float selection (seleção destacada que pode ser movida)

---

### Fase 3: Sistema de Ferramentas

- [x] **3.1 Arquitetura de Tools**
  - [x] Interface `Tool`
    ```ts
    type Tool = {
      id: string;
      name: string;
      icon: string;
      cursor: string;
      onPointerDown(ctx: ToolContext): void;
      onPointerMove(ctx: ToolContext): void;
      onPointerUp(ctx: ToolContext): void;
      onKeyDown?(ctx: ToolContext, e: KeyboardEvent): void;
      renderOverlay?(ctx: ToolContext, surface: Surface2D): void;
    };
    ```
  - [x] ToolContext com estado compartilhado
  - [x] Tool registry com hotkeys

- [ ] **3.2 Ferramentas de Pintura**
  - [x] **Pencil/Brush**
    - [x] Tamanho variável (1-64 px)
    - [x] Formas: quadrado, círculo, diamante
    - [x] Interpolação Bresenham entre pontos
    - [x] Preview do brush no cursor
  - [x] **Eraser**
    - [x] Mesmo que brush mas pinta material 0
  - [ ] **Bucket Fill**
    - [x] Flood fill com threshold de tolerância
    - [ ] Opção: fill contiguous ou fill same color
    - [ ] Limite de área para evitar travamento
  - [x] **Line Tool**
    - [x] Preview em tempo real
    - [x] Snap 45° com Shift
  - [x] **Rectangle/Ellipse**
    - [x] Filled ou outline
    - [x] Snap 1:1 com Shift
  - [x] **Eyedropper**
    - [x] Pick material da célula clicada
    - [x] Atalho: Alt+Click em qualquer tool

- [ ] **3.3 Ferramentas de Seleção**
  - [x] **Rect Select**
    - [x] Drag para selecionar área
    - [x] Shift+Drag para adicionar
    - [x] Alt+Drag para subtrair
  - [ ] **Lasso Select** (freeform)
  - [x] **Magic Wand**
    - [x] Seleciona área contígua do mesmo material
    - [x] Tolerância configurável
  - [ ] **Select All / Deselect**

- [ ] **3.4 Ferramentas de Navegação**
  - [x] **Pan** (Hand tool)
    - [x] Middle-click drag em qualquer tool
    - [x] Spacebar + drag
  - [x] **Zoom**
    - [x] Scroll wheel
    - [x] Ctrl+Plus/Minus
    - [x] Fit to window
    - [x] Zoom levels: 12.5%, 25%, 50%, 100%, 200%, 400%, 800%
  - [ ] **Rotate View** (só para modo iso/3D)
    - [ ] 90° steps ou livre

---

### Fase 4: Sistema de Camadas (Layers)

- [x] **4.1 Layer Types**
  - [x] `GridLayer` - usa Grid2D do voxelyn
  - [x] `VoxelLayer` - usa VoxelGrid3D
  - [x] `ReferenceLayer` - imagem de referência (não editável)

- [ ] **4.2 Layer Operations**
  - [x] Criar/duplicar/deletar layer
  - [x] Reordenar (drag & drop)
  - [x] Visibilidade toggle
  - [x] Lock (impedir edição)
  - [x] Opacidade (0-100%)
  - [x] Blend modes: normal, multiply, screen, overlay
  - [x] Merge layers (rever, pois layers tem um z-index diferente, não faz sentido mergear. Pense numa solução)
  - [x] Flatten all
  - [x] Construção assistida (talvez por atalho, nao sei, que seja facil construir coisas inter layers só colocando um bloco em cima do outro) (por exemplo, que seja possivel um avanço suava entre layers para criar estruturas que crescem no eixo z (exemplo, arvore, torre))

- [ ] **4.3 Layer Panel UI**
  - [x] Lista com thumbnails
  - [x] Ícones de visibilidade/lock
  - [x] Context menu com opções
  - [x] Rename inline

---

### Fase 5: Sistema de Paleta

- [ ] **5.1 Palette Manager**
  - [ ] Usar `Palette` do voxelyn (Uint32Array)
  - [ ] Máximo 256 materiais (índice u8)
  - [ ] Cada material: cor RGBA + nome + propriedades
  - [ ] Material properties (para simulação):
    ```ts
    type MaterialProps = {
      name: string;
      color: number; // RGBA packed
      density: number; // para gravidade (0 = flutua, 100 = cai)
      friction: number;
      isLiquid: boolean;
      isGas: boolean;
      flamable: boolean;
    };
    ```

- [ ] **5.2 Material Editor UI**
  - [ ] Grid de swatches (cor do material)
  - [ ] Seleção primária/secundária (left/right click)
  - [ ] Material picker popup:
    - [ ] Color picker (HSV + RGB + Hex + Alpha)
    - [ ] Propriedades físicas (density, friction, etc.)
    - [ ] Flags: isLiquid, isGas, flamable
  - [ ] Import/export paleta (.pal, .gpl, .ase) - converte cores para materiais
  - [ ] Material presets: básicos (terra, água, areia, pedra)

- [ ] **5.3 Color/Material Picker**
  - [ ] HSV wheel ou square (para editar cor do material)
  - [ ] RGB sliders
  - [ ] Hex input
  - [ ] Alpha slider
  - [ ] Materiais recentes usados
  - [ ] Quick edit: Alt+Click no swatch abre editor inline


---

### Fase 6: Modos de Visualização

- [ ] **6.1 Modo 2D (Top-Down)**
  - [ ] Renderização direta do Grid2D
  - [ ] Zoom centrado no cursor
  - [ ] Grid lines opcionais
  - [ ] Pixel grid em zoom alto
  - [ ] Coordenadas no cursor

- [ ] **6.2 Modo 2.5D Isométrico**
  - [ ] Usar `projectIso` e `forEachIsoOrder` do voxelyn
  - [ ] Altura por layer ou por material
  - [ ] Shading automático (face superior mais clara)
  - [ ] Depth sorting correto com `makeDrawKey`
  - [ ] Wall extrusion (paredes verticais automáticas)
  - [ ] Câmera: 4 rotações discretas (N/S/E/W)

- [ ] **6.3 Modo Voxel 3D**
  - [ ] Usar VoxelGrid3D do voxelyn
  - [ ] Renderização via raycast CPU (existente) ou WebGL
  - [ ] Câmera orbital (yaw/pitch/distance)
  - [ ] Face highlighting no hover
  - [ ] Edição de voxels individuais
  - [ ] Conversão 2D→3D: extrudar layers como slices Z

- [ ] **6.4 Sincronização entre Modos**
  - [ ] Documento único, views diferentes
  - [ ] Edições em qualquer modo atualizam todas
  - [ ] Opção: auto-switch ou manual

---

### Fase 7: Simulação (Noita-like)

- [ ] **7.1 Material Simulation**
  - [ ] Integrar `stepActiveChunks` do Grid2D
  - [ ] Regras básicas:
    - [ ] Gravidade: areia cai, água escorre
    - [ ] Fluídos: dispersão lateral
    - [ ] Gases: sobem
  - [ ] Play/Pause/Step controls
  - [ ] Speed slider (0.1x - 4x)

- [ ] **7.2 Entity System (Simples)**
  - [ ] `Entity` type:
    ```ts
    type Entity = {
      id: string;
      x: number; y: number;
      vx: number; vy: number;
      sprite: Surface2D;
      collision: 'none' | 'solid' | 'trigger';
    };
    ```
  - [ ] Gravidade e colisão básica com terreno
  - [ ] Spawn point markers
  - [ ] Player entity controlável (WASD)

- [ ] **7.3 Simulation Panel**
  - [ ] Play/Pause/Reset buttons
  - [ ] Frame counter
  - [ ] Entity inspector
  - [ ] Collision debug overlay

---

### Fase 8: Exportação

- [ ] **8.1 Formatos de Imagem**
  - [ ] PNG (screenshot do canvas)
  - [ ] GIF animado (recording de simulação)
  - [ ] Spritesheet (todos os frames em grid)

- [ ] **8.2 Formatos de Dados**
  - [ ] **JSON nativo**
    ```json
    {
      "version": 1,
      "size": [128, 128],
      "palette": [...],
      "layers": [
        { "name": "terrain", "data": "base64..." }
      ]
    }
    ```
  - [ ] **Binary compacto** (.vxf)
    - Header: magic + version + size
    - Palette: 256 * 4 bytes
    - Layers: RLE compressed u16 arrays
  - [ ] **Tilemaps**: export como CSV/TMX (Tiled format)

- [ ] **8.3 Formatos Voxel**
  - [ ] **.vox** (MagicaVoxel)
  - [ ] **.obj** (mesh exportado)
  - [ ] **.gltf** (com materiais)

- [ ] **8.4 Code Generation**
  - [ ] Export como array TypeScript/JavaScript
  - [ ] Export como código Voxelyn (createGrid2D calls)

---

### Fase 9: Importação

- [ ] **9.1 Imagens**
  - [ ] PNG/JPG → converter para paleta
  - [ ] Quantização de cores (median cut)
  - [ ] Import como nova layer

- [ ] **9.2 Formatos Externos**
  - [ ] .vox (MagicaVoxel)
  - [ ] .tmx (Tiled)
  - [ ] .aseprite (frames como layers)

---

### Fase 10: UI/UX

- [ ] **10.1 Layout Principal**
  ```
  ┌─────────────────────────────────────────────┐
  │ Menu Bar                                     │
  ├────────┬────────────────────────┬───────────┤
  │ Tools  │      Canvas            │  Layers   │
  │        │                        │           │
  │        │                        ├───────────┤
  │        │                        │  Palette  │
  │        │                        │           │
  ├────────┴────────────────────────┴───────────┤
  │ Status Bar (coords, zoom, mode)             │
  └─────────────────────────────────────────────┘
  ```

- [ ] **10.2 Dockable Panels**
  - [ ] Panels podem ser arrastados/reorganizados
  - [ ] Collapse/expand
  - [ ] Floating ou docked
  - [ ] Salvar layout no localStorage

- [ ] **10.3 Menus**
  - [ ] File: New, Open, Save, Save As, Export, Recent
  - [ ] Edit: Undo, Redo, Cut, Copy, Paste, Select All
  - [ ] View: Zoom, Grid, View Mode, Reset View
  - [ ] Layer: New, Duplicate, Merge, Flatten
  - [ ] Simulation: Play, Pause, Step, Reset
  - [ ] Help: Shortcuts, About

- [ ] **10.4 Keyboard Shortcuts**
  | Action | Shortcut |
  |--------|----------|
  | Pencil | B |
  | Eraser | E |
  | Fill | G |
  | Select | M |
  | Eyedropper | I |
  | Pan | H or Space+Drag |
  | Undo | Ctrl+Z |
  | Redo | Ctrl+Y / Ctrl+Shift+Z |
  | Save | Ctrl+S |
  | Zoom In | Ctrl++ or Scroll |
  | Zoom Out | Ctrl+- or Scroll |
  | New Layer | Ctrl+Shift+N |
  | Toggle Grid | G |
  | Play/Pause Sim | P |

- [ ] **10.5 Cursors**
  - [ ] Custom cursors por ferramenta
  - [ ] Brush preview no cursor
  - [ ] Crosshair com coordenadas

---

### Fase 11: Persistência

- [ ] **11.1 Autosave**
  - [ ] Save to IndexedDB a cada 30s
  - [ ] Versioning de backups (últimas 10 versões)

- [ ] **11.2 File System**
  - [ ] File System Access API (Chrome)
  - [ ] Fallback: download/upload

- [ ] **11.3 Cloud Storage (Opcional)**
  - [ ] Export/Import via URL
  - [ ] Integration com GitHub Gist

---

### Fase 12: Performance

- [ ] **12.1 Rendering**
  - [ ] Double buffering
  - [ ] Dirty rect rendering (só redesenha áreas modificadas)
  - [ ] WebGL batching para sprites
  - [ ] LOD para zoom out extremo

- [ ] **12.2 Large Maps**
  - [ ] Virtual scrolling (só renderiza chunks visíveis)
  - [ ] Lazy loading de layers
  - [ ] Web Workers para simulação
  - [ ] OffscreenCanvas para renderização off-thread

- [ ] **12.3 Memory**
  - [ ] Compression de layers não visíveis
  - [ ] Pooling de arrays temporários
  - [ ] Dispose de recursos não usados

---

### Fase 13: Extras

- [ ] **13.1 Procedural Generation**
  - [ ] Noise generators (Perlin, Simplex)
  - [ ] Terrain presets: caves, mountains, islands
  - [ ] Random dungeon generator

- [ ] **13.2 Advanced Tools**
  - [ ] Gradient fill
  - [ ] Pattern fill (tileable)
  - [ ] Symmetry mode (horizontal/vertical/radial)
  - [ ] Tile mode (seamless editing)

- [ ] **13.3 Animation Support**
  - [ ] Frame timeline
  - [ ] Onion skinning
  - [ ] Animation preview
  - [ ] Export GIF/spritesheet

- [ ] **13.4 Collaboration (Future)**
  - [ ] Real-time multiplayer editing via WebRTC
  - [ ] Cursor presence
  - [ ] Chat sidebar

---

## 🏗️ Arquitetura Proposta

```
packages/
├── voxelyn-core/           # Biblioteca existente (renomeada)
│   ├── src/
│   │   ├── core/          # Surface2D, Grid2D, Palette, etc.
│   │   ├── extras/        # Iso, Sprites, Voxels
│   │   └── adapters/      # Canvas2D, WebGL
│   └── package.json
│
├── voxelforge-editor/      # O Editor
│   ├── src/
│   │   ├── lib/           # Lógica core do editor
│   │   │   ├── document/  # EditorDocument, Layer, etc.
│   │   │   ├── commands/  # Command pattern, history
│   │   │   ├── tools/     # Pencil, Eraser, Fill, etc.
│   │   │   ├── selection/ # Selection system
│   │   │   └── export/    # Exporters
│   │   │
│   │   ├── components/    # Svelte components
│   │   │   ├── canvas/    # Main canvas, overlays
│   │   │   ├── panels/    # Tools, Layers, Palette
│   │   │   ├── dialogs/   # Export, Settings, etc.
│   │   │   └── ui/        # Buttons, Sliders, etc.
│   │   │
│   │   ├── stores/        # Svelte stores (state)
│   │   │   ├── document.ts
│   │   │   ├── tools.ts
│   │   │   └── ui.ts
│   │   │
│   │   ├── App.svelte
│   │   └── main.ts
│   │
│   ├── public/
│   │   └── icons/         # Tool icons, cursors
│   │
│   ├── package.json
│   ├── vite.config.ts
│   └── svelte.config.js
│
├── voxelforge-electron/    # Desktop wrapper (opcional)
│   ├── main.js
│   └── package.json
│
└── pnpm-workspace.yaml
```

---

## 🔧 Tecnologias Recomendadas

| Componente | Tecnologia | Justificativa |
|------------|------------|---------------|
| Framework UI | Svelte 5 | Leve, sem vDOM, reactivity nativa |
| Build Tool | Vite | Fast HMR, ESM nativo |
| Canvas | WebGL2 + Voxelyn adapters | Performance, já integrado |
| State | Svelte stores + Immer | Immutable updates p/ undo |
| Desktop | Electron (opcional) | File system access nativo |
| Icons | Lucide ou Phosphor | Consistente, SVG |
| Color Picker | Vanilla JS custom | Evitar deps pesadas |
| File Handling | File System Access API | Modern, sem servidor |

---

## 📊 Estimativa de Complexidade

| Fase | Esforço | Prioridade |
|------|---------|------------|
| 1. Monorepo Setup | 2 dias | 🔴 Alta |
| 2. Document Model | 3 dias | 🔴 Alta |
| 3. Tools System | 5 dias | 🔴 Alta |
| 4. Layers | 3 dias | 🔴 Alta |
| 5. Palette | 2 dias | 🔴 Alta |
| 6. View Modes | 5 dias | 🟡 Média |
| 7. Simulation | 4 dias | 🟡 Média |
| 8. Export | 3 dias | 🟡 Média |
| 9. Import | 2 dias | 🟢 Baixa |
| 10. UI/UX Polish | 5 dias | 🟡 Média |
| 11. Persistence | 2 dias | 🟡 Média |
| 12. Performance | 3 dias | 🟢 Baixa |
| 13. Extras | ongoing | 🟢 Baixa |

**Total estimado MVP: ~4-6 semanas**

---

## 🚀 Quick Start (Primeiros Passos)

```bash
# 1. Setup monorepo
cd voxelyn
mkdir -p packages
mv src package.json tsconfig.json packages/voxelyn-core/

# 2. Criar workspace
echo 'packages:\n  - packages/*' > pnpm-workspace.yaml

# 3. Criar editor
cd packages
pnpm create vite voxelforge-editor --template svelte-ts
cd voxelforge-editor
pnpm add @voxelyn/core

# 4. Desenvolver!
pnpm dev
```

---

## 💡 Ideias Adicionais

1. **Tile Painter Mode**: Modo especial para criar tilesets com bordas automáticas (auto-tiling)

2. **Scripting**: Lua ou JS para macros e tools customizadas

3. **Plugin System**: Permitir extensões de terceiros

4. **Asset Library**: Biblioteca de prefabs/stamps reutilizáveis

5. **Height Painter**: Pintar altura para mapas 2.5D como "paint elevation"

6. **Light Painting**: Pintar luzes/sombras que afetam a renderização isométrica

7. **Version Control**: Git-like branching do documento

8. **AI Generation**: Integrar com modelos de geração procedural (diffusion para pixel art?)

---

## 📚 Referências

- [Goxel Source](https://github.com/guillaumechereau/goxel)
- [Aseprite](https://github.com/aseprite/aseprite) - UX de pixel art
- [Tiled](https://github.com/mapeditor/tiled) - Editor de mapas
- [Pixelorama](https://github.com/Orama-Interactive/Pixelorama) - Editor Godot-based
- [MagicaVoxel .vox spec](https://github.com/ephtracy/voxel-model)

---

*Documento criado em: 2026-01-20*
*Projeto: VoxelForge Editor*
*Base: Voxelyn Library*
