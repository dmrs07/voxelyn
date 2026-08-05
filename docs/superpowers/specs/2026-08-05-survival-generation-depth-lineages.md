# Linhagens de até sete setores, desbloqueadas pela geração do Prospector

**Data:** 2026-08-05
**Escopo:** `voxelyn-survival-sim`, `voxelyn-survival-protocol`, `voxelyn-survival-server`, `voxelyn-survival` (cliente)
**Depende de:** spec 2026-08-01 (Estratos e biomas), spec 2026-08-02 (Matriz Geracional Aurix), spec 2026-08-04 (Codex narrativo)
**Versões:** `PROTOCOL_VERSION` 18 → 19, `SIMULATION_VERSION` 31 → 32

---

## 1. Decisão de produto

A profundidade de uma run deixa de ser uma constante do jogo e passa a ser a
**autorização operacional** que a geração do Prospector concede.

| Geração | Setores acessíveis | Núcleos |
| --- | --- | --- |
| G-00 | 3 | setor 3 |
| G-01 | 3 | setor 3 |
| G-02 | 4 | setor 4 |
| G-03 | 5 | setores 3 e 5 |
| G-04 | 7 | setores 3 e 7 |

Toda linhagem geológica passa a resolver **sete** posições. Quantas delas a run
visita é outra pergunta, e a resposta é a geração congelada.

A profundidade **não** escala com chassi, protocolo individual durante a run,
minério, seed, equipamento visual, upgrade local ou Records/localStorage. Escala
somente com a geração autoritativa do perfil — que já é derivada dos protocolos
comprados. Não existe segunda derivação de geração neste trabalho.

### Política de G-00 (explícita)

G-00 fica com **três setores**, e não com zero ou com um número menor. Ele não é
"sem autorização": é o Prospector de fábrica — o que o ranqueado usa, o que o
co-op usa, e o que toda run gravada antes desta mudança foi. Rebaixá-lo
encurtaria runs existentes e mudaria a duração do ranqueado sem ninguém ter
pedido.

Geração **desconhecida** (perfil corrompido, cliente de outra versão, campo
inventado) normaliza para G-00 — `normalizeGeneration`. Rebaixar é a única
direção segura: a run fica curta, nunca longa demais para o que o jogador pagou.

---

## 2. Arquitetura

### 2.1 Fonte única da profundidade

```
constants.ts    MAX_LINEAGE_SECTORS = 7      (teto potencial da linhagem)
                DEFAULT_SECTOR_COUNT = 3     (fábrica, legado, ranqueado, co-op)

progression.ts  SECTORS_BY_GENERATION        geração → nº de setores
                sectorCountForGeneration()
                coreSectorsForGeneration()
                runDepthForGeneration()      → RunDepthConfig
                normalizeRunDepth()          saneamento de dado externo
                isValidRunDepth()            validação para o servidor
                normalizeGeneration()        política de geração desconhecida

depth.ts        as três perguntas da run, contra o estado congelado
```

`SECTOR_COUNT` **foi removido**. Não sobrou nenhuma constante global de
profundidade em uso: `depth.ts` é o único lugar que responde "quantos setores
tem esta descida", e ele lê da configuração congelada.

```ts
export type RunDepthConfig = {
  generation: ProspectorGeneration;
  sectorCount: number;
  coreSectors: readonly number[];
};
```

Os três campos viajam juntos porque só juntos significam alguma coisa: um
`sectorCount` sem `coreSectors` obrigaria todo consumidor a re-derivar a lista,
e re-derivar é exatamente o que o congelamento existe para impedir.

### 2.2 As três perguntas (`depth.ts`)

| Pergunta | API |
| --- | --- |
| este é o último setor? | `isFinalSector(sector, sectorCount)`, `isRunFinalSector(state)` |
| há Núcleo aqui, e já foi recolhido? | `hasCoreInSector`, `isCoreTaken`, `markCoreTaken`, `clearCoreTaken`, `countCoresTaken` |
| o selo deste setor já cedeu? | `sectorHasBoss`, `descentUnlocked`, `coreUnlocked`, `markSectorBossDown` |

Tudo função pura do estado; nenhuma consulta ao perfil, nenhuma RNG, nenhuma
escrita fora dos dois `mark*`. É o que permite ao cliente responder as mesmas
perguntas com o mesmo código.

### 2.3 Congelamento

A profundidade é resolvida **uma vez**, no momento em que o servidor emite o
ticket (`depthForProfile`), e gravada em `RunConfig.depth`. Depois disso o perfil
deixa de existir para aquela run.

Comprar um protocolo ou mudar de geração com uma run em andamento **não** altera
retroativamente: quantidade de setores, posição dos Núcleos, bosses, biomas,
seed derivada, regras de extração ou hash.

---

## 3. Linhagens com sete posições

`LINEAGES` passou de `ReadonlyArray` de três entradas para uma **tupla de sete**
`LineageStep`, com estrato, ocupação e o nome editorial da posição. As posições
1–3 são **exatamente** as históricas em toda linhagem.

| Linhagem | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hídrica | Galerias Úmidas | Aquífero Superior | Reservatório Negro | Galerias Submersas | Lençol Profundo | Colônia Abissal | Fossa do Aquífero |
| mineral | Basalto Cristalizado | Galerias Prismáticas | Catedral Prismática | Nervuras Ressonantes | Coro Mineral | Câmara de Reflexão | Coração Ressonante |
| industrial | Escavação Inicial | Galerias Ferríferas | Complexo Aurix | Linha de Extração | Cicatriz Aurix | Instalação de Recuperação | Poço Diamandis |
| térmica | Basalto Fraturado | Fenda Sulfurosa | Câmara de Ventilação | Galeria Carbonizada | Pulmão Profundo | Mar de Escória | Coração da Fornalha |
| árida | Basalto Seco | Sílica Fraturada | Sumidouros de Sílica | Galerias Móveis | Deserto Subterrâneo | Sílica Vitrificada | Ninho do Devorador |
| criogênica | Basalto Frio | Galerias de Geada | Cripta Glacial | Lençol Congelado | Câmara dos Ecos | Palácio de Gelo | Trono da Geada |
| basáltica | Galerias de Basalto | Galerias Inferiores | Câmara do Guardião | Fratura Basáltica | Colunata Profunda | Anfiteatro Negro | Raiz do Veio |

A metade profunda não é a repetição da rasa. Três decisões editoriais dão a
volta que a curva pedia:

- **hídrica** ganha uma segunda colônia micelial mais fundo (posição 6): a do
  setor 3 tinha tomado um reservatório; esta é o próprio lençol;
- **mineral** ganha uma câmara **Aurix** dentro da catedral (posição 6) — a
  ressonância do estrato era dado, e dado se mede;
- **térmica** ganha um pulmão de enxofre entre duas fornalhas (posição 5);
- **industrial** termina em `ferric/none` e não `ferric/aurix`: o poço leva o
  nome da máquina que o abriu, mas a operação parou antes de chegar lá. Sem
  isso, uma run de G-04 industrial enfrentaria o Diamandis **duas vezes**.

### 3.1 Compatibilidade de seed

`sectorBiome` clampa contra `MAX_LINEAGE_SECTORS`, **nunca** contra o
`sectorCount` da run: o bioma do setor N é função pura de `(seed, N)`. Duas runs
com a mesma seed em gerações diferentes veem os **mesmos** três primeiros
setores; o que a geração muda é até onde se pode ir.

Isto está provado, não afirmado: `tests/impressao-digital-geracao.test.ts`
continua na assinatura **2694607655** para os setores 1–3 das 64 seeds de
amostra, a mesma da `SIMULATION_VERSION` 18.

---

## 4. Progressão de intensidade

O `Math.min(SECTOR_COUNT - 1, sector - 1)` de `biomeProfile` foi substituído por
`depthIntensity(sector)`:

```
setor        1  2  3  4  5  6  7
intensidade  0  1  2  3  3  4  4
```

Idêntica ao índice cru até o terceiro setor (o que mantém a seed antiga
produzindo o mesmo mapa) e com **metade da inclinação** depois. Multiplicar
densidade linearmente até o sétimo entregaria uma Catedral com um terço de
cristal no chão e um Aquífero sem chão seco — profundidade lida como caos.

O que cresce fundo é a **composição**, não a densidade:

- `biomeMix` ganha um passo de contraponto a partir do **setor 5**
  (`DEEP_COUNTERPART`): uma vaga em cada quatro vira o contraponto do arquétipo
  — corpo-a-corpo vira alcance, alcance vira corpo-a-corpo. Mesmo tamanho de
  lista, mesma ordem de RNG, **mesma densidade**;
- bosses adicionais nos setores de Núcleo;
- arenas comprometidas pelo selo (portal e pedestal trancados);
- `normalizedDepth(sector, sectorCount)` existe para escalas proporcionais de
  **apresentação** — nunca para o worldgen, que produziria mapas diferentes para
  a mesma seed em gerações diferentes se lesse dali.

Nada de vida ou dano inflados por profundidade.

---

## 5. Núcleos

### 5.1 Modelagem

`coreTaken: boolean` **saiu**. Entrou `coresTakenMask: number` (bit N = Núcleo do
setor N), no estado e no hash. Máscara e não lista porque o campo é hasheado e
viaja em snapshot: um inteiro tem uma única representação, e duas simulações
nunca podem divergir por ordem de inserção.

Cada portador carrega `PlayerExtra.carriedCoreMask` — **quais**, não quantos.
Quando o portador cai, cada Núcleo volta **ao pedestal dele**. Um contador diria
"dois caíram" e não diria de onde; a run seguinte reabriria o pedestal errado.

`hasCore: boolean` continua existindo como derivado (`carriedCoreMask !== 0`):
é o que atravessa o wire, o que a extração pergunta e o que o HUD desenha.

### 5.2 Política de recompensa

- coletar o Núcleo **intermediário é opcional** e não encerra a run;
- o jogador pode continuar descendo carregando-o — o poço só sela quando o
  Núcleo **mais fundo** da run sai do pedestal (`runIsReturning`);
- cada Núcleo coletado eleva a contaminação (fator 2,2×) pelo resto da descida:
  recolher o intermediário é uma **aposta**, não ganho puro;
- somente extração bem-sucedida liquida;
- morrer ou abandonar segue a política atual de perda de carga;
- o servidor deriva a contagem da **ressimulação** (`summary.cores`), nunca do
  cliente. `rewardFor(phase, cargoOre, cores)` deixou de devolver o literal `1`;
- liquidação repetida continua idempotente pelas mesmas três camadas de antes
  (índice único, ledger, concorrência otimista).

---

## 6. Bosses por setor

### 6.1 Quem tem chefe

`sectorHoldsBoss(sector, sectorCount, coreSectors)`:

- o **setor 1 nunca** tem chefe — é onde a run ensina;
- o **último setor** da run tem;
- **todo setor de Núcleo** tem: o Núcleo está selado, e o selo precisa de um
  dono. Um pedestal que qualquer um alcança não é objetivo, é parada.

| Geração | Setores | Chefes |
| --- | --- | --- |
| G-00 / G-01 | 3 | 3 |
| G-02 | 4 | 4 |
| G-03 | 5 | 3 e 5 |
| G-04 | 7 | 3 e 7 |

Numa run de três setores isso dá exatamente o que sempre deu: um chefe, no
terceiro.

### 6.2 Quem é

`bossForSector(biome, sector, sectorCount, coreSectors)` → `SectorBossDefinition
| null`. A **posição** decide se há chefe; o **bioma** decide quem, pela mesma
regra de sempre (`bossForBiome`: ocupação forte primeiro, depois o dono do
estrato).

`bossArchetypeForBiome` passou a devolver `EnemyArchetype | null`. O fallback
universal no Guardião **saiu**: ele era invisível — uma linha da tabela sem
arquétipo passava a rodar como Galerias de Basalto em todo bioma que a
herdasse. Com `null`, o portal segue a regra normal de disponibilidade e nada
finge estar implementado.

Bosses suportados hoje (tabela completa, todos com arquétipo):

| Fonte | Bioma | Chefe |
| --- | --- | --- |
| ocupação | micelial | Bispo |
| ocupação | Aurix | Diamandis |
| estrato | basalto | Guardião |
| estrato | prismático | Arquicantor |
| estrato | aquífero | Leviatã do Lençol |
| estrato | enxofre | Pulmão-Matriz |
| estrato | fornalha | Coração da Fornalha |
| estrato | sílica | Devorador Branco |
| estrato | glacial | Rainha da Geada |
| estrato | ferrífero | Magnetarca |

### 6.3 Estado genérico

```ts
type SectorBossState = { archetype: EnemyArchetype | null; entityId: number | null; defeated: boolean };
```

Deliberadamente magro. Mecânicas próprias continuam em `bossRuntime` e nos
campos de cada chefe — generalizar a rota do Guardião e a arena do Diamandis num
tipo comum só produziria um objeto que nenhum dos dois preenche inteiro.

O ponto é outro: **o portal e o pedestal consultam o estado genérico**, e nunca
`bishop` ou `guardian`. Enquanto perguntavam por nome, a marca de chefe abatido
(`bossesDown`) ficou três versões enumerando dois arquétipos enquanto a tabela
crescia para dez — um Arquicantor abatido **renascia na subida**. A morte agora
compara o `entityId` que `populateSector` guardou.

`bossesDown` → `bossesDownMask`. A ausência de bit é ambígua de propósito
(significa "vivo" **e** "setor sem chefe"); quem precisa distinguir pergunta
antes se há dono (`sectorBoss.archetype`).

---

## 7. Selos: portal e Núcleo

```
descentUnlocked = !sectorHasBoss || sectorBossDefeated
coreUnlocked    = sectorHasCore && (!sectorHasBoss || sectorBossDefeated)
```

- setor **sem** chefe: o portal segue a regra normal. Não se cria chefe
  invisível, não se bloqueia indefinidamente, não se exige matar inimigo comum;
- setor **com** chefe vivo: o poço recusa (`sim.descentSealedByBoss`) e o
  pedestal recusa (`sim.coreSealedByBoss`). A recusa é **autoritativa** — o
  cliente não consegue forçar `take_core`;
- o Núcleo selado continua **visível**: selado não é escondido; o jogador tem de
  ver o que o chefe está guardando;
- a morte do chefe emite `sector_unsealed` e **não transporta ninguém**: ela só
  libera a possibilidade;
- quando portal e Núcleo dividem o setor, a mesma morte abre os dois;
- o desbloqueio persiste em `bossesDownMask`, que sobrevive à regeneração do
  setor na subida, à reconexão e ao replay.

### 7.1 O ponto especial compartilhado

Num setor de Núcleo intermediário, `corePos` é **as duas coisas**: recolhe-se o
Núcleo ali e desce-se dali mesmo, em duas interações. O pedestal vem primeiro —
quem chega quer o Núcleo que veio buscar, e descer sem ele por uma interação
ambígua seria perder a coleta atrás de um mapa que não volta.

Gerar um segundo ponto especial exigiria repetir a prova de alcançabilidade e —
pior — mudaria a geração semeada de **todo** mapa já existente.

---

## 8. Retorno

Ao subir: bosses derrotados não reaparecem; portais já desbloqueados continuam
desbloqueados; Núcleos coletados não reaparecem; a fauna repovoa como sempre; a
contaminação não alivia. O jogador nunca fica preso por um portal que voltou a
trancar — `bossesDownMask` é da RUN, não do setor gerado.

Os Ecos do poço deixam de ser revelados em qualquer setor com pedestal (antes:
só no último). Lá o ponto já tem dono e, quando há chefe, a arena dele em volta.

---

## 9. Determinismo e hash

Entram no hash autoritativo:

- `generation`, `sectorCount`, `coreSectors` (a configuração congelada);
- `coresTakenMask`, no lugar do booleano;
- `bossesDownMask` (renomeado, mesma semântica de bits).

Duas runs com a mesma seed e `sectorCount` diferente produzem hashes iniciais
diferentes — é o que impede o replay do leaderboard de verificar uma contra a
outra.

O worldgen **não** ganhou nada novo: nenhum RNG extra é consumido, nenhum mundo
futuro é pré-gerado, e bioma/chefe/seed de setor continuam saindo de funções
puras de `(seed, sector)`.

---

## 10. Ranked e co-op

**Ranked** continua em três setores. Dois mecanismos independentes já garantiam
isso e continuam garantindo: o modo ranqueado nunca recebe ticket
(`isRewardEligibleMode`), e `resimulateRun` sem `depth` cai em G-00 de fábrica.
Progressão permanente não alonga a prova ranqueada.

**Co-op** continua em três setores, e a decisão é explícita. Uma sala de co-op
não tem perfil: o handshake é anônimo e não há ticket, então não existe "a
geração de quem criou a sala" para consultar, e usar a menor geração dos
participantes exigiria autenticar todo mundo antes de gerar o primeiro mundo.

A política adotada é a mesma que o co-op já usa para o tuning — **G-00 de
fábrica, para todos** — agora congelada por sala em `GameRoom` e configurável
por `ServerOptions.coopDepth`. A autoridade é da **sala**: quem entra atrasado
recebe a configuração congelada pelo handshake (`welcome.sectorCount`,
`coreSectors`, `generation`), nunca a do próprio perfil.

---

## 11. Protocolo

- `ServerWelcome` ganha `sectorCount`, `coreSectors`, `generation`;
- `WorldFlags` mantém `coreTaken` (booleano de conveniência) e ganha
  `coresTakenMask`, `coreSectors`, `descentUnlocked`, `coreUnlocked`,
  `activeBoss`. Os selos são derivados **no servidor**: o cliente não
  reimplementa a regra de quem guarda o quê;
- `ViewerState` ganha `coreCount`;
- `sector_entered` ganha `sectorCount`, `hasCore`, `boss`, `unsealed`;
- entra `sector_unsealed`; `pickup_core` ganha `sector`/`taken`/`total`;
  `extracted` ganha `cores`;
- `ProgressionRunTicket` ganha `depth` (opcional na leitura para tickets
  antigos, que a checagem de `simulationVersion` já recusa);
- `IGNORED_CLIENT_CLAIMS` ganha `claimedSectorCount` e `claimedDepth`.

O cliente **não** recebe nada sobre o conteúdo dos setores que ainda não
visitou. O que ele recebe é o total acessível, que é o denominador do HUD.

Validação (`normalizeRunDepth` / `isValidRunDepth`): inteiros, `sectorCount`
entre 1 e 7, setores de Núcleo dentro da run, sem duplicatas, geração
reconhecida.

---

## 12. Interface

- **HUD**: `SETOR {n}/{total}`, com o total **acessível da run** e nunca o
  máximo potencial da linhagem. G-01 mostra `3/3` e lê como completa; `3/7` a
  faria parecer truncada por uma área perdida que ela nunca teve autorização
  para ver;
- **contador de Núcleos** (`NÚCLEOS {taken}/{total}`) só aparece quando a run
  tem mais de um. Numa run de um Núcleo a linha seria ruído;
- **objetivo**, em ordem de urgência: selo do setor → caminho de volta →
  Núcleo deste setor → descer. Quando o selo está de pé, a diretiva é
  `O SELO DO SETOR RESISTE — DERRUBE QUEM O SUSTENTA`;
- ao recolher um Núcleo **intermediário** a mensagem é
  `NÚCLEO RECUPERADO — DESCIDA ADICIONAL AUTORIZADA` (`sim.coreTakenDeeper`), e
  nunca a de fim de run;
- poço selado desenha `portal:sealed` e apaga a luz — por chefe vivo ou por
  retorno, a mesma leitura: um marcador não convida para uma interação que a
  simulação recusa;
- Núcleo selado desenha o pedestal normalmente;
- **tela de fim**: `NÚCLEOS EXTRAÍDOS ×{n}` quando há mais de um, e a carga
  informa a contagem em vez do literal `1 ◉`;
- **menu**: carimbo compacto de autorização antes de "Descer" — geração,
  profundidade autorizada, Núcleos detectáveis. Informativo, nunca um seletor;
  some inteiro quando não há perfil;
- textos em pt-BR e inglês, com o teste de paridade de placeholders do
  repositório valendo para todas as chaves novas.

---

## 13. Persistência e runs antigas

`normalizeRunDepth` é o único caminho de entrada:

- configuração **ausente** → três setores, Núcleo no terceiro;
- `coreSectors` ausente → `[sectorCount]`;
- valores fora de faixa, duplicados ou não inteiros → saneados contra o
  `sectorCount` que os acompanha.

A regra que rege a função: a lista de Núcleos é sempre saneada contra o
`sectorCount` que a acompanha, e **nunca re-derivada do perfil**. Uma run de três
setores gravada antes desta mudança continua sendo de três setores — o fato de o
perfil estar hoje em G-04 não a alonga retroativamente.

Postgres: `alter table progression_tickets add column if not exists depth jsonb`,
no mesmo estilo explícito das colunas narrativas. Ticket antigo volta como
`null` e é lido como a run de três setores que ele foi.

Runs liquidadas são linhas imutáveis e não migram. O bump de
`SIMULATION_VERSION` invalida todo ticket em voo — comportamento já existente e
pretendido (`version_mismatch`).

---

## 14. Codex

Quatro documentos novos, um por geração, com o mesmo gatilho dos marcos
`AX-GEN-*` mas assunto distinto: o marco é a homologação do **chassi**; a
autorização é um documento sobre o **Veio**. No Codex aparecem lado a lado pela
cronologia.

| Doc | Geração | Título | Ato |
| --- | --- | --- | --- |
| `AX-ENG-037` | G-01 | Autorização de Descida Padrão | II — Engenharia |
| `AX-PRC-027` | G-02 | Extensão de Garantia Estrutural | III — Aquisições |
| `AX-EXE-049` | G-03 | Protocolo de Recuperação Dupla | V — Executivo |
| `AX-UNK-068` | G-04 | Licença de Profundidade Irrestrita | VI — Não classificado |

A curva editorial acompanha a mecânica: três setores apresentados como
tolerância estrutural → um quarto autorizado porque a conta fechou (perder o
Prospector custa menos que interromper a operação) → o Núcleo intermediário
tratado como "redundância de coleta" e nunca como descoberta → sete setores, com
a admissão de que o limite anterior não era técnico, e sim uma política para
impedir Prospectors de alcançar determinadas áreas. O último cruza com a
Persistência Mnêmica e vem parcialmente censurado.

Regras preservadas: corpos bloqueados não são enviados ao cliente; leitura não
afeta gameplay; cronologia global; pt-BR e inglês.

Total do catálogo: 123 → **127** documentos.

---

## 15. Riscos conhecidos

- **Duração da run de G-04.** Sete setores mais o retorno ultrapassam a promessa
  original de 12–20 minutos. `targetExtractionTicks(sectorCount)` acompanha (4
  min/setor: 28 min para G-04), mas o teto de replay de 30 minutos
  (`MAX_REPLAY_TICKS`) fica apertado para uma run lenta de sete setores. Não foi
  alterado nesta entrega — a alternativa é aumentar o teto e o limite de 512 KB
  de log junto, e isso pede medição real antes.
- **Dois Diamandis.** Uma run de G-04 numa linhagem cuja intrusão Aurix caia nos
  setores 3 e 7 enfrenta o mesmo chefe duas vezes. Reduzido (a industrial deixou
  de forçar Aurix no fundo), não eliminado: a intrusão é sorteada por setor e
  pode coincidir.
- **Núcleo intermediário e contaminação.** O fator 2,2× a partir da primeira
  coleta é o número herdado do Núcleo único. Para uma run de sete setores ele
  pode ser severo demais se o jogador recolher no setor 3; precisa de playtest.
- **Co-op não usa a geração de ninguém.** É a decisão certa hoje (não há perfil
  no handshake), mas significa que um par de jogadores de G-04 não consegue
  jogar sete setores junto. Levantar isso exige autenticar a sala.
