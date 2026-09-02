# Voxelyn Survival — Matriz Geracional Aurix

Data: 2026-08-02
Status: **implementado** nos slices 1 a 9 (ver §15 para o que ficou de fora).

> «O que retorna é homologado. O que fica no Veio nunca existiu.»
>
> «Somente o servidor da Aurix decide o que retornou.»

---

## 1. A decisão que rege tudo

O Prospector deixa de melhorar apenas **dentro** da run. Ele passa a melhorar
**entre** runs, e a moeda dessa melhoria é exatamente aquilo que a run atual
arrisca perder.

| Camada     | O que é                         | Onde vive             |
| ---------- | ------------------------------- | --------------------- |
| Temporária | Módulos de salvage, Ecos, purga | A run atual           |
| Permanente | Protocolos da Matriz Geracional | O perfil autoritativo |

As duas não competem: uma é escolhida sob pressão com informação incompleta, a
outra é escolhida com calma na superfície.

Cada sistema passa a ter exatamente uma função:

```
Salvage  → módulos temporários
Ecos     → habilidade da run
Minério  → carga de metaprogressão
Núcleo   → chave rara de progressão permanente
```

### 1.1 Política de carga

Durante a run, todo minério é **CARGA NÃO HOMOLOGADA**.

| Desfecho                                    | Minério | Núcleo |
| ------------------------------------------- | ------- | ------ |
| Morte (`dead`)                              | 0       | 0      |
| Abandono (nenhuma fase terminal)            | 0       | 0      |
| Extração (`extracted`)                      | tudo    | 0      |
| Extração com núcleo (`extracted_with_core`) | tudo    | +1     |

Duas consequências que valem por si:

- **Extração antecipada continua legítima.** Ela salva minério — mas minério
  sozinho não compra nada, porque _todo_ protocolo custa pelo menos um núcleo.
- **Nenhum nó da árvore reduz a perda da morte** (§5).

Isso encaixa no fluxo que já existe: o jogo já distingue `extracted` de
`extracted_with_core`, e voltar com o núcleo exige subir os setores com a
contaminação acelerada. A parte cara do loop já está construída.

---

## 2. Mudança de política no repositório

`packages/voxelyn-survival/src/client/records.ts` abre hoje com uma decisão
explícita: metaprogressão é _variedade_, nunca poder numérico, sob o argumento de
que uma seed compartilhada precisa significar a mesma coisa para duas pessoas.

**Esta feature substitui essa política.** Não como exceção — como troca
consciente, para o repositório não conter duas filosofias incompatíveis.

O argumento antigo continua correto _sobre o que protegia_. A resposta não é
abandoná-lo, é **separar contextos**:

> A metaprogressão da Expedição pode fornecer melhorias numéricas leves e
> ponderadas. Modos competitivos e contratos ranqueados continuam usando
> Prospectors padronizados.

| Contexto                         | Prospector                |
| -------------------------------- | ------------------------- |
| Expedição solo autoritativa      | Tuning derivado do perfil |
| Simulação local (fallback)       | G-00, sem recompensa      |
| Contrato ranqueado / leaderboard | G-00 padronizado          |
| Co-op (1ª versão)                | G-00 padronizado          |

Bestiário, descobertas e registros continuam existindo. A árvore não os remove.

---

## 3. Remoção da recompensa de módulo por minério

Hoje `payOreQuota` (`sim/src/run.ts`) converte cada 14 lascas em uma escolha de
módulo. Essa mecânica sai inteira.

| Símbolo                      | Ação                                |
| ---------------------------- | ----------------------------------- |
| `ORE_PER_MODULE`             | remover                             |
| `payOreQuota` + chamada      | remover                             |
| `PlayerExtra.oreModulesPaid` | remover (init, reset, hash, testes) |
| `DISCOVERY_ORE_QUOTA`        | aposentar o bit; ver §3.2           |

**Preservado**: mineração dos veios, `SOLID_ORE*`, `stats.oreCollected`, evento
`ore_gained`, partículas `oreChip`, cue de áudio, drop do Minerador, minério no
sumário, minério como desempate do leaderboard, módulos por salvage e Ecos.

### 3.1 Por que o campo continua se chamando `oreCollected`

Renomear provocaria migração de leaderboard, telemetria e replay sem ganho
técnico. O significado não mudou: _minério coletado durante esta run_. A
homologação é operação do servidor de progressão, não da simulação.

### 3.2 A descoberta órfã

`DISCOVERY_ORE_QUOTA` (`1 << 12`) descreve uma regra que deixa de existir.

1. **O bit é aposentado, não reciclado.** Perfis salvos já o têm aceso; reusá-lo
   faria a descoberta substituta nascer desbloqueada. A constante permanece com
   comentário de reserva.
2. No lugar entra `DISCOVERY_CARGO_LOST` (`1 << 13`): morrer carregando carga não
   homologada — a lição central do novo loop. Marcada em `finalizeRun`,
   determinística, entra no hash como qualquer outra.

---

## 4. Persistência autoritativa

### 4.1 Fonte de verdade

O perfil permanente vive **no servidor**. O princípio é o mesmo do leaderboard:

> O cliente fornece comandos e evidências da run. O servidor reproduz, valida e
> decide o resultado autoritativo.

O cliente **nunca** decide: quanto minério foi homologado, se um núcleo voltou,
como a run terminou, se era elegível, qual tuning valeu, quais protocolos estão
comprados, qual a geração, quanto debitar, ou quais arquivos foram liberados.

`localStorage` deixa de ser autoridade de qualquer coisa permanente. O que ele
guarda vira **cache explicitamente marcado** (§4.9).

### 4.2 Reúso, não segundo protocolo

O que já existe e é reaproveitado sem cópia:

| Peça existente                            | Uso na progressão                |
| ----------------------------------------- | -------------------------------- |
| `replay.ts` → `resimulate()`              | prova canônica da run            |
| `command-log.ts` (RLE + base64)           | formato de gravação              |
| `run-recorder.ts`                         | gravação no caminho da simulação |
| `http-util.ts` (rate limit, budget, body) | proteções da rota                |
| `leaderboard.ts` (Memory + Postgres)      | padrão de store por ambiente     |
| `hashAuthoritativeState`                  | comparação de estado terminal    |

`resimulate` era privado de `replay.ts`; passa a ser exportado como
`resimulateRun`, com o mesmo comportamento, para o settlement não reimplementar o
laço. `createRun` ganha `tuning`, e o replay passa a receber o tuning autorizado
em vez de assumir o padrão.

### 4.3 Perfil

```ts
type AuthoritativeProgressionProfile = {
  profileId: string;
  schemaVersion: number;
  profileVersion: number;
  wallet: { ore: number; cores: number };
  progression: { purchasedUpgradeIds: UpgradeId[] };
  codex: { unlockedLoreFragmentIds: LoreFragmentId[] };
  statistics: {
    oreHomologated: number;
    oreLost: number;
    coresRecovered: number;
    successfulReturns: number;
    failedExpeditions: number;
    upgradesPurchased: number;
  };
  createdAt: string;
  updatedAt: string;
};
```

`generation` **não** é persistida como segunda fonte: é sempre
`deriveGeneration(purchasedUpgradeIds)`. O servidor normaliza IDs, ordem, saldos
e versões. Uma cópia completa do perfil enviada pelo cliente nunca substitui o
registro.

Perfil novo começa zerado. **Não existe importação de saldo local** — a feature
está nascendo, não há saldo legítimo anterior a importar.

### 4.4 Identidade

Não existe autenticação de jogador no repositório hoje, e nome de exibição, IP,
user-agent ou ID escolhido pelo cliente não servem. Decisão: **sessão anônima
emitida pelo servidor**.

1. `POST /api/progression/session` cria `profileId` aleatório (128 bits, CSPRNG);
2. o servidor devolve um token `profileId.expiry.hmac`, assinado com
   `PROGRESSION_SECRET` (HMAC-SHA256, `node:crypto`);
3. entregue por cookie `HttpOnly; Secure; SameSite=Lax; Path=/api/progression`;
4. validado com `timingSafeEqual` em toda operação;
5. o segredo nunca sai do servidor.

Sem `PROGRESSION_SECRET` no ambiente, o servidor gera um segredo efêmero no boot
e **loga** que as sessões não sobrevivem a restart — dev funciona, produção mal
configurada é visível em vez de silenciosa.

Fica estruturado, sem implementar agora: associação a conta, recuperação, merge
controlado. **Merge automático de saldos não é implementado.**

### 4.5 Ticket de run

```ts
type ProgressionRunTicket = {
  runId: string;
  profileId: string;
  seed: number;
  mode: RunMode;
  playerCount: number;
  tuning: PlayerTuning;
  tuningHash: string;
  progressionProfileVersion: number;
  protocolVersion: number;
  simulationVersion: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
};
```

Emitido por `POST /api/progression/runs`. O **servidor** deriva o tuning do perfil
autoritativo e o congela no ticket. O cliente recebe o tuning e roda a mesma
simulação determinística.

O ticket é guardado no servidor (não é um blob assinado devolvido depois): assim
a liquidação lê a seed e o tuning autorizados do próprio registro, e o cliente
não tem o que alterar. Validade padrão: 90 minutos — 3× o teto de replay.

Comprar um protocolo no meio de uma run **não** afeta a run em andamento: o
ticket já congelou `progressionProfileVersion` e o tuning.

### 4.6 Liquidação

`POST /api/progression/runs/:runId/settle`, com `{ log }` em base64. Ordem:

1. autenticar o perfil;
2. localizar o ticket e conferir dono, expiração, versões;
3. recusar se já liquidado (devolvendo o resultado anterior — §4.7);
4. validar tamanho/forma do log;
5. reconstruir o tuning autorizado a partir do ticket e revalidar `tuningHash`;
6. **re-simular** com seed + tuning do ticket;
7. exigir fase terminal e sumário;
8. calcular a recompensa **apenas** do replay canônico;
9. persistir liquidação + ledger + saldo + estatísticas numa operação atômica;
10. devolver o perfil público atualizado.

```ts
switch (canonical.phase) {
  case 'dead':
    reward = { ore: 0, cores: 0 };
    break;
  case 'extracted':
    reward = { ore: canonical.stats.oreCollected, cores: 0 };
    break;
  case 'extracted_with_core':
    reward = { ore: canonical.stats.oreCollected, cores: 1 };
    break;
}
```

Campos como `claimedOre`, `claimedPhase` ou `claimedGeneration` são **ignorados**
na liquidação, existam eles ou não no payload. O `RunSummary` do cliente nunca é
fonte de verdade.

Uma run morta é liquidada normalmente — com recompensa zero e registro de perda.
Isso é o que permite `oreLost` existir e o que fecha o `runId` contra retentativa
com outro log.

### 4.7 Idempotência

`UNIQUE(profile_id, run_id)` na tabela de liquidações — restrição **persistente**,
não checagem em memória. Repetir a mesma requisição:

- não credita de novo;
- devolve o resultado previamente persistido;
- é segura após timeout, retry, reload e reconexão.

Compras usam `idempotencyKey` com a mesma garantia: `UNIQUE(profile_id, key)`.

### 4.8 Ledger e atomicidade

Nada de dois números mutáveis sem histórico. Toda mudança de saldo escreve uma
entrada de ledger com `oreDelta`, `coreDelta`, `balanceAfter` e metadados — em
inteiros, sempre.

Liquidação e compra são **transacionais**: registro + ledger + saldo +
estatísticas + `profileVersion` na mesma transação. Falha intermediária não deixa
resíduo. Em Postgres isso é uma transação real; no store de memória é uma cópia
mutada e publicada só no fim (falha ⇒ o estado anterior permanece).

Comprar sem desbloquear a lore, ou desbloquear a lore sem comprar, é impossível
por construção: as duas escritas estão na mesma operação.

### 4.9 Cache local e records

O cliente pode cachear a última resposta autoritativa para renderizar rápido.
Esse cache **não** é fonte de verdade, não autoriza compra, não define tuning de
run elegível e não credita nada. A resposta do servidor sempre o substitui.

`records.ts` continua guardando localmente histórico, bestiário, descobertas,
seeds dominadas e preferências. Ele **não** guarda como autoridade: wallet,
núcleos, protocolos, geração, codex ou tuning. Onde aparecerem, são projeção
marcada como cache.

### 4.10 Indisponibilidade do servidor

Sem servidor não há Expedição recompensada. Existe **SIMULAÇÃO LOCAL**: G-00, sem
recursos, sem compras, sem lore, sem submissão posterior. Anunciada antes de
começar.

Runs offline **não** são armazenadas para crédito futuro — seria uma superfície
enorme de adulteração. Se o servidor cair _durante_ uma run que já tem ticket
válido, o cliente guarda o log e repete a submissão do **mesmo `runId`** dentro da
validade. O servidor continua decidindo.

### 4.11 Segurança

Herdadas de `http-util.ts` e do leaderboard: teto de corpo, teto de comandos,
teto de ticks, orçamento de re-simulação compartilhado (uma por vez), rate limit
por origem, JSON inválido tratado, logs estruturados, erros sem vazamento.

Nunca: confiar em hash do cliente, embarcar segredo de HMAC no bundle, aceitar
saldo negativo, aceitar custo enviado pelo cliente, aceitar geração enviada pelo
cliente, aceitar float como moeda, ou cair silenciosamente para progresso local.

---

## 5. Limites de balanceamento

Fica permanentemente fora da árvore: seguro de carga, retenção parcial,
recuperação de cadáver, teleporte à superfície, skip de setores, início em setor
profundo, multiplicador de minério ou de núcleo, desconto progressivo, respec
irrestrito, revive automático, imunidade ambiental permanente, remoção de slow,
fim do calor, grande aumento de dano, garantia de módulo específico.

Multiplicador econômico é a proibição mais importante: ele acelera a própria
compra, domina todas as outras escolhas e quebra o balanceamento de todos os
custos futuros.

Orçamento com a **árvore inteira** comprada:

| Eixo                   | Total              |
| ---------------------- | ------------------ |
| Vida máxima            | +12%               |
| Velocidade             | +4%                |
| Dano direto            | +4%                |
| Redução ambiental      | −8%                |
| Cooldown de habilidade | −4%                |
| Esquiva                | −1 tick, +1 iframe |
| Calor máximo           | +5%                |
| Dissipação             | +5%                |

Testado por asserção sobre `derivePlayerTuning(TODOS)` (§10).

---

## 6. A árvore — 24 protocolos

Quatro ramificações de seis tiers. `T(n)` exige `T(n-1)` do mesmo ramo; não há
dependência entre ramos.

| Tier | Minério | Núcleos |
| ---- | ------- | ------- |
| T1   | 35      | 1       |
| T2   | 55      | 1       |
| T3   | 85      | 1       |
| T4   | 130     | 2       |
| T5   | 200     | 2       |
| T6   | 300     | 3       |

Ramo completo: 805 minério, 10 núcleos. Árvore: 3.220 minério, 40 núcleos.

### CHASSI — sobrevivência

| ID    | Nome                   | Efeito             | Campo do tuning            |
| ----- | ---------------------- | ------------------ | -------------------------- |
| CA-01 | Carapaça Reforçada I   | +4 vida            | `maxHp`                    |
| CA-02 | Berços de Impacto      | stun −10%          | `stunDurationScale`        |
| CA-03 | Carapaça Reforçada II  | +4 vida            | `maxHp`                    |
| CA-04 | Selagem Ambiental      | dano ambiental −8% | `environmentalDamageScale` |
| CA-05 | Carapaça Reforçada III | +4 vida            | `maxHp`                    |
| CA-X  | Reservatório Auxiliar  | +1 célula de purga | `startingPurgeCells`       |

### MOBILIDADE — movimento

| ID    | Nome                         | Efeito                 | Campo                |
| ----- | ---------------------------- | ---------------------- | -------------------- |
| MV-01 | Servomotores I               | +2% velocidade         | `moveSpeed`          |
| MV-02 | Relé de Esquiva              | cooldown 18 → 17 ticks | `dodgeCooldownTicks` |
| MV-03 | Tração Segmentada            | slow de líquidos −8%   | `liquidSlowScale`    |
| MV-04 | Estabilizadores Giroscópicos | mais controle no gelo  | `iceGlide`           |
| MV-05 | Servomotores II              | +2% velocidade         | `moveSpeed`          |
| MV-X  | Firmware Reflexo             | +1 iframe na esquiva   | `dodgeIframeTicks`   |

### REATOR — calor e combate

| ID    | Nome                     | Efeito                       | Campo                  |
| ----- | ------------------------ | ---------------------------- | ---------------------- |
| RX-01 | Dissipador Expandido     | dissipação +5%               | `heatDecayPerTick`     |
| RX-02 | Coletor Térmico          | calor máximo 100 → 105       | `heatMax`              |
| RX-03 | Capacitor de Resposta    | cooldown de habilidade −4%   | `abilityCooldownScale` |
| RX-04 | Colimador Balístico      | projéteis +6% de velocidade  | `projectileSpeedScale` |
| RX-05 | Governador de Emergência | overheat −4 ticks, −1 dano   | `overheat*`            |
| RX-X  | Malha de Combate         | dano +4% (bolt e habilidade) | `playerDamageScale`    |

`playerDamageScale` aplica-se **somente** a dano com autoria do Prospector.
Explosões ambientais, carrinhos, dano de inimigo e reações sem autoria ficam de
fora — garantido por teste.

### LEVANTAMENTO — navegação

| ID    | Nome                     | Efeito                                    | Campo                   |
| ----- | ------------------------ | ----------------------------------------- | ----------------------- |
| SV-01 | Beacon de Objetivo       | pulso ao objetivo na entrada              | `objectiveBeacon`       |
| SV-02 | Traço de Salvage         | terminal próximo a ~18 tiles              | `salvageTraceRange`     |
| SV-03 | Espectrômetro Mineral    | veio pulsa através de 1 parede, ~11 tiles | `oreScanner*`           |
| SV-04 | Memória de Rota          | salões visitados na run                   | `routeMemory`           |
| SV-05 | Vetor de Retorno         | direção da entrada com o núcleo           | `returnVector`          |
| SV-X  | Previsão de Contaminação | leitura da próxima onda                   | `contaminationForecast` |

**Levantamento é apresentação pura.** Nenhum campo dessa ramificação altera um
tick. Consequência valiosa: um quarto da árvore é impossível de dessincronizar.
Por isso `navigation` fica fora do hash (§8).

---

## 7. Configuração da simulação

```ts
type PlayerTuning = {
  maxHp: number;
  moveSpeed: number;
  dodgeCooldownTicks: number;
  dodgeIframeTicks: number;
  heatMax: number;
  heatDecayPerTick: number;
  stunDurationScale: number;
  environmentalDamageScale: number;
  liquidSlowScale: number;
  iceGlide: number;
  abilityCooldownScale: number;
  projectileSpeedScale: number;
  playerDamageScale: number;
  overheatLockTicks: number;
  overheatSelfDamage: number;
  startingPurgeCells: number;
  navigation: {
    /* SV-01..SV-X, ver §6 */
  };
};

const DEFAULT_PLAYER_TUNING: PlayerTuning; // exatamente os números atuais
```

`RunConfig.tuning?` é opcional: uma run sem configuração continua G-00, byte a
byte. A simulação **não** consulta a árvore — nada de `if (hasUpgrade('RX-01'))`
espalhado. Ela lê `state.config.tuning`, resolvido antes da run.

`derivePlayerTuning(ids)` é pura, ignora IDs desconhecidos e independe da ordem.

---

## 8. Determinismo, replay e hash

Todo valor de tuning que altera gameplay entra no estado autoritativo e no hash,
em **milésimos inteiros** (`Math.round(v * 1000)`) por uma lista ordenada
explícita — `Object.keys` não tem ordem garantida entre engines.

`navigation` fica **fora** do hash: não altera a simulação, e incluí-lo faria duas
runs idênticas divergirem por causa de um HUD.

Consequência: mesma seed + mesmos comandos + mesmo tuning ⇒ mesmo hash; tunings
diferentes ⇒ hashes diferentes.

`tuningHash` viaja no ticket e é revalidado na liquidação. O leaderboard atual só
aceita G-00: uma run geracional **não** é submetida como padronizada.

---

## 9. Codex narrativo

Cada protocolo comprado desbloqueia **exatamente um** fragmento. Mais quatro
documentos de marco geracional (G-01..G-04) e um documento público inicial:
**29 documentos**, em pt-BR e en.

O desbloqueio é autoritativo e derivável:

```
expectedLoreIds = loreForPurchasedUpgrades + loreForReachedGenerations + defaultUnlocked
```

Isso permite reparar perfis inconsistentes. Documento bloqueado não é entregue
pelo endpoint. (O bundle do cliente carrega apenas títulos-máscara e metadados de
slot; o corpo vem do servidor.)

### 9.1 Os quatro arcos

| Ramo         | Arco                              | Pergunta central                                                                |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------- |
| Chassi       | A economia do descarte            | A Aurix quer que o Prospector sobreviva, ou apenas que funcione o bastante?     |
| Mobilidade   | Retornar não é ser resgatado      | Quem conduz as unidades de volta quando os sistemas já deviam estar desligados? |
| Reator       | Limites deliberadamente ignorados | O reator serve ao Prospector, ou o transforma em sonda descartável?             |
| Levantamento | O que a Aurix encontrou           | A Aurix descobriu o Veio, ou foi atraída por ele?                               |

### 9.2 Cinco atos

Por tier, e não por ramo — assim qualquer ordem de compra atravessa a mesma
curva de tom:

| Ato | Tiers | Tom                                                    |
| --- | ----- | ------------------------------------------------------ |
| I   | T1    | Propaganda: brochura, investidor, orgulho técnico      |
| II  | T2–T3 | Eficiência: memorando, custo, linguagem desumanizada   |
| III | T4    | Incidentes: falha, censura, transmissão após a morte   |
| IV  | T5    | Encobrimento: ordem executiva, reclassificação         |
| V   | T6    | Continuidade: memória, Ecos, o que "geração" significa |

O horror emerge da normalidade burocrática, não de vilões se declarando maus. O
mistério — memória, Ecos, Veio, continuidade — permanece **deliberadamente
aberto**.

Redação (`[REDACTED]`) é usada com moderação, esconde nome/local/causa e é
parcialmente esclarecida por documentos posteriores via `relatedFragmentIds`.
Texto já desbloqueado não muda retroativamente.

---

## 10. Testes

**Remoção**: 14 e 28 lascas não abrem escolha de módulo; `oreCollected` continua
subindo; `ore_gained` continua; drop do Minerador intacto; salvage continua
oferecendo módulo.

**Tuning**: perfil vazio ⇒ `DEFAULT_PLAYER_TUNING` exato; cada protocolo altera
só o esperado; acúmulo correto; teto de poder respeitado; dano ambiental não
reduz ataque de inimigo; `playerDamageScale` não afeta dano ambiental; gelo,
slow e overheat continuam existindo; ordem irrelevante; ID desconhecido ignorado.

**Determinismo**: mesmo tuning ⇒ mesmo hash; tuning diferente ⇒ hash diferente;
navegação não muda o hash; replay G-00 continua validando.

**Autorização**: ticket emitido pelo servidor; vinculado ao perfil, seed, tuning
e versão; expirado rejeitado; de outro perfil rejeitado; modo não elegível não
gera recompensa.

**Liquidação**: morte credita zero; extração credita minério; extração com núcleo
credita minério e um núcleo; valores declarados pelo cliente ignorados; replay
inválido, hash divergente, versão incompatível, tuning adulterado, run não
terminal e log excessivo rejeitados.

**Idempotência**: mesmo `runId` duas vezes credita uma; concorrentes creditam
uma; resultado anterior devolvido na repetição.

**Ledger**: crédito e compra criam entrada; `balanceAfter` correto; atomicidade;
rollback em falha; saldo reconstruível; deltas inteiros; sem saldo negativo.

**Compra**: cliente não controla custo, pré-requisito nem lore; versão antiga
recebe 409; `idempotencyKey` impede duplicidade; concorrentes não estouram saldo;
compra e lore atômicas; geração derivada; afeta só runs futuras.

**Identidade**: display name não identifica perfil; token inválido/alheio
rejeitado; segredo não aparece no payload; perfil novo zerado.

**Cache**: não autoriza compra; não inicia run recompensada; resposta do servidor
substitui; cache adulterado não muda perfil; ausência de servidor ⇒ só simulação.

**Codex**: cada upgrade tem um fragmento; toda lore pertence a um upgrade; sem
IDs duplicados; `relatedFragmentIds` existem; cronologia válida; traduções
completas nos dois idiomas; marco geracional desbloqueia; perfil inconsistente
reparável; bloqueado não é entregue.

---

## 11. Fases de entrega

| Slice | Conteúdo                                                            |
| ----- | ------------------------------------------------------------------- |
| 1     | Remoção da cota + modelo de domínio (`sim/progression.ts`)          |
| 2     | Tuning aplicado à simulação, hash, determinismo                     |
| 3     | Contratos no protocolo (ticket, settle, perfil público, `cargoOre`) |
| 4     | Servidor: store, ledger, auth, ticket, settle, compra, codex        |
| 5     | Conteúdo narrativo: 29 documentos, pt-BR e en                       |
| 6     | Cliente: API, cache, records sem autoridade, wiring da run          |
| 7     | HUD de carga e feedback de coleta                                   |
| 8     | Matriz Geracional e Codex                                           |
| 9     | Evolução visual, tela de resultado e telemetria                     |

---

## 12. Riscos

| Risco                                                  | Mitigação                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Re-simulação de progressão compete com o tick de co-op | Orçamento **compartilhado** com leaderboard e ecos: uma por vez                    |
| Sessão anônima presa a um navegador                    | Documentado; estrutura preparada para conta; sem merge automático                  |
| Segredo HMAC ausente em produção                       | Segredo efêmero + log explícito no boot                                            |
| Custo de CPU por run liquidada                         | Mesmos tetos do leaderboard (30 min, 512 KB, rate limit)                           |
| Postgres indisponível                                  | Fallback em memória, como o leaderboard — sem recompensa persistida entre restarts |
| Spoiler no bundle                                      | Corpo dos fragmentos vem do servidor; bundle só tem metadados                      |
| Inflação de poder por acúmulo silencioso               | Teto verificado por teste sobre a árvore completa                                  |

---

## 13. Configurável para balanceamento

Tudo abaixo é dado, não regra espalhada: custos por tier, efeito de cada
protocolo, `DEFAULT_PLAYER_TUNING`, limiares de geração, validade do ticket,
tetos de replay, alcances de `navigation`, e a ordem/cronologia dos fragmentos.

Alterar qualquer um deles é editar uma tabela — nenhum exige reescrever regra.

---

## 14. Decisões tomadas durante a implementação

Quatro pontos em que a construção mudou o que a spec previa. Estão aqui porque a
razão de cada um só ficou visível ao escrever o código.

### 14.1 Dois rate limits, e não um

A rota herdaria o teto do ranking (6 por minuto por origem), que existe porque
cada POST de lá custa uma re-simulação. Aqui só a liquidação custa isso — sessão,
perfil, ticket e codex são leituras baratas — e **uma run inteira já consome duas
chamadas**. Seis por minuto viraria 429 no meio da campanha, em três partidas
curtas. Ficaram 12/min para `settle` e 60/min para as leituras, ambos injetáveis.

### 14.2 O texto do Codex viaja resolvido, não como chave de i18n

O resto do jogo guarda chaves e resolve na hora de desenhar, para trocar de
idioma sem recarregar. Aqui a troca vale o preço inverso: uma chave exige o texto
no bundle, e um bundle com os 29 documentos é um bundle em que qualquer pessoa lê
o ato V no primeiro dia. Com a frase vindo do servidor, "bloqueado" é uma
afirmação sobre bytes que o cliente nunca recebeu. Trocar de idioma refaz a busca
do codex — barato, e raro.

### 14.3 O dano com autoria é escalado na FONTE, não na causa

`playerDamageScale` entraria em `damageEntity` filtrando por `DamageCause`. Não
dá: flamethrower e arc chamam `damageEntity` **sem causa**, e cairiam em
`unknown`. Ficou aplicado onde o número nasce (bolt, seeker, sopro, arco) — lista
curta e auditável, e nada mais escala junto.

A selagem ambiental (CA-04) e os berços de impacto (CA-02) foram pelo caminho
oposto, e pela razão simétrica: os dois são **centralizados** em `damageEntity` e
`stunEntity`, contra uma lista fechada de causas. Um caminho de dano ambiental
novo que esquecesse o multiplicador apareceria como bug de balanceamento; assim
ele aparece no `if`.

### 14.4 A evolução visual é uma camada de atlas por marco

Um atlas por protocolo seriam 24 conjuntos completos de animação por direção, e a
silhueta — o requisito mais duro da direção de arte — quebra antes disso. Ficaram
cinco marcos cumulativos, sem tocar hitbox.

A primeira entrega os desenhava em runtime, por cima do sprite, em coordenadas de
tela; foram medidos para um corpo mais baixo que o sprite atual e liam como glitch.
Hoje cada marco é uma **camada de atlas** (`layer-generation-g01`..`g04`), assada
pelo mesmo rasterizador do Prospector, na mesma pose do tronco e com o tronco como
oclusor — o que fica atrás do chassi já não existe no atlas. O cliente empilha as
camadas de G-01 até a geração da run (`RunDepthConfig.generation`), logo depois
do tronco; G-00 não carrega nenhuma. As alegorias (placa de matrícula e alça de
içamento, gaiola de proteção, berço duplo, pilha de reator e placas peitorais)
estão documentadas em `prospector-generations.mjs` no pacote de conteúdo.

## 15. O que ficou de fora desta entrega

- **Telemetria da progressão.** Os eventos existentes continuam intactos, mas
  `oreCollected`, `generation` e `protocolos comprados` ainda não viajam no
  payload de telemetria — mexer nele exige alterar a validação do servidor e o
  schema da tabela, e não cabia junto com o resto. A estrutura para isso está
  pronta: a liquidação já loga `phase`, `ore`, `cores` e duração de forma
  estruturada.
- **Co-op geracional.** O co-op continua padronizado em G-00, como a spec previa
  para a primeira entrega.

## 16. Trabalho futuro (documentado, não implementado)

Progressão individual autenticada; host escolhendo "padronizado" ou "geracional";
geração viajando no protocolo de sala; leaderboard separado por geração;
matchmaking por faixa; contratos que fixam configuração; respec; appendages por
ramo dominante; merge de perfil anônimo em conta.
