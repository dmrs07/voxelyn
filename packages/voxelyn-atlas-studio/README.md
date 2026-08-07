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
- **Cortes grossos (fluxo do STL)**: STL importado quase sempre chega apoiado
  numa laje de base que não faz parte do bicho. `🗑z` apaga a camada z inteira;
  a ferramenta `⬚` marca um retângulo na fatia e apaga **naquela camada** ou
  **em todas de uma vez** (ou preenche com o material atual); e `Menu → ✂
  Camadas` corta da base até a camada escolhida e **assenta o modelo em z=0**,
  que é o que sobra fazer depois de tirar a base.
- **Importar GLB (malha + animação)**: `.glb` é o único dos três formatos que o
  Meshy oferece que é **um arquivo só e autocontido** — geometria, esqueleto,
  pesos de skin e animações no mesmo binário, com cabeçalho JSON legível. Cabe
  num parser sem dependência, que é o que um PWA offline precisa; FBX é
  proprietário e USDZ é um zip de USD binário. O import lê a malha **já
  deformada pelo esqueleto** num instante do clipe e passa pelo mesmo
  voxelizador do STL: cada animação do arquivo é amostrada nos frames do preset
  e vira frames Voxelyn. O enquadramento é **um só para todos os frames de todas
  as animações** — enquadrar frame a frame faria o bicho crescer, encolher e
  pular de lugar a cada pose. Y-up (padrão glTF) vira Z-up automaticamente, com
  giro em torno do eixo vertical quando o bicho chega de costas.
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
- **Rig automático**: o modelo é segmentado sozinho em **corpo + membros**
  (núcleo = a massa espessa do bicho; cada membro = um componente conexo por
  vizinhança-26 do que sobra, da inserção até a ponta) e cada membro comprido é
  cortado em **ossos ao longo do próprio comprimento** — coxa → canela → pé —
  usando distância geodésica até a inserção, que segue a forma do membro mesmo
  quando ele desce na diagonal. Os ossos formam uma **árvore**: `corpo` é a raiz
  e vale cinemática direta, então girar a coxa leva a canela e o pé junto, girar
  só a canela dobra o joelho, e mover o corpo carrega o bicho inteiro. Quadrúpede
  e bípede ainda ganham nomes anatômicos (`perna-traseira-direita`) em vez de
  `perna-3`. Daí saem os dois modos: presets determinísticos (`walk`, `idle`, `attack`,
  `hit`…) e a **IA projetando as poses** — o Claude recebe as imagens da pose
  neutra e um mapa colorido das partes, e devolve um JSON de
  `mover/girar por parte`; quem mexe em voxel é o motor local, nunca a IA.
  Toda pose passa por uma **cura de adjacência**: par de voxels que era vizinho
  na pose base e ficou separado depois da transformação ganha uma reta ligando
  os dois — é o que impede perna fina de se despedaçar ao girar. `Menu →
  Partes` mostra a divisão colorida e deixa renomear ou marcar um membro como
  corpo quando a geometria enganou o detector.
- **Rig manual (`Menu → 🦴 Esqueleto`)**: quando a geometria engana o detector —
  membro grudado no corpo por uma área larga, dois membros encostados — quem
  decide é quem desenhou. Escolha o arquétipo (humanoide ou quadrúpede), toque
  numa junta da lista e depois **no próprio modelo** para cravá-la; vale na
  vista 3D (pega o voxel da superfície) e na Fatia. A **simetria** espelha o
  lado B automaticamente, e o botão "chutar juntas" preenche tudo a partir do
  rig automático para você só corrigir o que saiu torto. O *skinning* é exato:
  em voxel a grade é discreta, então "cada voxel pertence ao osso mais próximo"
  é uma resposta, não uma aproximação com pesos — e empate vai para a
  extremidade, senão o osso da ponta nasceria vazio.
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
