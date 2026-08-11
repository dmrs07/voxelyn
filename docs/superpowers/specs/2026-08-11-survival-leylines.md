# Leylines — o condutor geológico que orienta o Veio

**Data:** 2026-08-11
**Escopo:** `voxelyn-survival-sim`, `voxelyn-survival-protocol`, `voxelyn-survival-server`, `voxelyn-survival` (cliente), `voxelyn-survival-content`
**Versões:** 1º corte: `SIMULATION` 37→38, `CONTENT` 23→24, wire das leylines em `PROTOCOL` 23 (renumerado no merge com o main — o 22 ficou com o `hazard` do PR #142). 2º corte: `PROTOCOL` 23→24 (roteamento), `SIMULATION` 38→39. 3º corte: `SIMULATION` 39→40.
**Status:** três cortes implementados — condução por segmento, roteamento nas junções, verticalidade + lore.

## A decisão que rege tudo

> Leylines são condutores geológicos persistentes que atravessam a
> macroestrutura do setor e funcionam como linguagem de orientação. Elas não
> rendem minério, não recarregam habilidades e não concedem buffs. Uma fonte
> elétrica pode energizar temporariamente um SEGMENTO até a próxima junção,
> produzindo uma descarga telegrafada que afeta jogador e criaturas. Depois da
> descarga o segmento entra em período refratário. Junções existem inicialmente
> para limitar propagação e futuramente permitirão roteamento.

Dois papéis, nesta ordem:

| Papel | Peso |
| --- | --- |
| Orientação — "estou indo para dentro do Veio" | principal |
| Condução tática — energizar um segmento à distância | secundário, contido |

O que foi deliberadamente deixado FORA deste corte (e por quê):

- **Pulso automático / recarga de habilidade** — uma linha permanente que
  reduz cooldown cria o comportamento ótimo "lute sempre perto da leyline" e
  fecha um loop de reforço com `current` → Arc. Se o pulso um dia entrar, é só
  o perigo rítmico, sem recarga.
- **Nós como altar de buff** — a junção é mecânica espacial (transformador/
  disjuntor), não número no personagem. Roteamento é o trabalho futuro dela.
- **Descarga da linha inteira** — o que separa "usei bem o terreno" de
  "atirei na parede certa e limpei a sala". O alcance é ESTRUTURAL: o
  worldgen fecha cada segmento na junção (≤ `LEYLINE_SEGMENT_MAX_CELLS` = 56,
  abaixo dos 64 do veio comum — a fiação de sala inteira continua sendo
  identidade exclusiva do Ferrífero).

## Onde existem

`WorldgenProfile.leylines` (default 0 — zero tiradas de RNG, todo estrato sem
leyline fica byte a byte):

- **Catedral Prismática**: 2 linhas (3 com profundidade ≥ 2). A nervura-mestra
  que organiza a nave.
- **Ocupação Aurix, exceto no Ferrífero**: 1 linha. A ficção: a operação
  prospectou SEGUINDO as leylines — a cicatriz expõe o condutor que a guiou.

## O traçado (worldgen, passo 6b)

Entrada → salão da gramática espacial (`hallCenters`) → região profunda
(banda ≥ 0.82·maxPath, a ≥ 6 células de núcleo/terminais/caches/chefe), por
descida gulosa sobre o campo BFS que o gerador já provou. Um ramo por linha
para a 6+ células do terminal mais próximo — **passa perto, nunca termina
nele**: a linha diz a direção, não desenha o walkthrough. A gravação troca
apenas rocha comum por `SOLID_LEYLINE`/`SOLID_LEYLINE_NODE` na parede que
margeia o corredor, depois de todas as provas de alcançabilidade — a abertura
do mapa não muda em nenhuma célula (teste de byte-identidade em
`leylines-worldgen.test.ts`).

## O ciclo

```
dormente → carregando (16 ticks, 0,8 s, luz subindo) → descarga → refratária (10 s) → dormente
```

- Tiro `energy` numa célula do segmento arma o relógio e emite
  `leyline_charge` — o sinal prévio obrigatório. Nenhum dano no impacto.
- `stepLeylines` cumpre o anúncio: `chargeCells(openNeighbours(cells))` com um
  ÚNICO evento `discharge`, dano plano `DISCHARGE_DAMAGE` (26) — sem "super
  choque". Um evento por ativação entrega de graça, via `resolveChainedEvents`:
  um hit por entidade, desconto de fogo amigo, e **+1 ressonância `current`
  por ativação** (frequência, nunca área).
- Armar cobra a carga do módulo Conductive como qualquer descarga.
- Refratária: tiro morre na parede em silêncio; o estado é legível pela luz.
- Nenhuma classe de projétil morde a leyline; a junção é inerte a tudo.

## Estado e wire

Matéria permanente no GRID (chega por diff de chunk, sobrevive a resync).
Fase em `state.leylineSegments` (`dischargeAt`/`refractoryUntil`/`triggeredBy`),
que **entra no hash autoritativo** — os relógios decidem dano; `railTimers`
só telegrafam, por isso ficam fora e estes entram. Geometria derivada da seed,
fora do hash e do wire, como `hallCenters`. No wire:
`WorldFlags.leylineClocks`, alinhado por índice como `railTimers`, com a mesma
regra de "o aviso só anda para frente" no espelho do cliente.

## Apresentação

Atlas de terreno v5: kinds `leyline`/`leylineNode` — a veia elétrica é função
da POSIÇÃO (cx+cy), então blocos vizinhos emendam a faixa e a linha lê como
linha. Luz: dormente = pontos alternados num respiro lento (seguível no
escuro, sem virar letreiro); carregando = todas as células, pulso subindo até
o tick anunciado; refratária = apagada; junção nunca apaga (é o marco que
separa segmentos). Faíscas ralas + cue baixo no armamento.

## Segundo corte: roteamento nas junções (o RELÉ)

> Uma junção ROTEADA deixa a descarga atravessar: ao descarregar, o segmento
> arma o(s) vizinho(s) DORMENTES como nova ativação — telegrafada
> (`leyline_charge`, 16 ticks) e refratária como qualquer outra. O toggle é
> persistente no setor, via interact (E) adjacente (raio 1.45, o do terminal),
> o ÚLTIMO alvo da cadeia — rotear nunca rouba um interact de objetivo.

Regras que valem registrar:

- **Anti-loop por construção, não por contador**: o relé só arma segmento
  dormente, e o que acabou de descarregar ganhou 10 s de refratária — a
  cascata nunca volta por onde veio.
- **Ressonância: +1 `current` por CASCATA**, na ativação original. A descarga
  repassada viaja com `relayed: true` e mantém autoria (dano, stun, fogo
  amigo do dono), mas não credita de novo — frequência do hábito, não tamanho
  da rede.
- **Descoberta** (`DISCOVERY_LEYLINE_ROUTED`, bit 25): marcada quando uma
  descarga ATRAVESSA — o toggle sozinho não ensina nada.
- **Adjacência nó↔segmento**: elos de CONSTRUÇÃO registrados na gravação (a
  junção sabe qual segmento fechou e qual abriu; o nó forçado do encontro
  liga-se ao dono do corredor cruzado — ancorado na célula do encontro, não
  onde o nó pousou) somados a proximidade Chebyshev ≤ 3. Zero RNG, zero grid:
  a impressão digital da geração continua 3461746772. ~19/20 seeds têm junção
  articulando ≥2 segmentos; o mapa raro sem ela é variância aceita (relé
  no-op honesto).
- **Estado/wire**: `routed` (por nó) e `relayed` (por segmento) entram no hash
  autoritativo; `WorldFlags.leylineRouting` viaja por índice como os clocks.
  A junção continua inerte a projéteis — o toggle é de mão, não de bala.
- **Apresentação**: junção fechada = luz constante; roteada = respiração lenta
  (r 3.2, pulso 600 ms). Prompt no padrão da caixa-preta ("USAR — ROTEAR
  JUNÇÃO"/"DESFAZER ROTEAMENTO"), cue de clique de disjuntor, faísca no
  toggle, entrada no codex. Fragmento de lore do servidor ficou de fora
  (sistema com grafo próprio; entra num corte de conteúdo).

## Terceiro corte: a mesma veia, mais funda — e o documento que a arquiva

**Vertical.** A rede densifica com a descida: a Catedral funda (setor 4+)
traça a quarta linha e a cicatriz Aurix funda expõe duas
(`biomeProfile`: `2 + clamp(depth-1, 0, 2)` / `max(·, depth≥3 ? 2 : 1)`).
Setores 1–3 ficam byte a byte — a amostra da impressão digital para no
setor 3 e ela continua 3461746772; só replays de descidas fundas (G-02+)
divergem, e é isso que o bump de `SIMULATION` 40 marca. No cliente, a luz
de REPOUSO da rede (dormente e junções) escala com `depthIntensity` — quem
desce a linhagem mineral vê a veia clarear a cada estrato. A CARGA não
escala: o telégrafo já é o sinal máximo.

**Lore.** `AX-ENG-038` — "Ensaio 38 — comutação em veio condutor"
(Engenharia, Ato II, relacionado a AX-ENG-022 e AX-UNK-067): o parecer que
classifica a junção como comutador natural e arquiva a pergunta de quem
comuta um comutador natural. De brinde, um conserto real: o bit
`DISCOVERY_LEYLINE_ROUTED` era descartado do perfil (`LORE_DISCOVERY_MASK`
deriva de `DISCOVERY_LORE`, e ele não estava lá) — a descoberta do relé não
persistia entre runs até este fragmento existir.

## Trabalho futuro

- Sobrecarga (descarga total do nó) e desligar região, se o jogo pedir.
- Pulso ambiental rítmico (sem recarga), se o jogo pedir.
- Decor/landmark dedicado da leyline (nascente monumental num salão).
