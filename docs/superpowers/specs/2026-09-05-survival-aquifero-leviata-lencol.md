# Voxelyn Survival — o Aquífero Negro e o Leviatã do Lençol em duas fases

**Versões**: `SIMULATION_VERSION` 59 (60 com a vida em 4000, ver §5) · `PROTOCOL_VERSION` 32 · `CONTENT_VERSION` 34
(atlas `enemy-sheet-leviathan` v3, atlas novos `part-sheet-leviathan-wings` e `part-sheet-leviathan-tail` v1,
`surface-tiles` v9).

Rework completo e integrado do estrato e do encontro: água profunda nativa gerada
como **bacias** (margem rasa, núcleo profundo permanente), o Leviatã como criatura
**estacionária** na primeira fase — ancorado sobre uma poça, atacando à distância
pela Sondagem Abissal, criando e aprofundando poças, mergulhando por segmentos e
reaparecendo em outra — e como **arraia inteira** na segunda, depois do Dilúvio,
nadando direto no Prospector. As bolhas protetoras ganharam um contrato de raio
único e a mesma linha do tempo dos corpos.

## 1. O conceito

A luta conta duas histórias.

| Fase                   | Arena                                                                  | Leviatã                                                                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **O Lençol por Baixo** | poças isoladas: margem rasa em volta de núcleos profundos              | ancorado sobre uma poça, com o corpo aberto **tampando** o núcleo; gira para acompanhar; solta duas ou três Sondagens; escolhe outra poça; afunda por segmentos; viaja escondido; emerge por segmentos |
| **A Arraia Inteira**   | o Dilúvio conecta dutos, poças naturais e poças criadas e enche a sala | emerge por completo, nada direto no Prospector, o corpo segue as curvas da cabeça; contato, passagem das asas e a descarga massiva controlam espaço                                                    |

O corpo segmentado existe para a **submersão**: cabeça, asas, tronco e cauda
atravessam a lâmina em momentos diferentes. Só na segunda fase os segmentos
também comunicam comprimento, curva e deslocamento (o rastro por comprimento de
arco do Devorador, generalizado em `spine-trail.ts`).

## 2. A semântica da água

| Água                                               | Prospector                            | Criaturas                                          | Duração                                   |
| -------------------------------------------------- | ------------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| água rasa (`SURF_WATER`)                           | caminhável, lenta, condutiva          | atravessável                                       | permanente                                |
| água profunda nativa (`SURF_DEEP_WATER`, Aquífero) | queda fatal                           | Leviatã e Lampreia atravessam; terrestres barrados | permanente, **nunca** entra em `iceHoles` |
| buraco glacial (`SURF_DEEP_WATER`, Cripta)         | queda fatal                           | Rainha e Espectro atravessam                       | temporário, recongela                     |
| Dilúvio                                            | coluna de água sobre o piso existente | atravessável                                       | runtime da luta                           |

O id de superfície é o mesmo; a **origem e o ciclo vivem no registro**:
`sealIceHole` só fecha buracos registrados em `state.iceHoles` — a Nova da Rainha
não transforma água profunda nativa em placa. `CROSSES_DEEP_WATER` ganhou
`sheet_leviathan` e `mud_lamprey`. O Prospector continua morrendo ao entrar numa
célula profunda que **não esteja tampada** pelo corpo ancorado do Leviatã
(`drownsAt` em `run.ts`). A queda leva `medium: 'ice' | 'water'` no evento
`ice_fall`: na Cripta o gelo quebra e recongela; no Aquífero a água negra engole
o chassi, sobe uma coluna de bolhas, o golpe é grave e abafado
(`aquiferPlunge`), e nenhum gelo aparece.

## 3. Geração das bacias (`stampDeepBasins`, worldgen)

Depois de toda água rasa existir (gramática karst, `waterBlobs`, poças da arena) e
**antes** de qualquer ponto de interesse ser sorteado:

1. cada massa 4-conexa de água rasa com pelo menos `BASIN_MIN_CELLS` (14) células
   é a máscara externa, irregular por construção;
2. a máscara é **erodida** em vizinhança de oito — uma vez; duas nas massas com
   `BASIN_DOUBLE_ERODE_CELLS` (46); três a partir de `BASIN_TRIPLE_ERODE_CELLS`
   (120) — e só sobram células cujos oito vizinhos são água ou rocha;
3. o miolo vira água profunda; núcleos de uma ou duas células
   (`DEEP_CORE_MIN_CELLS`) não existem; as células protegidas (entrada e
   pedestal, raio 3; ponto do chefe, cheb 2) ficam de fora; massas que **já** têm
   núcleo (as poças autoradas da arena) não crescem;
4. cada núcleo é pintado e **provado**: se corta a rota caminhável da entrada
   até o pedestal ou até o chefe (`floodWalkable`: aberto e não profundo, quatro
   vizinhos — o raio do Prospector, 0,34, é menor que meia célula, então esse é o
   modelo honesto), volta a ser raso.

Terminais, caches, respiradouros e spawns passam a ser sorteados sobre o **chão
caminhável** (`walkArr`); sem água profunda a lista é idêntica a `openCells` e o
sorteio dos estratos secos não muda um byte. A arena karst deixou de pintar uma
orla rasa e passou a **escavar cinco poças** (`AQUIFER_ARENA_POOLS`: margem
2,6, plus profunda de raio 1,2) em volta do chefe, com chão seco entre elas. O
Leviatã nasce sobre o núcleo ocupável mais próximo (`populateSector`).

Varredura de 300 mapas de Aquífero (setores 2, 4 e 7, 100 seeds cada):

| Métrica                                                           | Valor                       |
| ----------------------------------------------------------------- | --------------------------- |
| mapas com falha de conectividade ou núcleo encostado em piso seco | **0**                       |
| água rasa / chão aberto                                           | 15,9 %                      |
| água profunda / chão aberto                                       | 1,5 %                       |
| componentes profundos por mapa                                    | 9 a 31 (média 16,6)         |
| tamanho de componente                                             | 3 a ~50 células (média 5,6) |
| pior rota obrigatória entrada → pedestal                          | 192 células (média 170)     |

Testes: `aquifero-bacias.test.ts` (determinismo, margem, sem ruído, posições
críticas, conectividade com água profunda fatal, poças da arena, spawn do chefe
sobre núcleo, basalto intocado) e `impressao-digital-geracao.test.ts` (nova
assinatura 3903803443).

## 4. As posturas (`types.ts`, `leviathan.ts`)

O humor da entidade viaja no snapshot e entra no hash: `LEVIATHAN_ANCHORED`,
`LEVIATHAN_DIVING`, `LEVIATHAN_HIDDEN`, `LEVIATHAN_EMERGING`, `LEVIATHAN_HUNTING`.
`charging` é derivada (`hunting` + ação `massive_shock`). `leviathanPosture` é a
única leitura; `leviathanExposure` (0..1 da região vulnerável fora da água) e
`leviathanTargetable` (≥ 0,5) decidem o funil de dano, os projéteis e a mira
assistida — escondido ele não é alvo, e nem o `hit` sai.

Ações novas no wire: `probe` (Sondagem), `dive`, `emerge`. O mergulho tem
windup (o aviso) e da liberação ao fim os segmentos entram na água
(`leviathanSegmentSubmersion`: janelas sobrepostas de `LEVIATHAN_HEAD_FRACTION`
escalonadas cabeça → cauda). **A posição só muda em `endsAt`**, quando nada dele
é visível; a emergência é o inverso, na poça de destino.

`BossRuntime` ganhou `leviathanProbeCell`, `leviathanProbeDeepen`,
`leviathanProbeSeq`, `leviathanAnchorProbes`, `leviathanDest`,
`leviathanSurfaceAt` e `leviathanPools` — todos no hash; os quatro que a
apresentação precisa (marca, afunda, destino, tick de emersão) também nas
`WorldFlags` para quem reconecta.

## 5. A primeira fase

**Vida**: `LEVIATHAN_HP` = 4000 (`SIMULATION_VERSION` 60; era 800). Medido sem cliente
com o parafuso básico e tiro perfeito: com 800 ele morria em 19 s e o Dilúvio saía aos
13 — antes do primeiro mergulho, a primeira fase nunca acontecia. Com 4000 o Dilúvio sai
aos 61 s depois de quatro mergulhos e ele morre aos 105 s; na prática, dois ou três
minutos com a arma básica.

1. Ancorado: `vx`/`vy` zerados todo tick; gira a `LEVIATHAN_TURN_RATE` rad/s sem
   translação.
2. `LEVIATHAN_PROBES_MIN..MAX` (2–3) Sondagens por ancoradouro, alternando por
   hash determinístico; intervalo `LEVIATHAN_PROBE_INTERVAL_TICKS` (44).
3. Escolhe o destino (`leviathanPickDestination`): centros de poça ocupáveis
   (`isPoolCore` e núcleo inteiro dentro de `LEVIATHAN_LID_RADIUS`), salto entre
   5 e 20 tiles, 3x3 aberto, pelo menos 3 tiles de todo jogador vivo, o mais longe
   do Prospector, desempate por hash — variedade sem sorteio.
4. Telegrafa (26 ticks), afunda (40 ticks), salta, viaja
   (`LEVIATHAN_TRAVEL_TICKS_BASE` + 3/tile) com a poça de destino borbulhando,
   halo (12 ticks), emerge (44 ticks), reancora e recomeça.

**A tampa viva**: `leviathanLidCells` deriva as células profundas 4-conexas por
água a até `LEVIATHAN_LID_RADIUS` (1,9) da âncora; `leviathanCovers` responde a
`plungeIntoDeepWater`. Vale ancorado e durante o mergulho até a cauda sumir;
volta **só** quando a emergência termina. As poças ocupáveis têm núcleo de raio
1,2 para o corpo realmente tampá-las.

## 6. A Sondagem Abissal

Telégrafo no corpo (`boss_windup: probe`, canto grave, guelras vibrando na pose
`attack`) e no chão (`probe_marker`: círculos escuros contraindo, chão
encharcando, bolhas — 22 ticks; 32 quando afunda). Liberação: dano
`LEVIATHAN_PROBE_DAMAGE` (22) e empurrão até `LEVIATHAN_PROBE_PUSH_TILES` no raio
1,7 — o empurrão anda por `moveEntity` e **para** antes de água profunda.

Progressiva por construção (`probeImpact`): piso seco → poça rasa irregular
(frente conexa de raio 2, borda dentada por hash); água rasa cujo centro tem os
quatro vizinhos em água → **afunda** uma plus de cinco células; profunda → só
amplia a margem. O núcleo é pintado e provado (`deepeningCutsRoute`: entrada e
cada jogador vivo até o pedestal); se corta rota, volta a ser raso. Nunca sobre
entrada, pedestal (raio 3), terminais, caches, ofertas do poço, bolhas ou
jogadores abatidos; nunca atravessa parede (conectividade); ponto inválido →
busca em anel até `LEVIATHAN_PROBE_SEARCH`. Depois de
`LEVIATHAN_MAX_NEW_POOLS` (4) bacias novas, a mirada é redirecionada à poça dele
mais próxima. O antigo `leviathanSurge`, a rompida sob o alvo e a perseguição
da primeira fase **saíram**.

## 7. A transição: o Dilúvio

Mantido `DELUGE_HP_FRACTION = 0.55`. Ao cruzar: a Sondagem em curso é cancelada
com `action_end`; ele mergulha na própria poça (`dest = -1`), o lençol sobe pelos
dutos e pelas poças (`delugeField`, inalterado) e, quando o nível na célula dele
passa de `PROSPECTOR_HEAD_HEIGHT`, ele emerge inteiro
(`LEVIATHAN_DELUGE_EMERGE_TICKS`) em `hunting`. Nunca mais ancora, teleporta ou
sonda.

## 8. A segunda fase e as bolhas

`leviathanHunt`: nada a `LEVIATHAN_SWIM_SPEED` (× `LEVIATHAN_DELUGE_SPEED_SCALE`)
por `moveEntity` (parede é parede; água profunda não barra), contato ao encostar,
descarga massiva quando o alvo está submerso e a recarga permite; durante a carga
a ação segura o corpo. `startLeviathanMassiveShock` exige `hunting` e **não emite
mais o pulso genérico** — o telégrafo é o corpo e a água.

**O contrato das bolhas**: `bubble.radius` é o **raio seguro para o centro** do
Prospector; `playerProtectedByBubble` (`dist ≤ raio + ε`) é o único predicado —
dano, HUD, som, renderer, debug e testes. Não se subtrai mais `player.radius` (a
regra antiga encolhia a área para 1,01 tile enquanto o domo desenhava
`R * TILE_W` numa elipse errada). `bubbleShellRadius` é a casca visual. O anel do
chão usa a projeção correta (`R·TILE_W/2·√2`, `R·TILE_H/2·√2`); dentro, o anel
estabiliza, engrossa e ganha um segundo traço; o `leviathanBubbleSafe` pulsa e a
carga é abafada (low-pass + metade do ganho) pelos nós que `play()` guarda.

Posicionamento: centro e área segura livres de sólido **e de água profunda**,
submersa de verdade, distância geodésica caminhável ≤
`LEVIATHAN_BUBBLE_REACH_TILES` (11) a partir do primeiro jogador vivo (bolha 1) e
do último (bolha 2), não sobrepostas e assimétricas; busca exaustiva
determinística de reserva.

**Linha do tempo**: `LocalPlayout` captura o `bossRuntime` por retrato e o
devolve com os corpos daquele tick; `NetClient` retém o último `WorldFlags` num
`BossFrame` por quadro (`latestBoss`) e `sampleRenderState` aplica o do quadro
**alcançado**. Reconexão no meio da carga toca o tempo restante
(`play(..., elapsedSeconds)`).

## 9. Apresentação

- **Corpo** (`leviathan-body.ts`): pose autorada em modo ancorado/mergulho/emersão
  (sem histórico), rastro `SpineTrail` na caçada (gap 0,62, oito postos, sobreposição
  de 0,25 tile), descarte em qualquer salto > 3 tiles; cada peça desce
  `LEVIATHAN_SINK_PX` × submersão e é **recortada** na linha d'água com ondulação
  (`drawLeviathanPiece`, `leviathanWaterDip`). Escondido não desenha nada.
- **Rigidez** (`TrailConfig.stiffness`, `maxBend`): uma raia, não uma cobra. Com
  rigidez 0 o corpo senta sobre o caminho da cabeça (o Devorador, inalterado).
  O Leviatã usa 0,72 com dobra máxima de 12° por elo: a **cabeça é o vetor**, o
  primeiro elo herda o rumo dela, cada elo seguinte mistura a tangente do caminho
  com a direção do anterior e é segurado pelo limite; a posição passa a ser o fim
  do elo (sempre a `gap` do anterior — sem fresta nem amontoado). A cauda soma
  no máximo 84° de curva: o corpo **vira** em vez de serpentear. Andando reto,
  rigidez não muda a forma (`spine-trail.test.ts`).
- **Atlas**: `enemy-sheet-leviathan` v3 é só a cabeça (disco cefálico, lobos,
  boca, olhos no topo, fendas branquiais, eletroporos, início das linhas; hitbox
  1,7 × 1,2; quadro 112 × 68, o menor que enquadra as quatro rotações). O corpo
  são oito cortes em **dois atlas** de **oito rumos**: `part-sheet-leviathan-wings`
  (postos 0–3: raiz das asas, o maior vão, borda serrilhada, tronco com quilhas;
  208 × 112) e `part-sheet-leviathan-tail` (postos 4–7: tronco, pedúnculo, cauda,
  ponta com o órgão elétrico; 64 × 44) — um atlas tem um só tamanho de quadro, e a
  cauda não pode pagar o quadro das asas trinta e duas vezes. Os rumos são os
  quatro eixos do mundo e as quatro diagonais (`r`, `d`, `l`, `u`), escolhidos por
  `dirFromFacing8` em setores de 45° no plano da tela; os intermediários são o
  mesmo modelo girado meio passo e **re-rasterizado** na grade fina
  (`rotatedVoxels`: malha 2×2 por voxel, pivô (0,5, 0,5) — o mesmo das rotações
  inteiras — interior maciço, borda serrilhada em um voxel).
- **Direção de arte — largo e talassofóbico**: o vão do meio das asas é 34
  unidades, pouco mais de **quatro tiles** (era três); as asas são doze tiras
  sobrepostas numa curva que acelera para a ponta, corda em crescente, borda
  traseira serrilhada. O dorso é **quase preto** (`rockDeep`), o ventre pálido
  (`rock`): contra a água escura o que se lê dele é a orla clara do ventre nas
  pontas das asas, o brilho molhado da borda de ataque em tiras alternadas, os
  olhos, os poros e as duas linhas condutivas — a massa em si é sombra. A cabeça
  segue a mesma regra (dorso escuro, brilhos azuis de pele molhada). E por baixo
  da lâmina o renderer desenha a **massa** (`drawLeviathanMass`,
  `LEVIATHAN_MASS_RADIUS` por posto, 2,9 tiles no meio das asas, 2,0 na cabeça):
  uma elipse escura sem borda no plano do chão, só sobre água, que persiste
  enquanto o corpo afunda e some com ele — o corpo parece maior do que o que
  rompe a superfície. A cabeça continua em quatro rumos (bicho vivo: validador e
  histerese de `facing.ts`); oito rumos nela custariam ~3 MiB no orçamento de
  boot. `leviathan-frames.test.ts` mede que as oito rotações de cada peça cabem
  no quadro com 2px de margem e que o vão passa de quatro tiles.
- **Chão**: `aquifer-deep-water` (surface-tiles v9), escolhido por (superfície,
  estrato) em `surfaceKindIndex`: quase preto, plano rebaixado, correntes largas e
  lentas, bolhas esparsas, sem moldura por tile e sem gelo. O `deep-water` da
  Cripta continua com a borda de gelo quebrado.
- **O nível da água é legível**: todo corpo que não nada (Prospector, parceiro,
  inimigos) é **cortado na linha d'água** do Dilúvio (`drawCutByWaterline`): acima
  dela como é, abaixo dela azul e apagado, com a ondulação na linha — é nele que se
  lê "na cintura" ou "acima da cabeça". Na caçada o Leviatã **nada na superfície**
  (cabeça e peças sobem a altura da coluna; a massa fica no chão) e, emergindo sob
  o Dilúvio, sobe do fundo com a própria emergência. Os **núcleos profundos** do
  Aquífero ganham o contorno do núcleo (só as arestas que encostam em chão não
  profundo — o tile continua sem moldura) e, alagados, uma mancha escura no plano
  da superfície: a água é mais funda onde o chão caiu, e cair num buraco que a tela
  não mostra não é dificuldade.
- **Marcas**: `probe` em `pendingGroundMarkers` (reconexão lê do `bossRuntime`);
  poça de destino em ebulição (`drawPoolBoil`, intensidade por
  `leviathanSurfaceAt`); aviso do mergulho como anel escuro pulsando no raio da
  tampa.
- **Descarga**: ondas convergindo, riscos elétricos fora das bolhas (semeados
  pelo tick), três contrações no último meio segundo, arcos contornando as cascas
  no clarão; sem strobe de tela inteira.
- **Áudio** (`cues.ts`, `synth.ts`, `voices.ts`): `leviathanProbeCall` (corpo),
  `leviathanProbeMark` (ponto), `leviathanProbeRelease`, `leviathanDiveWarn`,
  `leviathanDive`, `leviathanGulp`, `leviathanBubbling`, `leviathanEmerge`,
  `leviathanBreath`, `aquiferPlunge`; `leviathanShockCharge` a 0,45 de ganho com
  saw/ruído prolongados cortados pela metade, estalos que aceleram e três pulsos
  finais; a descarga continua sendo o maior impacto.

## 10. Arena (`arena.html`)

Seed 112 medida de novo: ~540 células de chão num raio de 14, ~200 de água rasa,
14 profundas em três poças ocupáveis, chão seco entre elas, três dutos. O painel
do Leviatã (`arena-leviathan-debug.ts`) põe o encontro em cada postura — ancorar,
quatro rumos, Sondagem em piso seco e aprofundamento, jogador sobre a tampa e em piso seco,
mergulho, viagem escondida, emergência, Dilúvio, perseguição, carga — e o jogador
dentro, na borda e fora da bolha, com a leitura exata: postura, exposição,
células tampadas, marca, destino, descarga e o predicado da bolha com a margem.

## 11. Testes

- sim: `leviathan-lencol.test.ts` (ancorado parado e girando; Sondagem rasa com
  marca e dano; segunda afunda e preserva margem; células críticas; parede;
  destino determinístico; posição só muda submerso; ordem da submersão; postura
  do snapshot; tampa protege, mata depois da cauda, volta só no fim da
  emergência; primeira fase nunca persegue; Dilúvio encerra o ciclo e a descarga
  só depois; caçada; solo/co-op/replay iguais; predicado das bolhas — centro,
  limite, ε; sem água profunda; rota por jogador no co-op; cruzar a borda no
  último tick; travessia por arquétipo; água nativa permanente; queda de água),
  `aquifero-bacias.test.ts`, os testes antigos do Leviatã reescritos.
- content: `surface-separation.test.mjs` (a água profunda do Aquífero sem gelo,
  sem leito, sem moldura, e se move), validação de atlas (bounds, anchors,
  jitter, paleta, normais, sem quadro vazio, oito rumos, quadros das peças, orçamento de boot: 166,75 MB de
  167,77).
