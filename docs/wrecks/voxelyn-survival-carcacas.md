# Carcaças de outras runs: o que já existe e o que falta

Este documento nasceu como projeto de uma feature inteira e foi reescrito depois
de ler o código: **a maior parte já está mergeada** (#68) ou em revisão (#69). O
que sobra é uma coisa só, e é justamente a que a pergunta original pedia —
a camada **comunitária**.

## O problema, e a saída que o gerador já dava

Nas poças do Dark Souls o **lugar é a mensagem**, e isso depende de o mapa ser o
mesmo para todo mundo. Num mapa por run, `(41, 67)` não tem referente
compartilhado: no mapa do vizinho aquilo é rocha.

A saída está em `worldgen.ts`: o gerador **nunca escolhe ponto por coordenada**.
Escolhe por profundidade normalizada de caminho, e posiciona os sítios de salvage
em bandas dessa régua (`0.20–0.35`, `0.40–0.60`, `0.65–0.80`). Como cada mapa
normaliza pelo próprio caminho mais longo, a régua é **comparável entre seeds**.

O #68 implementa exatamente isso, com nome próprio:

```ts
const progressAt = (state, x, y) => {
  const distance = distanceField(state.solid, width, height, state.entry.x, state.entry.y);
  const objective = distance[cellIndex(width, state.corePos.x, state.corePos.y)];
  return clamp255(Math.round((here / objective) * 255));
};
```

E vai além do que a régua sozinha dá: a assinatura topológica carrega também
`openness` (vizinhos abertos), `surface` (fungo/biofluido) e `nearOre`. Não casa
só *quão fundo*, casa **que tipo de lugar**. `candidateScore` pesa os quatro e
`placeOne` varre o mapa pelo mínimo, com desempate por hash determinístico.

> O efeito colateral continua valendo, e é o que torna o mapa procedural uma
> vantagem em vez de obstáculo: num mapa fixo a poça ensina uma verdade sobre
> *aquele mapa*; aqui ela ensina uma verdade sobre **o jogo** — "esta banda é
> onde as pessoas morrem" —, que é a lição que sobrevive à próxima run.

## Já está pronto — #68, mergeado

- projeção topológica por `progressQ` + `openness` + `surface` + `nearOre`;
- escada de fidelidade `exact` / `topological`, e o portão é **melhor** do que eu
  tinha projetado: além de seed e dimensões, exige `SIMULATION_VERSION` e
  `CONTENT_VERSION` iguais. Mesma seed com simulação diferente **não** é o mesmo
  mapa, e o código sabe disso;
- projeção ruim vira **ausência**, nunca worldgen adulterado;
- exclusão de entrada, objetivo, inimigos, terminais e cofres;
- 1 carcaça por setor;
- captura só em solo, com causa autoritativa validada contra `EnemyArchetype` e
  `ProjectileKind` reais;
- estritamente client-side: fora de `SurvivalState`, protocolo, hash e replay.

## Em revisão — #69, aberto

- pareamento como **ato** pelo botão de usar, e o eco **observa** o comando sem
  consumir — para o `interact` chegar inteiro à simulação e a run gravada não
  divergir da run jogada no replay do servidor;
- sete carcaças por causa autoritativa;
- fog of war que revela **luz**, não silhueta;
- **holograma dos últimos segundos**: 24 amostras a cada 120 ms, deslocamento em
  oitavos de tile a partir da célula da morte, octante da mira e bit de disparo.

## O que falta: a camada comunitária

Os dois PRs são **locais**. O acervo é `localStorage`, chave
`voxelyn.death-echoes.v1`, e são as **suas próprias** mortes. O #68 lista "pool
comunitário no servidor" fora de escopo, explicitamente.

Ou seja: o "dar vida" está entregue; o "elemento de jogabilidade comunitária"
ainda não existe. O resto deste documento é só isso.

### O bloqueio concreto

Mortes nunca são enviadas:

```ts
if (submitted || !state.summary || state.summary.phase === 'dead') return;
```

O comentário justifica com *"uma run de zero estrela não tem posição — mandaria
dezenas de replays por sessão para o servidor re-simular sem nada a mostrar no
fim"*. A carcaça é esse "algo a mostrar".

### Hack-proof: o cliente não submete carcaça nenhuma

A restrição do Postgres do Render continua valendo inteira, e a solução cai de
graça do que já existe:

**Nenhum campo novo sai do cliente.** Ele segue mandando `{seed, log, name}`. O
servidor re-simula e **deriva** a morte — posição, `progressQ`, `openness`,
`surface`, `nearOre`, causa, setor, minério carregado. Uma carcaça vira
**subproduto de uma run verificada**: nenhuma superfície nova de ataque, nenhuma
confiança nova. Forjar uma exige forjar um log que produza aquela morte, que
custa exatamente o mesmo que forjar um placar — jogar.

Mortes passam a ser enviadas e verificadas, continuam **fora** do ranking
(`isLeaderboardEligible` não muda) e podem cunhar uma carcaça.

A cápsula do #68 já é o formato certo para isso: derivar seus campos no servidor
é reexecutar `captureDeathEcho` sobre o estado final da re-simulação.

### Armazenamento novo

`leaderboard_entries` guarda `digest` e o sumário, **não guarda o log**. O acervo
público precisa de tabela nova (cápsula + rastro do holograma). Herda o `alter
table ... add column if not exists` como padrão — `create table if not exists`
não altera tabela existente, e isso já quase quebrou o minério em produção.

### Anti-abuso — só faz sentido quando é público

Localmente nada disso importa; num acervo público é obrigatório, e tudo é
derivável da run verificada:

- **piso de profundidade**: morrer aos 10 s não é história, e `progressQ` já é o
  campo;
- **dedup por `digest`**, que já existe e já é `unique`;
- **limite por origem**, que já existe (6/janela);
- **teto por banda**, guardando as mais informativas e não as mais recentes —
  senão a banda de abertura enche de mortes triviais;
- **nenhum texto livre**, invariante que o #68 já fixou.

### Densidade pública

O #68 usa `DEATH_ECHOES_PER_SECTOR = 1`, e para acervo local está certo: você tem
poucas mortes e todas são suas. Com acervo público a escassez precisa ser
**escolhida**, não consequência — sugiro manter 1–2 por setor mesmo com acervo
grande. Quarenta carcaças num mapa de 96×96 são cenário, e cenário é o fracasso
que o recurso existe para evitar.

## Duas adições que o acervo público pede

### 1. Relação com marco, não só com terreno

Hoje `salvageSites` entra só como **exclusão** (não plantar a menos de 4 tiles de
um terminal). A assinatura não guarda *relação* com marco.

Para o acervo local isso não faz falta. Para o público faz, porque o laudo quer
dizer de onde a perda foi registrada:

```
UNIDADE EX-0447
Perda registrada no terminal secundário, setor 2.
Sem valor de recuperação.
```

Isso pede `{ site, sitePart, siteGap }` na cápsula. E resolve de brinde a
honestidade do marcador análogo: **a empresa não registra coordenada, registra
incidente por classificação de sítio**. Sua unidade reconstrói o sítio a partir
do relatório — imprecisão diegética, não mentira. Quando a projeção é
`topological`, o laudo pode dizer isso na cara.

### 2. Manifesto por época, se a salvagem entrar

O #69 já aponta para lá: *"É este ato que a recuperação de módulo vai custar
depois"*.

Assim que uma carcaça **conceder recurso**, ela entra no estado autoritativo e o
servidor precisa reproduzi-la, ou a re-simulação devolve "fraude" para runs
honestas. Isso quebra o invariante 2 do #68 ("eco não concede recurso") de
propósito, e o preço é:

- **épocas imutáveis** (de hora em hora): a submissão vira `{seed, epoch, log,
  name}` e o servidor reconstrói o manifesto exato de `(seed, época)`. Sem linha
  por run, e o cemitério ganha ritmo em vez de mudar debaixo do jogador;
- **K fixo** por setor, para a *forma* do manifesto não variar — senão época
  farta vira vantagem de ranking.

Enquanto a salvagem não entrar, nada disso é necessário: marcador, laudo e
holograma não tocam a simulação.

## Alternativas recusadas

- **Mapa fixo ou mapa do dia único.** Resolve matando o que se quer preservar.
- **Coordenada absoluta.** Metade das carcaças nasceria dentro de pedra. O #68 já
  não faz isso.
- **Marcador submetido pelo cliente.** Viola o hack-proof de frente: seria o
  único caminho do jogo em que o cliente afirma um fato.
- **Mensagens escritas por jogador.** Abre moderação, e o jogo tem fonte de
  verdade mais forte: o rastro real. Uma pessoa mente ao escrever "cuidado"; o
  deslocamento gravado não.
- **Carcaça que reanima e ataca.** Transformaria a camada comunitária em ameaça e
  ensinaria o jogador a preferir que **menos** gente jogasse.

## Recomendação

Fechar o #69 primeiro. Ele termina a experiência **local**, e a pergunta que só o
playtest responde é se a carcaça já é interessante sem recompensa material — com
holograma e laudo, sem salvagem. Se for, o acervo público é multiplicador do que
já funciona. Se não for, a salvagem estaria comprando com minério um interesse
que o recurso não tinha, e é melhor descobrir isso antes de haver época,
manifesto e tabela nova para manter.
