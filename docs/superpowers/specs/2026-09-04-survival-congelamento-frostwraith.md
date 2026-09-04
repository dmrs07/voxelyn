# Voxelyn Survival — o congelamento do Prospector e o Espectro de Geada

**Versões**: `SIMULATION_VERSION` 58 · `PROTOCOL_VERSION` 31 · `CONTENT_VERSION`
33 (atlas `enemy-frost-wraith` v3, num quadro de 96 px).

Parte da base do PR #199 (Nova a cada 14 s, coroa de estilhaços, som de gelo
quebrado e sinos, sem o pulso genérico, `ice_mend` calado no tick da Nova) e
acrescenta três coisas: um **sistema autoritativo de acúmulo de frio** por
jogador, o **congelamento corporal total** ("frostbite") que só o gatilho da
própria arma desfaz, e o **redesenho do Espectro de Geada** como entidade de
névoa que se condensa num elemental cristalino.

## 1. O conceito

A Nova da Rainha e o bote do Espectro não machucam de frio: **acumulam** num
medidor contínuo do Prospector. Enquanto o medidor não está cheio, o gelo se
espalha pelo equipamento e pelo corpo, e ainda é possível agir; o frio parcial
decai devagar sozinho. Cheio, o corpo inteiro congela: nada anda, nada gira,
nada dispara. O único input de gameplay aceito é o **gatilho**, e o que ele faz
ali não é atirar — é forçar o motor da arma por baixo da crosta, em ciclos
térmicos de cadência fixa que geram calor de verdade e derretem o gelo com
esse calor novo. Derretida uma camada, a crosta se parte e o Prospector se
liberta por inteiro.

## 2. Estado autoritativo (`frost.ts`)

Quatro campos em `PlayerExtra`, todos no **hash**, no **viewer** (`freeze`,
`frostbitten`), no **snapshot** de cada player (os mesmos dois, para o
parceiro ver a geada e a estátua), no replay (comandos + sim determinística) e
no resync (o snapshot completo carrega o `you`):

| Campo | O que é |
| --- | --- |
| `freeze` | o medidor, inteiro 0..`FREEZE_MAX` (1000 = 100%) |
| `frostbitten` | o latch de corpo inteiro |
| `freezeGraceUntil` | até quando o decaimento fica suspenso depois de uma dose |
| `thermalCycleReadyAt` | o próximo tick em que o gatilho pode forçar um ciclo |

Limpos em morte, abatido, revive, reset de slot e troca de setor
(`clearFreeze`). Individual por slot no co-op.

## 3. Tuning

| Constante | Valor | Por quê |
| --- | --- | --- |
| `FREEZE_QUEEN_DOSE` | 450 (45%) | três Novas seguidas a 14 s congelam: `450 − 120 + 450 − 120 + 450 = 1110 ≥ 1000`, com 120 = `(280 − 40) / 2` pontos de decaimento por intervalo |
| `FREEZE_WRAITH_DOSE` | 120 (12%) | um bote não ameaça; uma matilha somada a uma Nova acelera. Elite **não** escala a dose |
| decaimento | 1 ponto a cada 2 ticks (1 pp/s) | lento o bastante para o Espectro seguir perigoso, perceptível no HUD |
| `FREEZE_GRACE_TICKS` | 40 (2 s) | o medidor não parece "já indo embora" logo depois da dose |
| `FREEZE_THAW_LAYER` | 330 (um terço) | a histerese: a crosta só solta depois de uma camada inteira |
| `FREEZE_THERMAL_CYCLE_TICKS` | 4 (5 ciclos/s) | cadência FIXA, igual para bolt, Return Disc e Minigun |
| `FREEZE_THERMAL_CYCLE_HEAT` | 12 | calor real por ciclo, no sistema de calor de sempre |
| `FREEZE_MELT_PER_HEAT` | 5,5 | 12 de calor = 66 de gelo; 5 ciclos = 330 = uma camada em 1,0 s com a arma fria |

Regras que os testes provam:

- a Nova dosa **uma vez por jogador**, no raio real (`FROST_QUEEN_FREEZE_RADIUS`),
  pela mesma liberação que refaz o lago; fora do raio, mortos e abatidos não
  tomam; iframes não barram;
- o bote do Espectro só dosa quando **encosta** (resolvido uma vez por bote,
  `action.landed`); esquivado por iframes ou fora de alcance, nada; contato
  prolongado não vira segunda dose;
- o decaimento é por tick, para em zero, e **nunca liberta o latch**;
- calor guardado antes do congelamento não derrete nada; só calor **novo**;
- superaquecer suspende os ciclos durante o lockout sem perder o que já
  derreteu; entrar frio liberta sem superaquecer (60 de calor gerado, ~23
  dissipados); entrar a 70 trava o cano no quarto ciclo — o risco é deliberado;
- o tick da libertação não dispara; o próximo aperto elegível atira, e o tiro
  de verdade também derrete o gelo residual.

**Achado que veio junto**: o bote dos espreitadores era um impulso de
velocidade sem resolução de contato — o Espectro atravessava o Prospector sem
tocar nele, e o `contactDamage` dele era número morto. `frostWraithLungeStride`
resolve o golpe (dano pelo funil de sempre + dose se entrou). A Lampreia divide
o `lurkerStep` mas **não** recebeu o passo: mudar o balanço dela é outra
decisão, registrada aqui como pendência.

## 4. Frostbite: o que trava

Ao encher: `frostbitten = true`, velocidade e inércia zeradas (mesmo no gelo),
esquiva cancelada, canal do sopro cancelado cobrando o cooldown, canos da
Minigun desacelerando. Depois, a cada tick (`stepFrostbitten`): sem movimento,
rumo, esquiva, interação, habilidade ou tiro. O dano entra normalmente; não há
invulnerabilidade, módulos ficam, não é morte nem abatido. Câmera, cursor e
HUD continuam.

O gatilho é interceptado **antes** de qualquer arma existir: sem bolt, disco
ou bala; sem carga; sem recoil; sem `shotsFired`; sem `shot`; nada enfileirado.
Em vez disso, um ciclo térmico: `heat += 12`, `freeze −= 66`, evento
`thermal_cycle`, `settleOverheat`. Quando `freeze ≤ 1000 − 330`, `frostbite_break`.

## 5. Eventos

`freeze_dose { slot, amount, freeze, source }`, `frostbite { slot }`,
`thermal_cycle { slot, freeze, heat }`, `frostbite_break { slot }`. Para o
Espectro: `lurker_state { archetype, entity, hidden }` (troca de postura pelo
terreno — o bote não passa por aqui, o `action_start` já anuncia) e
`wraith_lunge { entity, dx, dy }` (o impulso). Nenhum decide nada.

## 6. Apresentação

**HUD** (`hud-layout.ts` `freezeRail`, `render.ts`): abaixo dos trilhos de calor
e rotação, um medidor azul-claro **segmentado em três** com um floco na origem;
o terceiro segmento é o mais claro (perigo); cheio, pulsa, ganha um cadeado e a
legenda `hud.freeze.critical`; durante o degelo, fissuras atravessam o último
segmento na proporção do que derreteu enquanto o trilho de calor logo acima
cresce em laranja. Em zero, a fileira recolhe. Instruções localizadas só nas
três primeiras vezes (`frost-hints.ts`): "O frio está se acumulando." e
"MOTORES E CHASSI CONGELADOS — SEGURE DISPARO PARA AQUECER."; a instrução de
segurar repete a cada 3 s enquanto a estátua durar.

**Corpo** (`frost-shell.ts`): um véu frio no sprite que sobe com o medidor;
geada nas extremidades (≥8%), placas sobre arma e pernas (≥38%), cristais
crescendo para o núcleo (≥68%); cheio, a **estátua**: pose de repouso com o
relógio parado, uma concha facetada por cima da silhueta, o núcleo pulsando
laranja e a estátua vibrando a cada ciclo, vapor pelas juntas, fissuras do
motor e da arma. Na quebra, a concha se abre por 220 ms e cacos e vapor saem.
Tudo estado-dirigido: o parceiro remoto mostra o mesmo, com o progresso fino
(pulso) vindo dos eventos que ele também recebe.

**Som**: ver `docs/audio/voxelyn-survival-audio-design.md`.

**Evidência no zoom real** (`docs/media/ice-rework/`): `geada-parcial.png`
(cristais a 95%), `frostbite-estatua.png`, `frostbite-degelo.png` (núcleo
laranja, vapor, calor subindo), `hud-medidor-congelamento.png` (o medidor
travado com cadeado e legenda), `coop-parceiro-congelado.png`,
`espectro-nevoa.png` e `espectro-materializado.png`.

## 7. O Espectro de Geada

**Escondido** (`LURKER_HIDDEN`): sem corpo. Uma névoa baixa e irregular
(`drawFrostMist`): lóbulos difusos deslizando, bordas dissolvendo em voxels,
cristais suspensos, brilho ciano sutil no centro, riscos de condensação atrás
do rumo; o rastro são névoas menores apagando. Larga o bastante para dizer
"algo se move aqui" sem entregar a hitbox. O counterplay territorial fica:
derreter o lago tira a névoa.

**Exposto** (`LURKER_EXPOSED`): o **manawyrm** (`entities.mjs`,
`frostWraithModel`, atlas v3): corpo serpentino curto e arqueado flutuando,
vértebras de gelo escuro com costelas pálidas estreitas e espinhos dorsais,
pescoço com o núcleo ciano saltado da garganta, cabeça cristalina separada com
mandíbula escura, focinho em cunha, chifres para trás e olhos elétricos
saltados; cauda em fragmentos. Animações: `idle` (flutua), `walk` (ondula),
`attack` (recolhe e dispara como lança), `hit` (núcleo pisca uma vez), `die`
(estilhaça), e a nova `special` (materialização de baixo para cima, 4 quadros a
7 fps cobrindo o windup de 12 ticks — o `charge` cai nesse slot). O quadro
subiu de 64 para **96 px** (modelo 1,4× maior) por leitura: no zoom real um
corpo de 64 px com cabeça, chifres, núcleo e cauda virava um borrão de vinte
pixels. Hitbox, alcance e dano não mudaram. A Lampreia não muda.

## 8. Arena (`arena.html`)

Na arena da Rainha, um painel de congelamento com os cenários (medidor vazio,
+1 Nova, +2 Novas, quase cheio, frostbite agora, arma quente, Espectro ao lado,
parceiro a 60%), o decaimento ×10 (só pelo controle) e a leitura exata: valor,
%, latch, taxa de decaimento, última dose, calor, lockout, próximo ciclo,
espectros (e quantos em névoa), parceiro. A opção "co-op de apresentação" põe um
segundo Prospector parado no slot 1. Nada disso é importado por `main.ts`.
