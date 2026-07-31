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

**Não há trilha sonora.** O jogo soa como um lugar, e o silêncio faz parte do lugar.

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
pnpm test           # 39 testes de áudio: cues, mixer, ambiência
pnpm build && pnpm check:audio
```

`check:audio` (`scripts/check-audio.mjs`) abre o jogo num Chromium, **instrumenta o próprio
`AudioContext`** e joga uma run de verdade, contando os nós criados. Existe porque as
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
  resposta ao impulso (asset) ou geração em runtime; fica para quando houver mais de um
  bioma e a diferença tiver o que comunicar.
- **Mono por fonte.** `StereoPannerNode` posiciona no eixo horizontal; não há altura nem
  profundidade. Suficiente para uma câmera isométrica de topo.
