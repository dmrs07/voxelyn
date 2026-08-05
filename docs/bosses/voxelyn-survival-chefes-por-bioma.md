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

| Categoria | Mapa | Chefe | Status |
| --- | --- | --- | --- |
| Ocupação | Contaminação Micelial | Bispo | **implementado** |
| Ocupação | Cicatriz Aurix | Diamandis | **implementado** |
| Estrato | Galerias de Basalto | Guardião | **implementado** |
| Estrato | Catedral Prismática | Arquicantor | fallback → Guardião |
| Estrato | Aquífero Negro | Leviatã do Lençol | fallback → Guardião |
| Estrato | Fenda Sulfurosa | Pulmão-Matriz | fallback → Guardião |
| Estrato | Fornalha Abissal | Coração da Fornalha | fallback → Guardião |
| Estrato | Sumidouros de Sílica | Devorador Branco | fallback → Guardião |
| Estrato | Cripta Glacial | Rainha da Geada | fallback → Guardião |
| Estrato | Estrato Ferrífero | Magnetarca | fallback → Guardião |

A tabela conceitual (`BossId`) é completa desde já; os arquétipos entram um a um em
`IMPLEMENTED_BOSS`, com o Guardião como fallback jogável. Assim seleção, documentos e
codex podem falar do Diamandis antes de o Diamandis lutar.

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
  phasesFired: number;      // bitmask; BOSS_PHASE_SUMMON é a matilha do Guardião
  path: number[];           // derivado: não entra no hash nem no snapshot
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
`bossForBiome`. `PROTOCOL_VERSION` 15, `SIMULATION_VERSION` 24. (A *voz* de áudio
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

| Distância | Ferramenta | O que ela faz |
| --- | --- | --- |
| 9–20 | **Broca de avanço** | fixa o rumo, 1,8 s parado, atravessa a arena abrindo um corredor de 3 células |
| 4–13 | **Salva de demolição** | 3 cargas marcadas no chão no início do telégrafo, implodem onde foram marcadas |
| ≤ 16 | **Feixe de prospecção** | varre a linha inofensivo por 2 s, depois a mesma linha com potência |

A primeira versão tinha a broca começando em 5 e a demolição cobrindo 0–13: como a
broca é checada primeiro, ela vencia em toda distância útil e a salva **nunca saía**.
Faixa que só existe no comentário não é faixa.

**A broca é a única ação telegrafada do jogo que não exige linha de visão.** Exigir
anularia a mecânica: o Corcel precisa de visada porque a investida dele se perde numa
parede, e a do Diamandis a *come*. Ela existe justamente para a cobertura deixar de
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

- o reator **vaza**: um *anel* de brasa nasce em volta dele (anel e não disco — o
  centro fica pisável para a luta não virar "fique longe e espere"), e ele continua
  deixando brasa sob os rastos enquanto perfura;
- um sistema **desliga**: o feixe morre — é o primeiro a cair quando a alimentação
  entra em colapso, e é o que faz a segunda fase ser *outra luta* em vez da mesma com
  números piores;
- os outros **operam acima do limite**: broca e demolição recarregam a 65%.

"Cadência irregular por sorteio" seria dano sem sinal, que é o que o jogo proíbe.
Cadência maior com uma arma a menos é a mesma sensação, legível e ensinável.

**Ele guarda o Núcleo.** `guardsTheCore` (Guardião + Diamandis) dorme até ser notado
e, acordado, nunca mais perde o alvo: os dois têm golpes de alcance maior que o
próprio aggro, e sem isso ficavam mirando de um raio em que nunca decidiam nada.

### Documentos do Diamandis

| Gatilho | Documento | ID |
| --- | --- | --- |
| Primeiro abate | Propaganda: *"Uma máquina. Quatrocentas funções. Nenhum trabalhador abaixo da superfície."* | `AX-PUB-010` |
| **Ver a broca abrir um corredor** | Raio mínimo de operação: o ativo não cabe nos túneis que deveria escavar → *"os túneis serão adaptados ao ativo"* | `AX-ENG-029` |
| Abate **+** ver o corredor | Incidente 41: ele recebeu o desligamento, **acusou o recebimento**, parou 9 s e continuou — em azimute que não consta de contrato | `AX-INC-041` |
| Abate **+** corredor **+** Núcleo | Não classificado: os corredores dele formam arcos **concêntricos** ao redor do sinal. Ele não escavava em direção à fonte — escavava **ao redor** | `AX-UNK-059` |

`DISCOVERY_DIAMANDIS_CORRIDOR` (bit 16) é a única testemunha do jogo que **não** exige
linha de visão, e por um motivo estreito: a parede entre os dois é exatamente a coisa
que está sendo removida, e quem está do outro lado dela é quem mais precisa entender
o que aconteceu.

`AX-UNK-059` fecha com o gancho do Guardião (`AX-UNK-051`): dois sistemas de contenção,
e *um deles nós construímos*. A pergunta que nenhum documento aprovado formula é se o
Diamandis falhou em alcançar o objetivo — ou entendeu antes da companhia que ele não
devia ser alcançado.

### O que fica para a próxima fatia

- **A economia dos Coveiros**: módulos destrutíveis que caem do Diamandis e Coveiros
  que os arrastam para fora do mapa enquanto ele ainda se move — deixar trabalharem
  torna a luta mais fácil e a recompensa menor; destruí-los preserva a sucata e
  prolonga a capacidade ofensiva dele. É a escolha que transforma o encontro de bom
  em memorável, e é um sistema próprio (estado de módulo, IA de arrasto, cache de
  salvage), não um ajuste do chefe.
- Os dois documentos que dependem dela: **Aquisições** (custo de recuperação — é de
  onde os Coveiros vêm) e **Executivo** (reclassificação: "instalação móvel de
  recuperação economicamente inviável").
- O **atlas voxel** do Diamandis. Hoje ele usa o renderizador de fallback, como o
  Bispo e o Corcel usaram antes de ganharem atlas.

## Ordem recomendada de desenvolvimento (restante)

1. ~~Gatilho da Supernova + remover cuspe do Bispo~~ ✔
2. ~~Salva Litoclasta do Guardião~~ ✔
3. ~~`bossForBiome()` sem dependência de setor~~ ✔
4. ~~Generalizar o estado específico do Guardião num `bossRuntime`~~ ✔
5. ~~**Diamandis** (Cicatriz Aurix) — broca, demolição, feixe, colapso do reator~~ ✔
   (a economia dos Coveiros — módulos destrutíveis e sucata arrastada — fica para a
   fatia seguinte; ver abaixo)
6. **Devorador Branco** (Sumidouros de Sílica) — linha de vibração, emergir por
   baixo, vitrificar o chão como contra-jogo.
7. Documentos de chefe desbloqueados por **entendimento do encontro** (primeiro
   encontro → classificação corporativa; presenciar o golpe principal → relatório
   técnico; primeira derrota → incidente; condição especial → ordem executiva;
   descoberta composta → não classificado), junto de cada chefe — não numa etapa
   posterior.
