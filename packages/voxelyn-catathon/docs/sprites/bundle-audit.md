# Auditoria (somente leitura) — bundle "Animated Cat Sprites" (girlypixels, itch.io)

Data: 2026-08-25. Nenhum pixel foi modificado ou gerado nesta fase; este
documento e as folhas de contato derivam apenas de leitura dos PNGs originais.

## 1. Licenca

- **Dentro do zip NAO existe arquivo de licenca/readme** (2266 arquivos:
  1978 png + 288 gif, nada de texto).
- Termos fornecidos pela pagina do pack (itch.io, girlypixels): *"You can
  modify and use these assets in commercial projects, however, you cannot
  redistribute or resell these assets."*
- Consequencias praticas:
  - Uso no jogo (inclusive comercial) e modificacao (recolor, overlays,
    frames derivados): **permitido**.
  - **Redistribuir o pack e proibido.** Commitar os PNGs crus num repositorio
    publico e redistribuicao. Antes de importar os assets para o repo,
    confirmar a visibilidade do repo; se publico, os sprites devem entrar
    apenas embutidos no build (atlas processado) ou o repo/asset-dir precisa
    ficar privado. Guardar o zip original fora do repo.
  - Adicionar `docs/sprites/LICENSE-cats.md` com atribuicao e o link da
    pagina do pack quando a importacao acontecer (o zip nao traz o texto).

## 2. Inventario

Estrutura: `cats/<raca>/<pelagem>/<Animacao>/<Animacao><n>.png` + `Gifs/`.

- 4 racas × 4 pelagens = 16 gatos: **bobtail** (black and white, brown tabby,
  mekong, orange spotted), **halloween** (angel, butterfly, skeleton, wizard),
  **longhair** (blue, orange siamese, orange tabby, white), **shorthair**
  (abyssinian, grey_tabby, siamese, tuxedo).
- Conjunto de referencia (11 dos 16 gatos), 18 animacoes / 122 frames:

  | Animacao | Frames | | Animacao | Frames |
  |---|---|---|---|---|
  | Attack_hit | 6 | | Jump | 8 |
  | Attack_swat | 4 | | Laying_down | 5 |
  | Crouch | 4 | | Running | 10 |
  | Dead | 8 | | Sitting | 5 |
  | Getting_up | 4 | | Sitting_head_turn | 7 |
  | Groom_fur | 8 | | Sleeping | 10 |
  | Groom_paw | 8 | | Turning | 9 |
  | Hissing | 7 | | Walking | 10 |
  | Hurt | 4 | | Idle | 5 |

- Desvios do conjunto de referencia:
  - `shorthair/{grey_tabby,siamese,tuxedo}`: Sitting **10**, Laying_down
    **7**, Sitting_head_turn **8** (versoes estendidas).
  - `shorthair/abyssinian`: os mesmos + Jump **9** (nao e recolor puro dos
    irmaos de raca; canvas do Jump tambem difere: 54px vs 53px).
  - `bobtail/mekong`: **Hissing/ tem 0 PNGs** (defeito do bundle — o
    `Hissing.gif` existe; da para reportar a autora ou extrair frames do gif).
- `Gifs/`: 18 gifs por gato, previews prontos de cada animacao.

## 3. Canvas, bounds, transparencia, escala

- PNG RGBA 8-bit (color type 6), sem entrelacamento. Alpha **binario**
  (0/255, zero pixels semitransparentes) — recorte limpo.
- Altura do canvas: **32px em todos os 1978 frames**. Largura: 32px na
  maioria; animacoes largas variam POR RACA:
  - Running: 43/47/48 × 32 · Jump: 42/53/54/56/59 × 32
  - Dead: 38/43/46 × 32 · Hurt: 32/37/38 × 32
- Linha do chao: consistente em y=31 (frames aereos de Running sobem ate
  y=27; Turning/Hissing variam 1–2px de agachamento intencional).
- Paletas minusculas por gato (6–21 cores com contorno) — recolor
  deterministico por mapa de paleta e viavel e seguro.
- Escala de pixel **1:1 verdadeira** (nenhum texel ampliado).

## 4. Problemas de nomenclatura

- **Armadilha de ordenacao lexicografica em 52 pastas**: `Walking1, Walking10,
  Walking2, …`. Toda leitura precisa de *natural sort* (o script de folhas ja
  usa; o importador tambem devera).
- `Gifs/Sit_head_turn.gif` vs pasta `Sitting_head_turn/` (nome divergente).
- `grey_tabby` usa underscore; todas as outras pelagens usam espaco.
- Espacos em nomes de pastas ("orange tabby") — encode em URLs/imports.

## 5. Folhas de contato e previews animados

Gerados sem tocar nos pixels (composicao 1:1 dos PNGs originais):

- `sheet-coats.png` — os 16 gatos (Idle1 + Sitting1, 4×).
- `sheet-orange-tabby-all.png` — as 18 animacoes do longhair/orange tabby,
  todos os frames (3×).
- `sheet-vertical-slice.png` — Walking/Idle/Sitting/Sleeping a 8×.
- Previews animados: os proprios `Gifs/` do bundle.

## 6. Pivos e offsets

- Pelagens da MESMA raca sao **recolors exatos** (mascaras de alpha
  identicas frame a frame) — exceto abyssinian (ver §2). Racas tem
  silhuetas proprias.
- Frames 32×32: conteudo estavel, pes em y=31 → ancora natural =
  **centro-horizontal do canvas, base y=31**.
- Frames largos NAO sao centralizados: **Jump tem translacao horizontal
  embutida** (o gato avanca dentro do canvas: x0 varia 0→12, x1 42→55);
  Running preenche quase toda a largura. Integracao precisa de metadata de
  ancora POR ANIMACAO (e por raca, ja que a largura varia por raca) — um
  JSON Catathon-side, sem editar os PNGs.
- Direcao nativa: os gatos olham para a **direita**; só existem
  esquerda/direita (pack 2D side-view). Esquerda = espelho horizontal no
  engine. `Turning` e a transicao direita→frente→esquerda pronta.

## 7. Escala vs jogo

- Gato atual (procedural): corpo 22×14 (+cabeca) ≈ **20–21px** de altura em
  mundo 480×270.
- Gato do bundle: **~30–32px** de altura visual (canvas cheio) — ~1.5× o atual.
- Recomendacao: **integrar 1:1 (nunca reescalar os pixels)** e adaptar o
  mundo: mesas, rack, palco e vagas (`VENUE_OFFSETS`, `DECIDE_SPOTS`)
  ganham uma passada de proporcao para o metro de 32px. Reamostrar o sprite
  destruiria os pixels originais (proibido pela diretriz).
- Perspectiva: bundle e side-view puro; o pavilhao e 3/4. Combinacao
  classica de jogos cozy (personagens side-view sobre cenario 3/4) — ok,
  mas o teclado/mesa passam a ser interagidos DE LADO, nao de costas.

## 8. Fatia vertical recomendada

**`longhair/orange tabby`** (e o heroi da splash) com **Walking (10) +
Idle (5)**, depois Sitting (5) e Sleeping (10):

- Walking/Idle ficam 100% em 32×32 (sem canvas largo, sem translacao
  embutida) — integracao mais simples primeiro.
- Cobre o loop basico do jogo: andar ate um posto, ficar parado, sentar,
  dormir.
- Valida o pipeline completo: natural sort → atlas → ancora → espelho
  esquerda → timing.

## 9. Acoes do CATATHON sem cobertura no bundle

Presentes: idle, andar, correr, sentar, virar cabeca, dormir, deitar,
levantar, virar (flip), groom ×2, hiss, ataque ×2, hurt (flash vermelho),
morrer, pular (celebracao de ship).

Faltantes (adaptar como OVERLAY/derivacao Catathon por cima de frames base
do bundle, sem redesenhar o gato):

| Acao Catathon | Base do bundle | Camada Catathon |
|---|---|---|
| Teclar na mesa | Sitting + Sitting_head_turn | patas no teclado, monitor |
| Consertar rack | Attack_swat (pata estendida) | chave/cabo, fumaca |
| Comer | Crouch (cabeca baixa) | tigela |
| Carregado (held) | — (nao ha) | derivar pose pendurada de Idle |
| Carinho / reacao | Groom_fur / Sitting_head_turn | coracao/particula |
| Decidir no quadro | Sitting + head_turn | balao "?" |
| PM (oculos+gravata) | Walking/Idle/Turning | oculos, camisa+gravata |
| Brigar | Attack_hit/swat + Hissing + Hurt | ja coberto |

Colares/oculos/gravata/props = camadas separadas alinhadas as ancoras, com
mapa de paleta deterministico para novas pelagens — nunca recolor por IA.

## 10. Status

Fase de auditoria concluida sem modificar nem gerar arte. Proximo passo
(apos aprovacao): importar o bundle intacto para um diretorio de assets
fonte (respeitando §1), normalizar por METADATA (nomes/ancoras via JSON,
nunca editando PNG) e montar a fatia vertical do §8.
