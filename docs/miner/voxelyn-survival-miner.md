# Voxelyn Survival — Empoverished Miner e a cota de minério

## 1. O buraco que ele preenche

O Prospector é um **robô de mineração que não minerava**. O minério existia no
grid, reagia a eletricidade, virava fiação — e não ia para lugar nenhum. E todo
o bestiário era fauna: nenhum encontro em que a pergunta fosse outra coisa além
de "como eu mato isto".

O Miner resolve os dois de uma vez.

### O que ele é (e o que eu escrevi antes que estava errado)

Ele **não é uma pessoa**. É um **autômato de extração abandonado** — uma unidade
de manutenção da grade, deixada para trás quando os veios desabaram, ainda
cumprindo a ordem que ninguém cancelou. É da mesma família do Prospector.

A primeira versão deste documento, e o código todo com ela, afirmava o contrário:
*"a única pessoa do bestiário"*, sangue como respingo, *"a única morte humana do
jogo"*, `PESSOAL NÃO AUTORIZADO`, `civis abatidos`, e uma silhueta autorada de
propósito com a gramática de gente. Tudo isso foi corrigido de uma vez, porque
metade certa e metade errada deixaria o jogo dizendo duas coisas incompatíveis.

O encontro fica **mais forte** assim: você não está matando um coitado, está
matando o seu antecessor. E a frase que a empresa arquiva sobre ele — *"sem valor
de recuperação"* — passa a ser uma previsão sobre o Prospector.

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

O gatilho é **físico, não emocional**: o corpo dele está saturado de minério
reativo e o cabeamento ainda conduz corrente da grade. Calor em excesso
**sobrecarrega** o circuito. Ele não fica com raiva de você; ele entra em falha
perto de você, e a falha dele é violenta.

A rota mais lucrativa é a do meio, e ela **exige parar de atirar** num setor
hostil antes de chegar perto. É a mesma troca de sempre: tempo e segurança
contra recurso.

### A decisão congela

Se a postura seguisse o calor tick a tick, o Miner oscilaria entre fugir e
atacar enquanto a arma esfria — um NPC epilético em vez de uma reação. O calor
decide **uma vez**, no instante em que ele levanta a cabeça. Depois disso o
encontro já é o que é.

*"It raises its head only to decide"* — e isso saiu de graça na animação: no
`idle` a cabeça fica baixa, batendo a picareta no chão; ela sobe em `walk` e
`attack`, os dois estados que só existem depois de ele ter decidido alguma coisa
a seu respeito. A seleção de animação já é por movimento.

### O cleave é circular

Circular porque a resposta certa é **recuar**. Um golpe frontal ensinaria a
orbitar por trás, que é o que o jogador já faz com todo o resto do bestiário — o
Miner enfurecido existe justamente para punir quem entra em cima confiando nisso.

## 3. Matar o passivo: sem drop, e anotado

O Miner passivo destruído **não dropa nada** e soma em `stats.innocentsKilled`.

> O nome do campo continuou `innocentsKilled` depois de o Miner deixar de ser
> humano, porque o que ele conta não mudou: alguma coisa que não ia fazer nada
> com você, e que você destruiu assim mesmo.

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
REGISTRO CORPORATIVO: 3 unidades inativas destruídas — sem valor de recuperação.
```

**Não** é mais uma célula na grade de números, e a diferença é o ponto inteiro.
Ali ele viraria uma métrica entre outras — algo a otimizar, para cima ou para
baixo. Como linha própria, em vermelho, com a voz da empresa, ele não pede nada
ao jogador: só registra, com a indiferença exata de quem contabiliza perda de
material e não morte de gente.

*"sem valor de recuperação"* faz o trabalho todo, e faz um trabalho **diferente**
agora que o Miner é um autômato: a empresa está falando de uma máquina que **ela
mesma abandonou**, ainda cumprindo a ordem que ninguém cancelou, e a única coisa
que ela anota é que não sobrou nada aproveitável.

O Prospector é da mesma geração. A frase é sobre a empresa — e é uma previsão
sobre o jogador. O jogo não diz nada disso; só mostra a linha.

Some em zero. Uma linha "0 civis" toda run transformaria a **ausência** de
violência gratuita numa pontuação, que é o mesmo erro pelo outro lado.

## 4. Minério paga a PRÓXIMA run, não esta

Durante um tempo a coleta pagava **escolha de módulo**: cada 14 lascas
(`ORE_PER_MODULE`) rendiam uma oferta, a mesma moeda com que o salvage paga
risco. A intenção era manter as duas atividades comparáveis dentro da run.

O problema era exatamente esse. Mineração e salvage viravam duas torneiras da
mesma economia, e minerar era uma forma mais lenta de abrir um cofre. Um sistema
inteiro do jogo existia para produzir o que outro já produzia melhor.

Desde a spec de 2026-08-02, cada sistema tem uma função só:

```
Salvage  →  módulos temporários
Ecos     →  habilidade da run
Minério  →  carga de metaprogressão (a próxima geração)
Núcleo   →  chave rara de progressão permanente
```

`ORE_PER_MODULE`, `oreModulesPaid` e `payOreQuota` foram removidos. O que ficou
intacto: os veios, `stats.oreCollected`, o evento `ore_gained`, as partículas de
lasca, o drop do Minerador e o minério como desempate do ranking.

Minerar continua **opcional** por design, e a razão mudou de lugar: ninguém é
obrigado a minerar porque a carga é um risco, não um imposto. Toda lasca só vale
alguma coisa se o Prospector voltar — e nada na Matriz Geracional reduz essa
perda.

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
| `deathMiner` | **150 ms** |
| `death` (bicho) | 329 ms |
| `deathGuardian` (fim de ato) | 1770 ms |

A brevidade é o desenho. Todo o resto do banco toca e desvanece — a criatura cai,
o som acompanha o corpo, a cauda cobre o instante seguinte. Aqui a cauda é o
problema: uma morte que ressoa é uma morte **estilizada**, e o objetivo desta é o
oposto.

A forma sobreviveu à troca de ficção, e vale registrar por quê. Ela foi escrita
quando o Miner era humano, com o argumento *"esta morte não pode ressoar"*. O
argumento estava certo **pelo motivo errado**: não é a humanidade que pede o
corte, é o fato de que **isto não é um evento**. Um autômato que para não tem
agonia nem queda dramática — a corrente cessa, e o que sobra é o silêncio de uma
coisa que estava zumbindo há décadas.

O que mudou foi o timbre: saiu a parcial dupla batendo (que era voz) e entrou a
queda de corrente — um estalo elétrico e uma descida curta que morre sem cauda.

Nada abaixo de 190 Hz: grave é o registro dos chefes e das explosões.

Prioridade 7 contra os 5 do `death` comum, e espacial. Sete é alto para uma morte
que não é a sua, e o motivo é estreito: esta é a única morte do jogo que o jogador
pode ter causado **sem precisar**. Perdê-la no orçamento durante um tiroteio seria
apagá-la justamente na situação em que ela mais tem o que dizer. Espacial porque
importa **de onde** veio — você atirou naquela direção de propósito.

## 9. O bestiário é escrito pela empresa

O registro era uma lista de nomes e contagens — a voz de um naturalista
catalogando fauna. Isso contradiz a ficção que o resto do jogo estabeleceu: o
Veio é habitado por **civilizações** que protegem o que sobrou, e o Prospector é
um robô de uma mineradora enviado para levar o que é delas.

Então quem escreve o registro é a empresa, e a empresa não chama ninguém de povo.
A seção virou **REGISTRO DE ATIVOS**, e cada entrada tem três linhas:

```
UNIDADE EX-016                                            ×3
Extratora da geração anterior. Operação após o encerramento
do contrato não foi autorizada. Sem valor de recuperação.
  campo: Minerador Empobrecido
```

A designação corporativa vem **primeiro**, porque é o que o relatório considera o
nome de verdade. O nome que o **jogador** aprendeu vem embaixo, recuado e em
itálico, como uma nota de campo que alguém acrescentou à mão. A distância entre as
duas linhas é o efeito inteiro.

O texto nunca diz ao jogador o que sentir. Ele só mostra o que foi arquivado — e
a ficha do Miner é a mais reveladora das oito, porque nela a empresa não está
negando a natureza de outra coisa: está negando **responsabilidade pela própria
máquina**. *"Operação após o encerramento do contrato não foi autorizada"* culpa o
autômato por continuar trabalhando depois de ter sido abandonado. É a mesma frase da tela de fim, de propósito: os
dois lugares em que o jogo fala com a voz de quem o construiu dizem a mesma coisa.

A voz também **se desgasta** conforme a lista desce. Começa como zoologia de
rotina (`ESPÉCIME QUIT-04`, "fauna de túnel") e no fim precisa de negações para não
admitir o óbvio:

- *"Reclassificado de «maquinário extraviado» após o terceiro relatório."*
- *"A presença de arreios não implica operador."*
- *"A alegação de estrutura religiosa permanece não corroborada."*

O jogador viu a mitra, a congregação e os arreios. O relatório está mentindo com
o vocabulário de quem não pode ser processado por isso.

### O sprite do Miner

`enemy-miner`, 48×60 — **maior que o bruiser**, e a única criatura do jogo que
passa dos 2 m sem ser um chefe.

A silhueta usa a gramática do **Prospector degradada**, e não a de gente: mesmo
plano de corpo, mesma lanterna, mesma ferramenta, só que grande demais, curvado
sob a própria carga, com o cabeamento para fora e o minério reativo crescido por
dentro. O jogador não deve pensar *"coitado"*. Deve pensar *"isto aqui é o que
sobra de mim"*.

Três voxels contam a história e são os únicos claros do modelo: a lanterna acesa,
a placa facial rachada e as veias condutoras. O resto é ferrugem sobre ferrugem.

Corpo grande (raio 0,46) com vida baixa (34) é deliberado e diz o que ele é: uma
máquina de carga que nunca foi construída para lutar. Subir a vida junto com o
tamanho transformaria a decisão num orçamento de munição, que é outra coisa.

E o respingo do acerto é **`stone`, o mesmo do Prospector** — a coisa mais
importante daquela tabela. Nenhuma linha de texto diz ao jogador que os dois são
da mesma família; o respingo diz, toda vez.

A fúria não cabe no atlas: um sheet de frames fixos não sabe o humor da entidade.
Ela chega pelo gancho de **tint** que já existia para o elite, em vermelho contra o
laranja dele, para as duas marcações continuarem distinguíveis.

## 10. O que fica em aberto

- `MINER_RAGE_HEAT = 66,6` (de 100) — dois terços da barra. Começou em 55, o que
  caía dentro do calor de um combate curto qualquer: o jogador chegava
  enfurecendo sem ter escolhido isso, que é o oposto do ponto. Continua sendo
  calibragem de playtest.
- O Miner não tem atlas; cai no `drawVoxelEntity`, com silhueta humana própria
  (dois membros, tronco estreito, picareta) e olhos que só acendem quando ele se
  enfurece.
- `innocentsKilled` é registrado e não aparece em lugar nenhum da UI ainda. A
  tela de fim é o lugar certo, e é o próximo passo pequeno.
