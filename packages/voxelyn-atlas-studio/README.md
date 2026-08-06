# Voxelyn Atlas Studio

Editor **PWA mobile-first** de atlases de sprite do Voxelyn Survival. Existe
para devolver a decisão artística ao autor: em vez de dirigir uma IA por prompt
e torcer pelo resultado, você monta o personagem **voxel a voxel, como Lego** —
no celular — com os materiais do jogo, e exporta o par `PNG + JSON` que o
`SpriteBank` carrega sem nenhuma conversão.

## O que ele faz

- **Modo voxel (recomendado)**: o personagem é um modelo 3D editado camada por
  camada (fatias horizontais em z), com espelho em X, fantasma da camada de
  baixo, materiais do jogo (`rock`, `player`, `biolum`, `lamp`, `loot`…) e
  preview isométrico ao vivo renderizado pelo **port 1:1 do rasterizador do
  jogo** (`tools/voxel.mjs`): rampas de face, oclusão de ambiente, quina acesa
  e ordem do pintor — com teste de paridade byte a byte. As **4 direções saem
  por rotação do mesmo modelo**, sem redesenhar nada; um modelo por frame de
  animação, e o export assa tudo.
- **Modo pixel**: desenho touch-first frame a frame. 1 dedo desenha, 2 dedos
  fazem pan/pinch. Lápis, borracha, balde, linha, retângulo e conta-gotas;
  pincel de 1–3 px; undo/redo; grade, onion skin e guia da margem de 2 px.
- **Paleta travada no jogo**: só as 22 cores da `veio-fungico.v01` (espelho de
  `voxelyn-survival-content/tools/lib.mjs`, com teste de paridade), contador do
  teto de 20 cores por atlas e alpha sempre binário — por construção.
- **Contrato de animações**: presets com os canvases canônicos (humanoide
  88×112, pequena 64×64, grande 96×136, chefe 112×128, FX 32×32) e as animações
  da Art Bible (`idle`, `walk`, `attack`, `hit`, `die`, `downed`, `revive`…),
  com frames/fps/loop editáveis, 4 direções isométricas (`dr`, `dl`, `ur`,
  `ul`) e `flipPairs` para entidades simétricas.
- **Abrir do jogo**: as seis entidades-núcleo (Prospector, Stalker, Spitter,
  Spore Bomber, Bruiser, Guardian) vêm embarcadas no app e abrem offline como
  projeto pixel. **Import**: qualquer par `PNG + JSON` de
  `packages/voxelyn-survival-content/assets/atlases/` também entra; imagens
  fora do pipeline são normalizadas (alpha binário + quantização para a
  cor mais próxima da paleta). Os modelos voxel originais do jogo vivem em
  código (`tools/entities.mjs`) e não são recuperáveis do PNG — por isso o
  modo voxel é para personagens novos.
- **Export**: monta o atlas com a MESMA matemática do gerador
  (`tools/generate.mjs`): ordem `ANIM_ORDER`, `columns` limitado ao teto de
  4096 px de textura, `frameMap`, `paletteColors` ordenadas e `generation`
  registrando a autoria. O teste de contrato lê o atlas exportado com o
  `resolveFrame` real do pacote de conteúdo.
- **Validação no aparelho**: os erros que o CI do jogo acusaria (alpha parcial,
  cor fora da paleta, teto de cores, anchor fora do canvas, direção descoberta,
  margem de 2 px, frame vazio) aparecem ANTES do export.
- **Offline de verdade**: PWA instalável; projetos vivem no IndexedDB do
  aparelho com autosave; service worker com precache no padrão do cliente
  Survival.

## Fluxo de trabalho

1. `pnpm dev:atlas-studio` (ou o deploy estático `voxelyn-atlas-studio` do
   `render.yaml`) e abra no celular; instale como PWA se quiser.
2. Crie um personagem por preset **ou importe** um atlas existente do jogo.
3. Desenhe as animações direção por direção; use a pré-visualização 2×2 para
   conferir as quatro direções (flips inclusive) em movimento.
4. `Menu → Validar & exportar`: corrija o que o validador acusar, incremente a
   versão quando o PNG mudar e baixe/compartilhe `id.png` + `id.json`.
5. Coloque o par em `packages/voxelyn-survival-content/assets/atlases/`
   (substituindo os gerados) e rode o validador do pacote de conteúdo — os
   nomes de arquivo são estáveis de propósito.

## Comandos

```bash
pnpm dev:atlas-studio     # dev server (porta 5177)
pnpm build:atlas-studio   # typecheck + build de producao (com precache no SW)
pnpm test:atlas-studio    # paridade de paleta, contrato de pack/slice, validacao
node scripts/make-icons.mjs  # regenera os icones PWA (deterministico)
```

## Contratos espelhados (e testados)

| Studio                          | Fonte de verdade no jogo                                       |
| ------------------------------- | -------------------------------------------------------------- |
| `src/palette.ts`                | `voxelyn-survival-content/tools/lib.mjs` (`COLORS`)            |
| `MAX_ATLAS_COLORS`              | `tools/validate.mjs` (`MAX_ATLAS_COLORS`)                      |
| `src/atlas.ts` (pack)           | `tools/generate.mjs` (`buildEntity`)                           |
| `src/atlas.ts` (slice)          | `src/manifest.ts` (`resolveFrame`) — importado direto no teste |
| `src/presets.ts` (`ANIM_ORDER`) | `tools/entities.mjs` (`ANIM_ORDER`)                            |
| `src/voxel.ts` (rasterizador)   | `tools/voxel.mjs` (`renderVoxels`) — paridade byte a byte      |

Se qualquer um desses contratos mudar no jogo, os testes deste pacote acusam.
