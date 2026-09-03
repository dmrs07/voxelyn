# Voxelyn Survival — Chefes por estrato e ocupação

## O problema

Os chefes eram decididos pelo **número do setor**: Bispo no 2, Guardião no 3,
qualquer que fosse a geologia. Uma Catedral Prismática terminava no mesmo Guardião de
basalto, e o Bispo aparecia em mapas onde o micélio era um enxerto plantado à força
só para a luta dele existir.

## A regra nova — `bossForBiome` (`src/bosses.ts`)

```ts
bossForBiome({ stratum, occupation, depth });
```

Prioridade:

1. **Uma ocupação forte substitui o chefe do estrato.**
2. **Sem ocupação dominante, entra o chefe natural do estrato.**

| Categoria | Mapa                  | Chefe               | Status           |
| --------- | --------------------- | ------------------- | ---------------- |
| Ocupação  | Contaminação Micelial | Bispo               | **implementado** |
| Ocupação  | Cicatriz Aurix        | Diamandis           | **implementado** |
| Estrato   | Galerias de Basalto   | Guardião            | **implementado** |
| Estrato   | Catedral Prismática   | Arquicantor         | **implementado** |
| Estrato   | Aquífero Negro        | Leviatã do Lençol   | **implementado** |
| Estrato   | Fenda Sulfurosa       | Pulmão-Matriz       | **implementado** |
| Estrato   | Fornalha Abissal      | Coração da Fornalha | **implementado** |
| Estrato   | Sumidouros de Sílica  | Devorador Branco    | **implementado** |
| Estrato   | Cripta Glacial        | Rainha da Geada     | **implementado** |
| Estrato   | Estrato Ferrífero     | Magnetarca          | **implementado** |

**A tabela está completa**: os dez chefes conceituais têm corpo, e o fallback no
Guardião — que sustentou a seleção enquanto a lista era parcial — não responde mais
por nenhuma linha. Ele continua no código porque `BossId` é um espaço aberto: um chefe
novo entra na tabela antes de ganhar corpo, e até lá a câmara dele não pode ficar
vazia. O teste _"a tabela está COMPLETA"_ é o que impede o fallback de voltar a
responder em silêncio.

### Um chefe por run

- **Setor 1 nunca tem chefe** — é onde a run ensina. E o poço dele **sempre revela
  pelo menos um Eco**, mesmo sem ressonância acumulada (fallback determinístico pela
  seed): um poço calado na primeira descida ensinaria que o poço não oferece nada.
- **Setores do meio não têm chefe obrigatório** — três chefes fragmentariam toda
  descida. A identidade deles é a fauna de assinatura.
- **O chefe final é escolhido pelo mapa final da linhagem.** A linhagem hídrica
  termina em Aquífero + Matriz Micelial → Bispo; as intrusões sorteadas (um setor
  final `none` pode ganhar ocupação micelial) também trazem o Bispo.
- A câmara de chefe continua carimbada pelo worldgen em todo setor (moldura por
  estrato incluída); só o setor final a ocupa.
- `bossesDown` continua por setor: chefe abatido não repovoa.
- O bolso micelial do Bispo poupa o anel do pedestal (`PEDESTAL_KEEPOUT`): o fosso
  de água/brasa do objetivo é funcional e é mais antigo que a colônia — exceto o 3x3
  do próprio chefe, que nasce sempre sobre tapete.

### Por que o micélio é uma ocupação forte

A regra de seleção não é só arrumação de tabela: a lore do Bispo (§2 de
`voxelyn-survival-bosses.md`) a torna **necessária**. Ele era o órgão que fechava as
feridas do Veio; o micélio fora de controle é a cicatrização dele falhando contra a
escala industrial da Aurix. Um mapa profundamente ocupado pelo micélio não é um mapa
onde o Bispo por acaso mora — é o **rastro do colapso dele**, e por isso ele é o dono
daquele encontro em qualquer estrato. O antigo "chefe obrigatório do setor 2" invertia
a causalidade: plantava o fungo para justificar o chefe, em vez de deixar o chefe
explicar o fungo.

## Bispo — Supernova como resposta primária

Ver `docs/bosses/voxelyn-survival-bosses.md` (atualizado, §2 lore e §3 mecânica).
Resumo do que mudou:

- **Saiu do ramo genérico de gosma.** O Bispo não compartilha mais o cuspe do
  Spitter — um chefe do chão responde com o chão.
- **Supernova em luta normal**: jogador dentro do raio + recarga pronta (300 ticks)
  → telégrafo radial de 1,5 s. Dano 360°, fungo replantado **somente no release**.
- **Gatilho ferido corrigido**: era "nenhum fungo detectável em 14 tiles", e uma
  célula isolada atrás de uma parede bloqueava o ataque para sempre. Agora: ferido e
  fora do fungo ele recua; se não **pisa** em fungo dentro de
  `BISHOP_NOVA_SEEK_TICKS` (4 s), a Supernova sai.
- Segundo ataque temático futuro (candidato): **Erupção Litúrgica** — o cajado marca
  três células fúngicas próximas ao jogador e, após um windup curto, raízes explodem
  nesses pontos. Continua sendo um chefe do chão, não um Spitter gigante.

## Guardião — Salva Litoclasta (pedras, não gosma)

O release do ranged dele criava um projétil `spit` com biofluido — visual e
mecanicamente, o chefe das Galerias de Basalto estava cuspindo. Agora:

- **Leque de três pedras**: central com interceptação da posição prevista (sem
  homing, como a pedra do Britador), laterais com ±`GUARDIAN_FAN_SPREAD` (~22°).
  Três corredores legíveis.
- `kind: 'rock'`, **sem biofluido**, **sem stun** (o stun de pedra virou flag
  `stuns` do projétil e é exclusivo do arremesso único do Britador — três pedras
  encadeando atordoamento seria stun-lock).
- Velocidade **6** (< 7 do cuspe), hitbox visível (raio 0,42), colide com parede
  sólida e quebra frágil pela classe cinética que já existe.
- **Segunda fase (< 50% de vida)**: alterna leque (negar espaço) com **rajada** de
  três pedras em sequência (`GUARDIAN_VOLLEY_INTERVAL_TICKS`), com correção de mira
  entre disparos (perseguir movimento). A rajada re-arma o release da própria ação,
  então os relógios hasheados acompanham sozinhos.
- Tudo o mais fica: atravessar/destruir paredes, investida, cerco da arena,
  invocação, guarda do Núcleo.

## `BossRuntime` — o estado do encontro

Os seis campos `guardian*` do topo do estado (`guardianAwake`, `guardianSummoned`,
`guardianPath`, `guardianPathAt`, `arenaClosed`, `arenaBarrierCells`) viraram um
objeto só, `state.bossRuntime`:

```ts
type BossRuntime = {
  awake: boolean;
  phasesFired: number; // bitmask; BOSS_PHASE_SUMMON é a matilha do Guardião
  path: number[]; // derivado: não entra no hash nem no snapshot
  pathAt: number;
  arenaClosed: boolean;
  arenaBarrierCells: number[];
};
```

Três decisões dentro disso:

- **Um objeto, não um por chefe.** A run tem UM encontro de chefe (o setor final).
  No dia em que tiver dois, isto vira um mapa por `entityId` e todo consumidor já lê
  de um lugar só — em vez de seis campos globais para desembaraçar.
- **`phasesFired` é bitmask, não um booleano por fase.** O Guardião tem uma fase de
  uma vez (a matilha); o Diamandis terá o colapso do reator. Cada chefe novo somaria
  mais um campo ao estado autoritativo, que é hasheado e reenviado a cada resync.
- **`emptyBossRuntime()` é fábrica, não literal compartilhado.** `path` e
  `arenaBarrierCells` são mutáveis: um objeto congelado no módulo faria a descida
  herdar a rota do setor anterior e, pior, duas salas de co-op escreverem no mesmo
  array.

No wire, `WorldFlags.guardianAwake` virou `bossAwake` e o evento `guardian_awake`
virou `boss_awake` — os dois nomes mentiam sobre metade das runs desde
`bossForBiome`. `PROTOCOL_VERSION` 15, `SIMULATION_VERSION` 24. (A _voz_ de áudio
continua se chamando `guardianAwake`: ela é o nome de um som, não de um chefe.)

## Diamandis — a máquina que parou de executar a tarefa

O chefe da ocupação Aurix. A regra que rege as três armas: **nenhuma é militar**. São
ferramentas industriais aplicadas com indiferença — e é isso que separa o encontro de
"um robô grande atira em você". O Diamandis não está lutando, está **trabalhando**, e
o jogador está no caminho da obra.

**Corpo.** 880 de vida, velocidade 1,5, raio **0,9**. Visualmente ele é dez vezes um
Prospector; mecanicamente uma hitbox gigante transformaria toda parede em gaiola e
todo tiro em acerto garantido — o tamanho mora no sprite e no estrago, nunca no raio.
Ele entra em `crushesWalls` (abre caminho) e em `isStoneEnemy` (corrente machuca, não
paralisa: chefe paralisável é chefe que morre num stun-lock).

**As três faixas, sem sobreposição** — e a ordem de leitura da IA é a mesma:

| Distância | Ferramenta              | O que ela faz                                                                  |
| --------- | ----------------------- | ------------------------------------------------------------------------------ |
| 9–20      | **Broca de avanço**     | fixa o rumo, 1,8 s parado, atravessa a arena abrindo um corredor de 3 células  |
| 4–13      | **Salva de demolição**  | 3 cargas marcadas no chão no início do telégrafo, implodem onde foram marcadas |
| ≤ 16      | **Feixe de prospecção** | varre a linha inofensivo por 2 s, depois a mesma linha com potência            |

A primeira versão tinha a broca começando em 5 e a demolição cobrindo 0–13: como a
broca é checada primeiro, ela vencia em toda distância útil e a salva **nunca saía**.
Faixa que só existe no comentário não é faixa.

**A broca é a única ação telegrafada do jogo que não exige linha de visão.** Exigir
anularia a mecânica: o Corcel precisa de visada porque a investida dele se perde numa
parede, e a do Diamandis a _come_. Ela existe justamente para a cobertura deixar de
valer. O que a mantém justa é o 1,8 s parado antes de sair — e, ao contrário do
Corcel, **bater na pedra não encerra a ação**: a pedra é que acaba.

Quem decide o que cai é `canRip`, a mesma regra do Britador: rocha e frágil vão,
**minério e cristal ficam de pé**. A passagem dele expõe veio que estava emparedado —
o estrago do chefe vira a mina do jogador, e a sala fica permanentemente alterada.

**A salva não persegue.** As marcas nascem sobre a posição do alvo no instante do
telégrafo e congelam ali (`bossRuntime.blastCells`, hasheado). Sair do círculo é a
resposta inteira do golpe, e ela só existe porque o círculo fica onde nasceu. As
laterais abrem **perpendicularmente**, não para trás: recuar em linha reta já é o
reflexo de todo mundo, e um golpe que só pune o reflexo não ensina nada.

**O feixe é duas metades.** `beam_line` carrega `powered` para o cliente distinguir a
varredura (inofensiva) da passagem com potência — sem o campo, as duas seriam
desenhadas iguais e a única informação que importa ("agora queima") não chegaria. Com
potência ele aplica a tabela de materiais que já existe: `igniteCell` seca fungo e
acende gás, `meltIce` derrete, o minério energiza pelas aberturas coladas nele.
Nenhuma reação nova — o feixe é mais um cliente do sistema, como o rastro do Corcel.
Para na primeira parede nos dois modos: um levantamento que atravessa rocha não é um
levantamento, e um feixe que queima do outro lado do muro é dano sem sinal.

**Colapso do reator (< 50%)**, uma vez, via `BOSS_PHASE_REACTOR`:

- o reator **vaza**: um _anel_ de brasa nasce em volta dele (anel e não disco — o
  centro fica pisável para a luta não virar "fique longe e espere"), e ele continua
  deixando brasa sob os rastos enquanto perfura;
- um sistema **desliga**: o feixe morre — é o primeiro a cair quando a alimentação
  entra em colapso, e é o que faz a segunda fase ser _outra luta_ em vez da mesma com
  números piores;
- os outros **operam acima do limite**: broca e demolição recarregam a 65%.

"Cadência irregular por sorteio" seria dano sem sinal, que é o que o jogo proíbe.
Cadência maior com uma arma a menos é a mesma sensação, legível e ensinável.

**Ele guarda o Núcleo.** `guardsTheCore` (Guardião + Diamandis) dorme até ser notado
e, acordado, nunca mais perde o alvo: os dois têm golpes de alcance maior que o
próprio aggro, e sem isso ficavam mirando de um raio em que nunca decidiam nada.

### Documentos do Diamandis

| Gatilho                           | Documento                                                                                                                                         | ID           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Primeiro abate                    | Propaganda: _"Uma máquina. Quatrocentas funções. Nenhum trabalhador abaixo da superfície."_                                                       | `AX-PUB-010` |
| **Ver a broca abrir um corredor** | Raio mínimo de operação: o ativo não cabe nos túneis que deveria escavar → _"os túneis serão adaptados ao ativo"_                                 | `AX-ENG-029` |
| Abate **+** ver o corredor        | Incidente 41: ele recebeu o desligamento, **acusou o recebimento**, parou 9 s e continuou — em azimute que não consta de contrato                 | `AX-INC-041` |
| Abate **+** corredor **+** Núcleo | Não classificado: os corredores dele formam arcos **concêntricos** ao redor do sinal. Ele não escavava em direção à fonte — escavava **ao redor** | `AX-UNK-059` |

`DISCOVERY_DIAMANDIS_CORRIDOR` (bit 16) é a única testemunha do jogo que **não** exige
linha de visão, e por um motivo estreito: a parede entre os dois é exatamente a coisa
que está sendo removida, e quem está do outro lado dela é quem mais precisa entender
o que aconteceu.

`AX-UNK-059` fecha com o gancho do Guardião (`AX-UNK-051`): dois sistemas de contenção,
e _um deles nós construímos_. A pergunta que nenhum documento aprovado formula é se o
Diamandis falhou em alcançar o objetivo — ou entendeu antes da companhia que ele não
devia ser alcançado.

### Os Coveiros — a escolha que fecha o encontro

Não são minions do chefe e não estão ajudando o jogador. Continuam executando o
trabalho para o qual foram deixados ali: recolher sucata de equipamento abatido. O
Diamandis só ainda não está abatido.

Cada arma dele mora num **módulo** preso à carcaça. Conforme a vida cai, o módulo
daquela arma **se solta** — em ordem fixa e ensinável (78% → broca, 55% → torre,
30% → scanner), do maior alcance para o menor, então o cerco vai _fechando_: perder
a broca cedo significa que a luta termina de perto, que é onde o corpo dele cobra
caro. Soltar **não** é perder: a arma continua funcionando enquanto ninguém arranca.

Um Coveiro que enxergue um módulo solto **larga o jogador** e vai buscar a peça —
2 s de eletroímã engatando, telegrafados. No arranque o chefe perde aquela arma na
hora, e o Coveiro vira um _carregador_ rumo à saída.

| Você faz                   | A luta                                               | A recompensa                                             |
| -------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| **Deixa trabalhar**        | mais fácil: cada módulo arrancado é uma arma a menos | vai embora com a peça, se você não interceptar           |
| **Mata antes do arranque** | mais longa: o chefe mantém as três armas             | garantida — o módulo continua na carcaça e paga no abate |
| **Mata o carregador**      | já sem aquela arma                                   | recuperada: a peça cai e é sua                           |

O abate paga `DIAMANDIS_MODULE_ORE` (16) por módulo ainda preso. Os dois lados são
legítimos, e é isso que faz disso uma decisão em vez de uma armadilha.

**"Fora de alcance" é uma distância, não uma porta.** O critério óbvio era "saiu do
mapa" e estava errado: o carregador não come minério (recurso do jogador, mesma
regra da broca), então um veio no caminho o encalhava — medido na seed 404, ele
parava em x=85 de um mapa de 96 e ficava ali pelo resto da run. Com uma porta como
critério, _deixar trabalhar_ virava _espere, ele empaca_, e o preço de não
interceptar nunca chegava a ser cobrado. A distância (24 tiles da carcaça) diz a
coisa certa — a peça se perde quando sai da luta — e a borda continua valendo para
quem escapa de verdade.

Quem sai do mapa **não conta como abate**: creditar um kill que o jogador não fez
faria o registro do bestiário dizer que ele resolveu um problema que na verdade
escapou.

Dois Coveiros nunca disputam a mesma peça (`claimableModule` checa quem já engatou):
sem isso, os três de uma galeria ferrífera convergiam todos para o mesmo módulo e
dois ficavam parados em cima do chefe sem nada para fazer.

### Documentos dos Coveiros

| Gatilho                                | Documento                                                                                                                                                                                        | ID           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| **Ver um módulo ser arrancado**        | Não classificado: o procedimento de recolhimento foi escrito para equipamento **abatido**, e não tem passo que verifique se o ativo ainda opera — _"um Prospector é equipamento da mesma frota"_ | `AX-UNK-060` |
| Coveiro abatido **+** ver o arranque   | Aquisições: recuperar o Diamandis custa mais que o programa inteiro → _abandonar o corpo, enviar unidades menores._ O item 3 foi aprovado e nunca cancelado                                      | `AX-PRC-026` |
| Diamandis abatido **+** ver o arranque | Executivo: reclassificação para _"instalação móvel de recuperação economicamente inviável"_ — a máquina em operação vira parte do mapa, por contabilidade                                        | `AX-EXE-048` |

`AX-PRC-026` é de onde os Coveiros vêm, e `AX-UNK-060` é o que eles são. A piada
contábil de `AX-EXE-048` fecha: a reclassificação não o desativa, não o recupera e
não o interrompe — ela apenas o remove do balanço.

### O que fica para a próxima fatia

- O **atlas voxel** do Diamandis. Hoje ele usa o renderizador de fallback, como o
  Bispo e o Corcel usaram antes de ganharem atlas.
- A apresentação dos módulos no cliente: `boss_module` já viaja com os quatro
  estados, mas quem desenha ainda não os distingue.

## Devorador Branco — o chão é que decide

O ciclo é um só e nunca muda: **mergulha**, deixa faixa de sílica solta enquanto anda
por baixo, calcula onde o jogador vai estar, **emerge ali**. Submerso ele absorve 88%
do dano; a janela é o tempo em que fica exposto depois de subir.

Ele **atravessa parede** — é o único corpo do jogo que anda por baixo do sólido — e é
por isso que perseguir não é uma resposta a ele. Nem cobertura é. O que sobra é
decidir **onde ele pode sair**.

**As duas matérias são o encontro inteiro.** `SURF_SILT` (sílica solta) é o rastro
dele: onde passou por baixo, o chão cedeu. Calor sobre ela não acende nada — **funde**,
e o que sobra é `SURF_GLASS`. Sobre vidro ele não emerge.

O rastro dele é ao mesmo tempo o aviso de por onde ele anda **e a matéria-prima do
contra-jogo**. Queimar o caminho dele fecha o chão por onde ele viria. E a emergência
revira mais solo em sílica solta — o estrago dele alimenta a própria resposta.

Três regras que sustentam isso:

- **O vidro não volta a ser areia.** Nem o rastro nem a emergência sobrescrevem
  `SURF_GLASS`: o chefe passando por cima não pode desfazer a decisão do jogador,
  senão o contra-jogo se apaga sozinho a cada ciclo.
- **Emergência negada é emergência perdida.** Se o ponto previsto e tudo num raio de
  6 estiverem vitrificados, ele não sobe — volta a andar por baixo e gasta o ciclo.
  Essa recusa é a recompensa inteira de quem transformou a areia em vidro.
- **Redução, não imunidade** (12%, a mesma escolha da couraça do Escoriáceo). Imune
  ensinaria "guarde a munição e espere", que é a ausência de jogo.

**A mira antecipa** (0,9 s de lead): o alvo parado é o único que ela erra, de
propósito — quem lê o rastro e para de correr em linha reta já está jogando contra
ele.

### A janela deixou de ser uma torre

O ciclo dele termina numa abertura: três arcos mirados em sequência e então ele fica
**meio enterrado na própria cratera** por 7,5 s, imóvel e sem areia absorvendo tiro.
Essa parte não mudou, e não pode mudar — é a única janela de dano do encontro.

O que mudou é o que ele **faz** parado. Ele era uma torre: um alvo inofensivo que não
andava, não cobrava contato e não pedia nada de quem o usava além de munição. A única
decisão do encontro era ter guardado o superaquecimento, e essa decisão acontece
_antes_ da janela, não dentro dela.

Agora a mesma janela é uma **boca**, e enquanto ela dura ele engole o setor para
dentro de si: areia, bicho e jogador. A janela deixou de ser um alvo e virou um
**lugar** — e ficar nele passou a custar.

**A sucção é gradual em dois eixos, e é isso que a separa de uma armadilha.**

- **No tempo.** O alcance cresce de zero até 7,5 tiles ao longo de 4,5 s. O primeiro
  segundo da janela é exatamente o que a janela sempre foi (chegue, encoste,
  descarregue); o segundo terço é o aviso; o terço final é a conta. E como a queda do
  arco é mirada no jogador, a janela **sempre** abre com ele em cima do centro: a
  garganta só passa a cobrar quando o alcance chega ao raio dela, cerca de um segundo
  depois. Esse segundo é o tempo de sair de cima do buraco andando.
- **No espaço.** A força a cada distância é fixa — 0,7 tile/s na borda, 7,6 colado na
  garganta — e cruza a velocidade de caminhada (4,6) a **3,47 tiles do centro**. Essa
  é a _linha do sem-volta_, e o jogo a desenha no chão. Fora dela, andar para longe
  resolve. Dentro dela, andar não basta mais.

Nenhum tick arranca mais que um terço de tile: quem se ignora por completo, parado na
borda, ainda leva **2,85 s** até a garganta. Esse tempo é o espaço onde a perícia
cabe.

**As três saídas, e nenhuma é automática:**

| Saída        | Como funciona                                                       | Quando serve                                      |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------------- |
| **Andar**    | A sucção é menor que a caminhada fora da linha do sem-volta         | Do disco inteiro até 3,47 tiles                   |
| **Esquivar** | 2,2 tiles em 0,2 s contra ~1,2 de sucção — devolve o corpo à linha  | Dentro dela, gastando o recurso                   |
| **Vidro**    | Sobre `SURF_GLASS` a sucção cai a 45% e **nunca** vence a caminhada | De qualquer ponto — mas o vidro tem de já existir |

**A garganta é uma regra, não um risco.** Chegar ao centro custa 200 — o dobro da vida
cheia do Prospector. Nenhuma cura e nenhum módulo salvam quem chega lá, e é deliberado:
se fosse um número calculável, o jogador otimizado descobriria que atravessar a boca é
mais barato que reposicionar, e a mecânica viraria um dano a mais. Vale igual para a
fauna — quem arrasta um bando para dentro do raio resolve dois problemas de uma vez, e
essa jogada só existe porque a sucção não pergunta de quem é o corpo.

**O vórtice de areia é o desenho do raio.** A boca engole toda a sílica solta que o
alcance cobre: `SURF_SILT` dentro do disco vira chão limpo, tick a tick. A borda entre
areia e chão limpo diz — sem HUD e sem número — até onde a sucção chega naquele
instante, e como o alcance cresce com o tempo, **a borda que avança pelo chão é o
cronômetro**. Ela toca os pés do jogador no mesmo tick em que a sucção o alcança.

E ela come de verdade: sílica engolida não vitrifica mais. Essa é a pressão que impede
o contra-jogo de ser adiado de graça — quem guardou o rastro do verme "para depois"
descobre que depois ele foi comido. O **vidro não é tocado**, pela regra de sempre.

**A pose é a promessa.** Enquanto a boca está aberta, o atlas troca a silhueta:
uma **cratera dentada rente ao chão** — cinco abas de mandíbula descascadas para fora
e deitadas na areia, carne exposta por baixo delas, um anel de dentes curtos e
desiguais e um vão escuro que afunda. Ela já foi um tronco **erguido**, e a projeção é
que derrubou aquela versão: vista de cima em 2:1, um voxel de altura sobe 4px na tela
e um de raio sobe 2px, então a arcada alta que devia emoldurar o buraco tapava o
buraco inteiro. Boca vista de cima lê por **área de abertura**, não por altura.

E ela **espasma**: seis quadros a 11 fps, com cada aba, cada dente e cada fio de
tecido lendo o quadro pelo seu próprio relógio. A dilatação global não é senoidal — é
uma tabela que pula (1,00 → 0,80 → 1,18 → 0,90 → 1,24 → 0,86). Senoide daria um
pulmão, e pulmão é calmo; isto precisa parecer engasgo.

**A mesma matéria, agora com três alavancas.** Calor sobre sílica solta já negava a
emergência (ele não sobe por vidro) e já esticava o arco (ele não decola de vidro);
agora também dá chão onde a boca não tem o que agarrar. Uma decisão, três pagamentos —
e nenhum deles entregue de graça, porque durante a janela a boca come a areia que
produziria o vidro.

### A linhagem árida mudou de destino

`arid` era `basalto → sílica → fornalha`, e isso tinha uma consequência que só
apareceu quando o Devorador ganhou corpo: **o estrato sedimentar nunca era o último**,
e como só o setor final tem chefe, o dono dos Sumidouros não podia existir. Um chefe
que não spawna não está implementado.

Agora é `basalto → sílica → sílica`, como as outras três linhagens que dobram o seu
estrato no fim (mineral, industrial, crio). Perde-se o segundo acesso à Fornalha (a
térmica mantém o dela); ganha-se o encontro que o estrato sempre prometeu. O terreno
semeado de toda run árida muda — daí o bump e a impressão digital nova em
`tests/impressao-digital-geracao.test.ts`.

### Uma correção de renderização que veio junto

Superfície sem tile no atlas caía em `SURFACE_KIND_INDEX[surf] ?? 0` — o tile de
**chão limpo** — e `draw` devolve `true`, então a cor de recuo nunca rodava. Qualquer
matéria nova ficava literalmente **invisível**, que é o pior defeito possível num jogo
em que o chão é a mecânica. Agora um índice ausente cai na cor, como o comentário do
`SURFACE_FALLBACK` sempre prometeu.

### Documentos do Devorador

| Gatilho                     | Documento                                                                                                                                                                                  | ID           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Primeiro abate              | Levantamento de massa: 400–600 t contra um estrato inteiro três ordens de grandeza abaixo. _"Engenharia registra que a conta não fecha"_                                                   | `AX-ENG-030` |
| **Vitrificar sílica solta** | Incidente 42: em 61 emergências, nenhuma sobre vidro. _"A superfície que ele deixa ao passar é a mesma que ele precisa para voltar"_                                                       | `AX-INC-042` |
| Abate **+** vitrificar      | Não classificado: ele não atravessa a sílica — **a sílica assume temporariamente a forma dele**. Não estamos matando um organismo, estamos interrompendo um padrão de movimento do estrato | `AX-UNK-061` |

`DISCOVERY_SILICA_VITRIFIED` exige ter **feito**, não ter entendido — a compreensão vem
depois, de ver o verme falhar em subir ali.

## Os seis chefes de estrato

A regra que rege os seis: **nenhum inventa sistema novo**. Cada um opera, em escala de
chefe, a alavanca que a própria geologia já tem. É a mesma regra do bestiário de
assinatura, e vale ainda mais aqui — um chefe que trouxesse mecânica própria seria um
chefe que poderia estar em qualquer mapa.

| Chefe                   | Estrato             | A alavanca                                                                        | O contra-jogo                                                                                      |
| ----------------------- | ------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Arquicantor**         | Catedral Prismática | rege: quatro Ressonantes em órbita cardinal, e todo cristal ao alcance descarrega | romper a órbita para abrir ângulo, **e** esvaziar a sala — a Catedral é a luz e o recurso do setor |
| **Leviatã do Lençol**   | Aquífero Negro      | só anda e só emerge por superfície condutiva                                      | o terreno seco, e eletrificar a água (que fica mortal para você também)                            |
| **Pulmão-Matriz**       | Fenda Sulfurosa     | inspira o gás da câmara, expele em outra direção                                  | **incendiar a expiração** — a única janela de dano que o jogador abre                              |
| **Coração da Fornalha** | Fornalha Abissal    | ciclo térmico; setores da arena acendem em sequência                              | estar no lugar certo quando ele esfria                                                             |
| **Rainha da Geada**     | Cripta Glacial      | a couraça é o gelo em volta; Espectros como extensões                             | derreter o lago — e a água que sobra conduz nos dois sentidos                                      |
| **Magnetarca**          | Estrato Ferrífero   | polaridade alterna: atrai, depois repele                                          | achar a **faixa**, que troca de lado a cada ciclo                                                  |

Notas de desenho que valem registrar:

- **O Arquicantor é o único cuja blindagem é inversa.** Calar a rede o deixa mais
  _frágil_ (`ARCHCANTOR_SILENT_ARMOR` > 1), porque a Catedral era a defesa dele. Nos
  outros a couraça é o bioma intacto; nele, o bioma intacto é a arma. Desde o **Coro
  Cardinal**, a rede tem duas metades — o cristal da nave e as vozes em órbita — e a
  blindagem só abre quando as duas caem. Antes, um mapa pobre de cristal entregava um
  chefe desarmado de graça, sem o jogador entender nada.
- **O Arquicantor rege criaturas, e não só pedra.** Ver §_O Coro Cardinal_ abaixo.
- **Pulmão e Coração são FIXOS** (`speed: 0`). A luta não é contra um corpo, é contra
  a sala — e a ficha de Ativo do Pulmão registra que neutralizá-lo deixou câmaras a
  jusante permanentemente irrespiráveis. Matá-lo não é claramente uma vitória.
- **O Magnetarca não tem posição segura, tem uma faixa.** Atraindo, perto machuca;
  repelindo, longe machuca. O deslocamento usa o passo-a-passo do eletroímã do Coveiro
  — colisão respeitada, sem teleporte — porque a quina no caminho continua sendo o
  contra-jogo geométrico do campo.
- **Os Espectros da Rainha saem do gelo, não dela.** São extensões do estrato, não
  filhotes, e nascem com vida parcial.
- Todas as blindagens vivem no **único funil de dano**, para que nenhum caminho novo
  (fogo, descarga, explosão) as esqueça.

### O Coro Cardinal

O encontro começava **vazio**: um corpo lento no meio da nave cantando para cristais que
a geração tinha (ou não tinha) posto por perto. Com sorte de mapa a Catedral respondia
inteira; sem ela o chefe era um alvo parado que não defendia nem o próprio corpo. E os
Ressonantes do setor — que são a fauna _dele_ — agiam exatamente como agiriam sem ele na
sala.

Ao **acordar**, ele chama quatro Ressonantes de verdade (mesmo arquétipo, mesma vida,
mesma morte, mesmo atlas) e os põe em órbita nas quatro direções cardinais, a
`ARCHCANTOR_CHOIR_RADIUS` (2,5) tiles do corpo:

```
                [N]
                 │
          [O] — ARQUI — [L]
                 │
                [S]
```

**A dança.** A cada `ARCHCANTOR_CHOIR_ROTATE_TICKS` (50 ticks / 2,5 s) os quatro avançam
juntos para o posto seguinte, no sentido horário (N → L → S → O → N). Não é teleporte: o
percurso é um **arco** pela circunferência, porque uma reta de norte a leste é uma corda
que passa a 1,77 do centro — quatro cordas simultâneas leem como quatro bichos se
cruzando no meio, e durante a travessia a formação deixaria de cobrir o corpo. O período
é deliberadamente primo com a recarga do canto (110): dois relógios que só às vezes se
encontram fazem cada canto acontecer com outra configuração do coro.

**Por que eles protegem.** Não há redução de dano envolvida. O corpo do guarda está
_literalmente_ na trajetória do tiro mirado no chefe — e isso é melhor que qualquer
número: perfuração continua valendo, ricochete abre jogada, o ângulo passa a ser uma
decisão, e matar uma voz abre uma janela de tiro **visível**, sem ícone de escudo nenhum.

**O canto vira arpejo — e reverbera.** Na execução, as quatro vozes respondem _uma a uma_
— na ordem da órbita (N, L, S, O), a cada `ARCHCANTOR_CHOIR_ANSWER_STEP_TICKS` (3 ticks).
Os cantos alternam duas geometrias: primeiro a **cruz cardinal**, emitida para fora de cada
guarda; depois o **xis diagonal**, cujo raio nasce no ponto médio entre dois guardas
adjacentes. O halo do telegrafo identifica qual desenho vem a seguir, portanto nenhuma
direção é uma segurança permanente. Cada corredor é uma **faixa parabólica**: nasce com
três células de largura (`_LANCE_HALF_WIDTH` 1) e abre pelo quadrado da distância até sete
na ponta (`_LANCE_MAX_HALF_WIDTH` 3). A janela ainda permite reagir perto do coro, mas fica
bem mais apertada onde seria fácil estacionar e atirar. O alcance euclidiano de doze
(`_LANCE_LENGTH`) põe a ponta dos dois desenhos onde o canto termina, e o halo desenha as
duas bordas curvas com a mesma função do dano. Um compasso depois (`_ECHO_TICKS`, 12) cada corredor
cobra **de novo**, na mesma ordem — a descarga é instantânea, e sem o eco o corredor
recém-piscado era o lugar mais seguro da sala; o desenho só troca **depois** do eco, para a
segunda cobrança nunca sair de uma geometria que ninguém anunciou. Derrubar uma voz apaga
seu braço da cruz e também as duas diagonais que dependiam daquele par. Só depois do arpejo
a rede de cristal continua propagando em camadas, com um halo circular reverberando em cada
cristal alcançado.

**Reforço custa a sala.** Um guarda abatido abre uma vaga, e `ARCHCANTOR_CHOIR_RECRUIT_TICKS`
(80 ticks, 4 s) depois a Catedral responde: o **cristal mais próximo do corpo cristaliza**
num Ressonante novo, que corre para o posto — e o cristal **deixa de existir**. Ele era
luz, recurso e nó da rede do canto; o chefe consome a própria nave para manter o acorde, de
dentro para fora (a camada zero da cadeia primeiro). É assim que repor preserva o progresso
em vez de apagá-lo: uma sala sem cristal não repõe ninguém, e quebrar cristal continua sendo
o contra-jogo — agora pelas duas razões. No último segundo, o cristal escolhido entra num
**brilho de metamorfose** crescente antes de virar corpo; quebrá-lo durante o aviso força a
Catedral a procurar outro cristal. Uma vaga por vez: derrubar os quatro compra
dezesseis segundos de corpo exposto. Um Ressonante _solto_ que entre no raio de atração
(`_ATTRACT_RADIUS`, 8) também ocupa a vaga, sem custar cristal. Todos os Ressonantes têm
afinidade com a rede: a descarga de cristal regida pelo Arquicantor atravessa guardas,
solistas e vozes recém-cristalizadas sem feri-los; jogador e outras criaturas continuam
recebendo o choque normalmente.

**O Solista.** Com os quatro postos ocupados, quem chega é _expulso_ por uma das
diagonais. E com o acorde cheio a Catedral **continua respondendo**: a cada **volta
completa** da dança um cristal cristaliza numa voz que não cabe, e ela é cuspida na diagonal
(teto de `ARCHCANTOR_SOLOIST_CAP`, 2). É o que fecha a saída fácil do encontro: quem
descobriu o lugar seguro contra o desenho da vez ganha um problema que anda exatamente por
ali. Ele deixa de operar a regra da Catedral e passa a se mover como um **bispo de xadrez**:
só diagonal, comprometido com a diagonal escolhida até bater em alguma coisa ou até o
relógio (`_RETARGET_TICKS`) permitir trocar. O compromisso é o bicho inteiro — um solista
que corrigisse o rumo a cada tick seria um perseguidor comum com animação torta, e a
resposta a ele deixaria de ser geométrica. Chegando perto, ele solta uma descarga curta
telegrafada e **recua** por outra diagonal.

**Som.** Cada posição cardinal tem uma nota — fundamental, terça _menor_, quinta e nona —,
e a nota sai da **posição**, não de quem está nela. É isso que faz um coro incompleto soar
incompleto: a voz que falta simplesmente não emite, e o buraco no acorde é o buraco na
órbita. A dança confirma o movimento com um arpejo curtíssimo; o solista usa o mesmo
material sonoro _errado_ (trítono, ritmo quebrado). Quando a última fonte cai, entra o cue
de silêncio que já existia.

**Estado.** Quatro campos em `BossRuntime` (`choir`, `choirRotation`, `choirRotateAt`,
`choirRecruitAt`) e um papel na entidade (`RESONANT_WILD` / `RESONANT_CHOIR` /
`RESONANT_SOLOIST`, em `mood`) — todos no hash autoritativo, o papel inclusive, porque ele
decide o próximo tick de qualquer inimigo com postura. A posição desejada é **derivada** —
corpo + raio + assento + rotação — e não sincronizada: guardar quatro coordenadas seria
guardar números que já se sabem calcular, com quatro formas novas de discordar deles.
Assumir um papel **cancela a ação em voo** (com `action_end`): um Ressonante promovido no
meio do próprio pulso não pode soltá-lo como guarda. Matar o regente **dissolve a
regência**, não o coro: os guardas voltam a ser Ressonantes soltos.

### Os arcos de entendimento

Cada um dos seis entrou com a **ficha de Ativo** (a classificação corporativa, aberta
no primeiro abate). O miolo do arco abre por uma **Descoberta** que marca o instante
em que o jogador entende a alavanca — nunca por repetição: um chefe aparece no máximo
uma vez por run, e uma grade de abates transformaria a revelação em farm.

| Chefe               | A Descoberta exige                                         | Incidente    | Não classificado (abate + Descoberta)                                                                |
| ------------------- | ---------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| Arquicantor         | bater nele com a **Catedral em silêncio**                  | `AX-INC-043` | `AX-UNK-062` — alguns cristais respondem _antes_ do pulso; ele não emite o sinal, **rege**           |
| Leviatã             | **atordoá-lo** eletrificando a lâmina                      | `AX-INC-044` | `AX-UNK-063` — as sete medições não discordam: cada uma mediu uma parte, ao mesmo tempo              |
| Pulmão-Matriz       | **acender a expiração** e queimar a coluna de volta        | `AX-INC-045` | `AX-UNK-064` — nos setores em que ele caiu, a ventilação nunca voltou                                |
| Coração da Fornalha | acertar na **janela fria**                                 | `AX-INC-046` | `AX-UNK-065` — o magma não aquece a formação; a emissão aquece o magma                               |
| Rainha da Geada     | **derreter o lago** e bater sem a couraça                  | `AX-INC-047` | `AX-UNK-066` — ela não reproduz uma pessoa, reproduz um organograma                                  |
| Magnetarca          | ficar na **faixa** (dentro do campo, fora das duas bordas) | `AX-INC-048` | `AX-UNK-067` — o campo antecede a mina; a operação foi construída sobre um cabo que ela não instalou |

Duas notas de implementação:

- **Cinco das seis marcam no funil de dano ou no golpe**, no instante em que se sabe
  que o dano entrou inteiro (ou que a alavanca cobrou). A do Magnetarca é a única que
  marca uma **ausência** de dano — porque ali o entendimento é exatamente não ter sido
  cobrado.
- A do Leviatã mora nos **três** caminhos de atordoamento por descarga (`run.ts`), e
  não num deles: o contra-jogo é "eletrificar a água", não "eletrificar a água com
  aquele módulo específico".

### A linhagem basáltica

Com a tabela completa apareceu o mesmo problema que a linhagem árida já tinha tido,
agora com o chefe original do jogo: **o Guardião é o dono das Galerias de Basalto, e o
basalto era o setor 1 de todas as linhagens e o final de nenhuma.** Ele tinha deixado
de poder existir.

Entrou `basaltic`: basalto do topo ao fundo, o mapa histórico como linhagem inteira. E
ela não é monótona por ser um estrato só — as intrusões de ocupação continuam
sorteando micélio e Aurix nos setores 2 e 3, então ela termina no **Guardião, no Bispo
ou no Diamandis** conforme o que tomou conta do fundo. É a única linhagem em que os
chefes de ocupação e o de estrato disputam a mesma câmara.

Custo: uma linhagem a mais remapeia **toda seed** (o sorteio é `% LINEAGE_ORDER.length`).

### O objetivo não encosta mais na moldura

`bfsFarthest` procura o ponto mais distante da entrada, e o mais distante costuma ser
um canto — então o pedestal caía a uma célula da borda com alguma frequência. Duas
promessas quebravam ali: o **3x3 livre** em volta do objetivo (onde o corpo do chefe
tem de caber — o Coração da Fornalha tem raio 1,0) e o **anel do pedestal**, que
carrega o sotaque do estrato e é funcional.

`CORE_BORDER_MARGIN = 2` recusa a tentativa, e a geração tenta outra seed derivada. O
número é um teto e não um desejo: tentei 4 primeiro, para o anel de raio 3 também caber
sempre, e a maioria das tentativas passou a ser recusada — a geração inteira desabou.

## Ordem recomendada de desenvolvimento (restante)

1. ~~Gatilho da Supernova + remover cuspe do Bispo~~ ✔
2. ~~Salva Litoclasta do Guardião~~ ✔
3. ~~`bossForBiome()` sem dependência de setor~~ ✔
4. ~~Generalizar o estado específico do Guardião num `bossRuntime`~~ ✔
5. ~~**Diamandis** (Cicatriz Aurix) — broca, demolição, feixe, colapso do reator e a
   economia dos Coveiros~~ ✔
6. ~~**Devorador Branco** (Sumidouros de Sílica)~~ ✔ e ~~os seis chefes de estrato
   restantes~~ ✔
7. Documentos de chefe desbloqueados por **entendimento do encontro** (primeiro
   encontro → classificação corporativa; presenciar o golpe principal → relatório
   técnico; primeira derrota → incidente; condição especial → ordem executiva;
   descoberta composta → não classificado), junto de cada chefe — não numa etapa
   posterior.
