# Voxelyn Survival — Matriz Geracional Aurix

Data: 2026-08-03
Status: spec de implementação. Nada implementado ainda; o protótipo interativo
que originou este documento define a economia, a árvore, os desfechos de
extração e o feedback de minério no HUD.

> O que retorna é homologado. O que fica no Veio nunca existiu.

## 1. A decisão que rege tudo

O prospector deixa de melhorar apenas **dentro** da run. Ele passa a melhorar
**entre** runs, e a moeda dessa melhoria é exatamente aquilo que a run atual
arrisca perder.

A separação:

| Camada     | O que é                              | Onde vive               |
| ---------- | ------------------------------------ | ----------------------- |
| Temporária | Módulos de salvage, habilidade, purga | A run atual             |
| Permanente | Protocolos da Matriz Geracional       | O perfil entre runs     |

Melhorias temporárias constroem a run atual; melhorias permanentes dão propósito
à próxima tentativa. As duas não competem: uma é escolhida sob pressão com
informação incompleta, a outra é escolhida com calma na superfície.

### 1.1 Política de progressão

A run passa a trabalhar com **carga não homologada**. Nada do que está na mochila
é seu até chegar à plataforma.

| Desfecho                        | Minério permanente   | Núcleo permanente |
| ------------------------------- | -------------------- | ----------------- |
| Morte (`dead`)                  | 0                    | 0                 |
| Abandono (sem `summary`)        | 0                    | 0                 |
| Extração (`extracted`)          | tudo que retornou    | 0                 |
| Extração com núcleo (`extracted_with_core`) | tudo que retornou | +1        |

Duas consequências que valem por si:

- **Extração antecipada continua sendo uma decisão válida.** Ela salva minério —
  mas minério sozinho não compra nada, porque *todo* protocolo custa pelo menos
  um núcleo. Quem só extrai acumula uma reserva que fica esperando a coragem de
  buscar o núcleo.
- **Nenhum nó da árvore reduz a perda da morte.** Ver §4.

Isso encaixa no fluxo que já existe: o jogo já distingue `extracted` de
`extracted_with_core` (`RunPhase`, `packages/voxelyn-survival-sim/src/types.ts`),
e carregar o núcleo de volta exige subir pelos setores com a contaminação 2,2×
mais rápida. A parte cara do loop já está construída — falta só pagar por ela.

## 2. Mudança de política no repositório

`packages/voxelyn-survival/src/client/records.ts:1-12` abre com uma decisão
explícita e bem argumentada:

> A spec (secao 2.3) e explicita: metaprogressao aqui e VARIEDADE — bestiario,
> descobertas, cosmeticos —, nunca poder numerico. [...] no instante em que um
> recorde virar +5 de vida, a run deixa de ser justa consigo mesma e a seed
> compartilhada deixa de significar a mesma coisa para duas pessoas.

**Esta feature substitui essa política.** Não é uma exceção pontual, e tratá-la
como exceção deixaria duas filosofias contraditórias no repositório — a próxima
pessoa que ler `records.ts` vai acreditar na versão errada.

O argumento antigo continua correto *sobre o que ele estava protegendo*: a seed
compartilhada. A resposta não é abrir mão dele, é **separar os contextos**:

| Contexto                      | Prospector                       |
| ----------------------------- | -------------------------------- |
| Expedição (solo, campanha)    | Progressão geracional ativa      |
| Contrato ranqueado            | Padronizado de fábrica           |
| Co-op casual                  | Individual ou padronizado pela sala |
| Leaderboard geracional (futuro) | Classificação separada por geração |

Assim a seed continua significando o mesmo desafio no ranking atual, e a campanha
normal ganha a progressão roguelite.

**Entregável desta seção**: o comentário de topo de `records.ts` reescrito, os
testes que afirmam a política antiga atualizados, e `docs/miner/voxelyn-survival-miner.md`
§4 reescrito (ver §3.1).

## 3. Remoção da cota temporária

Hoje cada lasca já é registrada em `stats.oreCollected` e emite `ore_gained`
(`materials.ts:246-248`, `entities.ts:502-508`). A recompensa a cada 14 lascas é
aplicada **separadamente** por `payOreQuota` (`run.ts:1731-1751`). Por isso a
conversão em módulos pode sair inteira sem desmontar mineração, partículas ou
estatísticas.

### 3.1 O que sai

| Símbolo                     | Arquivo                                | Ação    |
| --------------------------- | -------------------------------------- | ------- |
| `ORE_PER_MODULE`            | `sim/src/constants.ts:742`             | remover |
| `payOreQuota`               | `sim/src/run.ts:1728-1751` + chamada em `stepRun:1781` | remover |
| `PlayerExtra.oreModulesPaid` | `sim/src/types.ts:345` + `makeExtra` (`run.ts:176`) | remover |
| `DISCOVERY_ORE_QUOTA`       | `sim/src/types.ts:190`                 | aposentar (ver §3.3) |
| Testes de cota              | `sim/tests/miner.test.ts:181-219`      | remover |
| Doc §4 "A cota tem de ter um benefício" | `docs/miner/voxelyn-survival-miner.md:115-133` | reescrever |

`rollModuleChoice` continua existindo: salvage segue pagando em módulo. Some
apenas a oferta de `sourceSiteId` negativo.

### 3.2 O que fica intacto

`stats.oreCollected`, o evento `ore_gained`, a partícula `oreChip`
(`client/particles.ts:346`), a cue de áudio (`client/audio/cues.ts:152`), a linha
de minério do sumário (`client/run-summary.ts:177`), o desempate do leaderboard
(`server/leaderboard.ts:116,245`) e a entrada de `oreCollected` no hash
autoritativo (`run.ts:1956`).

### 3.3 A descoberta órfã

`DISCOVERY_ORE_QUOTA` (`1 << 12`) descreve uma regra que deixa de existir. Duas
regras não negociáveis:

1. **O bit 12 é aposentado, não reciclado.** Perfis salvos já têm esse bit aceso;
   reusá-lo faria a descoberta nova nascer desbloqueada para quem jogou antes. A
   constante permanece no arquivo com um comentário de reserva.
2. A migração de schema (§5.1) **apaga** o bit 12 de `records.discoveries`, e a
   entrada some de `DISCOVERIES` (`records.ts:257-261`) e das locales.

No lugar entra a descoberta que a nova política de fato ensina:

```ts
/** Morrer carregando carga não homologada. A lição central do loop. */
export const DISCOVERY_CARGO_LOST = 1 << 13;
```

Marcada em `finalizeRun` quando `phase === 'dead' && stats.oreCollected >= 20`.
Determinística, entra no hash como qualquer outra.

## 4. Limites de balanceamento

A árvore **não protege o jogador da consequência central**. Fica permanentemente
fora dela:

- seguro, retenção parcial ou recuperação de minério após a morte;
- teleporte direto para a superfície;
- skip de setores;
- multiplicadores de minério ou de qualquer ganho econômico;
- revives automáticos precoces;
- grandes aumentos de DPS.

A ausência de multiplicadores econômicos é a regra mais importante das seis: uma
habilidade que dá mais minério se tornaria obrigatória, aceleraria a própria
aquisição e faria todas as outras escolhas parecerem erradas.

O Prospector **completo** (24 protocolos) fica em aproximadamente:

| Eixo               | Total  |
| ------------------ | ------ |
| Vida               | +12%   |
| Movimento          | +4%    |
| Dano direto        | +4%    |
| Calor, esquiva, navegação | melhorias pequenas |

Mais confiável e mais versátil. Não invencível.

## 5. Contratos de dados

### 5.1 Perfil persistente — schema 2

`client/records.ts` hoje **descarta** schema desconhecido (`SCHEMA = 1`,
`loadRecords:95`). O comentário que justifica isso continua válido para o que ele
protegia — um parser não testado no caminho de inicialização. Mas agora o perfil
carrega uma carteira que o jogador levou horas para encher, e descartar isso é
inaceitável. Desta vez **migramos**.

```ts
const SCHEMA = 2;

export type UpgradeId = string; // 'CA-01' | 'MV-03' | ...

export type Records = {
  schema: number;
  // ... campos do schema 1, inalterados ...
  wallet: {
    ore: number;
    cores: number;
  };
  progression: {
    purchased: UpgradeId[];
    generation: number;
  };
};
```

**Migração 1 → 2** (função pura, testada, isolada de `localStorage`):

```ts
const migrate1to2 = (rec: RecordsV1): Records => ({
  ...rec,
  schema: 2,
  discoveries: rec.discoveries & ~DISCOVERY_ORE_QUOTA, // §3.3
  wallet: { ore: 0, cores: 0 },
  progression: { purchased: [], generation: 0 },
});
```

Schema desconhecido (> 2 ou não numérico) continua sendo descartado. `try/catch`
em volta da migração: se ela lançar, cai em `emptyRecords()` — o jogo abre.

**Crédito da carga.** `applyRunOnce` (`records.ts:141-149`) já é a fronteira
idempotente correta: a identidade é `seed:phase:ticks`, estável entre cópias
JSON/WebSocket da mesma run terminal. O crédito entra em `applyRun`, junto dos
demais totais, e portanto herda a idempotência de graça:

```ts
if (summary.phase !== 'dead') {
  next.wallet.ore += summary.stats.oreCollected;
  if (summary.phase === 'extracted_with_core') next.wallet.cores += 1;
}
```

Abandono não precisa de tratamento: sem run terminal não há `summary`, e
`recordRun` (`main.ts:324`) nunca é chamado. Zero por construção.

**Compra** — pura, atômica, e a única porta de saída da carteira:

```ts
export type PurchaseResult =
  | { ok: true; records: Records }
  | { ok: false; reason: 'unknown' | 'owned' | 'locked' | 'ore' | 'cores' };

export const purchase = (records: Records, id: UpgradeId): PurchaseResult;
```

`locked` cobre o pré-requisito de tier: `T(n)` exige `T(n-1)` do mesmo ramo.

### 5.2 `PlayerTuning` — a configuração congelada da run

Vive em `packages/voxelyn-survival-sim/src/progression.ts` porque **cliente e
servidor precisam derivá-la de forma idêntica** — o servidor vai validar a árvore
de um cliente que ele não controla.

```ts
export type PlayerTuning = {
  maxHp: number;
  moveSpeed: number;
  dodgeCooldownTicks: number;
  dodgeIframeTicks: number;
  heatMax: number;
  heatDecayPerTick: number;
  abilityCooldownScale: number;
  projectileSpeedScale: number;
  damageScale: number;
  startingPurgeCells: number;
  stunScale: number;              // CA-02
  environmentalDamageScale: number; // CA-04
  liquidSlowScale: number;        // MV-03
  iceControlScale: number;        // MV-04
  overheatTicksDelta: number;     // RX-05
  overheatDamageDelta: number;    // RX-05
};

/** O prospector de fábrica: exatamente as constantes de hoje. */
export const FACTORY_TUNING: PlayerTuning;

/** Derivação pura e determinística. Ordem de `purchased` é irrelevante. */
export const tuningFrom = (purchased: readonly UpgradeId[]): PlayerTuning;
```

`RunConfig` ganha `tuning?: PlayerTuning`; `createRun` congela em
`state.config.tuning` (default `FACTORY_TUNING`) e `makePlayer`/`makeExtra`
passam a ler dali em vez de `PLAYER_HP` / `purgeCells: 1` diretamente.

A simulação continua determinística. Ela apenas deixa de ler algumas constantes
globais e passa a ler a configuração congelada **daquele** Prospector.

**O tuning entra no hash autoritativo.** Sem isso, uma run com +12% de vida
verificaria contra o replay de uma run de fábrica. Em `hashState`, junto dos
contadores:

```ts
for (const key of TUNING_HASH_ORDER) mix(Math.round(state.config.tuning[key] * 1000));
```

`TUNING_HASH_ORDER` é uma lista explícita e ordenada — `Object.keys` não tem
ordem garantida entre engines.

### 5.3 `SurveyKit` — o ramo que não toca na simulação

Os seis protocolos de LEVANTAMENTO são **apresentação pura**: pulso de objetivo,
bearing, memória de mapa. Nada deles muda um único tick.

```ts
export type SurveyKit = {
  entryBeacon: boolean;      // SV-01
  salvageTrace: number;      // SV-02 — raio em tiles, 0 = desligado
  spectrometerWalls: number; // SV-03
  routeMemory: boolean;      // SV-04
  returnVector: boolean;     // SV-05
  waveForecast: boolean;     // SV-X
};
```

Vive no cliente, **não** entra em `RunConfig` nem no hash. Isso é uma propriedade
valiosa: um quarto da árvore é impossível de dessincronizar.

### 5.4 `ViewerState.cargoOre`

`ViewerState` (`protocol/src/messages.ts:121-133`) carrega hoje calor, células,
módulos, escolha pendente, núcleo, abatido, mira e superaquecimento — **não
carrega minério**. O evento `ore_gained` tem `amount` e `total`, perfeito para o
`+1` flutuante, mas eventos não sobrevivem a reconexão nem a resync completo: quem
reconecta veria o contador zerado.

```ts
export type ViewerState = {
  // ...
  /** Carga NÃO homologada da run corrente. Espelha stats.oreCollected. */
  cargoOre: number;
};
```

Opcional no wire (`cargoOre?: number`) para que um servidor antigo não quebre um
cliente novo — o cliente cai em `0` e o evento repõe o valor no primeiro acerto.
Bump de `protocol/src/version.ts`.

## 6. A árvore — 24 protocolos

Quatro ramos de seis tiers. Custo e pré-requisito idênticos entre ramos: T(n)
exige T(n-1) do mesmo ramo.

| Tier | Minério | Núcleos |
| ---- | ------- | ------- |
| T1   | 35      | 1       |
| T2   | 55      | 1       |
| T3   | 85      | 1       |
| T4   | 130     | 2       |
| T5   | 200     | 2       |
| T6   | 300     | 3       |

Ramo completo: 805 minério e 10 núcleos. Árvore completa: 3.220 minério e 40
núcleos — quarenta extrações com núcleo, no mínimo.

### CHASSI — sobrevivência

| ID    | Nome              | Efeito                    | Campo                      |
| ----- | ----------------- | ------------------------- | -------------------------- |
| CA-01 | Carapaça I        | +4 HP                     | `maxHp`                    |
| CA-02 | Berços de impacto | stun −10%                 | `stunScale`                |
| CA-03 | Carapaça II       | +4 HP                     | `maxHp`                    |
| CA-04 | Selo ambiental    | dano ambiental −8%        | `environmentalDamageScale` |
| CA-05 | Carapaça III      | +4 HP                     | `maxHp`                    |
| CA-X  | Purga auxiliar    | começa com +1 Purga       | `startingPurgeCells`       |

### MOBILIDADE — movimento

| ID    | Nome              | Efeito                    | Campo                 |
| ----- | ----------------- | ------------------------- | --------------------- |
| MV-01 | Servos I          | movimento +2%             | `moveSpeed`           |
| MV-02 | Relé de esquiva   | cooldown 18 → 17 ticks    | `dodgeCooldownTicks`  |
| MV-03 | Tração            | slow de líquidos −8%      | `liquidSlowScale`     |
| MV-04 | Estabilizadores   | mais controle no gelo     | `iceControlScale`     |
| MV-05 | Servos II         | movimento +2%             | `moveSpeed`           |
| MV-X  | Firmware reflexo  | +1 iframe na esquiva      | `dodgeIframeTicks`    |

### REATOR — calor e combate

| ID    | Nome              | Efeito                       | Campo                    |
| ----- | ----------------- | ---------------------------- | ------------------------ |
| RX-01 | Dissipador        | dissipação +5%               | `heatDecayPerTick`       |
| RX-02 | Coletor           | calor máximo 105             | `heatMax`                |
| RX-03 | Capacitor         | cooldown de habilidade −4%   | `abilityCooldownScale`   |
| RX-04 | Colimador         | projéteis +6% de velocidade  | `projectileSpeedScale`   |
| RX-05 | Governador        | overheat −4 ticks e −1 dano  | `overheat*Delta`         |
| RX-X  | Malha de combate  | dano de bolt/habilidade +4%  | `damageScale`            |

O **único** bônus direto de dano da árvore inteira é RX-X, no fim do ramo mais
caro. Ver §4.

### LEVANTAMENTO — navegação

| ID    | Nome              | Efeito                                | Campo                |
| ----- | ----------------- | ------------------------------------- | -------------------- |
| SV-01 | Beacon            | pulso ao objetivo na entrada          | `entryBeacon`        |
| SV-02 | Traço salvage     | aponta terminal a 18 tiles            | `salvageTrace`       |
| SV-03 | Espectrômetro     | veio pulsa através de 1 parede        | `spectrometerWalls`  |
| SV-04 | Memória de rota   | mapa guarda salões visitados          | `routeMemory`        |
| SV-05 | Vetor de retorno  | bearing à entrada com núcleo          | `returnVector`       |
| SV-X  | Previsor de onda  | anuncia a próxima onda de contaminação | `waveForecast`      |

## 7. Mudanças por pacote

### `voxelyn-survival-sim`

- **Remove**: `ORE_PER_MODULE`, `payOreQuota`, `oreModulesPaid`, `DISCOVERY_ORE_QUOTA`
  do codex (constante fica reservada).
- **Adiciona**: `src/progression.ts` — `UpgradeId`, `PROTOCOLS` (catálogo com
  custo, tier, ramo e efeito), `PlayerTuning`, `FACTORY_TUNING`, `tuningFrom`,
  `TUNING_HASH_ORDER`, `DISCOVERY_CARGO_LOST`.
- **Altera**: `RunConfig.tuning?`, `createRun` congelando o tuning,
  `makePlayer`/`makeExtra`/`resetPlayerProgress` lendo dele; pontos de leitura de
  `PLAYER_HP`, `PLAYER_SPEED`, `DODGE_COOLDOWN_TICKS`, `DODGE_IFRAME_TICKS`,
  `HEAT_MAX`, `HEAT_DECAY_PER_TICK`, `BOLT_SPEED`, `BOLT_DAMAGE`;
  `hashState` mixando o tuning; `finalizeRun` marcando `DISCOVERY_CARGO_LOST`.
- **Exporta** o catálogo pelo `index.ts` — cliente e servidor consomem o mesmo.

### `voxelyn-survival-protocol`

- `ViewerState.cargoOre?: number`.
- Bump de versão.
- *(Fase 6)* `ClientHello.tuning` + validação; `RoomConfig.standardized: boolean`.

### `voxelyn-survival-server`

- `room.ts` preenche `cargoOre` a partir de `state.stats.oreCollected`.
- `replay.ts:133` passa `tuning: FACTORY_TUNING` explicitamente — o verificador
  nunca herda a árvore de ninguém.
- `leaderboard.ts` rejeita (ou classifica separadamente) run cujo tuning ≠ fábrica.

### `voxelyn-survival` (cliente)

- `records.ts`: schema 2, migração, `wallet`, `progression`, `purchase`,
  `generationOf`, comentário de topo reescrito (§2).
- Novo `matrix-panel.ts`: a Matriz Geracional — abas Matriz / Extração / HUD,
  cabeçalho com minério homologado, núcleos, geração e protocolos *n* de 24.
- `main.ts`: `createRun({ seed, tuning: tuningFrom(records.progression.purchased) })`
  no solo, e o mesmo tuning no reinício da linha 782.
- HUD (`render.ts`): contador de carga com o rótulo `CARGA NÃO HOMOLOGADA`.
- `run-summary.ts`: linha de homologação — o que foi creditado, e o que ficou.
- i18n: chaves novas em `en.ts` e `pt-BR.ts`; remoção de `discovery.oreQuota.*`.

## 8. Feedback de minério no HUD

A sequência exata, por lasca:

1. lascas voxel saem da parede (já existe: `oreChip`, `particles.ts:346`);
2. `+1 ⬡` sobe do ponto atingido;
3. uma lasca curva em direção ao contador;
4. o número pulsa uma vez;
5. drops agrupados — os seis minérios do Minerador (`MINER_ORE_DROP`) — mostram
   **+6**, não seis textos concorrentes.

O passo 5 sai de graça: `ore_gained` já carrega `amount`, e o drop do Minerador já
emite um único evento com `amount: MINER_ORE_DROP` (`entities.ts:502-508`). O
texto flutuante lê `amount`, nunca conta eventos.

O contador reconcilia com `ViewerState.cargoOre` a cada snapshot: o evento anima,
o estado autoritativo corrige. Reconexão no meio da run mostra a carga certa.

## 9. Testes

### `voxelyn-survival-sim`

| Teste | Afirma |
| ----- | ------ |
| `progression.test.ts` | `tuningFrom([])` é byte a byte `FACTORY_TUNING` |
| | `tuningFrom` é independente da ordem de `purchased` |
| | ID desconhecido é ignorado, não lança |
| | árvore completa bate os totais de §4 (+12% HP, +4% mov., +4% dano) |
| | nenhum protocolo toca ganho de minério (varredura do catálogo) |
| `determinism.test.ts` | mesmo tuning + mesmos comandos ⇒ mesmo hash |
| | tunings diferentes ⇒ hashes diferentes (o tuning está no hash) |
| `miner.test.ts` | minerar credita `oreCollected` e emite `ore_gained` |
| | minerar **não** produz `pendingModuleChoice` (regressão da cota removida) |
| `run-flow.test.ts` | morrer com carga marca `DISCOVERY_CARGO_LOST` |

### `voxelyn-survival` (cliente)

| Teste | Afirma |
| ----- | ------ |
| `records.test.ts` | migração 1 → 2 preserva totais, histórico e bestiário |
| | migração apaga o bit 12 e zera a carteira |
| | schema 3 (futuro) ainda é descartado |
| | migração que lança cai em `emptyRecords` sem propagar |
| | `dead` credita 0/0; `extracted` credita ore/0; `extracted_with_core` credita ore/+1 |
| | `applyRunOnce` com a mesma identidade **não** credita duas vezes |
| | `purchase` sem núcleo falha com `cores`, mesmo com minério de sobra |
| | `purchase` fora de ordem falha com `locked` |
| | `purchase` bem-sucedida debita exatamente uma vez e é pura |
| | `generationOf` nos limiares 0/1/6/12/18 |
| `matrix-panel.test.ts` | painel reflete a carteira e desabilita o que não dá para comprar |

### `voxelyn-survival-server`

| Teste | Afirma |
| ----- | ------ |
| `replay.test.ts` | replay usa `FACTORY_TUNING` mesmo se o cliente mandar outro |
| `leaderboard.test.ts` | run com tuning ≠ fábrica não entra no ranking padrão |

## 10. Fases de entrega

Cada fase é jogável e commitável sozinha.

**Fase 1 — Remoção da cota.** §3 inteira. Sim + testes + doc do Minerador + i18n.
Sem carteira ainda: o minério vira puramente um número de sumário e desempate.
Efeito percebido: menos oferta de módulo, nenhuma regressão.

**Fase 2 — Carteira e schema 2.** §5.1. Só cliente. A carga passa a ser creditada
e mostrada; ainda não compra nada. Tela de extração com os três desfechos.

**Fase 3 — A árvore.** §5.2, §5.3, §6, `matrix-panel.ts`, tuning aplicado no solo.
É aqui que a feature existe.

**Fase 4 — Feedback de carga.** §5.4 e §8. `cargoOre` no protocolo, contador no
HUD, `+N ⬡` flutuante, lasca que curva.

**Fase 5 — Marcos visuais.** §11.

**Fase 6 — Separação ranking/online.** `ClientHello.tuning`, validação server-side,
tuning no replay e no hash autoritativo do co-op, sala padronizada. As fases 1–5
ativam a árvore **apenas no solo/Expedição**; o co-op continua de fábrica até
aqui.

## 11. Evolução visual sem explosão combinatória

Um sprite por combinação de 24 protocolos é combinatoriamente impossível e
destruiria a leitura de silhueta que a direção de arte exige. A primeira versão
usa **marcos geracionais**, derivados de `purchased.length`:

| Geração | Protocolos | Chassi                              |
| ------- | ---------- | ----------------------------------- |
| G-00    | 0          | Prospector atual                    |
| G-01    | 1–5        | ombreiras e antena curta            |
| G-02    | 6–11       | carapaça e dissipador dorsal        |
| G-03    | 12–17      | pistões, sensores e reator ampliado |
| G-04    | 18–24      | chassi Aurix de campo completo      |

Depois, *appendages* por slot — cabeça, costas, ombros, pernas — podem representar
o ramo dominante, sem multiplicar atlases completos.

## 12. Trabalho futuro

- Leaderboard geracional: classificação separada por geração ou por valor total de
  protocolos instalados.
- Co-op com progressão individual vs. sala padronizada (decisão de produto, não de
  engenharia — as duas cabem no mesmo contrato).
- *Appendages* por ramo dominante (§11).
- Reset geracional: gastar uma árvore completa por algo que só a próxima linhagem
  vê. Só faz sentido depois de existir um jogador que chegou a G-04.
