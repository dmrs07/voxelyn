# Fase 0 — Auditoria do repositório Voxelyn (2026-07-24)

Auditoria de baseline antes da transformação em **real-time action survival roguelike mobile-first**
(spec: `docs/superpowers/specs/2026-07-24-voxelyn-survival-online-mobile-design.md`).

## 1. Baseline de build, testes e lint

Ambiente: Node v22.22.2, pnpm 10.33.0, Linux.

| Comando | Resultado | Observações |
| --- | --- | --- |
| `pnpm install` | ✅ OK (16s) | Build scripts de `electron`, `esbuild`, `sharp` ignorados pelo pnpm (não bloqueia). |
| `pnpm --filter @voxelyn/core build` | ✅ OK | `tsc` puro, sem DOM. |
| `pnpm --filter @voxelyn/core test` | ✅ OK | Runner próprio (`node dist/tests/run.js`), "tests ok". |
| `pnpm --filter @voxelyn/animation build` | ✅ OK | |
| `pnpm --filter @voxelyn/animation test` | ✅ 12/12 (vitest, 6 arquivos) | |
| `pnpm --filter @voxelyn/roguelike build` | ✅ OK | Vite, bundle 104 kB (35 kB gzip). |
| `pnpm --filter @voxelyn/roguelike test` | ✅ 49/49 (vitest, 24 arquivos) | Inclui determinismo de geração, conectividade, spawn, IA. |
| `pnpm -r build` (raiz) | ❌ FALHA | `@voxelforge/editor` quebra: `@github/copilot-sdk` importa `node:child_process`/`node:net` num bundle de browser (Rollup externaliza e falha). **Pré-existente, não relacionado ao jogo.** |
| `pnpm lint` | ❌ 141 erros / 51 warnings | Pré-existente. Maioria: `no-undef` de globals Node em `scripts/` e no editor (`process`, `console`, `Buffer`), e warnings `consistent-type-imports` no roguelike. |

Conclusão: **os três pacotes do jogo (core, animation, roguelike) estão verdes**. O vermelho do
monorepo vem do editor/electron e de configuração de lint — devem ser tratados como dívidas
separadas, sem bloquear a transformação.

## 2. Inventário de pacotes

| Pacote | Papel | Estado |
| --- | --- | --- |
| `@voxelyn/core` | Toolkit headless: grid2d, surface2d, RNG determinístico (xorshift32), material-physics (reações, difusão de calor, erosão), terreno/noise, iluminação/sombras, iso, voxels, adapters canvas/webgl | Saudável; base da simulação futura |
| `@voxelyn/animation` | Runtime de animação (state machine, frame pool), importers (Aseprite, TexturePacker), geração procedural de personagens | Saudável; será alvo do novo pipeline de sprites |
| `@voxelyn/roguelike` | Jogo atual (MVP 10 andares, 20 Hz, isométrico) | Funcional; base do survival |
| `@voxelforge/editor` | Editor Svelte | Build quebrado (copilot-sdk); fora do escopo do jogo |
| `@voxelforge/electron` | Shell Electron do editor | Depende do editor; fora do escopo |
| `@voxelyn/ai` | Geração de texturas via Gemini | Fora do caminho crítico |
| `@voxelyn/cli` | Scaffolding | Fora do caminho crítico |

## 3. Mapa de acoplamento do roguelike atual

O que já está certo:

- **Timestep fixo de 20 Hz** (`SIMULATION_HZ`, acumulador em `GameLoop.frame`), `simTick`/`simTimeMs`
  no estado — a simulação já é independente do FPS de render.
- `GameState` é um objeto de dados serializável na maior parte (nível, entidades em `Map`,
  projéteis, partículas, debuffs com timestamps de simulação).
- Geração 100% determinística por seed (`generateFloor(baseSeed, floor)`), RNG explícito em
  spawn/eventos/powerups; 49 testes cobrem isso.
- Materiais/features em bitmasks (`FEATURE_BIOFLUID`, `FEATURE_SPORE_VENT`, …) e `MaterialId`
  numérico — bom substrato para a simulação sistêmica.

Acoplamentos que a Fase 2 (headless) precisa quebrar:

| Ponto | Arquivo | Problema |
| --- | --- | --- |
| `GameLoop` constrói `Controls` (DOM) e `IsoRenderer` (canvas) | `src/game/loop.ts` | Simulação não instanciável em Node |
| `renderer.consumeClickedTile()` / `getHoveredTile()` **dentro** de `simulateStep` | `src/game/loop.ts:74-75` | Input de mouse vaza para dentro do passo de simulação; precisa virar `PlayerCommand` |
| `performance.now()` + `requestAnimationFrame` | `src/game/loop.ts` | Tempo de parede no driver do loop (aceitável no cliente, mas o passo precisa ser extraível) |
| `Controls` usa `window.addEventListener` | `src/input/controls.ts` | Sem abstração de intents; teclado hardcoded |
| Mensagens/UI (`state.messages`, `uiAlerts`, `screenFlash`, `cameraShakeMs`) misturadas no estado autoritativo | `src/game/types.ts` | Feedback de apresentação deveria ser derivado de eventos, não estado da sim |
| `hero-spritesheet.ts` faz `fetch` de PNG e usa `createImageBitmap` | `src/render/hero-spritesheet.ts` | OK no render, mas confirma que render e sim compartilham o mesmo pacote |

**Não existe arquitetura chunkada real.** O mundo é um grid único 64×64×4; sombras, AO e
luz são recalculados para o mapa inteiro por andar. Para o survival (mapas maiores +
simulação celular contínua + servidor) será necessário introduzir chunks com dirty/active
tracking — hoje só o importer Tiled menciona chunks.

**Movimento é bump-grid com cooldown** (90 ms move, 280 ms ataque), não ação livre em tempo
real. Para o feel de action survival com joystick, o movimento precisará de célula sub-tile ou
velocidade contínua com colisão no grid — decisão registrada na spec.

## 4. Sprites e animações que falharam

Estado atual dos assets:

- Herói: **dois PNGs gerados por IA sem pipeline** — `assets/9+BtwY.png` (down/DR) e
  `assets/oz9ztg.png` (up/UR), com flip horizontal para DL/UL. Nomes ilegíveis, sem manifest,
  sem versão, sem prompt registrado, sem validação automatizada.
- Inimigos: gerados proceduralmente (`@voxelyn/animation` enemy-archetypes) num estilo
  diferente do herói.
- Cenário: cubos flat-shaded coloridos por material.

Problemas visíveis na baseline (screenshots em `docs/audit/baseline/`):

1. **Colisão de linguagens visuais**: herói pixel-art AI-gen vs. terreno voxel flat vs. inimigos
   procedurais — três estilos na mesma cena.
2. **Atmosfera errada**: piso verde-pasto claro e paredes cinza neutro lêem como "jardim com
   caixas", não mina/organismo subterrâneo opressivo. Iluminação global uniforme, sem escuridão.
3. **Silhuetas fracas**: props (fungos, crates, debris) têm 3–5 px e desaparecem; a saída é um
   marcador flutuante fora da linguagem do mundo.
4. **Proporção**: herói ~2 tiles de altura com cabeça enorme; não há âncora/footprint documentado.
5. **Sem art bible, sem atlas, sem validação** — exatamente o modo de falha que o novo pipeline
   (`docs/art/voxelyn-survival-art-bible.md`) proíbe.

## 5. Baseline visual e de UX mobile

Screenshots (Chromium headless, jogo real rodando):

- `docs/audit/baseline/2026-07-24-roguelike-desktop-1280x720.png`
- `docs/audit/baseline/2026-07-24-roguelike-mobile-landscape-844x390.png`

UX mobile hoje:

- **Zero suporte a touch** — só WASD/setas, `E`, `1`/`2`, `Esc` e clique de mouse.
- Em 844×390 (iPhone landscape) a página tem overflow com scrollbars, HUD truncado
  ("Recuperaco...", "no anda...") e canvas deslocado.
- Sem manifest PWA, sem service worker, sem safe-areas, sem limite de DPR.

## 6. Métricas de performance (baseline e alvos)

Baseline atual (medido/estimado no código):

- Sim: 20 Hz fixo; mundo 64×64; ~8–20 inimigos/andar; `MAX_PARTICLES=160`, `MAX_PROJECTILES=64`.
- Render: redesenho isométrico do mapa completo por frame; bundle 104 kB gzip 35 kB.

Alvos para o vertical slice (a validar por instrumentação na Fase 1):

| Métrica | Alvo |
| --- | --- |
| Duração do tick de sim (p95, mid-range Android) | ≤ 8 ms @ 20 Hz |
| FPS mínimo mobile (qualidade reduzida) | 30 FPS estável |
| FPS desktop | 60 FPS |
| Células reagindo por tick (orçamento) | ≤ 4 096, degradação previsível via fila determinística |
| Memória de nível | ≤ 64 MB |
| Bundle inicial do cliente | ≤ 500 kB gzip |

## 7. Riscos e dívidas registradas

1. Lint do monorepo vermelho (141 erros) — corrigir config de globals Node em `scripts/`
   separadamente; não usar como desculpa para bloquear PRs do jogo.
2. Build raiz vermelho por `@voxelforge/editor` — remover `@github/copilot-sdk` do bundle de
   browser ou isolar o import; dívida fora do escopo do survival.
3. Ausência de chunks: maior risco técnico da Fase 2/4 (sync de mundo destrutível).
4. Movimento bump-grid vs. action feel: maior risco de design da Fase 1.
5. Assets sem pipeline: qualquer sprite novo antes da art bible repetirá a falha atual.
