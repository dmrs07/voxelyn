# Voxelyn Survival — o encontro cobra pelo time (escala de co-op)

**Versões**: `SIMULATION_VERSION` 78 · `PROTOCOL_VERSION` inalterado · `CONTENT_VERSION` inalterado

Com dois Prospectores em jogo, o setor deixa de ser o setor de um. Densidade,
vida, elites e toda leva fechada passam a ser calculadas contra o **tamanho do
time**; dano, loot e o terreno da seed continuam exatamente onde estavam.

## 1. O problema

A sala de dois nascia de graça. `playerCount: 2` dobrava os canos, a vida do
time, o alcance de visão e — o que mais pesa — a margem de erro: quem cai fica
**abatido** e volta de pé pelas mãos do parceiro, enquanto o solo paga
permadeath por um passo em falso. O setor, do outro lado, continuava o mesmo:
vinte e dois corpos com a vida de tabela, um elite no meio da lista, ondas de
contaminação do tamanho de sempre, chefe com a vida de sempre.

Um encontro desenhado para um Prospector e resolvido por dois não é o mesmo
encontro — é o mesmo encontro pela metade.

## 2. A régua

Tudo vive em `packages/voxelyn-survival-sim/src/coop.ts`, expresso **por jogador
extra** e nunca como um `if` de co-op: o dia em que `MAX_PLAYERS` passar de dois
não pode ser o dia em que alguém descobre que a escala estava escondida em cinco
arquivos.

| Alavanca                | Por jogador extra | Em dupla       | Onde                                |
| ----------------------- | ----------------- | -------------- | ----------------------------------- |
| Vida do bestiário comum | +55%              | 1,55x          | `spawnEnemy` (entities.ts)          |
| Vida de **chefe**       | +75%              | 1,75x          | `spawnEnemy`, via `isBossArchetype` |
| Densidade do setor      | +45%              | 22 → 32 corpos | `populateSector` (sectors.ts)       |
| Elites por setor        | +1                | 2              | `populateSector`                    |
| Levas fechadas          | +50%              | 2→3, 3→5, 4→6  | `coopPack` nos chamadores abaixo    |

**Levas fechadas** são os momentos em que o jogo cospe um grupo de uma vez:
onda de contaminação (`run.ts`), alarme do terminal de salvamento (`run.ts`),
bando da assinatura do estrato (`sectors.ts`), cerco invocado pelo Guardião,
ninhada de escórias do Coração da Fornalha, equipe de sucata do Diamandis,
Espectros da Rainha da Geada (`entities.ts`) e o teto da ninhada da Cerzideira
(`seamstress.ts`).

O chefe engorda mais que a fauna porque é o único alvo em que os dois canos
convergem o tempo inteiro: não há aggro para dividir nem corredor onde se
perder. Com a escala da fauna, as arenas autorais (as fases do Bispo, a escada
térmica da Fornalha, os módulos do Diamandis) seriam atravessadas antes de virar
o que elas são.

## 3. O que NÃO escala, de propósito

- **Dano.** Os padrões do bestiário foram afinados contra um corpo com a vida do
  Prospector; engordá-los transformaria golpes legíveis em one-shots — que o
  parceiro não tem como responder, só recolher. A pressão extra vem de mais
  bocas, não de bocas maiores.
- **Loot e caches.** São da sala e já se dividem entre dois. Multiplicar a
  recompensa junto com a ameaça anularia as duas pontas.
- **O terreno.** O worldgen entrega vinte e dois pontos de spawn e não pode
  entregar mais: a escolha deles consome `rng` no meio da geração, e pedir trinta
  e dois deslocaria toda tirada seguinte (suturas, veios, trilhos). A mesma seed
  precisa gerar o **mesmo mapa** com um ou dois jogadores — o cliente regenera o
  mundo localmente a partir da seed e desenharia outro setor. As vagas extras
  nascem depois do terreno pronto, por varredura em anel determinística
  (`derivedSpawnPoint`), sem RNG nenhuma.
- **Fauna passiva.** Mineradores e aranhinhas não são a pressão do encontro.
- **Ninhada do Devorador Branco.** Catorze filhotes já são o encontro; escalá-los
  estouraria `MAX_ENEMIES` num setor de dupla. A vida deles escala, a contagem
  não.

## 4. Quem é "o time"

`partySize()` lê `joined` — os slots **efetivamente em jogo** —, nunca
`config.playerCount`. A diferença importa nos dois sentidos: quem entra primeiro
e joga esperando o parceiro não pode receber a conta de dois; quem entra no meio
da descida não pode continuar pagando a conta de um.

Isso impõe uma **ordem** ao servidor. `GameRoom` cria a run com todos os assentos
da sala e só depois decide quem entrou — e o setor de abertura já foi povoado
nesse intervalo. Por isso `RunConfig.claimedSlots` existe: a sala passa `0`, a
população do primeiro setor lê um time de um, e a sala que ficar a run inteira
com um jogador só nunca paga a conta de dois. O campo descreve o instante da
criação e por isso **não** entra em `state.config`, que é a configuração
congelada da run — guardá-lo lá o deixaria envelhecer em silêncio.

Como toda escala é aplicada **no instante do spawn**, o setor já povoado não muda
debaixo do jogador: a mudança vale para a próxima onda, o próximo alarme, o
próximo setor. É função pura do estado, como tudo em `depth.ts` — o servidor
autoritativo e qualquer re-simulação chegam ao mesmo número no mesmo tick.

## 4.1 O teto do setor

`MAX_ENEMIES` é teto de **setor**, não de corpos vivos: `state.enemies` guarda os
cadáveres também e só é zerado na descida. Todo outro spawn do jogo já para
quando ele enche; as levas escaladas não paravam, e a densidade de dupla
transformou isso num estouro real — seed 2, setor 3: 46 corpos na população, 52
depois de um alarme de tier 3, 55 depois da primeira onda. `coopPackCapped`
recorta a leva pelo que ainda cabe.

O solo passa reto por essa guarda, com a leva de sempre: com 26 corpos num setor
de 48 ele praticamente não encosta no teto, a versão anterior nunca checou nada
ali, e recusar um corpo que ela spawnava mudaria o setor de quem joga sozinho.

Um encontro pode ainda assim passar do teto — a **formação de abertura do
Arquicantor** é garantida por desenho e nasce sem consultar orçamento nenhum.
Isso é anterior a esta escala e continua valendo; o que a escala garante é que
nenhuma leva **dela** empurra o setor para além do teto.

## 5. Garantias

- **Solo é byte-idêntico.** Nenhuma tirada de `rng` mudou de ordem: `coopDensity`,
  `coopPack` e `coopEnemyHp` são identidade com um jogador, o anel do alarme do
  terminal continua sendo o prefixo de seis casas, e o teto de tentativas da onda
  de contaminação só cresce junto com a leva. Verificado por hash autoritativo
  contra a `SIMULATION_VERSION` 77 em 400 ticks roteirizados de seis seeds e na
  população de 120 setores (40 seeds x 3 setores).
- **Nada nasce empilhado por causa da escala.** Em co-op a reserva de células é
  **uma só**: vaga derivada, casa do bando da assinatura e pouso do Costureiro
  realocado pela Cerzideira disputam o mesmo chão e nenhum deles escolhe uma
  célula que já tem dono. Medido em 420 setores (140 seeds x 3): **nenhum** setor
  de dupla empilha mais corpos que o mesmo setor no solo. O empilhamento que
  sobra é o do solo — mais velho que esta escala, e corrigi-lo moveria corpos de
  quem joga sozinho.
- **`MAX_ENEMIES` continua sendo teto**, compartilhado com mineradores, ninhadas
  e ondas — ver §4.1.
- **Hashes de co-op da 77 deixam de bater** — daí o bump de `SIMULATION_VERSION`.

Testes: `packages/voxelyn-survival-sim/tests/escala-coop.test.ts` e
`packages/voxelyn-survival-server/tests/escala-de-encontro-na-sala.test.ts` (a
ordem entre criar a sala e povoar o setor).
