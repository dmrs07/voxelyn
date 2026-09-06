# Voxelyn Survival — A barra de vida dos chefes

> «Não queremos colocar Dark Souls dentro de Voxelyn. Queremos que enfrentar um
> chefe em Voxelyn tenha a mesma dignidade, moda, gravidade e senso de ocasião.»

## 1. O problema

Até aqui o dono do setor tinha a mesma barra de qualquer criatura: dois pixels
flutuando sobre a cabeça, do tamanho do corpo, que só apareciam depois do
primeiro golpe e sumiam junto do corpo — debaixo d'água, atrás de uma parede,
fora da câmera. O Leviatã do Lençol e um Espreitador falavam a mesma língua
visual. A HUD não tinha como dizer "esta criatura domina a sala".

## 2. O que muda

Quando o dono do setor desperta, uma faixa longa surge no rodapé: o nome em
caixa alta, um acento material do bioma, a moldura escura, o leito quase preto,
o eco da ferida e a vida em vermelho profundo. Ela fica enquanto o encontro
durar — cheia antes do primeiro golpe, fora da câmera, submersa, enterrada,
entre poças — e desaparece na troca de setor, no reset do encontro ou quando o
chefe realmente não existe mais. O chefe ativo **não** recebe mais a barra
local flutuante: uma vida, uma barra.

Nada é interrompido: sem cutscene, sem letterbox, sem input bloqueado. A
glória vem da escala, do silêncio, do tempo e da disciplina.

| Antes                                                    | Depois                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| barra de 2 px sobre o corpo, só depois do primeiro golpe | faixa de até 860 px no rodapé, cheia desde o despertar      |
| sem nome                                                 | nome canônico localizado (`bestiary.name.*`)                |
| some com o corpo (mergulho, ocultação, fora da tela)     | persiste; um véu material marca o corpo inalvejável         |
| mesma linguagem de um Espreitador                        | moldura, terminações e acento material próprios             |
| morte = corpo some, barra some                           | vida a zero na hora, eco recua, acento apaga, moldura racha |

## 3. Arquitetura

Três módulos em `packages/voxelyn-survival/src/client/`, nenhum deles dentro
de `render.ts`:

- **`boss-health-bar.ts`** — seleção, estado visual e desenho.
  - `resolveSectorBoss(state)`: o corpo vivo do dono do setor, por
    **arquétipo**. Nunca por `sectorBoss.entityId` — o espelho online o deixa
    `null` de propósito. É a mesma resolução que o áudio já usava para os
    leitos de chefe; agora o `AudioDirector` a importa daqui.
  - `bossHealthBarTarget(state)`: existe barra? Precisa de dono não derrotado,
    corpo vivo e `bossRuntime.awake` (ou vida abaixo do máximo).
  - `usesMonumentalBar(state, entity)`: esta entidade é apresentada pela barra
    monumental, e portanto **não** recebe a barra local. O renderer consulta
    isto no laço de inimigos.
  - `BossHealthBarPresentation`: o que a barra mostra e o que está animando —
    HP autoritativo, eco, entrada, cura, fase, morte. Guarda números, nunca
    a entidade.
  - `drawBossHealthBar(ctx, layout, view, opts)`: desenho puro, todo em
    retângulos de pixel inteiro.
- **`boss-health-bar-layout.ts`** — `bossHealthBarLayout({viewport, safe,
touchMode, hudPanel})`: geometria pura (posição, moldura, leito, baseline do
  nome, escala, visibilidade). Lê a geometria dos controles de toque de
  `touchControlGeometry` (`input.ts`, a mesma função que posiciona os botões
  reais) e a reserva da barra de comandos (`desktop-controls.ts`).
- **`boss-health-bar-palette.ts`** — `bossBarAccent(archetype)`: tabela
  declarativa de acentos por chefe, sobre `palette.ts` (a paleta mestra,
  extraída de `render.ts` para poder ser lida sem o renderer).

`render.ts` só faz três coisas: repassa os eventos do tick ao presenter em
`ingestEvents`, pula `drawHealthBar` para o dono do setor, e chama
`renderBossHealthBar` por último — depois da HUD e da caixa-preta.

## 4. Uma linha do tempo só

O HP vem do `SurvivalState` que o renderer recebe em `render()`:

- **Solo e replay**: a amostra do `LocalPlayout` para o tick apresentado.
- **Online**: `net.sampleRenderState(now)` — o quadro **alcançado** pelo playout
  (`from`), o mesmo que posiciona os corpos.

Os eventos chegam pela mesma `TickEventQueue` que alimenta partículas e áudio,
liberados quando a linha de render alcança o tick deles. Por isso a barra
nunca mistura a vida do snapshot mais novo com o corpo do quadro anterior, e
um `hit` que o playout ainda não alcançou não move nada: o valor só muda
quando o **estado** do tick apresentado muda.

Consequências que os testes cobram:

- um snapshot repetido tem o mesmo HP → nenhum eco novo;
- um salto de tick (`> 40` ticks, ou tick voltando: resync/reconexão) →
  a barra **encaixa** no valor novo sem animar a diferença como dano;
- cura → a vida sobe, o eco sobe junto, e uma marca clara revela a área
  recuperada de onde a cura começou até onde chegou (o Bispo regenera em
  muitos passos: a marca cresce a partir do primeiro);
- fase → o HP não muda; o acento atravessa a moldura uma vez e o nome
  intensifica; evento e estado marcam a mesma virada uma vez só;
- reconexão no meio da luta → sem `boss_awake` e sem ter visto o chefe
  dormir, a barra entra com um fade de 180 ms direto no HP atual, sem ritual
  e sem varredura de fases já disparadas;
- troca de setor → o presenter limpa tudo, inclusive uma saída de morte em
  curso; `resetRunPresentation` também.

## 5. O ritual de entrada (800 ms)

Quando o chefe desperta (evento `boss_awake` recente, ou o presenter o viu
dormindo neste setor):

1. **0–18 %** — uma fissura escura de 1 px nasce no centro e cresce para os
   lados.
2. **18–50 %** — a moldura sobe em degraus de 2 px a partir do fio; as
   terminações encaixam quando ela está a 70 %.
3. **40–65 %** — o nome surge com um fade curto.
4. **50–85 %** — uma máscara revela a vida **no valor autoritativo**, da
   esquerda para a direita. Nunca se anima de zero até o valor: pareceria
   cura.
5. **80–100 %** — o acento pulsa uma vez ao longo da linha de cima.

Sem bounce, sem elasticidade, sem partículas, sem letterbox. Com
`prefers-reduced-motion` (ou o alternador da Arena) a montagem vira um fade de
180 ms com nome e HP legíveis no primeiro quadro.

**Som.** `cues.ts` acrescenta ao `boss_awake` uma segunda voz, `bossBar*`, por
família de material (`mineral`, `metal`, `crystal`, `fluid`, `ember`, `ice`):
um impacto grave abafado, o encaixe da moldura fechando aos 160 ms e a pequena
cauda do material. Prioridade 7, ganho 0,34 — abaixo do rugido (10 / 0,95) e
dos telégrafos fatais; o subgrave é do despertar, a barra só acrescenta o
timbre de que é feita. Toca no barramento de efeitos (não passa pela
amarrotada lo-fi dos chefes: é interface). Reconexão não toca nada.

## 6. Dano, cura, fase, morte

- **Dano**: a vida recua na hora. O eco (osso manchado de sangue,
  `BOSS_BAR_ECHO`) segura o valor anterior por 240 ms e recua em 300–450 ms
  (proporcional ao golpe), começando no fim do hold — não no quadro em que se
  notou, para duas máquinas de co-op convergirem. Golpes ≥ 6 % da vida
  contraem a moldura 1 px por 50 ms, soltam três lascas quadradas e acendem
  um clarão de 2 px na ponta da vida. A tela não sacode por causa da barra.
- **Cura**: a área recuperada recebe um preenchimento no brilho do acento e um
  fio claro na borda nova, revelados de onde a cura começou para onde chegou
  e desvanecendo em 560 ms. A barra nunca fica verde.
- **Fase**: mesmo HP; varredura do acento nas linhas de cima e de baixo da
  moldura (700 ms); nome intensificado. Sem divisórias que revelem thresholds.
  O **frenesi** do Diamandis (`boss_state: 'frenzy'`, um por peça arrancada)
  reutiliza a mesma varredura — uma por acúmulo, nunca um efeito de tela.
- **Corpo inalvejável** (Leviatã com exposição < 0,5, Devorador enterrado): a
  moldura perde brilho e um véu escuro do acento cobre a vida, com uma linha
  tracejada de "lâmina". Nada escreve "IMUNE"; armadura não é mostrada.
- **Morte**: vida a zero imediatamente; o eco completa o recuo; o nome fica;
  o acento apaga (35–65 % do hold); a moldura racha e perde os pixels das
  terminações; segura 1100 ms; depois encolhe para o centro e afunda em
  420 ms. O presenter retém os números — a entidade já saiu da lista. Não há
  segunda mensagem de vitória.

## 7. Layout

`bossHealthBarLayout` resolve três posturas:

| Postura        | Largura                                            | Vida  | Nome  | Onde                                                                                                          |
| -------------- | -------------------------------------------------- | ----- | ----- | ------------------------------------------------------------------------------------------------------------- |
| Desktop        | 66 % da tela, teto 860 px                          | 13 px | 18 px | centrada, acima da barra de comandos (`+16 px`)                                                               |
| Móvel paisagem | a faixa livre entre os controles, até 46 % da tela | 7 px  | 11 px | encostada na linha de baixo dos manches; sem terminações; peça atenuada (a postura DISCRETA: a tela é a luta) |
| Móvel retrato  | 94 % da tela, margens de 12 px                     | 10 px | 14 px | acima da borda mais alta dos controles                                                                        |

Sempre dentro da área segura; se a peça tocar o painel de status (tela muito
baixa), ela recua para a direita dele; se nem assim couber, não é desenhada.
Em telas minúsculas os ornamentos (terminações, desgaste) saem antes da vida.
Toda saída é inteira: a moldura é um arranjo de `fillRect` em pixels, sem
escala fracionária, sem blur.

## 8. Acentos

A vida é sempre `PAL.blood`. O acento aparece só na linha sob o nome, nos
chips das terminações, no pulso de entrada, na varredura de fase e no véu.

| Chefe               | Acento                        | Cauda sonora |
| ------------------- | ----------------------------- | ------------ |
| Guardião do Núcleo  | basalto e osso                | mineral      |
| Bispo do Veio       | fungo e biofluido             | fluid        |
| Diamandis           | metal Aurix e energia         | metal        |
| Devorador Branco    | sílica marfim                 | mineral      |
| Arquicantor         | cristal prismático            | crystal      |
| Leviatã do Lençol   | água abissal e ciano elétrico | fluid        |
| Pulmão-Matriz       | enxofre e osso                | mineral      |
| Coração da Fornalha | carvão e brasa                | ember        |
| Rainha da Geada     | gelo branco e ciano           | ice          |
| Magnetarca          | ferro, ferrugem e magnetismo  | metal        |

## 9. Arena (`arena.html`)

O painel **barra de chefe** aparece em toda luta: leitura exata do que a barra
lê (dono, `entityId` nulo ou não, acordado, derrotado, HP, fases, acento) e
cenários que agem sobre o estado autoritativo pelo funil da simulação
(`damageEntity`, eventos semânticos): dormir, despertar, vida cheia, dano
pequeno, dano grande, rajada (um golpe por tick), cura, transição de fase,
ocultar/submergir, fora da câmera, morte. Mais: reconnect simulado (o
presenter esquece e reentra no HP atual), menos movimento e língua.

Na arena do Diamandis há também o painel **Diamandis** (`arena-diamandis-debug.ts`):
os oito rumos do chassi, soltar/arrancar (com um Coveiro carregador de verdade),
abater o carregador, frenesi máximo e colapso do reator, com a leitura de cada
peça, do multiplicador e do tropeço.

Todos os painéis de ferramenta da arena obedecem a um só interruptor, o botão
**ferramentas** no canto superior direito. Em tela de toque (ou janela com
menos de 900 px) começam escondidos: no celular eles cobriam a sala e roubavam
o toque dos manches. A escolha persiste no navegador.

A **galeria** (`?gallery=1&scenario=…&viewport=…&single=…&locale=…&fit=0`)
desenha todos os chefes com a mesma estrutura e os respectivos acentos em uma
viewport escolhida (1366×768, 1920×1080, 2560×1080, 568×320, 320×568), com os
controles de toque desenhados como marcas fantasma e um roteiro por cenário
(entrada, cheia, dano, cura, fase, véu, morte) que recomeça a cada 4,2 s. É
inspeção: no jogo só o chefe ativo aparece.

## 10. Verificação

- `src/tests/boss-health-bar.test.ts` — seleção (arquétipo com `entityId`
  nulo, dormindo, derrotado, elite, barra local), presenter (ritual, reconnect,
  fora da câmera, veu, eco, snapshots repetidos, cura, fase, morte com e sem
  evento, reset/setor, resync, redução de movimento, HP do estado e não do
  evento), nomes em todos os locales, acentos válidos e distintos, desenho
  (coordenadas inteiras em todas as fases, fissura, revelação, largura da
  vida, redução de movimento).
- `src/tests/boss-health-bar-layout.test.ts` — 1366×768, 1920×1080,
  2560×1080, 1024×600, 568×320, 320×568, áreas seguras assimétricas, painel de
  status, telas minúsculas; nenhum controle de toque coberto; a mesma
  geometria que `layoutButtons` aplica.
- `src/tests/arena-bossbar-debug.test.ts` — os cenários contra uma run real
  (`createArenaRun`), a galeria em todos os cenários e viewports.
- `src/client/audio/boss-cues.test.ts` — o `boss_awake` do Diamandis leva a
  voz da barra (`bossBarMetal`) junto do boot e da fala; o `frenzy` tem voz
  própria, abaixo do windup das armas.
- `src/tests/diamandis-body.test.ts` — o corpo composto do Diamandis: peças,
  encaixes, ordem por rumo, frenesi (tint, espasmos, relógio), peça caída.
- `src/tests/arena-diamandis-debug.test.ts` — os cenários do painel do
  Diamandis contra uma run real: rumos, soltar, arrancar, abater, frenesi.
- `src/tests/diamandis-beam.test.ts` — o feixe de prospecção: alcance igual ao
  `beam_line` da simulação, atos, linha de medição, cores, cicatriz, cenário.
- `src/tests/demolition-fx.test.ts` — a salva de demolição: cargas do estado,
  voo e estopim, parábola e tombo, detonação só do Diamandis, cenário.
- `src/tests/drill-machine.test.ts` — a broca como máquina: fase do giro e pose
  em oito fases, passada pela distância, pose do chassi, telegrafo determinista,
  marcas e impactos dos eventos, cenários (corrida, veio, erro).
- `src/tests/noise.test.ts` — o ruído de Perlin: determinista pela semente, zero
  nos nós, dentro de [-1, 1], contínuo; `fbm` e o contorno irregular fechado.
- `src/client/audio/drill-audio.test.ts` — o leito da broca: curvas, o que ele
  lê do estado e da memória dos eventos, e as vozes dos transientes.

Capturas em `docs/media/boss-health-bar/`.
