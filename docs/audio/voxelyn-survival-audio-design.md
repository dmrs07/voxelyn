# Voxelyn Survival — Design de áudio

Documento irmão da art bible (`docs/art/voxelyn-survival-art-bible.md`) e da spec
(`docs/superpowers/specs/2026-07-24-voxelyn-survival-online-mobile-design.md`).

## 0. Por que o áudio existe aqui

A spec estabelece como invariante de design (§2.1) que *"todo perigo tem telegraph
visual **e/ou sonoro**"*. Até este ponto do projeto a metade sonora não existia, o que
significava que 100% da carga de legibilidade caía sobre o visual — numa tela de celular
em landscape, com a câmera apertada e a escuridão como mecânica deliberada.

O áudio aqui não é ornamento. Ele carrega três informações que o visual **não consegue**
entregar:

1. **O que está fora do quadro.** Um mundo com simulação celular reage continuamente fora
   da tela. Fogo se alastrando atrás de uma parede, gás acumulando na sala baixa, um veio
   descarregando — o jogador só descobre quando chega lá, ou quando ouve.
2. **O que vai acontecer.** Os inimigos telegrafam com windup (0,8 s no arremesso do
   bruiser). Um aviso sonoro dá ao jogador o mesmo tempo de reação sem exigir que ele
   esteja olhando para o inimigo certo.
3. **Estado contínuo.** Calor da arma, contaminação da run, densidade de ameaça. São
   escalas, não instantes, e nenhuma cabe num evento ou num canto do HUD.

## 1. Sem assets, por decisão

Não há um único arquivo de som no repositório. Tudo é sintetizado em WebAudio
(`src/client/audio/synth.ts`, ~8 KB). Três razões, na ordem em que pesaram:

- **O PWA precisa iniciar offline no primeiro uso.** Cada `.ogg` entra no precache do
  service worker; um pacote de sons decente passa fácil de 2 MB. O que se ganharia em
  timbre se perderia na promessa de instalar e jogar.
- **Coerência com o repositório.** A biblioteca inteira é "sem dependências, sem assets".
  Importar um formato de áudio e um pipeline de conversão contradiz o resto.
- **Som sintetizado tem parâmetro, não forma de onda.** A altura do telegrafo do bruiser é
  um número numa linha, ajustável em segundos — não um render novo.

**A trilha também é sintetizada.** Existe música — um tema de doom/drone por estrato
(§5.5) — e ela segue a mesma regra: zero assets, tudo procedural, e mixagem subordinada
por contrato (**SFX > música**, sempre). O silêncio continua fazendo parte do lugar: a
música cala na morte e na extração para o sting soar sozinho.

## 2. Arquitetura

O áudio pluga no **mesmo barramento de eventos semânticos** que o renderer e as partículas
já consomem. O cliente nunca decide que houve explosão — só a apresenta. Duas máquinas
numa sala de co-op recebem o mesmo evento e pedem a mesma voz, sem trocar um byte a mais.

```
SemanticEvent[]  ──►  cues.ts     (evento → pedido de som)        │ puro, testável
                      mixer.ts    (distância, prioridade, teto)   │ puro, testável
                      ─────────────────────────────────────────────
                      synth.ts    (receitas WebAudio)             │ browser
SurvivalState    ──►  ambience.ts (amostra da grade → níveis)     │ puro, testável
                      ambience-bus.ts (leitos contínuos)          │ browser
state.stratum    ──►  music.ts    (temas, compasso, notas)        │ puro, testável
state.tick            music-bus.ts (drone/pad + scheduler)        │ browser
```

A fronteira é deliberada e segue o mesmo *seam* de `flash.ts`: **a parte que decide o que o
jogador escuta é aritmética e roda em Node**; só a produção de som precisa de browser. As
suítes (`cues.test.ts`, `mixer.test.ts`, `ambience.test.ts`) rodam sem `AudioContext`.

| Arquivo | Papel |
| --- | --- |
| `voices.ts` | Catálogo de vozes + política (prioridade, ganho, trava, espacial) |
| `cues.ts` | Evento semântico → pedido de som |
| `mixer.ts` | Atenuação, paneamento, corte de agudos, prioridade, teto de vozes |
| `synth.ts` | Receitas de síntese, uma por voz |
| `ambience.ts` | Amostragem da grade → níveis contínuos 0..1 |
| `ambience-bus.ts` | Osciladores e loops persistentes dos leitos |
| `music.ts` | Temas por estrato, timeline por tick, notas por compasso (puro) |
| `music-bus.ts` | Drone/pad persistentes + scheduler lookahead do riff |
| `minigun-bus.ts` | O motor contínuo do canhão rotativo (§4.5) |
| `devourer-vortex-bus.ts` | O vórtice da boca do Devorador Branco (§4.6) |
| `lung-breath-bus.ts` | A respiração contínua do Pulmão-Matriz (§4.6) |
| `furnace-heart-bus.ts` | O batimento e a pressão da sala do Coração da Fornalha (§4.6) |
| `index.ts` | `AudioDirector`: ciclo de vida, unlock, volume, mudo |

## 3. As três decisões do mixer

Nesta ordem, em `mixer.ts`:

1. **Descarte por distância antes de qualquer conta.** Além de 22 tiles não há som. Uma
   cadeia de fogo do outro lado do mapa não pode custar nada.
2. **Ordem por prioridade, e só então a trava por voz.** A consequência é a que importa:
   entre três `break` no mesmo quadro, quem fica com a vaga é o **mais alto** — ou seja, o
   mais perto — e não o primeiro do array, que é uma ordem de varredura de célula sem
   nenhum significado para quem está jogando.
3. **Teto de 16 vozes, aplicado por último.** Quando o mundo desaba, o que sobrevive é o
   telegrafo, não o entulho.

### Curvas

- **Ganho por distância**: quadrático, não linear. Linear entregaria 50% do ganho a meio
  caminho, que o ouvido lê como "perto"; a curva quadrática entrega ~25%.
- **Corte de agudos**: interpolação exponencial de 16 kHz a 700 Hz. Frequência é percebida
  em oitavas; uma rampa linear concentraria toda a variação audível nos últimos tiles.
  **É este parâmetro que vende "isso está atrás da parede"** — mais que o volume.
- **Paneamento**: satura em 12 tiles de deslocamento horizontal.

## 4. Separação timbral (a regra que rege o catálogo)

Os **telegrafos** ocupam a faixa média-aguda (500–2000 Hz) com formas **tonais e ritmadas**.
O **mundo** (entulho, fogo, gás, corrosão) ocupa **ruído de banda larga**.

São categorias tímbricas diferentes, então um aviso nunca é mascarado por uma parede
caindo, mesmo tocando no mesmo instante com o mesmo ganho. Volume não resolveria isso:
dois ruídos de banda larga se mascaram por mais alto que um deles esteja.

Cada tipo de ação telegrafada tem voz **própria** — não um bipe genérico. `hurl` e `charge`
chegam do bruiser com o mesmo corpo na tela, e o que separa "sai da frente" de "recua" é
justamente qual dos dois começou.

A mesma lógica separa **pancada** de **pressão**: o dano por tick do chão (gás, esporo,
fogo sob os pés) chega a 20 Hz e viajava como `hitPlayer` — um thud de chefe, catorze vezes
por segundo, dentro de qualquer nuvem. Desde que o evento `hit` carrega o flag `hazard`
(protocolo 22, marcado pela própria simulação no call site do dano por tick), ele vira
`hitPlayerHazard`: surdo, sem transiente, prioridade de textura e trava de 500 ms. É um
flag, e não a causa do dano, de propósito: a varredura do Coração da Fornalha também fere
com fogo e **é** pancada — ataque de chefe sai como impacto pleno, com ducking e tudo.
Quem informa "estou no perigo" é o leito contínuo; a voz só pontua o custo.

## 4.5 O canhão rotativo, ou: dezesseis balas por segundo contra dezesseis vozes

A Minigun dispara 16 vezes por segundo. O mixer tem 16 vozes. Se essas duas frases se
encontrarem sem uma política no meio, uma rajada come o barramento inteiro, todo telegrafo
de inimigo desaparece durante ela, e o jogo passa a matar por algo que não deu para ouvir —
o único invariante de combate que este projeto não quebra.

A política tem três partes, e nenhuma delas é "abaixar o volume".

**1. Não existe uma voz por bala.** Não há `minigunShot` no catálogo, e a ausência é a
decisão. O que sai da simulação não é um evento por projétil: é `minigun_burst`, uma
contagem **agregada** de uma janela de quatro ticks (200 ms). Cinco eventos por segundo,
não dezesseis. A receita de `minigunBurst` agenda **três transientes dentro da mesma voz**,
espaçados por 45 ms — o Web Audio agenda no futuro sem custo por evento, então o preço de
uma saraivada é o preço de um som. O deslocamento de altura entre os três é determinístico
e pequeno: três estalos idênticos o ouvido detecta como amostra repetida, e é exatamente
isso que faz uma minigun soar de brinquedo.

**2. O motor é um leito, não um evento.** `minigun-bus.ts` segue a mesma decisão do
`AmbienceBus`: os nós nascem uma vez, no unlock, e o que muda é a altura e o ganho. Um
oscilador por quadro para simular rotação contínua sairia granulado no ritmo do quadro em
vez do ritmo do motor, e custaria sessenta nós por segundo para dizer uma coisa só. O
timbre é dente de serra grave (a armadura girando) + uma quinta desafinada (o conjunto de
peças) + ruído de banda estreita cuja frequência central sobe com o RPM (o atrito). A
altura segue `playerExtra.minigun.spin`, que é **estado autoritativo** — um contador do
cliente divergiria do gatilho na primeira reconexão, e o motor aceleraria depois de a arma
já estar cuspindo. Perto do travamento o motor desafina para baixo e ganha atrito: é a
única antecipação sonora que o superaquecimento tem.

O leito cobre o jogador **local**. O parceiro remoto chega pelas vozes espaciais
`minigunSpinStart` / `minigunSpinStop` e pelo próprio `minigunBurst`, que carrega a posição
no evento. Um segundo leito contínuo por slot remoto seria um par de osciladores
permanentes para uma arma que ele pode nunca pegar — e o paneamento de um leito que
persegue um corpo em movimento é justamente o que soa artificial.

**3. A rajada nunca chega a prioridade de telegrafo.** `minigunBurst` é prioridade 6, a
mesma do tiro comum. A arma mais forte do jogo não compete com o aviso que impede uma morte
injusta. E as cápsulas (`minigunCasing`, prioridade 1, ao lado de `corrode` e `chip`) são a
primeira coisa a sumir quando o orçamento aperta — é textura, e o design pede que ela suma.
A trava de 130 ms transforma a chuva inteira em até sete toques por segundo, agregados: um
som por cápsula seria a mesma armadilha do som por bala, um andar abaixo.

| Voz | Prioridade | Trava | O que é |
| --- | --- | --- | --- |
| `minigunSpinStart` | 6 | 200 ms | O motor pegando no tranco. Sobe. |
| `minigunSpinStop` | 4 | 200 ms | O motor perdendo rotação. Desce. |
| `minigunBurst` | 6 | 150 ms | A saraivada de uma janela inteira, em uma voz |
| `minigunCasing` | 1 | 130 ms | O latão no chão. Some primeiro. |

`minigun_spin` só soa nas transições para `spinning_up` e `spinning_down`. `firing` fica
mudo porque quem anuncia que a arma cuspiu é a própria rajada, um instante depois;
`overheated` fica mudo porque o evento `overheat` já toca o alarme no mesmo tick, e dois
sons para a mesma coisa são o dobro do aviso pela metade da clareza.

## 4.6 Os chefes, ou: uma assinatura por corpo, três momentos por habilidade

Cada chefe tem uma **assinatura sonora** — um material, uma física — e cada habilidade dele
usa essa assinatura para comunicar três momentos distintos:

1. **Preparação** — "algo vai acontecer" (`boss_windup`).
2. **Execução** — "aconteceu agora" (`boss_attack`).
3. **Consequência** — "o mundo mudou por causa disso" (`boss_state`, `boss_vulnerable`).

A regra que rege a feature: **a assinatura não é inferida no cliente**. `action_start` diz
que uma ação `pulse` começou, mas só a simulação sabe que aquele pulso é o canto do
Arquicantor e não a Supernova do Bispo — e as fases que não passam por `EntityAction` (a
respiração do Pulmão, a polaridade do Magnetarca, a boca do Devorador) não tinham evento
nenhum. Desde o protocolo 29 a simulação emite os quatro eventos acima, discriminados por
arquétipo e habilidade/momento, sem nenhuma decisão acústica: que voz soa é de `cues.ts`.
`action_start` carrega `archetype`, e por ele o cliente **cala o telegrafo genérico** quando
o ator é um chefe — o `boss_windup` do mesmo tick fala por ele (com a assinatura, ou com o
mesmo telegrafo genérico como reserva deliberada, nunca em silêncio).

| Chefe | Identidade sonora | A regra |
| --- | --- | --- |
| Guardião de Pedra | massa, rocha, subgrave | lento e tectônico; não fala, desloca massa |
| Bispo | matéria orgânica, fungo | preserva a subida da cura, agora na preparação da Supernova |
| Diamandis | máquina industrial + voz corporativa | toda habilidade é uma operação de mineração |
| Devorador Branco | fricção subterrânea, garganta, vácuo | o som localiza o que não pode ser visto |
| Arquicantor | cristal afinado, acordes | ataques são frases: nota, intervalo, acorde — ou trítono |
| Leviatã do Lençol | baleia abissal, água, eletricidade abafada | o canto anuncia intenção; o estalo, perigo |
| Pulmão-Matriz | inspiração, pressão, membrana, gás | o ciclo respiratório é o relógio da luta |
| Coração da Fornalha | pulsação, pressão, combustão | não vocaliza; a sala é a voz dele |
| Rainha da Geada | cristais finos, gelo tensionado | beleza fria antes de ruptura violenta; nunca a linguagem do Arquicantor |
| Magnetarca | magnetismo, inversão, metal | atração e repulsão soam opostas, e sem olhar |

**Prioridade e mixagem** (em `voices.ts`): windup de golpe letal e mudança de fase/estado
global, 10; execução da habilidade principal e cue de vulnerabilidade, 9; movimento
importante fora da tela, 7–8; vocalização de personalidade, 5–6; passos, respiração e
fragmentos, 2–4. Vocalização **nunca** rouba a vaga de um windup, e o canto do Leviatã não
pode mascarar a própria descarga — `leviathanCall` está em 6 e `leviathanShockCharge` em 10.
A carga e a descarga do Leviatã, a polaridade do Magnetarca e as fases da Fornalha **não são
espaciais**: são informação global da arena, reconhecida de qualquer lugar.

**A voz do Diamandis** é sintetizada como fonemas robóticos curtos (`speak` em `synth.ts`):
"SONDAGEM", "CARGA ARMADA", "AFASTE-SE", "ÁREA NÃO MAPEADA", "FALHA OPERACIONAL", "UNIDADE
NÃO RECUPERÁVEL". As palavras não ficam inteligíveis e não precisam — o ritmo silábico é a
personalidade. Ele não acorda: liga. Não enfurece: falha. Não ruge: desliga por subsistemas.

**Três leitos contínuos**, no molde do motor da minigun (nós persistentes, só o ganho anda,
dirigidos pelo estado autoritativo e nunca por um relógio do cliente):

- `DevourerVortexBus` — lê `bossRuntime.mawOpenedAt` com a mesma `mawIntensity` que puxa.
  Ruído filtrado descendo, subgrave pulsante, fragmentos de sílica acelerando para o centro.
- `LungBreathBus` — lê o tick com a mesma aritmética do `lungMatrixStep`. Inspirar sobe para
  dentro; o pulmão cheio **cala** por meio segundo; expirar desce e se afasta. Vida baixa: mais
  curto e irregular.
- `FurnaceHeartBus` — lê `furnaceOverheatingAt` e os bits de fase. Pressão de caldeira como
  leito, batimento como scheduler de lookahead (para poder **falhar** na instabilidade).

As **bolhas protetoras** do Leviatã são o único "você está seguro" sonoro do jogo: pulsos ocos
e regulares enquanto o jogador local está dentro de uma durante a carga, lidos do estado (as
bolhas viajam no snapshot) e passando pelo mixer como qualquer cue.

**Fora do primeiro recorte**, e por quê: o zumbido contínuo do campo do Magnetarca e a
modulação periódica dos ciclones da Fornalha (leitos a mais, cada um um par de nós permanentes
para um chefe que aparece uma vez por run — só quando a fase pedir modulação contínua); a
nota que some do conjunto quando um cristal da rede do Arquicantor quebra (a simulação ainda
não distingue "um cristal quebrou" de "um cristal DA REDE quebrou"; hoje soa o `breakCrystal`
comum); "OBSTRUÇÃO" quando a broca come parede (o `break` não carrega dono).

## 5. Ambiência

Cinco leitos contínuos, todos amostrados do estado autoritativo a cada 100 ms e
interpolados a cada quadro:

| Leito | Fonte | O que informa |
| --- | --- | --- |
| `fire` | células `SURF_FIRE` (+ `FUNGAL_HEATED` a meio peso) num raio de 14 | incêndio por perto, inclusive fora da tela |
| `gas` | células `SURF_GAS` / `SURF_SPORES` | sala contaminada adiante |
| `heat` | `playerExtra.heat` acima de 50% | **quanto falta** para o travamento — tique metálico que acelera de 2,2 a 14 Hz |
| `dread` | `state.contamination` | o relógio da run, audível sem HUD |
| `threat` | inimigos vivos no raio | densidade de pressão |

A interpolação **sobe mais rápido do que desce** (τ 180 ms vs 900 ms): perigo aparecendo
tem de ser imediato, perigo sumindo pode relaxar devagar. A constante é em tempo, não em
quadros — o jogo rebaixa para 30 FPS sozinho sob carga, e a ambiência não pode mudar de
comportamento exatamente nos momentos de mais ação.

**Contínuo não é constante.** `fire` e `gas` se calam sozinhos porque o mundo os apaga, mas
o calor da arma nunca zera enquanto o jogador atira — por isso `heat` é o único leito com
limiar próprio (`HEAT_WARN_AT`, 50%). Sem ele o aviso soava em todo combate, e um som que
nunca cala não é ouvido como aviso: o ouvido o adota como piso da cena. O limiar cai onde a
informação ainda é acionável — a `HEAT_PER_SHOT` 9 sobram uns cinco tiros — e coincide com
o calor devolvido depois de um travamento (`HEAT_MAX * 0.55`), então sair da trava devolve
um tique lento em vez de silêncio.

A urgência vira **taxa**, não altura: para saber que um tom subiu é preciso lembrar de onde
ele estava, mas um tique acelerando se lê no próprio instante. A batida aperta sozinha
quando a taxa sobe (40 ms a 2,2 Hz, 6 ms a 14 Hz) porque a janela é sempre a mesma fração
do período. A mesma fronteira aparece na tela: a barra de calor do HUD tem uma marca no
limiar e pulsa acima dele, para o silêncio abaixo de 50% ser lido como um limite e não
como sorte.

A batida sai de uma **porta formatada por WaveShaper** sobre um LFO, não de nós criados por
tique: o leito continua vivendo a run inteira, sem agendamento por quadro. O formatador não
tem memória — enxerga só a amplitude instantânea —, e a senoide visita cada valor abaixo do
pico duas vezes por ciclo. Por isso a curva é **monótona**: assim as duas travessias somam
uma batida só (subida = ataque, descida = queda), em vez de duas. Uma curva com envelope
completo dobraria a taxa anunciada, e uma rampa `sawtooth` — que resolveria a contagem e
ainda deixaria a batida assimétrica — reabre a porta no próprio salto, com um fantasma
medido a −8,6 dB.

## 5.5 Música por estrato

Um tema de doom/drone por estrato — lento (50–66 BPM), grave (fundamentais em E1–D2),
esparso. Referências declaradas: Deftones (*Cherry Waves*), Electric Wizard
(*Funeralopolis*), a trilha de Absolum. A música diz "você está em OUTRO lugar" pelo
mesmo motivo que o véu de cor do render diz: identidade no primeiro relance.

| Estrato | Root | Caráter |
| --- | --- | --- |
| `basalt` | E1 | a âncora neutra; pentatônica menor, quinta no pad |
| `prismatic` | B1 | menor com nona; a catedral canta |
| `aquifer` | G1 | frígio, o mais lento; swells, b9 no pad |
| `sulfur` | A1 | lócrio; o tritono do riff é o ar errado |
| `furnace` | F1 | o mais pesado; sawtooth, riff arrastado |
| `silica` | D2 | riff sempre descendente, seco, silêncios largos |
| `glacial` | Bb1 | quase sem baixo; pad detunado de ataque lento |
| `ferric` | Ab1 | pulso metronômico de duas notas; industrial |

Ocupações variam o tema sem trocá-lo: `mycelial` detuna uma **cópia** do drone (8 cents,
batimento orgânico) e soma uma terça menor; `aurix` põe um portão de tremolo no pad e um
tritono baixo de tensão. A profundidade (`normalizedDepth`) abre camadas por limiar —
drone sempre; baixo ≥ 0,15; pad ≥ 0,35; tensão ≥ 0,7 — com rampas de 1–2 s (o limiar
descreve desejo, nunca degrau de ganho).

As quatro decisões estruturais:

1. **O compasso vem do tick.** `barIndexForTick(state.tick)` é a identidade musical;
   `AudioContext.currentTime` só agenda a reprodução local. Dois clientes de co-op — um
   com unlock tardio, um recém-resyncado — tocam o mesmo compasso por construção. Não há
   `Math.random()` em `music.ts`: variação sai de hash de (compasso, índice).
2. **Teto de mixagem.** O barramento inteiro vive sob `MUSIC_CEILING = 0.366`, que põe a
   trilha em −21 LUFS no jogo. Em repouso isso passa do menor telegrafo de propósito; quem
   mantém o contrato *SFX > música* é o ducking (`MUSIC_DUCK_FACTOR = 0.35`), que sob um
   telegrafo devolve a música a −30 LUFS — exatamente o nível em que ela tocava o tempo
   todo antes desta virada. Trocou-se margem no silêncio, que ninguém usava, por margem no
   instante em que ela importa. O slider "Música" **multiplica** o teto, nunca vira ganho
   unitário. Ducking: vozes de prioridade ≥ 9 (e `hitPlayer`, exceção explícita) abaixam a
   música para 0,35× por ~0,8 s, com `cancelAndHoldAtTime` para rajadas não empilharem.
3. **Scheduler com contrato.** Lookahead de 0,4 s; ao voltar de suspensão ou stall o
   cursor **pula** para o próximo compasso válido (`MAX_CATCHUP_BARS = 1`) — nota perdida
   é perdida, nunca reposta em rajada.
4. **Crossfade sem buraco.** Na troca de estrato o drone desce até ~20% (nunca zero),
   re-afina no vale e volta em ~3 s; só pad e riff zeram. Trocar de bioma soa como o lugar
   mudando, não como BGM religando. Intensidade **nunca** dispara crossfade — só rampas.

A troca é detectada pela mudança de `state.stratum`/`state.occupation` (padrão
`lastPhase`), não pelo evento `sector_entered`: evento não sobrevive a resync, estado sim.

## 6. Ciclo de vida

**Nada é criado antes de um gesto do usuário.** Política de autoplay à parte, um
`AudioContext` criado no `load` fica `suspended` em todo browser móvel e depois soa com
atraso ou não soa. O contexto nasce no clique de "Descer sozinho" — e há uma rede de
segurança (`pointerdown`/`keydown` com `once`) para o auto-start por query (`?solo=1`),
que não conta como gesto.

- Aba escondida → `suspend()`. Os leitos são contínuos e sobreviveriam à troca de app.
- Volume e mudo persistem em `localStorage` (`voxelyn.audio`).
- **Padrão: som ligado**, volume 0,8. Começar mudo "para não assustar" seria um erro — o
  áudio carrega telegrafo de perigo, e quem nunca abre as opções jogaria a versão sem
  metade da informação de combate e concluiria que o jogo é injusto.
- Atalho `M` silencia sem voltar ao menu.

## 7. Verificação

```
pnpm test           # testes de áudio: cues, mixer, ambiência, música, minigun
pnpm build && pnpm check:audio
```

`check:audio` (`scripts/check-audio.mjs`) abre o jogo num Chromium, **instrumenta o próprio
`AudioContext`** e joga uma run de verdade, contando os nós criados — e também o **saldo de
nós vivos** depois de uma janela de assentamento: total criado crescendo com saldo limitado
é o scheduler de música saudável; os dois crescendo juntos é vazamento. Existe porque as
suítes unitárias não tocam em `main.ts`: um `audio.ingest` esquecido num dos dois loops,
um contexto que nunca destrava, uma receita que lança — tudo isso passa verde nos
unitários e entrega um jogo mudo. Não julga timbre (nenhum teste automático julga); julga
**existência**.

Playwright não é dependência do pacote de propósito: é ferramenta sob demanda, não portão
de build, e o jogo não deve arrastar um browser para o `pnpm install` de quem só quer
compilar. Em ambientes com Chromium já provisionado, use `CHROMIUM_PATH`.

## 8. Limitações conhecidas

- **Sem oclusão real.** A distância abafa, mas uma parede entre a fonte e o ouvinte não é
  consultada. Um raycast por voz por quadro é caro no alvo móvel, e o corte por distância
  já entrega a maior parte da leitura.
- **Sem reverb.** Uma sala grande soa igual a um corredor. Um `ConvolverNode` custaria uma
  resposta ao impulso (asset) ou geração em runtime. Hoje quem diferencia os biomas no
  ouvido é a música por estrato (§5.5); reverb por bioma continua na fila.
- **Mono por fonte.** `StereoPannerNode` posiciona no eixo horizontal; não há altura nem
  profundidade. Suficiente para uma câmera isométrica de topo.
