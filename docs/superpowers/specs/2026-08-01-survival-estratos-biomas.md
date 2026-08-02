# Voxelyn Survival — Estratos, Ocupações e Linhagens

Data: 2026-08-01
Status: três levas implementadas — estratos/ocupações/linhagens, segunda leva
de estratos, e o bestiário de assinatura. Restam os itens de "trabalho futuro".

## A decisão que rege tudo

O Veio não precisa de "mapas temáticos". Ele precisa de **estratos geológicos,
infestações e cicatrizes industriais** — e da possibilidade de combiná-los.

O exemplo Noita-like do repositório descreve cavern, desert, frozen, volcanic,
fungal, flooded, toxic e surface. Transplantar esses biomas literalmente não
cabe na fantasia do Veio ("deserto" e "superfície" não existem lá embaixo). A
resposta é **reinterpretá-los como interiores subterrâneos** e dividir a
identidade ambiental de cada setor em três camadas:

| Camada   | O que representa                  | Exemplos                                    |
| -------- | --------------------------------- | ------------------------------------------- |
| Estrato  | A formação geológica dominante    | Basalto, cristal, aquífero, enxofre, gelo   |
| Ocupação | O que tomou conta daquele estrato | Micélio, Aurix, contaminação, colapso       |
| Bolso    | Um encontro localizado e autoral  | Terminal, arena do Bispo, colônia, poço     |

Assim não são necessários quinze biomas completos: três estratos e duas
ocupações já produzem sete setores distintos, e cada peça nova multiplica em
vez de somar.

## Tradução dos biomas de referência

| Referência | Versão dentro do Veio                          | Leva    |
| ---------- | ---------------------------------------------- | ------- |
| Cavern     | Galerias de Basalto                            | 1ª ✅   |
| Fungal     | Matriz Micelial (como OCUPAÇÃO)                | 1ª ✅   |
| Flooded    | Aquífero Negro                                 | 1ª ✅   |
| —          | Catedral Prismática (cristal já existente)     | 1ª ✅   |
| —          | Cicatriz Aurix (como OCUPAÇÃO)                 | 1ª ✅ (parcial) |
| Toxic      | Fenda Sulfurosa                                | 2ª ✅   |
| Volcanic   | Fornalha Abissal                               | 2ª ✅   |
| Desert     | Sumidouros de Sílica                           | 2ª ✅   |
| Frozen     | Cripta Glacial                                 | 2ª ✅ (sem inércia) |
| Surface    | Ruptura à Superfície (evento raro, não setor)  | futuro  |

## O que foi implementado

### `strata.ts` (voxelyn-survival-sim)

- `StratumId`: `basalt` | `prismatic` | `aquifer`.
- `OccupationId`: `none` | `mycelial` | `aurix`.
- **Invariante de preservação**: basalto sem ocupação É o bioma original do
  jogo, byte a byte — mesmo perfil, mesma sequência de RNG, em qualquer
  linhagem e setor. Variação de basalto é trabalho das ocupações, nunca do
  estrato limpo (coberto por teste).
- `LineageId`: `hydric` | `mineral` | `industrial` — cada run segue UMA
  linhagem geológica; os três setores contam uma história ambiental contínua:
  - **hídrica**: Galerias de Basalto → Aquífero Negro → Abismo Micelial;
  - **mineral**: Galeria de Quartzo → Catedral Prismática → Coração Ressonante
    (a densidade de cristal cresce com a profundidade);
  - **industrial**: Caverna Escavada → Complexo Aurix → Instalação Alagada.
- **Intrusões**: um setor sem ocupação, do segundo em diante, pode ganhar uma
  colônia micelial (30%) ou uma instalação Aurix (15%), deterministicamente
  por (seed, setor).
- Tudo é **função pura da seed** — nada consome `state.rng`. Reconexão, replay
  e leaderboard derivam o mesmo bioma em qualquer máquina
  (`createRun({ sector: N })` ≡ descida ao vivo; coberto por teste).

### Worldgen parametrizado (`WorldgenProfile`)

O worldgen continua dono da topologia (autômato, alcançabilidade, bandas de
salvage). O perfil muda **matéria**: chances de frágil/minério/cristal,
nervuras de cristal (caminhadas retas que atravessam rocha — a ressonância
viaja por elas), lagos de água, manchas de fungo/biofluido e o teto de Miners.
O perfil default é byte a byte o comportamento histórico: o basalto limpo joga
o mapa de sempre, com a mesma sequência de RNG.

### Água (`SURF_WATER = 8`)

Primeira versão do flooded **sem simulação de fluidos**: superfície estática.

- **Conduz** descarga: `dischargeAt`/Conductive alastram por água e biofluido
  conectados (`isConductiveSurface`).
- **Retarda** (`WATER_SLOW = 0.72`, mais leve que o lodo: água é terreno, não
  armadilha).
- **Apaga fogo** encostado nela (vira cinza — o jogador vê onde apagou).
- **Não acende** nunca; ácido e térmico são inertes nela; cuspe não deixa poça
  sobre ela.
- Crosta própria no atlas (`surface-tiles` v4): lâmina azul da família da
  rocha com reflexos `electric` — o verde continua exclusivo do biofluido.

### Fauna por afinidade, não bestiários

`biomeMix` compõe o setor a partir do estrato: o prismático é mineral
(bruisers/stalkers), o aquífero é anfíbio (spitters/bombers), o micélio troca
músculo por matéria orgânica sem mudar a contagem. A ocupação micelial quase
dobra a chance do Cavalo Fúngico (sempre com UMA tirada de RNG — a ordem dos
sorteios não muda com o bioma). A Cicatriz Aurix sobe o teto de Miners: os
autômatos ainda cumprem a cota.

### Bolso do Bispo

O Bispo continua no setor 2 em **qualquer** estrato: a arena dele ganha um
disco de tapete fungico garantido (a colônia que tomou aquela câmara). A
mecânica de regeneração sobre fungo é preservada sem obrigar o setor inteiro a
ser fúngico.

### Cliente

- Evento `sector_entered` agora carrega `stratum`/`occupation`; a chegada
  anuncia "SETOR 2 — AQUÍFERO NEGRO · MATRIZ MICELIAL".
- HUD mostra o bioma sob o número do setor.
- Água renderiza pela crosta nova, pinga como a poça e tem fallback azul.
- i18n pt-BR/en (`biome.stratum.*`, `biome.occupation.*`,
  `toast.sector.entered`).

## Regras de design preservadas

- **Rota neutra**: nenhum estrato exige módulo específico. A água pune e
  recompensa o Conductive, mas o setor é vencível sem ele; o cristal favorece
  corrente/explosão sem ser obrigatório.
- **Nada de dano sem sinal**: água não causa dano; ela conduz o que o jogador
  ou o inimigo puser nela.
- **Determinismo**: bioma derivado por hash puro; toda variação de RNG mantém
  a contagem de tiradas invariante por bioma.

## Segunda leva (implementada)

Novos estratos com três linhagens novas — **térmica** (Basalto → Fenda
Sulfurosa → Fornalha Abissal), **árida** (Basalto → Sumidouros de Sílica →
Fornalha, a sílica vitrificando rumo ao calor) e **crio** (Basalto → Cripta →
Cripta profunda):

- **Fenda Sulfurosa** (`sulfur`): a identidade é a **ventilação**. 14
  respiradouros (vs 6), e cada fonte alterna janelas ativas/dormentes de 10 s
  (`VENT_CYCLE_TICKS`), com fase pela posição — metade das câmaras respira
  enquanto a outra enche, e a rota muda com o relógio. Paredes corroídas de
  dentro para fora (frágil 0.65). Fora da Fenda, os respiradouros mantêm o
  comportamento histórico.
- **Fornalha Abissal** (`furnace`): calor como **pressão territorial
  localizada**, nunca punição passiva. Fissuras incandescentes (`SURF_EMBER`)
  não causam dano: em cima delas a arma dissipa calor a 35% — a barra do HUD é
  o custo. O chão queimado lá é **carvão**: explosão ou chama o acende em fogo
  persistente (110 ticks), e só lá — em outros estratos cinza segue estéril.
  Não recebe colônia micelial (intrusão vira Aurix: refrigeração abandonada).
- **Sumidouros de Sílica** (`silica`): rocha esbranquiçada que cede — quase
  toda parede fina é frágil (0.78). Atravessar abrindo buracos é a identidade;
  o risco é abrir o flanco errado. Fauna de emboscada (stalkers).
- **Cripta Glacial** (`glacial`): o primeiro corte barato do frozen. Gelo
  (`SURF_ICE`) não conduz nem retarda; **fogo o derrete em água condutiva**
  que **recongela sozinha** (~14 s). O recongelamento é propriedade da água
  derretida, não do estrato — derreter uma ponte abre uma janela, não edita o
  mapa. Fogo que derrete gelo é apagado pela própria água que criou. A
  mudança de inércia sobre gelo ficou de fora de propósito (mexe em controle,
  dodge e determinismo).

## Terceira etapa (implementada): bestiário de assinatura

Um inimigo por estrato, e a regra que rege os cinco: **cada um manipula a
alavanca que o bioma já tem** — nenhum traz mecânica nova. Cada assinatura
ocupa uma vaga comum da contagem do setor (nunca soma), no primeiro terço da
lista de spawns; espreitadores nascem dentro do próprio elemento.

- **Ressonante** (`resonant`, Catedral): não atira. Vibra (telegrafo de 1,2 s)
  e ARMA os cristais num raio — cada um descarrega pelas aberturas coladas
  nele, com dano/stun da regra genérica de descarga. Sala esvaziada de cristal
  = bicho desarmado (e o pulso nem dispara).
- **Lampreia de Lodo** (`mud_lamprey`, Aquífero): submersa enquanto não ataca
  (`mood` viaja no snapshot; o cliente desenha ondulação). Só se move POR
  líquido; bote curto telegrafado é a única saída da água. Eletrificar a poça
  a atordoa — e percorre a poça inteira.
- **Fole** (`bellows`, Fenda): respira em fases de relógio (tick + id, sem
  RNG): inspira gás num raio, expele em linha na direção OPOSTA ao jogador.
  Deixá-lo vivo limpa a passagem desejada; a de trás contamina.
- **Escoriáceo** (`scoriac`, Fornalha): couraça fria corta todo dano a 45%
  (no funil único de dano). Pisar em brasa/fogo abre a couraça por ~8 s:
  vulnerável e 45% mais rápido. `rangedReadyAt` reusado como "quente até".
- **Espectro de Geada** (`frost_wraith`, Cripta): desliza SOB o gelo (35% mais
  rápido), emerge num bote telegrafado. Derreter o lago tira a cobertura: um
  corpo lento na água condutiva que o jogador acabou de criar.

Basalto e Sílica não têm assinatura por decisão: o basalto é a referência, e a
identidade da Sílica é o próprio terreno que cede.

Conteúdo: 5 atlases voxel novos (idle/walk/attack/hit/die × 4 direções,
materiais existentes da paleta), bestiário corporativo (fichas pt/en),
partículas por matéria, ecos de morte no protocolo.

## Quarta etapa (implementada): leitura de lugar

Feedback direto de playtest ("caí no Aquífero e demorei a perceber — parece o
mesmo lugar, só tem água de diferente"):

- **Véu de paleta por estrato**: uma luz ambiente por bioma (composição
  `overlay`, alfa baixo) sobre mundo e criaturas, sob partículas/HUD — azul
  profundo no Aquífero, quente na Fornalha, gélido na Cripta, violeta na
  Catedral, sulfuroso na Fenda, pálido na Sílica. O **basalto não tem véu**:
  as Galerias são o mapa original, e a ausência é a referência que faz os
  outros lerem como "outro lugar". Custo: um fillRect por quadro.
- **Lampreia como fauna** (`SIGNATURE_PACK`): três por setor de Aquífero,
  espalhadas pela lista de spawns — com uma, o setor tinha um lago perigoso e
  dezenas de lagos que eram só cenário. Continuam ocupando vagas comuns da
  contagem. As demais assinaturas seguem sendo encontro único.

## Quinta etapa (implementada): a rocha e a arquitetura do lugar

- **Paredes por estrato** (terrain-blocks v3): a rocha COMUM ganha seis peles —
  grãos de cristal na Catedral, pedra encharcada com limo no Aquífero, rocha
  esbranquiçada com crosta sulfurosa na Fenda, basalto negro com veios de
  brasa na Fornalha, arenito estratificado na Sílica, capa de gelo na Cripta.
  Frágil, minério e cristal continuam **universais**: são linguagem mecânica
  (o que cede, o que rende, o que conduz) e precisam ler idênticos em todo
  bioma. O basalto usa o índice histórico: o mapa original até no pixel. A
  simulação não sabe disso — `SOLID_ROCK` continua um ID só.
- **Estruturas de salão** (`WorldgenProfile.halls`): carimbadas após o
  autômato e antes das provas de alcançabilidade (toda garantia do gerador
  vale para elas; salão inalcançável é selado pela regra normal de bolsões):
  - `radial` (Catedral): rotunda com corredores em leque e **pilares de
    cristal** — cobertura, luz e munição do Ressonante ao mesmo tempo;
  - `lungs` (Fenda): câmaras bojudas ligadas por gargantas — o lugar que dá
    sentido ao ciclo dos respiradouros;
  - `canyon` (Fornalha): fissuras compridas dividindo as salas;
  - `basins` (Aquífero): bacias largas que **nascem cheias d'água** — a
    geografia e a matéria chegam juntas;
  - `sinkholes` (Sílica): poços circulares com **borda frágil**;
  - `lakes` (Cripta): lagos ovais congelados — o território do Espectro.
  Basalto: `none`, o labirinto orgânico histórico intocado.

## Sexta etapa (implementada): a strata determina a arquitetura

Redefinição formalizada: **a strata determina a arquitetura da caverna; a
ocupação determina o que tomou conta dela.** A regra de qualidade que rege as
gramáticas: *trocar a paleta inteira por cinza não pode apagar a identidade —
a forma dos salões e corredores tem de dizer onde o jogador está.*

Gramáticas espaciais (`WorldgenProfile.halls`), carimbadas após o autômato e
antes das provas de alcançabilidade:

| Strata | Gramática | Salões e corredores |
| --- | --- | --- |
| Basáltica | `columns` | Anfiteatro cercado de colunas, floresta de pilares, fissura entre dois espaços. Pesado e tectônico. |
| Prismática | `radial` | Rotunda com raios e pilares de cristal, **geodo** (casca cristalina voltada pra dentro), **câmara espelhada**, corredores angulares segmentados em 90°. Angular: cresceu, não foi erodida. |
| Cárstica (Aquífero) | `karst` | Cúpula calcária, cisternas que nascem cheias, colunata, túneis **sinuosos** de walker com persistência direcional que alargam e estreitam. Dissolvido pela água — o oposto visual da Catedral. |
| Sedimentar (Sílica) | `terraced` | Galerias estratificadas mais largas que altas, **corredores paralelos separados por parede fina frágil** (o frágil como seam estrutural legível), sumidouros de borda frágil. Horizontal e laminado. |
| Sulfurosa | `lungs` | Pulmões em cadeia, gargantas. |
| Fornalha | `canyon` | Cânions com blocos desabados no leito. |
| Cripta | `lakes` | Lagos ovais congelados + túneis suaves de walker. |

**Mudança de contrato do basalto** (pedido em playtest): a gramática basáltica
também evolui — o basalto ganha salões. O que continua intocável: o autômato
como base e as **matérias** (nada de água/brasa/gelo nele; variação de matéria
segue sendo trabalho das ocupações). O invariante passou de bytes para
identidade; `generateWorld()` sem perfil continua sendo o histórico puro.

Traduções do doc de design: *Estrato Sedimentar* = Sumidouros de Sílica
(a parede em camadas já era arenito); *Cárstico* = Aquífero Negro; *Estrato
Ferrífero* = trabalho futuro (naturalmente pareado com a Cicatriz Aurix).

## Sétima etapa (implementada): props decorativos

A divisão de trabalho do mundo, completa: **a strata define a formação; os
materiais definem o que reage; os props explicam onde o jogador está, o que
aconteceu ali e qual é a escala do Veio.**

Camada `client/decor.ts` + `decor-draw.ts` — puramente visual e DERIVADA:

- Um prop não ocupa célula autoritativa, não bloqueia, não conduz, não morre.
  Não entra em `solid`, `surface`, pathfinding, hash nem snapshot. Qualquer
  cliente reconstrói a mesma decoração de `(seed, setor, strata)` com PRNG
  próprio — o co-op vê o mesmo cenário sem o servidor transmitir um objeto.
- **Zonas proibidas inegociáveis**: raio da entrada, do poço/núcleo, de
  terminais e cofres, dos respiradouros e da posição de chefe. Decoração
  nunca compete com informação.
- **Regras anti-mentira** (testadas): baixo/estreito/quebrado — nunca parece
  bloquear; cristal decorativo usa a família fria (nada do biolum reativo);
  caixa Aurix sem ouro nem halo de coletável; fumarola decorativa apagada;
  nada sobre superfície reativa ou elemento. `propStillValid` re-checa a
  âncora a cada quadro: parede arrancada ou fogo por baixo → o prop some em
  vez de mentir.
- **Kits da primeira entrega** (20 arquétipos × variantes procedurais):
  coluna tombada/entulho/lasca (basalto), leque/estilhaços (Catedral),
  estalagmite/bacia/cascata petrificada (carste), pilha de lâminas/placa
  (sedimentar), cone de fumarola/monte de enxofre (Fenda), escória/cinza
  (Fornalha), agulha de gelo/pedra gelada (Cripta), cogumelo que respira +
  puffball **sobre o tapete** (Micélio), caixa + escora (Aurix).
- Desenho em runtime com o primitivo `drawVoxel` (zero atlas novo); animação
  (respiração do cogumelo) derivada de relógio local + variant, nunca da RNG
  autoritativa. Entram na fila de profundidade do pintor.

## Oitava etapa (implementada): teto e landmarks

A hierarquia de composição da camada de props fechou de ponta a ponta —
landmark → ritmo → micro — e ganhou a dimensão vertical:

- **Props de teto** (`anchor: 'ceiling'`): formações que PENDEM da rocha sobre
  celulas abertas junto a uma parede viva — esporão basáltico, lustre frio da
  Catedral, estalactite, laje sedimentar, escorrimento sulfuroso apagado,
  presa de fuligem, sincelos, véu de esporos (só sobre o tapete da colônia) e
  o cabo Aurix de gancho vazio. Desenhados ERGUIDOS e **translúcidos**
  (alpha 0.58): o contrato de honestidade é que nada pendurado esconde o chão
  que joga — a validade por quadro ignora a superfície de baixo (água/fogo
  continuam visíveis e válidos) mas exige a parede de origem viva.
- **Landmarks monumentais** (`anchor: 'landmark'`): um monumento por estrato
  (monólito, grande prisma frio, estalagnato, arco de estratos, fumarola-mãe
  extinta, ídolo de escória, obelisco gelado), no máximo DOIS por setor, com
  espaçamento mínimo. São os únicos props altos e maciços — e por isso os
  únicos ancorados em célula SÓLIDA: o pedestal bloqueia de verdade, então a
  silhueta imensa nunca mente sobre colisão. Minerar o pedestal derruba o
  monumento (`propStillValid`).
- **`hallCenters` no worldgen**: a gramática espacial registra os centros dos
  salões que já calculava (anfiteatro, rotunda, geodo, cúpula, colunata,
  galerias, câmaras dos pulmões, meio das fissuras, lagos da Cripta). Zero
  tirada de RNG a mais, zero byte de mapa mudado — puro registro, então sem
  bump de `SIMULATION_VERSION`. O campo não entra no hash nem em snapshot; o
  cliente lê do mundo pristino reconstruído e ancora os landmarks ali, em vez
  de num sorteio sem significado. Salão selado pelas provas de alcançabilidade
  simplesmente não oferece pedestal visível e é pulado.

## Nona etapa (implementada): morfologia de borda + composição por sala

- **Morfologia de borda** (`client/edge-detail.ts`): o detalhe que a parede
  faz exatamente onde encontra o vazio — pontas frias no rim da Catedral,
  lábio dissolvido do Aquífero, degraus laminados NA face exposta da Sílica,
  crosta apagada da Fenda, dentes de fuligem da Fornalha, orla de geada da
  Cripta. **Basalto: nada** (a ausência é a régua). Só a rocha comum recebe
  morfologia — frágil/minério/cristal seguem linguagem mecânica universal —
  e só no contorno (parede sem vizinho aberto não ganha detalhe). Voxels
  determinísticos por índice de célula com portão de densidade (~60%),
  cacheados por (estrato, variante, exposição) para não alocar por quadro;
  famílias de cor da decoração (sem biolum/loot); desenhado também no
  fallback sem atlas.
- **Composição por sala** (decor): cada salão registrado em `hallCenters`
  recebe um anel próprio de ritmo (6) e micro (4) num raio de 8 células,
  enquanto o orçamento global de micro encolheu (40→32) — o salão é
  mobiliado (landmark → ritmo → micro) e os corredores continuam rarefeitos.
  Testado por contraste: densidade de props por célula aberta perto dos
  salões > longe deles, em seeds fixas.

Futuro da camada: kit Aurix de infraestrutura (passarelas, trilhos, broca
monumental).

## Trabalho futuro

- **Roteamento de energia Aurix**: cabos ligando portas/bombas/defesas;
  drenar uma região e inundar outra no Aquífero.
- **Inércia sobre gelo** na Cripta, quando o estrato tiver provado a rota
  derreter/recongelar.
- **Ruptura à Superfície**: evento raro de luz/raízes/chuva, não um setor.
- **Estrato Ferrífero**: formação natural de ferro/magnetita — veio principal,
  nós magnéticos, condução por parede, Miners e Aurix densos ("o lugar que
  justificou a operação").
- **Salas funcionais com variantes por strata** (poço, arena do Bispo, arena
  do Guardião trocando de forma mantendo a função) e **Aurix adaptada ao
  substrato** (escoras no sedimento, passarelas no aquífero, isoladores no
  cristal, dutos na fenda).
- **Fratura por camada** na sedimentar (quebrar uma célula frágil enfraquece
  vizinhas da mesma faixa; minério em seams lineares).
- Trilha de rachaduras do Espectro e ondulação da Lampreia como apresentação
  dedicada no cliente (hoje a leitura vem da postura `mood` + superfície).

## Ressonância favorecida por bioma (referência de tuning)

| Bioma      | Ressonâncias favorecidas          |
| ---------- | --------------------------------- |
| Basalto    | Cinética e explosão               |
| Prismático | Corrente, explosão e ricochete    |
| Aquífero   | Corrente e cinética               |
| Micelial   | Fogo e explosão                   |
| Sulfuroso  | Fogo, explosão e cinética         |
| Fornalha   | Fogo e explosão                   |
| Sílica     | Cinética e explosão               |
| Glacial    | Fogo, corrente e cinética         |
