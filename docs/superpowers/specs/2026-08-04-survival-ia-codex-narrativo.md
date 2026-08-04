# Codex narrativo: documentos por Ativo, Descoberta e gatilho unificado

**Data:** 2026-08-04
**Escopo:** `voxelyn-survival-sim`, `voxelyn-survival-protocol`, `voxelyn-survival-server`, `voxelyn-survival` (cliente)
**Depende de:** spec 2026-08-02 (Matriz Geracional Aurix), PR #107 (Trilha IA — Cognição de Combate)

---

## 1. Decisão de produto

Toda a progressão da história vive em **documentos corporativos** da Aurix
Dynamics. Protocolos já desbloqueavam documentos; esta spec estende o mesmo
mecanismo a **Ativos** (inimigos identificados) e **Descobertas** (bits
`DISCOVERY_*`), e transforma o conjunto numa **história única** com cronologia
editorial global — sem revelar tudo de uma vez.

Princípios:

- Documentos de Ativos **não são bestiário**: são classificação de ativo,
  avaliação de risco, ordem de contenção, autorização de descarte, contrato de
  aquisição, laudo censurado. O primeiro documento nunca conta tudo; os
  posteriores, ligados por código, contam o que o primeiro negou.
- As **lições curtas** das Descobertas continuam na tela do Registro como
  resumo de campo; a narrativa completa vive nos documentos.
- Documento novo ganha **indicador visual (bolinha)** até ser aberto.
- O jogador navega do Registro para o Codex por **"Ver docs ↗"**, com filtro
  contextual — nunca para o topo genérico.

## 2. Arquitetura

A divisão de trabalho da progressão não muda:

```
progression-lore.ts       catálogo + gatilhos (dado puro)
progression-lore-text.ts  os 75 textos, pt-BR e en (só no servidor)
progression.ts            decide (puro): fatos → desbloqueio, leitura
progression-store.ts      persiste o decidido (atômico, idempotente)
progression-http.ts       traduz HTTP e protege a rota
```

O corpo dos documentos continua morando **apenas no servidor**: "bloqueado" é
uma afirmação sobre bytes que o cliente nunca recebeu. O cliente não carrega
mapa arquétipo→código no bundle (o prefixo do código entregaria o ato); o
índice "Ver docs" é **derivado no servidor** (`loreIndex`) e só contém Ativos
conhecidos e Descobertas feitas.

## 3. Modelo unificado de gatilhos

`unlockedByUpgradeId`/`unlockedByGeneration` foram substituídos por uma união
discriminada:

```ts
type LoreUnlockTrigger =
  | { kind: 'default' }
  | { kind: 'upgrade'; upgradeId: UpgradeId }
  | { kind: 'generation'; generation: ProspectorGeneration }
  | { kind: 'asset'; archetype: EnemyArchetype; minKills?: number }
  | { kind: 'discovery'; discoveryBit: number }
  | { kind: 'compound'; allOf?: LoreUnlockTrigger[]; anyOf?: LoreUnlockTrigger[] };
```

`minKills` (default 1) transforma um Ativo numa **trilha de marcos**: o perfil
autoritativo acumula `assetKills` por arquétipo a cada liquidação re-simulada,
e documentos posteriores abrem em limiares de abates. `knownArchetypes` passa a
ser projeção materializada de `assetKills > 0`; perfis da versão anterior
(lista de conhecidos sem contagem) migram como "pelo menos 1", sem inventar
progresso de marco.

- `triggerSatisfied(trigger, facts)` é pura; `facts` (`LoreFacts`) derivam do
  perfil autoritativo: árvore comprada, gerações alcançadas, arquétipos
  conhecidos, bitmask de descobertas.
- `unlockedLoreFor(facts)` é a **única** porta de derivação de desbloqueio —
  perfil novo, reparo, liquidação e compra passam todas por ela. Não existe
  segunda fonte de verdade.
- `compound` vazio não abre nada (erro de catálogo, coberto por teste de
  validade). O catálogo tem um compound real: `AX-UNK-051` exige
  `DISCOVERY_CORE_TAKEN` **e** `asset: guardian`.
- Um gatilho público (`PublicLoreTrigger`) viaja apenas em documentos já
  desbloqueados; `compound` não enumera as partes (um `anyOf` não cumprido
  nomearia o que o jogador ainda não viu).

## 4. Catálogo: 75 documentos

35 existentes + 40 novos: 30 de protocolo, 4 marcos geracionais, 1 público,
**25 de Ativo** (15 fichas + 4 marcos do Corcel + 6 das linhas de Solaris),
**13 de Descoberta**, 2 compostos (AX-UNK-051 e o capstone AX-UNK-054).

Trilha IA (já existente, PR #107): IA-01→AX-PUB-009, IA-02→AX-ENG-020,
IA-03→AX-PRC-024, IA-04→AX-INC-032, IA-05→AX-EXE-040, IA-X→AX-UNK-052.

Ativos (revelados no primeiro abate confirmado por re-simulação — o mesmo
comportamento do Registro local; nada é listado antes):

| Arquétipo | Documento | Voz |
| --- | --- | --- |
| stalker | AX-ENG-012 | classificação de rotina, "fauna hostil" |
| spitter | AX-ENG-014 | avaliação de risco; amostra > abate |
| bomber | AX-ENG-016 | valor de exploração da detonação |
| bruiser | AX-PRC-015 | relatório de perdas precificado |
| miner | AX-PRC-017 | contrato de aquisição da série EX |
| fungal_horse | AX-INC-024 | contato: três negações para "sela" |
| resonant | AX-ENG-017 | assinatura que responde antes do estímulo |
| mud_lamprey | AX-PRC-018 | análise de sinistro de carga |
| bellows | AX-INC-022 | "coincidência de deslocamento" |
| scoriac | AX-INC-026 | territorialidade rebaixada por custo |
| frost_wraith | AX-INC-028 | anomalia de instrumentação |
| sulfur_bomber | AX-PRC-020 | contestação científica censurada |
| undertaker | AX-UNK-043 | quem recolhe os núcleos caídos |
| bishop | AX-EXE-034 | ordem de contenção informacional |
| guardian | AX-EXE-039 | autorização de descarte |

Descobertas: FIRE_SPREAD→AX-ENG-021, GAS_IGNITION→AX-INC-030,
DISCHARGE_POOL→AX-ENG-022, ORE_CHAIN→AX-PRC-022, FRAGILE_BREACH→AX-PUB-004,
SELF_HARM→AX-PUB-006, MINER_FLED→AX-EXE-035, MINER_ENRAGED→AX-ENG-025,
CARGO_LOST→AX-PRC-023, HORSE_FELLED→AX-INC-033, BISHOP_FELLED→AX-UNK-045,
GUARDIAN_FELLED→AX-EXE-042, CORE_TAKEN→AX-UNK-050. O bit aposentado
(`DISCOVERY_ORE_QUOTA_RETIRED`) fica fora do catálogo e é mascarado na
persistência.

### O arco do Corcel Fúngico (marcos de abate)

O EQ-02 ganha uma trilha própria, de tom **cômico-burocrático** que escala até
o trágico — a papelada tentando não ver um cavalo, até não conseguir mais:

| Abates | Documento | Conteúdo |
| --- | --- | --- |
| 1 | AX-INC-024 | ficha de contato: três negações para "sela" |
| 3 | AX-ENG-023 | consulta taxonômica: o formulário não tem campo "cavalo"; a crina é queratina e o espécime é micélio; "usar o campo OUTROS" |
| 6 | AX-INC-034 | emissão térmica: fungo não produz fogo — "a rigor, deveria SER fogo, uma única vez"; as carcaças são o mesmo indivíduo, "não perguntaremos como" |
| 10 | AX-EXE-043 | ordem de vocabulário: proibidos "cavalo", "voltou" e "sonho"; unidades captam, a cada queda, uma voz humana cantarolando — sempre a mesma |
| 15 | AX-UNK-046 | **Sobre o cavaleiro**: a voz é do Major Tom, chefe de turno do bloco habitacional 7 da operação anterior, que perdeu esposa e filhos para a contaminação fúngica classificada como "perda aceitável" e desceu ao Veio sem equipamento de retorno. O micélio guardou o sonho de revolta dele; o Corcel é a forma que a revolta encontrou, e o fogo é o que ele achava da tirania. Não existe autorização de descarte para um sonho. (Referências a Space Oddity: "controle da superfície", "digam à minha esposa que eu a amo — ela já sabia", o circuito que cai, a pergunta final sem resposta.) |

A necropsia (AX-INC-033, via `DISCOVERY_HORSE_FELLED`) costura o arreio ao
cavaleiro: as fivelas são da linha de equipamento de pessoal do bloco 7.
Limiares baixos de propósito — o EQ-02 é um miniboss e a piada morre se o
segredo exigir farm.

### As linhas de Solaris (espécimes raros como pessoas)

Premissa (inspiração declarada: *Solaris*, Tarkovsky 1972): o Veio guarda quem
morre nele e devolve não o corpo, mas o **gesto** — o que a pessoa fazia pelos
outros quando terminou. O Major Tom inaugurou o padrão; três assinaturas de
bioma o estendem, cada uma com dois marcos (8 = a anomalia que a burocracia não
consegue arquivar; 20 = o nome):

| Espécime | 8 abates | 20 abates | A pessoa e o gesto |
| --- | --- | --- | --- |
| Fole (SULF-08) | AX-ENG-019 — o órgão é um fole que "respira para fora", em 84 cpm, compasso ternário; "não existe terminologia aprovada" para valsa | AX-UNK-042 — *Sobre quem dava o ar* | V., operador de ventilação do bloco 7, tocava fole na cantina; quando a manutenção saiu do orçamento (↔ AX-PRC-016), morreu na manivela do fole manual dando ar à galeria. O espécime dá às máquinas da Aurix o ar que a companhia deu a ele |
| Lampreia (AQU-03) | AX-INC-031 — a preensão imobiliza SEM danificar; 97% de correspondência com a "pega de resgate de vítima em pânico", figura 12 do manual de mergulho | AX-UNK-048 — *Sobre quem buscava* | D., mergulhadora de resgate cuja função o parecer "reposição versus resgate" (↔ AX-PRC-014, AX-EXE-031) encerrou — ela não; morreu segurando o quarto resgatado. A Lampreia larga a carga para carregar gente e resgata na única direção que restou |
| Espectro de Geada (GLAC-02) | AX-EXE-037 — a ordem que cortou a redundância de aquecimento, o "desvio" da operadora de caldeira, e a apuração "encerrada por falecimento da apurada" | AX-UNK-053 — *Sobre quem aquecia* | R., operadora de caldeira que mandou o calor todo para os dormitórios e congelou na casa de máquinas. O espécime subtrai calor porque ela nunca parou de dar o dela |

**Capstone** AX-UNK-054 — *Sobre o que o Veio guarda* (compound: os quatro
finais — Corcel 15, Fole 20, Lampreia 20, Espectro 20): nomeia o fenômeno sem
resolvê-lo — "chamamos de contaminação porque a alternativa era chamar de
memória" — e planta a pergunta que liga tudo aos Ecos e ao Núcleo: o que
acontece no dia em que todos se lembrarem, ao mesmo tempo, de quem os deixou
lá?

Regras de escrita mantidas (cabeçalho de `progression-lore-text.ts`): voz de
relatório, sem vilão declarado, redação com moderação, nenhuma resposta
fechada, curto. Cada descoberta "nova" prova que **a Aurix já sabia** (ensaios
arquivados antes do programa); cada Ativo escala da zoologia de rotina até as
três negações do óbvio.

## 5. História única e cronologia global

`CHRONOLOGY` é posição editorial explícita, cobrindo os 64 documentos
exatamente uma vez, na curva: **I Promessa (PUB) → II Procedimento (ENG) →
III Custo (PRC) → IV Incidente (INC) → V Encobrimento (EXE) → VI Memória
(UNK)**, com marcos GEN intercalados. Documentos de protocolo, Ativo e
Descoberta compartilham a mesma linha do tempo; o Codex ordena por ela, então
qualquer rota de desbloqueio lê uma história legível. Documento posterior não
resume documento ainda bloqueado — ele referencia por código, e o código chega
mascarado (`AX-███-041`) enquanto não houver autorização.

`relatedFragmentIds` formam caminhos de investigação (exemplos: EQ-02 contato
→ necropsia → o que o Bispo guardava; série EX: classificador → contrato →
tolerância térmica → desvio operacional; Guardião → descarte → reclassificação
→ o Núcleo como uma de várias fontes). Relacionado bloqueado = código
mascarado, sem título, sem categoria, sem prefixo de ato.

## 6. Trilha IA e auto-aim

Entregues no PR #107 e **não alterados** por esta spec: os seis protocolos
(IA-01..IA-X), tuning `combat.*` fora do hash autoritativo, assistência
resolvida na camada de entrada do cliente (o comando gravado é um `aim` comum
que o servidor re-simula identicamente), auto-aim que não atravessa parede,
não adquire passivo/em fuga e cede à mira manual. Esta spec conecta a trilha à
narrativa: os seis documentos de IA existiam; agora eles se costuram aos
documentos da série EX (`AX-ENG-020 ↔ AX-PRC-017`) e ao arco do modelo que se
lembra. Cobertura de teste: `combat-assist.test.ts`,
`sim/tests/progression.test.ts`, `tuning-aplicado.test.ts`,
`determinism.test.ts`, `replay-canonical.test.ts`.

## 7. Persistência e autoridade (Opção A — settlement autoritativo)

Escolhida a **Opção A**: a liquidação re-simulada deriva os fatos narrativos.

- `StoredProfile` ganha `knownArchetypes: EnemyArchetype[]`,
  `discoveries: number` (bitmask restrita a `LORE_DISCOVERY_MASK`) e
  `readLoreFragmentIds`.
- `settleRun` recebe `kills` e `discoveries` **do replay canônico**
  (`summary.stats`), nunca do corpo da requisição. `applySettlement` funde:
  união de arquétipos com abate > 0, OR de bits, e re-deriva
  `unlockedLoreFragmentIds` no mesmo objeto — recompensa, estatísticas, Ativos,
  Descobertas, documentos e versão do perfil gravam **na mesma transação**.
- Idempotência: a barreira `unique (profile_id, run_id)` continua sendo a
  única porta; reenviar um settlement devolve o resultado persistido e não
  altera o perfil (união e OR são idempotentes por construção, coberto por
  teste).
- Postgres: `alter table ... add column if not exists` para `known_assets`,
  `discoveries`, `read_lore` (o `create if not exists` não altera tabela
  existente).
- O Registro local (`records.ts`, localStorage) permanece para histórico e
  apresentação, **sem autoridade** sobre documentos.

## 8. Estado de leitura

- Vive no perfil autoritativo (`readLoreFragmentIds`), porque o desbloqueio já
  vive lá: sobrevive a sessões e dispositivos quando o perfil é recuperado.
- **Não** entra em hash de simulação e **não** sobe `profileVersion`: leitura é
  apresentação persistida, e bumpar a versão faria toda abertura de documento
  derrubar uma compra concorrente em 409. No Postgres, só `markLoreRead`
  escreve `read_lore` (settle/purchase não tocam a coluna), então leitura
  concorrente nunca é sobrescrita.
- Regra de leitura escolhida (consistente e testável): um documento é marcado
  lido quando o jogador **abre o documento** (clique/Enter no cabeçalho, que
  expande o corpo) ou quando a **revelação pós-compra** exibe o corpo inteiro.
  Abrir a aba do Codex **não** marca nada.
- Invariante `lido ⊆ desbloqueado` garantida em `sanitizeProfile`; documento
  bloqueado nunca aparece como não-lido (não aparece de forma alguma).
- Rota: `POST /api/progression/codex/:id/read` — idempotente; bloqueado e
  inexistente respondem 404 idênticos.
- Cliente: otimista (bolinha some no clique; falha do POST = bolinha volta na
  próxima sessão, que é o correto para estado não confirmado).

## 9. Protocolo

- `PublicProgressionProfile` += `readLoreFragmentIds`, `knownAssetArchetypes`,
  `discoveries`, `loreIndex` (`assets`/`discoveries` → ids desbloqueados).
- `PublicLoreFragment`: `trigger: PublicLoreTrigger` substitui os dois campos
  antigos; += `read: boolean`.
- Novos tipos: `CodexContext` (`all` | `asset` | `discovery` | `upgrade`) e
  `MarkLoreReadResponse`. O contexto nunca viaja — é filtro de apresentação
  sobre documentos já autorizados.
- `CodexResponse` continua separando `unlocked` / `locked` / metadados seguros
  (`maskedCode`, `clearanceLevel`, `category`).

## 10. UX e navegação

- **Registro › Ativos**: cada Ativo conhecido com documentos ganha
  "Ver docs ↗" (ícone arrow-square-out, aparência secundária compacta, alvo de
  toque ≥44px em pointer coarse, `aria-label` com o nome do Ativo) e bolinha
  quando houver documento relacionado não lido. Ativo bloqueado não exibe o
  link (revelaria que existe ficha).
- **Registro › Descobertas**: mesmo padrão por descoberta feita; lições curtas
  preservadas.
- Clique: fecha o Registro, abre Matriz › Arquivos com filtro contextual,
  rola/foca o primeiro documento relevante e mostra "← Voltar ao Registro"
  (que preserva a aba anterior — o módulo do Registro já lembra a aba ativa).
- **Codex**: barra de contexto (rótulo do filtro + "Todos" + retorno);
  documentos em acordeão (cabeçalho-botão com `aria-expanded`, código, título e
  bolinha); relacionados desbloqueados são links de navegação interna,
  mascarados são texto; lista de bloqueados só aparece sem filtro; estados
  vazio/carregando/indisponível/sem-documentos preservados do painel atual.
- Bolinha na aba "Arquivos" quando `unlocked − read > 0`, derivada do perfil
  (não do codex em cache). Bolinha nunca é cor sozinha: `title` + texto
  `sr-only`.
- A tela continua um arquivo corporativo (códigos, carimbos, redações,
  autorização), não uma árvore visual.

## 11. Migração de perfis existentes

- Dados já autoritativos (protocolos, geração): documentos **recomputados** por
  `sanitizeProfile` na leitura — desbloqueios preservados, ids desconhecidos
  normalizados, nada duplicado (a lista materializada é conveniência; a verdade
  são os fatos).
- Ativos e Descobertas locais (**decisão documentada**): **não importar**. O
  Registro do navegador é editável e cobre modos não elegíveis; conceder
  documentos por ele abriria no dia um o buraco que a arquitetura fecha. A
  progressão narrativa autoritativa começa a contar da **próxima run
  liquidada**. Perfis antigos recebem colunas com default vazio.
- `readLoreFragmentIds` nasce vazio para todos (não havia estado de leitura).

## 12. Acessibilidade

- Cabeçalho de documento é `<button>` com `aria-expanded` e rótulo
  código+título+"novo"; foco restaurado por `data-ax-focus` sobrevive ao
  redesenho; navegação contextual foca o documento pedido uma única vez.
- "Ver docs" tem `aria-label` descritivo e suporte a teclado nativo (botão).
- Bolinha carrega rótulo para leitor de tela; `prefers-reduced-motion` não é
  afetado (nenhuma animação nova).

## 13. Riscos

- **Volume de texto autoral** (29 documentos × 2 idiomas): revisão editorial
  humana recomendada; o tom foi calibrado pelas regras existentes.
- **Perfis em memória** (sem `DATABASE_URL`): fatos narrativos não sobrevivem a
  restart — mesmo trade-off já declarado da carteira.
- **Leitura otimista**: um POST de leitura perdido ressuscita a bolinha; aceito
  por design.
- **Crescimento do catálogo**: `codexFor` serializa 64 documentos; ainda barato
  e atrás do rate-limit de leitura existente.

## 14. Testes (adicionados nesta entrega)

- Servidor/domínio (`tests/progression.test.ts`): catálogo 64 = 30+4+15+13+1+1;
  todo Ativo e toda Descoberta têm documento; todo gatilho é válido; cronologia
  cobre todos exatamente uma vez; relações apontam para ids existentes;
  desbloqueio por Ativo/Descoberta abre só o seu documento; compound exige
  todas as partes (inclusive entre runs); `triggerSatisfied` por tipo;
  settlement funde fatos, é idempotente e não conta duas vezes; abate zero não
  torna conhecido; `loreIndexFor` só lista o conhecido/feito; leitura nasce
  não-lida, marca só um documento, é idempotente, não sobe versão, persiste,
  bloqueado nunca é lido, lido ⊆ desbloqueado.
- HTTP (`tests/progression-http.test.ts`): corpo bloqueado não viaja; códigos
  mascarados sem prefixo de ato; rota de leitura marca/persiste/idempotente;
  bloqueado e inexistente respondem 404 idênticos; `read: true` no codex.
- Cliente (`panel-focus.test.ts`): "Ver docs" só em Ativo conhecido com docs e
  com contexto correto; bolinha aparece e some após leitura; sem perfil não há
  link; Descoberta com contexto próprio; bolinha na aba de Arquivos; abrir
  documento mostra corpo e dispara marcação; filtro contextual esconde os
  demais e oferece "Todos"; retorno ao Registro presente; navegação contextual
  abre e foca o documento.
- Trilha IA/auto-aim: cobertura pré-existente (PR #107) verificada — alvo por
  distância, desempate por id, parede bloqueia, passivo/fuga ignorados,
  enfurecido adquirido, mira manual prevalece, replay determinístico, hash
  estável.

## 15. Fora de escopo (deliberado)

- Importar Ativos/Descobertas do Registro local (ver §11).
- Documentos por seed dominada, por co-op ou por modo ranqueado (modos
  padronizados não usam progressão de campanha).
- Editor/CMS de documentos; os textos são código-fonte revisável.
- Busca textual no Codex e árvore visual de relações.
- Notificações push/toast de documento novo fora dos painéis.
- Localização além de pt-BR/en (padrão vigente do Codex).
