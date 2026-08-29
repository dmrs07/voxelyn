# Splash 3D — `guardian-core`

Key art de **Voxelyn Survival** renderizada em perspectiva a partir dos sistemas
reais do jogo. Nenhum pixel foi gerado por modelo de imagem; o relatorio de
autenticidade esta em [`AUTHENTICITY.md`](./AUTHENTICITY.md).

```
pnpm --filter @voxelyn/survival-content render:splash:all
```

Um comando produz o conjunto inteiro em `artifacts/splash/guardian-core/`.
Para uma resolucao so:

```
pnpm --filter @voxelyn/survival-content render:splash -- \
  --width 3840 --height 2160 --samples 4 --passes --branding
```

---

## A ideia em uma frase

A materia continua sendo a do jogo — o mesmo worldgen, os mesmos modelos voxel,
a mesma paleta, o mesmo sistema de conducao — e so a **projecao** muda: em vez
da isometria 2:1 fixa do cliente, uma camera pinhole em perspectiva com um raio
por pixel.

Por que a projecao precisa mudar: a isometria do jogo desenha todo voxel com
4 pixels de largura, esteja ele encostado na tela ou no fim do corredor. E o
certo para jogar — ler a grade *e* jogar — e o errado para uma key art, onde a
distancia precisa medir alguma coisa. Sem perspectiva, o Prospector em primeiro
plano nao domina o quadro e o berco ao fundo nao cede tamanho; a imagem vira um
diagrama.

## O caminho dos dados

```
createRun({ seed: 518, sector: 1 })          simulacao do jogo, sem alteracao
        |
        v
  solid[] / surface[] / corePos / leylineSegments        area 96x96 real
        |
        +-- blockModel / surfaceModel        modelos voxel de terreno e chao
        +-- guardianModel / coreModel        chefe e berco, canonicos
        +-- prospectorParts / propModel      jogador e equipamento Aurix
        |
        v
  geometry.mjs  ......  box-lists -> grade densa (material + id de objeto)
        |
        v
  trace.mjs  .........  DDA (Amanatides & Woo) com pulo de bricos 8^3
  render.mjs  ........  luz, sombra, oclusao, emissao, bruma, volumetrico
        |
        v
  post.mjs  ..........  bloom do passe emissivo, ACES, graduacao, vinheta
  branding.mjs  ......  tipografia real (Chakra Petch) + logo Aurix vetorial
```

## Os arquivos

| Arquivo | O que faz |
|---|---|
| `preset.mjs` | **Fonte de verdade.** Seed, janela, encenacao, props, camera, pos-processamento. Os argumentos de linha de comando so escolhem resolucao e destino. |
| `scene.mjs` | Voxeliza a area 96x96: terreno, chao, empilhamento de rocha, personagens, berco, props. Marca a fronteira entre worldgen e encenacao. |
| `geometry.mjs` | Converte box-lists em grade densa. Tabela de materiais e albedo. |
| `camera.mjs` | Camera pinhole: base ortonormal, raios por pixel, projecao de pontos. |
| `trace.mjs` | Travessia da grade e teste de oclusao. |
| `render.mjs` | Equacao de luz e G-buffer. |
| `lights.mjs` | As luzes, todas derivadas de objetos que emitem na cena. |
| `vein.mjs` | Acende a Vein pelos sistemas de conducao da simulacao. |
| `post.mjs` | Tonemap, bloom, graduacao, e os passes auxiliares em PNG. |
| `branding.mjs` | Camada tipografica transparente e composicao alfa em linear. |
| `render-splash.mjs` | O comando de render. |
| `render-all.mjs` | O conjunto completo de entregas. |
| **Ferramentas de medicao** | |
| `scout-seed.mjs` | Escolhe a seed rodando o gerador do jogo e pontuando o resultado. |
| `solve-frame.mjs` | Busca encenacao + camera contra alvos medidos na referencia. |
| `frame.mjs` | Confere o enquadramento sem renderizar. |
| `histogram.mjs` | Compara a distribuicao de luminancia com a referencia. |
| `compare.mjs` | Monta o comparativo lado a lado. |

## A seed, e como ela foi escolhida

`runSeed: 518, sector: 1` — **Galerias de Basalto**, estrato basalto, gramatica
espacial `columns`. Seed de setor derivada: `sectorSeed((518 ^ 0x9e3779b9) >>> 0, 1)`.

A escolha foi medida. `scout-seed.mjs` roda o gerador sobre centenas de seeds e
pontua cada mundo pelo que a composicao exige: condutor denso nascendo no berco,
corredor navegavel medido por busca em largura sobre chao real, arena em volta do
nucleo, margem ate a parede externa.

Duas medicoes mudaram o criterio no caminho, e as duas sao fatos do jogo que
valem estar escritos:

- **O Guardiao nao ronda o mapa.** Em 251 setores medidos, o gerador o poe a
  2,8–3,0 tiles do berco. Sempre. Ele guarda, e guardar e ficar colado. A
  separacao entre chefe e berco que a composicao pede nao vem da geracao — vem
  da profundidade da camera e do avanco do proprio encontro.
- **O minerio do Voxelyn e bolsao, nao veio longo.** Em 2.700 setores medidos, a
  maior cadeia de minerio conectado tem 15 celulas e a mediana e **uma**. O
  condutor de longa distancia e a leyline, e e ela que faz o papel da Vein.

## O que e worldgen e o que e encenacao

Fronteira declarada em codigo, nao em nota de rodape (`stageEncounter`, em
`scene.mjs`):

**Worldgen, intocado** — terreno e chao de toda a area, posicao do berco, tracado
das leylines, tipo de rocha por celula, variante de textura por posicao.

**Encenacao, declarada** — o Guardiao avancou de (78,92), onde nasce, para
(78,89), meio caminho entre o bot e o berco; o Prospector esta em (81,85), celula
de chao aberto encostada no condutor; quatro props Aurix do atlas `world-props`
em celulas abertas conferidas contra o terreno. Poses sao quadros reais das
animacoes assadas, e orientacoes sao rotacoes de 90 graus do modelo — nenhuma
anatomia redesenhada.

**Composicao** — a rocha continua para cima ate o teto da caverna. O bloco de
parede do jogo tem 0,875 tile de altura porque e so a faixa que a isometria
mostra; a rocha do jogo bloqueia visao e movimento e vai da laje ao teto.
`wallStacks` deriva a altura de cada coluna da distancia ate o espaco aberto mais
proximo (rocha e mais alta onde a escavacao nao chegou) mais um hash da posicao.

## A camera, e por que ela e uma busca

Sete variaveis com tres acoplamentos medidos:

1. **Tamanho e espacamento escalam juntos.** Ambos sao um comprimento dividido
   por (profundidade x tangente do campo). Nenhuma lente deixa os tres sujeitos
   grandes *e* espalhados — a razao entre a distancia bot-berco e a altura do
   chefe e propriedade da encenacao, nao da lente.
2. **Azimute troca largura por profundidade.** Perto do eixo bot-berco, os tres
   colapsam na mesma coluna da tela e o chefe tapa o berco.
3. **Elevacao e altura do alvo** deslocam o grupo todo na vertical, mas nao na
   mesma medida para cada sujeito.

`solve-frame.mjs` varre celulas candidatas e uma grade de camera minimizando o
desvio ate alvos **medidos na referencia**, com os gates do briefing como
restricao dura: berco mais longe que o chefe, bot mais perto, separacao
horizontal minima entre chefe e berco, e linha de visada livre de rocha.

Resultado: desvio de **0,0065** sobre nove medidas, com lente de 28 graus
verticais (uma 40mm equivalente).

| | horizontal | vertical | altura no quadro |
|---|---|---|---|
| Prospector | 0,196 (alvo 0,21) | 0,711 (0,73) | 29,7% (33%) |
| Guardiao | 0,500 (0,47) | 0,389 (0,35) | 36,5% (35%) |
| Nucleo | 0,623 (0,62) | 0,208 (0,20) | 23,3% (22%) |

## A luz

Toda fonte nasce de um objeto que emite na ficcao do jogo. Hierarquia, na ordem
que o briefing fixa e que as intensidades declaradas respeitam:

1. **Nucleo** — ciano do cristal `biolum`, a unica com sombra projetada e a unica
   com espalhamento volumetrico no ar. E o volumetrico que a faz ler como fonte
   *dentro* de um espaco, e nao como objeto brilhante colado no fundo.
2. **Berco e Vein proximas** — emissor curto no pedestal, e uma luz por trecho
   carregado do condutor, com intensidade decaindo a partir da nascente.
3. **Visage do Guardiao** — o nucleo `electric` do chefe, emissivo em repouso.
4. **Prospector** — visor e farol.
5. **Pontos ambar** — so onde ha equipamento Aurix.
6. **Ambiente** — key fria de cima, quase neutra, mais um fill minimo na posicao
   da camera (o unico que o briefing autoriza: "suficiente para separar o
   Guardiao do fundo").

## O que a calibragem por medicao encontrou

Duas correcoes que o olho nao teria isolado:

**A cor, nao a exposicao.** O histograma mostrou que a estrutura de valor do
render ja batia com a da referencia (mediana 0,059 contra 0,052; sombras
cobrindo 60% do quadro contra 62%) enquanto a media de canal estava em
(8,5 24,0 64,6) contra (20,0 28,0 28,5). O problema nunca foi exposicao: era luz
azul multiplicando rocha azul. A luz foi dessaturada para quase neutra.

**A direcao da key.** O passe de segmentacao mostrava a silhueta de cidadela do
Guardiao perfeitamente legivel enquanto o beauty o entregava como mancha escura.
A key apontava de oeste, a camera olha de leste: as faces visiveis estavam no
lado errado da luz.

## Reprodutibilidade

Fixado em `preset.mjs` e registrado em cada `*-manifest.json`: seed e setor,
estrato e ocupacao, janela voxelizada, posicao de cada peca com a origem dela
(worldgen ou encenacao), camera completa com base ortonormal, celulas de Vein
carregadas e eventos que a simulacao emitiu, todas as luzes com tag e
intensidade, e os parametros de pos-processamento.

A amostragem por pixel usa deslocamento derivado do indice da amostra, nunca de
um gerador aleatorio: dois renders da mesma cena saem identicos bit a bit.

## Entregas

Em `artifacts/splash/guardian-core/` (fora do controle de versao):

| Arquivo | O que e |
|---|---|
| `*-3840x2160-branded.png` | master 4K com branding |
| `*-3840x2160-beauty.png` | 4K sem branding |
| `*-1920x1080-branded/beauty.png` | entrega 1080p |
| `*-1280x720-beauty.png` | preview na resolucao alvo do jogo |
| `*-2560x1600-*`, `*-2436x1125-*` | 16:10 e paisagem de celular, **renderizados** e nao recortados |
| `*-raw.png` | sem pos-processamento |
| `*-albedo/normal/depth/ao/shadow/emissive/object.png` | passes auxiliares |
| `*-manifest.json` | o registro completo do que produziu a imagem |
| `comparison-reference-vs-render.png` | referencia ao lado do render |

`artifacts/` fica fora do controle de versao por ser saida regeneravel. A copia
curada do que interessa guardar — as duas resolucoes de entrega, a versao sem
branding, o passe de segmentacao, o comparativo e o manifest — esta versionada em
[`docs/art/splash/`](../../../../docs/art/splash/README.md).
