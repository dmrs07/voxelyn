# Prospector — tipologia de peças

Prancha de referência para **impressão 3D** do Prospector (Unidade Modular PX,
Aurix Dynamics), gerada do modelo voxel de produção.

| arquivo                    | o que é                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `prospector-typology.svg`  | a prancha. Vetorial: as cotas continuam nítidas em qualquer zoom e em papel.              |
| `prospector-typology.png`  | a mesma prancha em bitmap 2x, para quem só quer abrir a imagem.                           |
| `prospector-typology.json` | a mesma tipologia em dados: peças, camadas, cotas em unidade autorada, materiais e notas. |

Regenerar os três:

```sh
pnpm run prospector:typology
```

## De onde vem o desenho

Nada aqui é redesenhado à mão. As peças da prancha são as **mesmas caixas de
voxels** que o jogo desenha: `tools/typology.mjs` chama `prospectorParts()` — o
modelo único que assa o atlas do personagem e as três camadas de runtime — e
rasteriza cada peça com `renderVoxels()`, o rasterizador do próprio pipeline de
arte. Trocar uma cor, mover um voxel ou acrescentar um módulo ao bot muda esta
prancha na próxima geração, sem ninguém redesenhar nada.

O que a prancha acrescenta ao atlas é o que o atlas não tem como responder:
quantas peças existem, qual encaixa em qual, e qual é a menor feature que a
impressora precisa resolver.

## Como ler

- **Vista explodida** — cada peça afastada do corpo na direção em que ela monta.
  O rótulo `x2` marca as cinco peças que têm par espelhado; as outras quinze são
  únicas, porque o bot é assimétrico de propósito.
- **Catálogo** — cota em **unidade autorada** (`u`), a camada de runtime a que a
  peça pertence (`lower` / `upper` / `gun`), quantas caixas a compõem, a menor
  aresta dela e as tintas do material.
- **Topologia de montagem** — a árvore de encaixe, com o chassi na raiz.
- **Materiais** — a rampa `[topo, esquerda, direita]` de cada material é o
  conjunto de três faces que o rasterizador desenha por voxel; numa peça pintada
  elas são as três tintas. Os marcados `*` são emissivos.
- **Escala de impressão** — a ficha do bot diz 1,35 m, e o modelo tem 15 u de
  altura, então 1 u vale 90 mm reais. A tabela converte isso para as alturas de
  impressão usuais e mostra em quanto fica o meio-passo, que é a feature que
  some primeiro.

## O acoplamento que este diretório tem com o modelo

`tools/typology.mjs` carrega uma tabela (`PIECES`) que diz quais caixas de
`prospectorParts()` formam cada peça, endereçadas por índice. Isso é frágil de
propósito: uma caixa nova, removida ou reordenada no modelo faz a assinatura de
material da peça divergir e o gerador aborta, apontando a peça. `tests/typology.test.mjs`
roda a mesma conferência no CI, então a divergência aparece no commit que a
criou — e não na hora em que alguém for imprimir.
