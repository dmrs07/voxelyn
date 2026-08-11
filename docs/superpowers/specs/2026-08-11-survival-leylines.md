# Leylines — o condutor geológico que orienta o Veio

**Data:** 2026-08-11
**Escopo:** `voxelyn-survival-sim`, `voxelyn-survival-protocol`, `voxelyn-survival-server`, `voxelyn-survival` (cliente), `voxelyn-survival-content`
**Versões:** `PROTOCOL_VERSION` 21 → 22, `SIMULATION_VERSION` 37 → 38, `CONTENT_VERSION` 23 → 24
**Status:** primeiro corte implementado (worldgen + condução por segmento + render).

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

## Trabalho futuro

- Roteamento nas junções (girar alimentação, sobrecarregar, desligar região).
- Pulso ambiental rítmico (sem recarga), se o jogo pedir.
- Continuidade visual/narrativa da linha entre setores da linhagem.
