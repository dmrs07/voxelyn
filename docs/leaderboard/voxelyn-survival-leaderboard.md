# Voxelyn Survival — Ranking e 3 estrelas

## 0. A pontuação: Núcleo e tempo

A posição de uma run sai de **duas** grandezas, nesta ordem:

1. **Núcleos extraídos** — mais primeiro;
2. **Tempo da run** — menos primeiro;
3. (empate real) quem chegou antes.

Nada mais entra, e *nada mais* é o ponto. Minério, abates, dano, células de purga são
consequência de **como** a run foi jogada; nenhuma delas é o que a run **pede**. Enquanto
o minério entrava na ordenação — como desempate, mas entrava —, ele era uma quarta
pergunta que o placar fazia e o briefing não.

A ordem entre as duas não é arbitrária. **Núcleo primeiro** porque ele é o objetivo: uma
descida que volta com dois cumpriu duas vezes o que a Aurix pediu, e nenhum tempo compra
isso. **Tempo depois** porque, cumprido o objetivo, a única pergunta que sobra é quanto o
Veio cobrou para soltá-lo — e é ela que mantém viva a decisão "extrair agora ou descer
mais um".

Lexicográfica, e **não** uma soma ponderada. Uma soma exigiria um câmbio entre segundo e
Núcleo que ninguém sabe cotar, e o primeiro playtest que mudasse a duração da run mudaria
o câmbio junto — o placar inteiro se reordenaria sem ninguém ter jogado nada.

**As estrelas deixaram de ordenar.** Uma run de dois Núcleos fora do tempo-alvo vale duas
estrelas e cumpriu o dobro de uma de três estrelas com um Núcleo só; ordenar pela nota
punia quem desceu mais fundo. As estrelas continuam sendo a *leitura* da run — elas só
não são mais a *posição* dela.

`compareRunScore` mora na **simulação**, junto de quem constrói o sumário, e o servidor
delega a ela. A pontuação é regra do jogo, não do banco: duas implementações da mesma
ordem (TypeScript e o `order by` do Postgres) já são uma a mais do que o seguro, e uma
terceira, divergente da sim, seria o jeito de a tela de resultado e o livro discordarem
sobre quem ganhou.

## 0.1. Um livro por profundidade

Descidas de três e de sete setores **não competem entre si**. A de sete tem mais Núcleos
disponíveis e leva o dobro do tempo: no mesmo livro, ela não compara habilidade, compara
**autorização** — e autorização se compra, não se joga.

A classe é o **`sectorCount`**, e não a geração. G-00 e G-01 autorizam a *mesma* descida
(três setores, Núcleo no terceiro); separá-los criaria dois livros para uma prova só, cada
um com metade dos jogadores. O que define a prova é a descida, e a descida é a contagem de
setores.

Os livros que o cliente vê são derivados **do que foi gravado**, nunca da tabela de
gerações: um seletor montado a partir de `SECTORS_BY_GENERATION` ofereceria quatro livros
vazios no dia do deploy, e um livro vazio que o jogador abre é uma promessa que o placar
não cumpriu. Com um livro só, o seletor não aparece.

### Como o servidor sabe a profundidade sem perguntar ao cliente

O corpo do POST **não tem** campo de profundidade — pelo mesmo motivo que não tem campo de
estrelas. O que ele carrega é o **`runId`** do ticket que *este* servidor emitiu; a
profundidade e o tuning saem de lá:

```
cliente  →  { seed, log, name, runId }   ← nenhum campo de configuração
servidor →  ticket[runId] → { seed, tuning, depth }
         →  re-simula com ESSA configuração
```

Um `runId` inventado não autoriza nada: cai no caminho de fábrica (três setores, sem
protocolo), que é o que toda run sem ticket sempre foi — inclusive a run offline e a de um
servidor sem progressão.

Ticket **vencido ainda serve** aqui. A validade existe para limitar a janela de uma
liquidação que *paga*; o livro não paga nada — ele só precisa saber sob qual descida
aqueles comandos foram gravados, e um ticket de ontem responde isso tão bem quanto um de
agora. Recusar jogaria fora a submissão honesta de quem perdeu a rede no fim da run.

Isto substituiu a política anterior (*"o ranqueado nunca herda profundidade: re-simula
tudo em três setores"*). Ela mantinha a comparação justa com um livro só, ao preço de
**recusar como fraude** toda run mais funda que três — o log de sete setores, alimentado a
uma run de três, não chega ao mesmo fim. O livro por classe faz o mesmo trabalho sem
cobrar isso.

## 1. As três estrelas

| Nota | Exigência |
| --- | --- |
| ★☆☆ | extraiu vivo |
| ★★☆ | trouxe **algum** núcleo |
| ★★★ | trouxe **todos** os núcleos da descida, **abaixo do tempo-alvo** (4 min × setores) |

A escada é de **intenção**, não de dificuldade bruta. Morrer não dá estrela — não é
um resultado parcial de extrair, é outro resultado. E a terceira estrela não adiciona
um objetivo novo: **cobra o mesmo objetivo, inteiro e com pressa**. É o que mantém viva a
decisão "extrair agora ou arriscar" depois que o jogador já aprendeu o mapa — com tempo
infinito, pegar tudo é sempre certo.

### Por que a contagem entra, e não só a fase

Enquanto a nota lia apenas `phase === 'extracted_with_core'`, uma run de G-04 (núcleos nos
setores **3 e 7**) que recolhia o **intermediário** e subia na hora ganhava **três estrelas
por metade do contrato** — e ganhava fácil, porque o tempo-alvo é derivado dos sete setores
enquanto a run só precisou de três. A saída antecipada era simultaneamente a jogada ótima
e a mais bem avaliada, que é o contrário do que a escada existe para dizer.

A regra corrigida devolve a decisão ao lugar certo: sair cedo com um núcleo **continua
valendo**, e continua valendo **duas** estrelas — mas o terceiro degrau agora custa o que
sempre disse custar. Em G-00, G-01 e G-02 nada muda: há **um** núcleo disponível, então
"todos" é "aquele", e a regra nova devolve exatamente a nota antiga.

A contagem sai de `cores`, o **mesmo número que ordena o ranking** (§0). Fazê-los lerem a
mesma grandeza é o que impede a tela de resultado e o livro de discordarem sobre a mesma
run — e produz a propriedade que sustenta a tela do ranking: **dentro de um livro, as
estrelas nunca sobem ao descer na lista**. Antes disso era falso, e uma ★★★ aparecia
abaixo de uma ★★☆; não era só feio, era o sintoma de a escada premiar meia entrega.

O tempo-alvo é derivado de `SECTOR_COUNT`, não um número solto: a run passou de um mapa
para três, e um alvo fixo passaria a significar outra coisa se o número de setores
mudasse. `TARGET_SECTOR_TICKS` é o único número aqui que se espera calibrar por playtest.

### O relógio do ar tem de acompanhar

O mesmo raciocínio vale para a **contaminação**, e lá ele tinha ficado para trás.
`CONTAMINATION_PER_TICK` foi calibrado quando toda run tinha três setores e doze minutos;
quando a profundidade virou dado da geração, o relógio ficou onde estava. Medido, com o
mesmo ritmo de jogo: a run de três setores saturava a **~89%** do caminho — o sprint final,
que *é* o clima pretendido — e a de sete saturava a **~58%**, com cinco setores de subida
pela frente e **21 segundos** de vida. Não era uma descida difícil, era uma descida
impossível, e nada denunciava isso porque cada constante, sozinha, continuava certa.

A taxa agora sai de `contaminationPerTick(sectorCount)`: mesma pressão medida **em fração
da run**, ar 2,3× mais lento por tick numa descida 2,3× mais longa. Tudo o mais continua —
acelerar por setor, aliviar no poço (e **só** no poço: a subida é a cobrança), dobrar com o
Núcleo, saturar perto do fim. Três setores fica bit a bit idêntico, o que permitiu o ajuste
sem tocar em nenhuma run que já aconteceu; profundidades maiores mudam de resultado, e por
isso `SIMULATION_VERSION` foi para **43**.

## 2. A garantia anti-cheat

**O cliente nunca submete um resultado.** Ele submete a seed e o que pressionou.

```
cliente  →  { seed, log, name, runId }  ← nenhum campo de pontuação
servidor →  re-simula                   ← descobre sozinho o que aconteceu
```

`runId` é **identidade, não afirmação**: ele nomeia um ticket que este servidor emitiu, e
é de lá que saem a seed, o tuning e a profundidade (§0.1). Um identificador inventado não
autoriza nada.

Não existe campo para mentir. Um cliente modificado que quisesse aparecer no topo teria
de produzir uma sequência de comandos que, alimentada à simulação autoritativa,
realmente chegasse ao núcleo e voltasse dentro do tempo — o que é a mesma coisa que
jogar bem.

Isso só funciona porque a simulação **já era** determinística por seed + comandos, e o
repositório já testava isso. O ranking não adiciona confiança nenhuma ao cliente; ele
colhe uma garantia que já existia.

### Dois caminhos, uma regra

| Modo | Como é verificado |
| --- | --- |
| **Co-op online** | O servidor **simulou a run**. O resultado já é autoritativo no instante em que nasce — pedir um log de volta seria pedir o que o servidor acabou de calcular. |
| **Solo** | O cliente envia `seed + command log`; o servidor **re-simula** e deriva o resultado. |

### A decisão crítica: quantizar na captura

`aim` é um vetor de float vindo do mouse ou do joystick. Codificá-lo em `int8` só na
hora de enviar produziria um log que, re-simulado, **diverge do que o jogador viveu** —
um tiro que passou raspando no original erra no replay, e a run honesta volta recusada
como fraude.

Por isso `quantizeCommand` é aplicado **antes** de o comando entrar em `stepRun` no
cliente, e o `RunRecorder` fica *no caminho* em vez de ao lado:

```ts
const cmd = recorder.capture(raw);  // devolve o comando quantizado
stepRun(state, [cmd]);              // …e é ESSE que a sim recebe
```

Mesma variável. O bug de "gravar um e simular outro" fica impossível por construção, e
não improvável por disciplina.

## 3. O que isto NÃO resolve

Re-simulação prova que os comandos produzem o resultado. **Não prova que um humano os
digitou.** Um bot que jogue bem produz um log legítimo, e nenhuma verificação
server-side distingue isso — quem afirma o contrário está vendendo heurística como
prova.

O que ela elimina é a classe inteira de *"editei o JSON e mandei 3 estrelas em 4
segundos"*, que é o ataque real de um leaderboard de jogo web.

Também não há contas: nomes não são únicos nem reivindicáveis. Um jogo web de sessão
curta que pede cadastro antes de deixar jogar perde o jogador na primeira tela. O que o
ranking prova não é *quem* jogou — é que **a run aconteceu**.

## 4. Custos e limites

Re-simular é trabalho **síncrono de CPU no mesmo event loop** que roda o tick
autoritativo a 20 Hz. Todos os limites saem daí:

| Controle | Valor | Porquê |
| --- | --- | --- |
| Verificações simultâneas | 1 | Node não paraleliza; duas não terminariam mais rápido e engasgariam quem está jogando. Excedente recebe **503, não fila** — uma fila dá ao atacante como acumular trabalho pendente. |
| Ticks por replay | 30 min | Limita o custo de UMA verificação. |
| Bytes do log | 512 KB | Recusado **antes** de decodificar. |
| Submissões por IP | 6 / min | |

As checagens estão em ordem de **custo crescente**: tamanho do texto antes de decodificar
base64, tamanho dos bytes antes de expandir o RLE, contagem de comandos antes de simular.
Um log hostil é recusado no degrau mais barato que o denuncia.

O corpo grande é abortado **durante o stream** com `pause()` (não `destroy()`): destruir
fecharia o socket antes de o 413 sair, e o cliente veria "erro de rede" em vez da recusa
— sem saber que basta mandar menos.

## 5. Persistência

Postgres via `DATABASE_URL`; **sem ela, memória**. O fallback não é modo degradado — é o
que faz `pnpm dev` e a suíte de testes rodarem sem um banco por perto.

Uma falha de conexão **não derruba o servidor**: o jogo funciona sem ranking, e
indisponibilidade de banco virando indisponibilidade de jogo seria trocar uma
funcionalidade acessória pela principal.

O schema é criado no boot (`create table if not exists`). Uma migração dedicada só se
justifica quando houver a segunda versão de schema para migrar. O banco guarda **apenas o
placar**: o estado das salas continua em memória — uma run em andamento não sobrevive a um
restart, e não deve (permadeath).

Deduplicação é por índice único no `digest`, com `on conflict do nothing` — a checagem no
banco e não na aplicação, porque duas instâncias ou dois POSTs simultâneos correriam entre
o "já existe?" e o insert.

## 6. Ordenação

Ver **§0**: Núcleos, tempo, e por fim quem chegou antes — dentro do livro da profundidade.

O desempate pelo mais antigo evita que o ranking se reordene sozinho quando ninguém
melhorou nada.

O índice do Postgres tem de **casar** com `compareEntries`; um que discorde devolve as
linhas certas na ordem errada. `sector_count` vem primeiro nele porque toda leitura do jogo
filtra por classe antes de ordenar. Os índices novos ganham **nome novo**:
`CREATE INDEX IF NOT EXISTS` olha o nome, não as colunas, e reusar o antigo deixaria o
índice velho intacto em produção, silenciosamente fora de ordem.

A coluna `cores` nasce **nulável** na migração, e não com `default 0`. Um zero direto
gravaria "nenhum Núcleo" em toda run antiga que extraiu *com* Núcleo, e o histórico
inteiro cairia para o fim do livro na primeira leitura depois do deploy. O `UPDATE` a
preenche a partir da fase (`extracted_with_core` era **um** Núcleo, porque um era o máximo
que existia) e só então ela vira `not null`. `sector_count` pode usar default porque toda
linha que existia foi mesmo uma descida de três setores — era a única que o jogo tinha.

## 7. Verificação

```
pnpm --filter @voxelyn/survival-protocol test   # codec: quantização, RLE, base64
pnpm --filter @voxelyn/survival-server test     # replay, store, endpoints HTTP
```

O teste que sustenta tudo é `deriva o mesmo sumário que o cliente observou`: joga uma run
pelo caminho exato do cliente (quantizar → simular → gravar), re-simula só com
`seed + log`, e compara os sumários com **igualdade profunda**. Não basta bater "no geral"
— o ranking ordena por ticks, e um tick de diferença já é uma posição diferente.

Verificado também de ponta a ponta, com servidor e browser reais: um POST vindo de origem
de browser carregando `stars: 3, ticks: 1` forjados recebeu de volta **1 estrela e 2663
ticks** — o que a simulação do servidor produziu.

## 8. Observação de balanceamento

Um bot de entrada aleatória alcançou **★☆☆ em 2:13**, sem nunca descer um setor. A
extração antecipada é intencional (spec §1: *"a extração antecipada sempre existe e sempre
custa a recompensa maior"*) e o preço está correto — 1 estrela. Mas vale registrar que o
primeiro degrau hoje é quase gratuito, e que ★★☆ e ★★★ carregam sozinhas toda a
progressão.

---

# Telemetria de diversão

Documento no mesmo arquivo porque compartilha o encanamento — e **não** os dados.

## 1. A unidade de diversão é a sessão, não a run

Quase toda telemetria de jogo erra isso. Um jogador que morre cinco vezes seguidas e
continua está se divertindo; um que extrai uma vez e fecha a aba não está. "Taxa de
vitória" e "duração média de run" não distinguem os dois.

Por isso os dois campos mais importantes não descrevem a run:

- **`runIndex`** — a quantas descidas desta sentada;
- **`msSincePreviousRun`** — quanto silêncio houve entre o fim da anterior e o início desta.

Deles sai a métrica principal: **fração de runs seguidas por outra em menos de 30 s**. É
o gate da Fase 1 da spec (*"vontade clara de jogar de novo"*) virado número.

E **abandono não é morte**. Morrer é o jogo funcionando; fechar a aba no meio é o jogo
perdendo alguém. Somar os dois no mesmo balde é o erro que faz um jogo difícil parecer
saudável enquanto sangra jogador.

## 2. O que o digest responde

| Campo | Pergunta |
| --- | --- |
| `immediateRestartRate` | Dá vontade de jogar de novo? |
| `abandonRate` | O jogo está entediando no meio? |
| `sectorReach` | Onde a run quebra? (funil acumulado) |
| `starHistogram` | **Calibra `TARGET_SECTOR_TICKS` sem chute.** |
| `deathCauses` | O que mata — e se ensina |
| `medianTicks` por desfecho | Quanto dura cada tipo de fim |

## 3. Este dado NÃO é verificado

O ranking re-simula tudo. A telemetria **não pode**: ela precisa registrar mortes e
abandonos, que são a maioria das runs, e re-simular todas custaria mais CPU que o jogo.

Aceitável para diagnóstico, inaceitável para competição — e por isso as duas coisas moram
em **tabelas diferentes**. A separação não é organização, é barreira: ninguém promove
telemetria a placar por engano, e limpar o placar não apaga o histórico de análise.

Entrada é **saneada, não recusada**: um cliente que mande `ticks: 1e12` vira o teto, e não
um buraco no histograma.

## 4. Privacidade

Sessão anônima em **`sessionStorage`** — morre com a aba. Agrupa runs de uma sentada; não
rastreia ninguém entre visitas. Sem nome, sem id persistente, sem PII. Custa a métrica de
retenção entre dias (a que menos importa agora) e evita ter de pedir consentimento para o
que hoje é diagnóstico interno. Opt-out visível no menu.

A leitura do digest exige `TELEMETRY_TOKEN`; sem ele a rota responde **404**, não 403 — uma
rota que se anuncia como protegida convida a tentativa.

## 5. Três regras do cliente

1. **Nunca fala com o jogador.** Sem banner, sem erro, sem retry visível.
2. **Nunca bloqueia.** Offline é o caminho normal — o solo funciona sem rede.
3. **Nunca identifica ninguém.**

Servidor indisponível responde **204**, não 503: o cliente não deve reagir de forma
nenhuma. Telemetria que atrapalha o jogo deixou de ser diagnóstico.

## 6. O bug que só o browser pegou

O beacon de abandono era enviado como `Blob` com `type: 'application/json'`. Isso tira a
requisição da lista segura de CORS e **exige preflight** — e `sendBeacon` não sabe fazer
preflight. O navegador descartava em silêncio.

Como em produção o cliente (Static Site) e o servidor (Web Service) são **origens
diferentes**, o evento de abandono — justamente o mais valioso — nunca teria chegado, e
nada denunciaria isso, porque telemetria que falha é telemetria calada. O tipo do Blob é
`text/plain` por causa disso; o servidor não lê content-type, só faz `JSON.parse` do corpo.

## 7. Limite por origem

A telemetria **reusa** `SubmissionRateLimiter` e `requestRateLimitKey` do ranking, em vez
de reimplementar. Não é economia de código: ler o primeiro elemento de `X-Forwarded-For`
dá ao cliente um limite novo a cada requisição, porque ele pode **prepender** valores à
vontade. O bug era idêntico nos dois endpoints, então a correção mora num lugar só — e o
limitador compartilhado ainda coleta origens ociosas, sem o que um fluxo de visitantes
legítimos deixaria uma entrada permanente por IP até o processo reiniciar.

## 8. Cobertura de verificação

- **Abandono: verificado ponta a ponta**, 4/4, no caminho que importa em celular
  (`visibilitychange` quando o app vai para o fundo). Foi ele que achou o bug do §6.
- **Término normal: verificado por testes de unidade** e pelo fato de estar ligado na mesma
  linha de `recordRun` e `submitSoloRun`, ambos já verificados em browser. Usa `fetch`
  comum — o caminho sem sutileza.
- Um bot de browser **não consegue completar uma run** (não morre vagando e não navega de
  volta à extração com precisão), então essa ponta continua sem cobertura E2E.
