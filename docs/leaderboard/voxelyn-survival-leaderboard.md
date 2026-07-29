# Voxelyn Survival — Ranking e 3 estrelas

## 1. As três estrelas

| Nota | Exigência |
| --- | --- |
| ★☆☆ | extraiu vivo |
| ★★☆ | extraiu **com o núcleo** |
| ★★★ | com o núcleo, **abaixo do tempo-alvo** (12 min = 4 min × 3 setores) |

A escada é de **intenção**, não de dificuldade bruta. Morrer não dá estrela — não é
um resultado parcial de extrair, é outro resultado. E a terceira estrela não adiciona
um objetivo novo: **cobra o mesmo objetivo com pressa**. É o que mantém viva a decisão
"extrair agora ou arriscar" depois que o jogador já aprendeu o mapa — com tempo
infinito, pegar tudo é sempre certo.

O tempo-alvo é derivado de `SECTOR_COUNT`, não um número solto: a run passou de um mapa
para três, e um alvo fixo passaria a significar outra coisa se o número de setores
mudasse. `TARGET_SECTOR_TICKS` é o único número aqui que se espera calibrar por playtest.

## 2. A garantia anti-cheat

**O cliente nunca submete um resultado.** Ele submete a seed e o que pressionou.

```
cliente  →  { seed, log, name }        ← nenhum campo de pontuação
servidor →  re-simula                  ← descobre sozinho o que aconteceu
```

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

Mais estrelas primeiro; entre nota igual, **menos tempo**; empate mantém quem chegou antes.

Ordenar por tempo dentro da nota não introduz critério novo — a terceira estrela já é "a
segunda com pressa", então isso apenas continua a escada que a nota começou. O desempate
pelo mais antigo evita que o ranking se reordene sozinho quando ninguém melhorou nada.

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
