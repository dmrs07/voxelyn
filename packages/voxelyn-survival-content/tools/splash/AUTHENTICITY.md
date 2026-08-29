# Relatorio de autenticidade — splash `guardian-core`

## Declaracao

**Nenhum pixel desta imagem foi produzido por geracao de imagem.** Nao houve
text-to-image, image-to-image, preenchimento generativo, difusao, ampliacao
generativa nem pintura generativa em nenhuma etapa — nem na imagem final, nem em
textura, nem em asset intermediario, nem em mascara.

Toda a imagem sai de um tracador de raios escrito neste repositorio, percorrendo
uma grade de voxels construida a partir da simulacao do jogo. Cada pixel colorido
existe porque um raio saido da camera encontrou um voxel de um modelo do
Voxelyn Survival naquela posicao.

A descricao honesta da imagem e:

> Renderizada em 3D com assets e sistemas reais de Voxelyn Survival, usando a
> pipeline de conteudo do proprio jogo.

## O papel da imagem de referencia

A imagem em `docs/art/splash/reference-ai-briefing.png` foi gerada por IA e
entregue como **briefing**. Ela nunca entrou na pipeline: nao foi amostrada, nao
foi usada como textura, como mascara, como entrada de qualquer processo, nem
sobreposta ao render.

Ela foi usada para exatamente tres coisas, todas mensuraveis:

1. **Alvos de composicao** — a posicao e a altura de cada sujeito no quadro
   foram medidas nela e viraram os numeros de `TARGETS`, em `frame.mjs`.
2. **Alvo de distribuicao de valor** — o histograma dela e a referencia contra a
   qual `histogram.mjs` compara o render.
3. **Direcao de atmosfera** — hierarquia luminosa e o lugar do branding.

## Onde a referencia foi deliberadamente contrariada

O briefing fixa a ordem de prioridade: assets do jogo acima da referencia. Tres
divergencias sao consequencia direta disso e estao aqui para ninguem precisar
descobri-las olhando.

**A anatomia do Guardiao.** A referencia desenha um visor em fenda ciano com
placas claras pareadas e quatro apoios. O modelo canonico do jogo
(`tools/entities.mjs:guardianModel`) e outro: nucleo redondo e difuso feito de
tres lajes emissivas de larguras alternadas, **seis** patas-coluna, sete
torres-cogumelo de oxido com chapeu de osso, franja de estalactites e garras de
duas unhas. O modelo canonico foi usado intacto. A silhueta de cidadela-montanha
que a identidade dele exige — baixo, largo, mais largo que alto ate a linha do
cume — esta preservada e e conferivel no passe de segmentacao.

**A cor da rocha.** A referencia mostra basalto marrom-neutro. O basalto do
Voxelyn e azul-acinzentado: `rock = [46, 58, 77]` na paleta mestra da art bible.
A paleta e fonte de verdade acima da referencia, e por isso o render e mais frio.
A aproximacao possivel foi feita pelo lado certo — dessaturando a LUZ ate quase
neutra, para o material poder dizer a propria cor — e nao tingindo a pedra.

**O tracado da Vein.** A referencia desenha uma linha continua correndo pelo
chao. No jogo, o condutor vive DENTRO da rocha: `SOLID_LEYLINE` e material de
parede, e o minerio tambem. A Vein aqui aflora nas paredes ao longo das celulas
que o worldgen gravou, o que atende ao que o briefing pede em texto ("parecer
minerio dentro da geologia", "nunca cabo de neon") mesmo divergindo do que a
referencia mostra em imagem.

## Rastreabilidade de cada elemento

| Elemento | Origem exata |
|---|---|
| Terreno (paredes) | `tools/terrain.mjs:blockModel`, tipo por celula via a mesma tabela do cliente (`client/render.ts:TERRAIN_KIND_INDEX`), variante via `variantAt` |
| Chao | `tools/surfaces.mjs:surfaceModel`, tipo via `SURFACE_KIND_INDEX` do cliente |
| Geografia | `createRun({ seed: 518, sector: 1 })` — a mesma chamada que o jogo faz |
| Guardiao do Nucleo | `tools/entities.mjs:guardianModel('idle', 2)` |
| Nucleo e berco | `tools/props.mjs:coreModel(0.25, false)` |
| Prospector | `tools/prospector.mjs:prospectorParts` (camadas lower + upper + gun) |
| Props Aurix | `tools/props.mjs:propModel` — `salvageTerminalIdle`, `salvageCacheT3`, `decor:crate:0` |
| Paleta | `tools/lib.mjs:COLORS` — 22 cores da art bible, nenhuma cor nova |
| Materiais | `tools/voxel.mjs:RAMPS` — albedo derivado da rampa de cada material |
| Emissivos | `tools/voxel.mjs:EMISSIVE`, importado e nao recopiado |
| Vein acesa | `floodFrom` + `chargeCells` de `@voxelyn/survival-sim` — as funcoes que o jogo usa quando um tiro de energia acerta um veio |
| Fontes | `voxelyn-survival/src/assets/fonts/chakra-petch-{600,700}.woff2` (OFL, licenca no repo) |
| Logo Aurix | `voxelyn-survival/src/assets/aurix-mark.svg` — vetorial, usado por referencia |

## Geometria criada para esta imagem

Duas, ambas declaradas em codigo e nenhuma delas um asset novo:

**Embasamento** (`scene.mjs`, item 1). Uma laje macica de `rockDeep` sob o piso
inteiro da janela. Nao e cenario: e a ausencia de um buraco. A isometria do jogo
nunca mostra o que ha sob o chao, entao nenhum modelo desenha isso; uma camera
livre, sim. O que se ve dela e apenas o corte lateral nas bordas do quadro.

**Empilhamento de rocha** (`scene.mjs:wallStacks`). A coluna de parede continua
para cima ate o teto da caverna, repetindo o MESMO `blockModel` da celula. O
afloramento — minerio, cristal, leyline — fica so no andar de baixo, e os
superiores usam a rocha comum do estrato. E restauracao do que a projecao corta,
nao geologia inventada: no jogo a rocha bloqueia visao e movimento, e as sete
unidades autoradas sao a altura da FAIXA que a isometria mostra.

## Pos-processamento

Todas as operacoes sao aritmetica declarada sobre os passes, em `post.mjs`:
bloom construido a partir do passe **emissivo** (nunca por limiar de brilho sobre
a imagem final), tonemap ACES, graduacao por faixa de luminancia, elevacao de
preto, saturacao, contraste e vinheta. Nenhuma delas cria materia; sao as mesmas
que um compositor aplicaria, com a diferenca de estarem escritas e serem
repetiveis.

Os passes auxiliares (albedo, normais, profundidade, oclusao, sombra, emissivo,
segmentacao) sao saida de QA e composicao. Nenhum deles alimentou pintura.

## Determinismo

- Seed fixa, e a seed do setor derivada pela mesma funcao do jogo.
- Amostragem por pixel com deslocamento derivado do indice da amostra, nunca de
  um gerador aleatorio.
- Alturas de empilhamento e variantes de textura vindas de hashes de posicao — as
  mesmas familias de hash que o jogo ja usa.
- Nenhuma leitura de relogio, de ambiente ou de rede em nenhum ponto do render.

Dois renders da mesma cena na mesma resolucao saem identicos bit a bit.

## Verificacao independente

O passe de segmentacao (`*-object.png`) pinta uma cor estavel por classe de
objeto: e possivel conferir, sem confiar em nada escrito aqui, que a silhueta do
Guardiao e a do modelo canonico, que o berco tem os quatro contrafortes, que o
Prospector esta de pe sobre o chao e que as celulas da Vein sao paredes do
worldgen. `*-manifest.json` traz a proveniencia de cada peca, com a origem
declarada como worldgen ou encenacao.
