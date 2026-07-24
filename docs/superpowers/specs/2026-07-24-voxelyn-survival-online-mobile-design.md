# Voxelyn Survival — Spec executável (2026-07-24)

Transformação do Voxelyn Roguelike em um **real-time action survival roguelike mobile-first**,
com mundo procedural sistêmico, permadeath e co-op PvE opcional para 2 jogadores.

Documentos irmãos:

- Auditoria de baseline: `docs/audit/2026-07-24-phase0-audit.md`
- Art bible: `docs/art/voxelyn-survival-art-bible.md`

## 0. O que o jogo É e o que NÃO é

**É**: um sobrevivente frágil dentro do **Veio** — mina/organismo subterrâneo procedural que
reage, se deteriora e mata. Runs de 12–20 min, permadeath, builds temporárias, o mundo como
antagonista principal. Difícil, opressivo, sistêmico, emergente — princípios gerais de design
sistêmico (mundo procedural, simulação por células, materiais que interagem, destruição do
cenário), **sem copiar** personagens, sprites, UI, lore, inimigos ou arte de nenhum jogo.

**NÃO é**: RTS. Sem tropas, bases, construção, economia, exércitos, produção de unidades,
captura territorial. Anti-escopo completo em §14.

Critério de sucesso nº 1: *existe uma run solo difícil, sistêmica e divertida o suficiente
para justificar levá-la para o online?* Rede vem depois da diversão, nunca antes.

## 1. Fantasia central e loop da run

O jogador é um prospector isolado descendo no Veio para extrair um núcleo e sair vivo.

Loop (uma run):

1. entrar numa região procedural (seed própria);
2. explorar sob visibilidade limitada;
3. identificar perigos (materiais, criaturas, eventos);
4. coletar recursos e componentes;
5. improvisar uma build (artefato + núcleo + modificadores);
6. decidir: **avançar por algo melhor ou extrair agora e preservar a run**;
7. enfrentar evento/elite/guardião;
8. alcançar a extração;
9. morrer (permadeath) ou escapar;
10. registrar descobertas → desbloqueios entram no *pool* (nunca stats permanentes).

Tensão permanente: a extração antecipada sempre existe e sempre custa a recompensa maior.

## 2. Princípios de design (invariantes)

1. **Difícil mas legível** — morte por decisão arriscada, despreparo, interação desconhecida,
   posicionamento, artefato mal usado, ganância de tempo, reação em cadeia compreensível.
   Proibido: dano sem sinalização, spawn sobre o jogador, geração insolúvel, hitbox injusta.
   Todo perigo tem telegraph visual (paleta de perigo da art bible) e/ou sonoro.
2. **O mundo é o inimigo principal** — criaturas são só parte da ameaça; ver §4.
3. **Roguelike verdadeiro** — seed, permadeath, loot variável, builds diferentes, começo/
   desenvolvimento/conclusão. Metaprogressão = variedade (itens/inimigos/biomas no pool,
   bestiário, cosméticos), não poder numérico.
4. **Emergência sobre roteiro** — sistemas que geram histórias (explosão abre rota; gás
   ocupa a sala baixa; fogo consome a vegetação que segurava um teto), não centenas de salas.

## 3. Combate (tempo real, 1 personagem)

Verbos: mover (contínuo), mirar, ataque principal, habilidade secundária, esquiva (i-frames
curtos + custo de stamina/carga), interagir, consumível. O cenário participa: atirar num
reservatório, derrubar suporte, acender biofluido, quebrar parede frágil.

Decisão técnica (registrada): o movimento atual bump-grid 90 ms vira **movimento contínuo
sub-tile** (posição em float, colisão contra o grid de células). O grid continua sendo a
verdade para materiais/destruição; entidades se movem livre sobre ele. É a menor mudança que
entrega feel de action com joystick sem reescrever o mundo.

## 4. Materiais e reações (vertical slice)

6–8 materiais/features, 3 reações sistêmicas **de verdade** (não dezenas superficiais).
Reaproveita `material-physics` do core (reações, difusão de calor) e as features existentes
(biofluido, esporos, cristais, raízes, trilhos).

Materiais do slice:

| Material | Comportamento |
| --- | --- |
| Rocha | estática; variante **frágil** destrutível por explosão/perfuração |
| Chão fúngico | vegetação; queima; regenera lentamente |
| Biofluido | líquido; escorre; **condutor**; inflamável quando "maduro" |
| Gás de esporos | flutua e se acumula em áreas fechadas; tóxico; inflamável |
| Fogo | propaga por inflamáveis; consome fungo; se extingue sem combustível |
| Cristal energético | descarga elétrica quando quebrado; conduz pelo biofluido |
| Raiz dinâmica | fecha/abre rotas ao longo do tempo (já existe: dynamic corridors) |
| Minério | recurso; parede escavável lenta |

As 3 reações canônicas do slice (todas com teste automatizado):

1. **Fogo × biofluido/esporos**: fonte de ignição + inflamável → propagação em cadeia com
   orçamento por tick; fogo consome fungo e abre/fecha rotas.
2. **Eletricidade × biofluido**: cristal quebrado (por tiro, explosão ou inimigo) descarrega
   por toda a poça conectada — dano a quem estiver nela, jogador incluído.
3. **Explosão × rocha frágil**: rompe paredes, revela bolsões (loot, gás acumulado ou criatura)
   e pode desabar células soltas.

Regra de ouro: cada reação afeta igualmente jogador e criaturas.

## 5. Criaturas (vertical slice)

4 arquétipos + 1 elite + 1 guardião, evoluindo os existentes:

| Criatura | Papel | Interação sistêmica |
| --- | --- | --- |
| Stalker | pressão de flanco, rápido, frágil | evita fogo; se esconde em áreas escuras |
| Bruiser | tanque lento, quebra terreno ao investir | investida rompe rocha frágil |
| Spitter | pressão à distância | projétil deixa poça de biofluido |
| Spore bomber | kamikaze | explosão libera gás de esporos |
| Elite (variação mutada de um arquétipo) | pico de tensão | aura ligada a um material (ex.: ignição) |
| Guardião do Núcleo | teste final antes da extração | arena com materiais reativos; luta usa o cenário |

Spawn nunca dentro do raio de visão nem sobre o jogador (teste existente é mantido).

## 6. Equipamentos e builds

Sistema modular próprio (não cópia de varinhas):

- **Artefato principal** (arma/ferramenta): define o disparo base.
- **Núcleo energético**: define cadência, cargas, recarga e um trade-off (ex.: núcleo instável
  = +dano, gera **calor**; calor alto = auto-dano/ignição).
- **Modificadores** (0–3 slots): perfurante (rompe rocha frágil), condutor (+dano em molhado),
  explosivo (perigoso em espaço fechado), sifão (drena vida), criogênico (congela líquido →
  cria passagem), esporífero (nuvem que afeta todos).
- 3 categorias de equipamento: artefato, núcleo, utilitário (consumível/ferramenta).
- 6–8 itens no pool do slice. Toda build forte carrega custo/risco/domínio.

Uma escolha de upgrade por marco (guardião de área/elite), com 2 opções — mantém o sistema de
choices atual, reduzido e mais significativo.

## 7. Mobile-first

Landscape prioritário. Controles touch:

- joystick virtual esquerdo (movimento contínuo);
- área direita de mira com **auto-fire enquanto mira** (configurável);
- botões: habilidade, esquiva, interação (contextual), consumível — máximo 4 botões + joystick;
- aim assist configurável (magnetismo angular leve);
- inventário simplificado (folha inferior, pausável em solo);
- safe areas (env(safe-area-inset-*)), DPR limitado a 2, presets de qualidade
  (partículas/iluminação/sombras), fallback 30 FPS, háptica opcional.

Teste de usabilidade nº 1: *sobreviver, mirar, fugir, usar habilidade e interagir sem olhar
para os controles*. Teclado+mouse preservados no desktop.

## 8. Arquitetura

### 8.1 Separação (sem big bang, sem ECS por preferência)

Fronteiras que **serão criadas** (confirmadas contra o acoplamento mapeado na auditoria):

- `@voxelyn/survival-sim` — simulação headless pura (regras, materiais, criaturas, runs);
- `@voxelyn/survival-protocol` — tipos de comando/snapshot/eventos + versionamento + validação;
- `@voxelyn/survival-client` — app PWA (render iso, input touch/teclado, áudio, HUD);
- `@voxelyn/survival-content` — manifests de sprites, atlases, definições de itens/criaturas.

`@voxelyn/survival-server` só nasce na Fase 4. `@voxelyn/core`, `@voxelyn/animation` e
`@voxelyn/roguelike` permanecem; **o roguelike legado continua funcionando** durante toda a
migração (gate de toda fase).

### 8.2 API da simulação headless

```ts
createRun(config: RunConfig): SurvivalState
stepRun(state: SurvivalState, commands: readonly PlayerCommand[]): StepResult
createSnapshot(state: SurvivalState, viewerId?: string): SurvivalSnapshot
hashAuthoritativeState(state: SurvivalState): string
```

Proibições dentro da sim: `window`, `document`, Canvas, renderer, input físico, áudio,
vibração, `requestAnimationFrame`, `performance.now()`, WebSocket. Tempo = **ticks inteiros**
(20 Hz). Toda aleatoriedade via `RNG` do core, semeada por `createRun`. `StepResult` separa
estado autoritativo de **eventos semânticos** (para FX/áudio/mensagens — remove `messages`,
`screenFlash` etc. do estado da sim, corrigindo o acoplamento apontado na auditoria).

### 8.3 Mundo chunkado e orçamento de tick

A auditoria confirmou que não há chunks hoje. A sim introduz chunks 16×16 com:

- conjunto ativo: chunks perto de jogadores, com reações em andamento, com criaturas ativas,
  modificados recentemente; demais chunks suspensos;
- dirty tracking por chunk (versão incrementada a cada mutação de célula);
- **orçamento por tick** (valores iniciais, ajustáveis por preset): células reagindo ≤ 4096,
  partículas físicas ≤ 256, projéteis ≤ 64, inimigos ativos ≤ 48, propagações (fogo/gás)
  processadas por fila FIFO determinística com limite por tick;
- ao exceder orçamento, a fila **adia** trabalho para o próximo tick em ordem determinística —
  degrada latência da simulação, nunca o determinismo.

## 9. Rede e autoridade (Fase 4)

Servidor autoritativo sobre: jogadores, criaturas, vida, dano, loot, inventário, equipamentos,
cooldowns, geração, RNG, interações, mutações do mundo, conclusão da run. Clientes enviam só
**intenções** (mover, mirar, atacar, habilidade, esquivar, interagir, trocar item, consumível).
Cliente nunca afirma fato (posição final, dano, HP, item, kill, célula destruída, recompensa).

Protocolo JSON versionado: `protocolVersion`, `contentVersion`, `simulationVersion`,
`serverTick`, `sequence` + ack, deduplicação, validação de runtime (schema), heartbeat,
reconnect com resume token, full resync, limites de payload e rate limit de comandos.
Sem rollback netcode no slice: interpolação + tolerâncias de co-op PvE.

Sync do mundo destrutível: seed+versão do gerador → cliente gera o estado estático local →
hash inicial → diffs de chunks modificados (lista de chunks, versão, células alteradas) +
entidades criadas/atualizadas/removidas + eventos semânticos → snapshots periódicos de chunks
ativos → hash periódico da sim → divergência dispara resync. Nunca o grid inteiro por snapshot;
nunca lockstep puro.

Co-op: 2 jogadores; estado abatido (down) com sangramento, revive arriscado pelo parceiro,
arrastar o parceiro abatido, loot compartilhado por caches, decisão conjunta de extração.
Jogador morto de vez vira observador com ping — nunca minutos sem participação.

## 10. Vertical slice (escopo máximo)

Um bioma (Veio Fúngico), mapa procedural, run 12–20 min, 1 personagem, movimento+mira+ataque+
habilidade+esquiva, inventário pequeno, 3 categorias de equipamento, 6–8 itens, 4 arquétipos +
1 elite + 1 guardião, extração, permadeath, 1 escolha de upgrade, 6–8 materiais, 2–3 reações
funcionais, touch completo, desktop preservado. Nada além disso antes do gate da Fase 1.

## 11. Fases e gates

**Fase 0 — Auditoria e spec** ✅ (este PR): auditoria, baseline verde dos pacotes do jogo,
screenshots, art bible, esta spec.

**Fase 1 — Run solo divertida** (sem rede): movimento contínuo, combate real-time, materiais e
3 reações, criaturas, build, guardião, extração, permadeath, controles mobile.
*Gate*: run completa; mundo hostil; 2–3 interações ambientais reais; boss; extração; vontade
clara de jogar de novo. **Se não for divertido, não avança.**

**Fase 2 — Separação headless**: extrair `@voxelyn/survival-sim` + `survival-protocol`.
*Gate*: zero DOM na sim; mesma seed+comandos ⇒ mesmo hash; testes Node; cliente local usa a
mesma sim; roguelike legado intacto.

**Fase 3 — Nova direção visual**: pipeline da art bible, sprite viewer, primeiro pacote
(player, stalker, spitter, FX; depois bruiser, bomber, guardian; depois props).
*Gate*: assets validados por script; legibilidade mobile; antes/depois no PR. Nunca todos os
assets num PR só.

**Fase 4 — Online co-op**: `@voxelyn/survival-server`, salas de 2, sync entidades+chunks,
revive, loot compartilhado, reconnect.
*Gate*: duas abas completam uma run; cliente malicioso não concede nada; desconexão não
corrompe; mundo consistente; hash divergente dispara resync.

**Fase 5 — Mobile e PWA**: *Gate*: Android jogável só por toque; sem overflow; 30 FPS em
hardware intermediário; qualidade configurável; instalável como PWA; feedback de
offline/reconnect.

**Fase 6 — Render alpha**: Static Site (PWA) + Web Service Node (HTTP+WSS), instância única,
`render.yaml`, `/healthz`, `/readyz`, bind `0.0.0.0:$PORT`, CORS restrito, logs estruturados,
graceful shutdown/SIGTERM/draining. Sem Postgres antes de persistência real; sem KV antes de
precisar. Medir latência do Brasil antes de declarar o co-op viável. Solo/PWA funcionam com o
online fora do ar.
*Gate*: cliente e servidor públicos; duas pessoas completam uma run; reconnect ok; docs de
deploy e rollback.

## 12. Testes obrigatórios (checklist acumulativa)

Determinismo por seed+command log; sim independente de FPS; geração solucionável e saída
alcançável; jogador não nasce em material perigoso; boss acessível; reações limitadas por
orçamento; explosões não travam o tick; inventário idempotente; loot não duplica; permadeath
consistente; cliente não altera vida/item; jogador não controla o parceiro; reconnect restaura
estado; chunk diff (de)serializa; resync corrige divergência; spritesheets/anchors/atlas
válidos; controles touch; performance mobile; soak test com bots; roguelike legado preservado.

## 13. Observabilidade

Métricas: tick duration, tick overruns, active chunks, reacting cells, active particles,
projectiles, enemies, chunk diff bytes, snapshot bytes, RTT, reconnects, hash mismatches,
resyncs, run duration, death cause, extraction rate, item usage, quality preset, FPS, asset
version. Sem tokens nem dados sensíveis nos logs.

## 14. Anti-escopo (não implementar no alpha)

PvP; exércitos; bases; crafting gigante; dezenas de biomas; mundo aberto persistente; MMO;
guildas; chat global; battle pass; loja; blockchain/NFT; Kubernetes; microserviços; React
Native; centenas de jogadores; rollback netcode completo; geração ilimitada de células;
sprites finais sem art bible e validação.

## 15. Definition of Done do primeiro alpha

Identidade de survival roguelike; mundo como ameaça real; run solo divertida; morte que
ensina; mapa procedural sistêmico; permadeath; builds variadas; sprites principais
repaginados com consistência; jogável por toque; co-op de 2 completando runs; servidor
autoritativo; reconnect; cliente e servidor publicados; roguelike original funcional; testes,
lint (dos pacotes do jogo) e build verdes; limitações e próximos passos documentados.

## 16. Processo

Branch de trabalho desta transformação: `claude/voxelyn-survival-redesign-oi75jh` (designada
para esta sessão; PRs pequenos por fase/slice). Modelos: arquitetura/design/revisões complexas
com o modelo mais capaz; implementação com modelo intermediário; tarefas mecânicas com o mais
leve. Nenhum agente edita os mesmos arquivos simultaneamente. Após cada push relevante:
solicitar revisão, corrigir blockers/highs, justificar divergências, re-rodar testes/lint/
build, novo push.
