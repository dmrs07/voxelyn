# Voxelyn Survival — Estratos, Ocupações e Linhagens

Data: 2026-08-01
Status: primeira E segunda levas implementadas; terceira etapa (bestiário de
assinatura) especificada abaixo

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

## Terceira etapa (especificada, não implementada)

- **Bestiário de assinatura** (um por estrato, manipulando a regra do bioma):
  **Ressonante** (arma cristais próximos), **Lampreia de Lodo** (submersa,
  ondulação telegráfica), **Fole** (inspira gás de uma região e expele em
  outra), **Escoriáceo** (carapaça fria resistente; aquecido, vulnerável e
  mais agressivo), **Espectro de Geada** (move-se sob o gelo deixando trilha
  de rachaduras).
- **Roteamento de energia Aurix**: cabos ligando portas/bombas/defesas;
  drenar uma região e inundar outra no Aquífero.
- **Inércia sobre gelo** na Cripta, quando o estrato tiver provado a rota
  derreter/recongelar.
- **Ruptura à Superfície**: evento raro de luz/raízes/chuva, não um setor.

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
