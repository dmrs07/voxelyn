# Voxelyn Survival — Empoverished Miner e a cota de minério

## 1. O buraco que ele preenche

O Prospector é um **robô de mineração que não minerava**. O minério existia no
grid, reagia a eletricidade, virava fiação — e não ia para lugar nenhum. E todo
o bestiário era fauna: nenhum encontro em que a pergunta fosse outra coisa além
de "como eu mato isto".

O Miner resolve os dois de uma vez. Ele é a **única pessoa** do jogo, e o que
ele carrega é o recurso que faltava ter destino.

## 2. O gatilho é o CALOR DA SUA ARMA, não um sorteio

A ideia original tinha três reações sorteadas: fugir, enfurecer, ou nada. O
sorteio era a versão óbvia e **violava o invariante que sustenta o jogo inteiro**
— o jogador nunca leva dano sem sinal.

Um humano parado que às vezes vira uma ameaça sem nada mudar no mundo é
exatamente isso. E pior: ensina o jogador a **matar todo mundo por precaução**,
o que apaga o encontro antes de ele existir.

Com o calor, a decisão volta para quem joga, lida num medidor que já está no HUD
desde sempre:

| Calor | O que ele faz | O que isso te custa |
| --- | --- | --- |
| frio (`< 8`) | te ignora | nada — e você passa sem incidente |
| morno (`8–66,6`) | **foge** | tempo, para alcançá-lo e pegar o minério |
| quente (`≥ 66,6`) | **ataca** | vida, num cleave circular |

A rota mais lucrativa é a do meio, e ela **exige parar de atirar** num setor
hostil antes de chegar perto. É a mesma troca de sempre: tempo e segurança
contra recurso.

### A decisão congela

Se a postura seguisse o calor tick a tick, o Miner oscilaria entre fugir e
atacar enquanto a arma esfria — um NPC epilético em vez de uma reação. O calor
decide **uma vez**, no instante em que ele levanta a cabeça. Depois disso o
encontro já é o que é.

### O cleave é circular

Circular porque a resposta certa é **recuar**. Um golpe frontal ensinaria a
orbitar por trás, que é o que o jogador já faz com todo o resto do bestiário — o
Miner enfurecido existe justamente para punir quem entra em cima confiando nisso.

## 3. Matar o passivo: sem drop, e anotado

O Miner passivo morto **não dropa nada** e soma em `stats.innocentsKilled`.

Não é punição — é a **ausência de recompensa**, e a distinção importa. Dropar
transformaria "matar todo mundo por precaução" na jogada ótima e apagaria o
encontro: por que arriscar aproximar-se frio se a bala rende o mesmo? Sem drop, a
violência gratuita custa munição, calor e tempo, e devolve só a anotação.

E é **só** a anotação. Nada de dano, nada de pontuação, nada de penalidade. O
Prospector é um robô sem compasso moral e o jogo não vai puni-lo por isso — ia
soar como uma moral que a própria ficção nega. Ele anota, e mostra anotado no
fim. **A mancha é o registro, não a penalidade.**

### Como ele aparece na tela de fim

```
REGISTRO CORPORATIVO: 3 civis abatidos — sem valor de recuperação.
```

**Não** é mais uma célula na grade de números, e a diferença é o ponto inteiro.
Ali ele viraria uma métrica entre outras — algo a otimizar, para cima ou para
baixo. Como linha própria, em vermelho, com a voz da empresa, ele não pede nada
ao jogador: só registra, com a indiferença exata de quem contabiliza perda de
material e não morte de gente.

*"sem valor de recuperação"* faz o trabalho todo. A empresa não está condenando
ninguém; está anotando que aquilo não rendeu. Quem decide se isso incomoda é o
jogador.

Some em zero. Uma linha "0 civis" toda run transformaria a **ausência** de
violência gratuita numa pontuação, que é o mesmo erro pelo outro lado.

## 4. A cota tem de ter um benefício

"Pontos no fim" não é benefício, é placar. A cota paga em **escolha de módulo** —
a mesma moeda com que o salvage paga risco.

Pagando com a moeda que o jogo já usa, as duas atividades ficam **comparáveis
dentro da run**: vale mais a pena abrir aquele terminal ou arrancar aquele veio?
Uma moeda própria faria da mineração uma economia paralela com regras próprias.

- `ORE_PER_MODULE = 14` — cerca de dois veios inteiros. Baixo demais e minerar
  vira a estratégia única; alto demais e ninguém chega lá dentro do tempo-alvo.
- `oreModulesPaid` é contador de **pagamentos**, não um limiar. Sem ele,
  `oreCollected` acima do múltiplo pagaria de novo a cada tick enquanto o jogador
  não escolhesse, e um veio grande viraria módulo infinito.
- No co-op a cota é do **time**: quem carrega a picareta e quem cobre não
  deveriam ser pagos de forma diferente.

A cota é **opcional** por design. Ninguém é obrigado a minerar; uma cota
obrigatória viraria imposto sobre o tempo, e o tempo já é cobrado pela terceira
estrela.

## 5. Minério no ranking: desempate, nunca objetivo

```
mais estrelas  →  menos tempo  →  mais minério  →  quem chegou antes
```

O minério entra **depois** do tempo, e não antes, de propósito. Ele não pode
virar um objetivo que compete com a corrida — a terceira estrela já é "a segunda
com pressa", e minerar custa tempo. Como desempate ele só decide entre duas runs
que já empataram no que o jogo cobra, e aí "quem tirou mais do Veio?" é a única
pergunta que sobra, além de ser a que a ficção faria.

### A migração que quase passou batido

`create table if not exists` **não altera** uma tabela que já existe, e a que
roda em produção foi criada antes de o minério existir. Sem a linha de `alter
table`, o deploy subiria limpo e o insert quebraria no primeiro placar enviado —
o pior tipo de falha, porque nada no boot a denuncia.

Os índices novos têm **nome novo**: `create index if not exists` olha o nome, não
as colunas. Reusar o nome antigo deixaria o índice velho intacto em produção e
silenciosamente fora de ordem com o `ORDER BY`.

## 6. Onde eles nascem

Perto de **minério**, não em pontos de spawn de inimigo. O lugar é a
caracterização: eles estão ali porque estão trabalhando o veio, e é por isso que
o robô da mineradora vai encontrá-los. Espalhá-los pelos mesmos pontos que os
bichos os transformaria em mais um inimigo que por acaso não ataca.

## 7. Verificação

```
pnpm --filter @voxelyn/survival-sim test    # tests/miner.test.ts, 13 casos
```

Quatro mutações injetadas no código de produção; três pegaram de primeira. A
quarta — trocar o cleave circular por um frontal — **passou**, e expôs um teste
que não provava a própria afirmação: o Miner reaponta para o jogador a cada tick
fora de ação, então "atrás" virava "na frente" no tick seguinte. O que separa
circular de frontal é a direção **congelada no windup**, então a troca de lado
tem de acontecer *depois* de a ação começar. O teste agora espera o
`action_start`.

### Uma lacuna de processo que este PR fechou

Nem `vite build` nem `vitest` fazem **typecheck**. Eu vinha rodando `tsc` só no
pacote da simulação, e por isso três erros de tipo introduzidos no PR anterior
(os chefes novos faltando em `ARCHETYPE_NAMES` e nas fixtures de teste) passaram
despercebidos por um PR inteiro — build verde, testes verdes, tipos quebrados.
Agora os cinco pacotes são checados.

## 8. A morte dele soa diferente

`deathMiner` é a voz mais **curta** do banco. Medido em `OfflineAudioContext`,
som audível até cair abaixo de −40 dB:

| Voz | Duração |
| --- | --- |
| `deathMiner` | **189 ms** |
| `death` (bicho) | 329 ms |
| `deathGuardian` (fim de ato) | 1770 ms |

A brevidade é o desenho. Todo o resto do banco toca e desvanece — a criatura cai,
o som acompanha o corpo, a cauda cobre o instante seguinte. Aqui a cauda é o
problema: uma morte que ressoa é uma morte **estilizada**, e o objetivo desta é o
oposto. Ela para antes de o ouvido esperar e deixa silêncio onde havia som.

Duas parciais próximas em vez de uma só, para dar batimento — é o que separa voz
de bipe. E nada abaixo de 280 Hz: grave é o registro dos chefes e das explosões, e
um corpo pequeno não pode soar como um evento grande.

Prioridade 7 contra os 5 do `death` comum, e espacial. Sete é alto para uma morte
que não é a sua, e o motivo é estreito: esta é a única morte do jogo que o jogador
pode ter causado **sem precisar**. Perdê-la no orçamento durante um tiroteio seria
apagá-la justamente na situação em que ela mais tem o que dizer. Espacial porque
importa **de onde** veio — você atirou naquela direção de propósito.

## 9. O que fica em aberto

- `MINER_RAGE_HEAT = 66,6` (de 100) — dois terços da barra. Começou em 55, o que
  caía dentro do calor de um combate curto qualquer: o jogador chegava
  enfurecendo sem ter escolhido isso, que é o oposto do ponto. Continua sendo
  calibragem de playtest.
- O Miner não tem atlas; cai no `drawVoxelEntity`, com silhueta humana própria
  (dois membros, tronco estreito, picareta) e olhos que só acendem quando ele se
  enfurece.
- `innocentsKilled` é registrado e não aparece em lugar nenhum da UI ainda. A
  tela de fim é o lugar certo, e é o próximo passo pequeno.
