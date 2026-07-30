# Carcaças: restos de outras runs num mundo procedural

Projeto, não implementação. O objetivo é o que o Dark Souls faz com as poças de
sangue — dar a sensação de que outras pessoas estiveram ali e falharam — **sem**
abrir mão de mapa novo por run.

## O problema, dito com precisão

Nas poças do Dark Souls o **lugar é a mensagem**. "Alguém morreu nesta beirada"
só significa alguma coisa porque a beirada é a mesma para todo mundo, para
sempre. Num mapa procedural, a coordenada `(41, 67)` não tem referente
compartilhado: no mapa do vizinho aquilo é rocha maciça.

A saída óbvia — fixar o mapa, ou ter um "mapa do dia" único — resolve o problema
matando exatamente o que você quer preservar. Então não é essa.

## A saída: o gerador já não pensa em coordenadas

Olhando `worldgen.ts`, o gerador **nunca escolhe um ponto por coordenada**. Ele
escolhe por *profundidade normalizada de caminho*:

```ts
const maxPath = distFromEntry[idx(w, corePos.x, corePos.y)];
const bands = [
  { min: 0.20, max: 0.35, tier: 1 },
  { min: 0.40, max: 0.60, tier: 1 },
  { min: 0.65, max: 0.80, tier: 2 },
  { min: 0.82, max: 0.95, tier: 3, optional: true },
];
```

`distFromEntry[cell] / maxPath` é um escalar em [0,1] que quer dizer *"quão fundo
na descida está este ponto"* — e ele é **comparável entre seeds**, porque cada
mapa normaliza pelo próprio caminho mais longo. É a régua que o próprio gerador
usa para decidir onde ficam os terminais.

Essa é a âncora. Não uma coordenada: uma **profundidade**.

> "Alguém morreu a 62% da descida do setor 2, doze tiles antes do segundo
> terminal" é uma frase verdadeira e útil em **qualquer** mapa que este gerador
> produza — porque o gerador usa essa mesma régua para construir todos eles.

E repare no que isso faz com o valor da informação. Num mapa fixo, a poça ensina
uma verdade sobre *aquele mapa*. Aqui ela ensina uma verdade sobre **o jogo**: "o
segundo terminal é onde as pessoas morrem". Para um roguelike, a segunda é a
lição que continua valendo na próxima run. O mapa procedural não é um obstáculo
ao recurso — ele muda o recurso para uma versão que ensina mais.

## O endereço

```ts
type WreckAnchor = {
  sector: 1 | 2 | 3;
  /** distFromEntry / maxPath no ponto da morte. */
  depth: number;
  /** Sítio de salvage mais próximo por caminho, ou -1. */
  site: number;
  /** 0 = nenhum, 1 = terminal, 2 = cache. */
  sitePart: 0 | 1 | 2;
  /** Distância em tiles até esse ponto, quantizada. */
  siteGap: number;
};
```

**Resolver o endereço num mapa estrangeiro** é um filtro sobre o que o gerador já
devolve (`openCells`), usando um BFS a partir de `entry` — a mesma travessia que
`bfsFarthest` já faz:

1. candidatos = células abertas com `|profundidade − depth| ≤ 0,03`;
2. entre elas, prefira as que têm o **mesmo** sítio/parte mais próximo;
3. entre essas, a de `siteGap` mais parecido;
4. desempate pelo RNG da run, para ser determinístico.

O ε de 0,03 sai das bandas: a mais estreita tem 0,15 de largura, então 0,03
garante que a carcaça nasça **dentro da mesma banda** em que a pessoa morreu, e
não no vão entre duas.

`distFromEntry` hoje é local a `generateAttempt` e não sai em `GeneratedWorld` —
ou expõe, ou recalcula (um BFS sobre ~2 600 células abertas, trivial).

## A escada de fidelidade — e por que ela premia seed compartilhada

O campo de seed já existe no cliente, e o comentário dele diz para que serve:
*"a razão de o campo existir é alguém colar a seed de outra pessoa e tentar a
mesma descida"*. Há também `?seed=` na URL. A comunidade já tem como se
encontrar no mesmo mapa; o recurso só precisa **recompensar** isso quando
acontece:

| Fidelidade | Quando | O que o jogador recebe |
| --- | --- | --- |
| **exata** | mesma seed | o tile exato, e o fantasma roda com colisão verdadeira |
| **análoga** | seed diferente, ponto resolvido em chão livre | mesma banda, mesma relação com o sítio, fantasma permitido |
| **aproximada** | o ponto caiu em rocha e foi encostado no vizinho livre | centro da estrutura, **sem** fantasma, marcado como aproximado |

Colar a seed de alguém deixa de ser só curiosidade e passa a ser o modo de alta
resolução do recurso. Sem obrigar ninguém: quem joga seed aleatória continua
recebendo a versão análoga, que é a maior parte do valor.

## A honestidade do marcador, e por que a voz corporativa já resolveu

Um marcador análogo diz "alguém morreu aqui" sobre um lugar onde ninguém morreu.
Isso seria uma mentira do jogo — e este projeto não mente para o jogador.

A voz que a #63 estabeleceu resolve sozinha: **a empresa não registra
coordenadas, registra incidentes por classificação de sítio.**

```
UNIDADE EX-0447
Perda registrada no terminal secundário, setor 2.
Sem valor de recuperação.
```

Isso é literalmente tudo o que o relatório diz. Sua unidade está reconstruindo o
sítio a partir do relatório, não visitando o lugar. Não é imprecisão escondida, é
**imprecisão diegética** — e ela deixa o jogo *admitir* a resolução que tem:
quando o ponto foi encostado, o marcador diz `posição aproximada` e o fantasma
não roda. O jogo nunca finge saber mais do que sabe.

## O que uma carcaça é, na ficção

O Prospector é uma máquina de mineradora. Um Prospector morto é uma **unidade
inutilizada** — a mesma classe de coisa que o Miner, que a #63 estabeleceu como
`UNIDADE EX-016`, *"extratora da geração anterior, operação após o encerramento
do contrato não foi autorizada, sem valor de recuperação"*.

E a sua tela de fim já escreve, sobre os Miners que você matou:

```
REGISTRO CORPORATIVO: 3 unidades inativas destruídas — sem valor de recuperação.
```

Uma carcaça é **você virando essa linha no relatório de outra pessoa**. O
vocabulário todo já está escrito, e o tema da #8 fecha o ciclo sem uma palavra
nova: o jogo já dizia que o Prospector mata o próprio antecessor. Agora ele
mostra os sucessores passando por cima de você.

## As três cargas, em risco crescente

### 1. Marcador e epitáfio — só apresentação

Uma carcaça no chão, silhueta de Prospector desmontada, com a linha corporativa.
Zero impacto na simulação.

### 2. Fantasma — os últimos segundos reais

O servidor tem o **log de comandos verificado**. Não é uma mensagem que alguém
escreveu: é o que a pessoa realmente apertou. Rodar os últimos 60 ticks (3 s) no
renderizador mostra o flail verdadeiro — para onde ela correu, para onde atirou,
o que não deu tempo.

A 4,6 tiles/s, 3 s são ~6 tiles de deslocamento: cabe numa sala, o que é o que
torna o fantasma plantável num mapa estrangeiro.

**O custo é tempo**, e o tempo é a moeda que as estrelas já cobram (*"a terceira
estrela já é «a segunda com pressa»"*). Parar para assistir custa posição no
ranking. Informação com preço, pago na moeda que o jogo já tem — nada de UI de
recurso nova.

E o custo é **emergente, não simulado**: assistir é puramente do cliente. A
simulação não sabe que existe um fantasma. Você parou de andar num lugar
perigoso; o que acontece com isso é problema seu. **Zero risco de determinismo.**

### 3. Salvagem — o minério que não foi entregue

A carcaça carrega o minério que a pessoa ainda não tinha pago na cota. O fracasso
dela vira o seu módulo. Risco/recompensa ancorado numa verdade: ela morreu ali
porque ali é perigoso, e ali continua sendo.

Esta **toca a simulação**, e é onde mora o problema difícil.

## O campo minado: determinismo

O anti-cheat inteiro é re-simulação — o servidor recebe `{seed, log, name}` e
descobre o resultado sozinho. **Qualquer coisa que afete a simulação precisa ser
reproduzível pelo servidor**, ou a verificação passa a devolver "fraude" para
runs honestas.

Marcador e fantasma não têm esse problema (não entram na simulação). Salvagem
tem: minério é estado autoritativo.

Solução proposta: **manifestos por época**.

- O servidor congela snapshots imutáveis do acervo de carcaças (de hora em hora).
- A run reporta qual época jogou; a submissão vira `{seed, epoch, log, name}`.
- O servidor reconstrói o manifesto exato de `(seed, época)` e re-simula.

Sem linha por run, armazenamento limitado, e o cemitério ganha um ritmo natural
("atualiza de hora em hora") em vez de mudar debaixo do jogador no meio da
descida.

**K fixo** — sempre exatamente K carcaças por setor, independente do tamanho do
acervo. Isso mantém a *forma* do manifesto invariante, então uma run jogada numa
época farta não tem vantagem estrutural sobre uma época magra. Só o conteúdo
muda. (O minério já é desempate depois do tempo no ranking, então a exposição a
injustiça é pequena de qualquer jeito — mas K fixo torna a discussão
desnecessária.)

## Hack-proof: o cliente não submete carcaça nenhuma

Vale dizer explícito, porque é a restrição que você fixou desde o Postgres do
Render:

**Nenhum campo novo sai do cliente.** Ele continua mandando `{seed, log, name}`.
O servidor re-simula, e ao chegar no fim **deriva** a morte: posição,
profundidade, tick, setor, minério carregado, causa. Uma carcaça é um
**subproduto de uma run verificada** — não há superfície nova de ataque, não há
confiança nova. Forjar uma carcaça exige forjar um log que realmente produza
aquela morte, que é o mesmo custo de forjar um placar: jogar de verdade.

O que muda: hoje mortes **nunca são enviadas**.

```ts
if (submitted || !state.summary || state.summary.phase === 'dead') return;
```

O comentário justifica: *"uma run de zero estrela não tem posição — mandaria
dezenas de replays por sessão para o servidor re-simular sem nada a mostrar no
fim"*. Carcaças são exatamente o "algo a mostrar" que faltava. Mortes passam a
ser enviadas e verificadas, continuam **fora** do ranking
(`isLeaderboardEligible` não muda) e podem cunhar uma carcaça.

### Armazenamento novo

`leaderboard_entries` guarda `digest` e o sumário, **não guarda o log**. O
fantasma precisa de tabela nova com a fatia de 60 ticks + a âncora. É a única
estrutura de dados genuinamente nova do projeto.

## Anti-abuso

Tudo derivável da run verificada, nada de heurística:

- **Piso de run.** Morrer aos 10 segundos não é história. Só cunha carcaça acima
  de uma profundidade mínima — que já é o campo `depth` da âncora, de graça.
- **Dedup por `digest`**, que já existe e já é `unique`.
- **Limite por origem**, que já existe (6/janela).
- **Teto por banda de profundidade**, guardando as mais *informativas* e não as
  mais recentes — senão a banda de abertura enche de mortes triviais e as
  interessantes somem.
- **Nome por `sanitizeName`**, que já existe.

## Densidade: escassez, não saturação

**K = 4 por setor.** Num mapa de 96×96 com ~2 600 células abertas atravessado em
~4 minutos, quatro carcaças são um evento; quarenta são cenário.

Esse é precisamente o fracasso que você quer evitar — "dar vida" vira "poluir" no
momento em que o jogador para de olhar. Cada carcaça tem de valer uma decisão:
gasto tempo assistindo? entro ali para pegar o minério?

## Alternativas recusadas

- **Mapa fixo, ou mapa do dia único.** Resolve matando o que você pediu para
  preservar.
- **Coordenada absoluta.** Sem referente entre seeds; metade das carcaças
  nasceria dentro de pedra.
- **Marcador submetido pelo cliente.** Viola a regra do hack-proof de frente, e
  seria o único caminho do jogo em que o cliente afirma um fato.
- **Mensagens escritas por jogador** (banco de palavras à la Dark Souls). Abre
  superfície de moderação, e o jogo tem uma fonte de verdade **mais forte** à
  disposição: o log real. Uma pessoa pode escrever "cuidado" mentindo; o log dela
  não mente.
- **Carcaça que reanima e ataca.** O instinto é forte e está errado: transformaria
  a camada comunitária em ameaça, e ensinaria o jogador a preferir que **menos**
  gente jogasse. A camada de outras pessoas nunca deve piorar a sua run.

## Fases sugeridas

**Fase 1 — marcador + epitáfio + fantasma.** Sem impacto na simulação, sem
manifesto de época, sem risco de determinismo, sem exposição no ranking. Já
entrega "dar vida" e a leitura comunitária inteira. É a fatia com a melhor razão
valor/risco por uma margem grande.

**Fase 2 — salvagem.** Aí sim: manifesto por época, K fixo, minério pinado na
simulação.

Recomendo fechar a Fase 1 sozinha e jogá-la antes de decidir a Fase 2 — porque a
pergunta que só o playtest responde é se a carcaça já é interessante **sem**
recompensa material. Se for, a salvagem é bônus. Se não for, a salvagem estaria
comprando com minério um interesse que o recurso não tinha.

## Números que são chute e vão precisar de playtest

Na mesma categoria de `TARGET_SECTOR_TICKS` e `MINER_RAGE_HEAT`:

- `K = 4` por setor
- `ε = 0,03` de profundidade
- `60` ticks de fantasma
- época de `1 h`
