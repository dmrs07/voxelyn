# Voxelyn Survival — Bispo e Corcel Fúngico

## 1. O problema que estes dois resolvem

A run tinha três setores e **um** encontro autoral: o Guardião, no fim. O setor 1
ensina, o setor 3 cobra, e o setor 2 era um corredor — mesma mistura de bichos, mais
denso. A descida tinha estrutura mas não tinha **eventos**.

Os dois inimigos aqui não são "mais conteúdo": cada um preenche uma lacuna diferente.

| | Bispo do Veio | Corcel Fúngico |
| --- | --- | --- |
| Onde | Setor 2, sempre | Qualquer setor, ~1/3 das vezes |
| O que ele pede | que você mude o **chão** | que você mude a sua **posição** |
| Como se anuncia | fugindo quando se machuca | 1,3 s de telégrafo parado |
| Silhueta | pilar vertical | o único bicho **horizontal** do jogo |

## 2. Bispo — a cura vem do chão, não dele

`BISHOP_REGEN_PER_TICK = 1.2` a 20 Hz são **24 de vida por segundo** enquanto ele
pisa em `SURF_FUNGAL`. Isso é deliberadamente acima do que o tiro base sustenta: em
cima do fungo ele não é difícil de matar, é **impossível de matar por atrito**.

A cura é uma propriedade do **lugar**, não um recurso que ele gasta. Isso troca a
pergunta da luta de *"quanto dano por segundo eu faço"* para *"de que chão eu o
tiro"* — e usa fungo, calor e propagação que já existiam. Nenhuma mecânica nova.

### O detalhe que é o encontro inteiro

Fungo **aquecido** (`SURF_FUNGAL_HEATED`, fumegando, antes de virar fogo) **já não
cura**.

Se a cura só parasse quando a chama sobe, a recompensa por encostar calor chegaria
segundos depois da ação, e o jogador não ligaria uma coisa à outra. Parando na
fumaça, ele vê a consequência **no instante em que age** — que é a única forma de
uma regra ser aprendida em vez de decorada.

### O tell

Abaixo de `BISHOP_RETREAT_HP_FRACTION` (72%) e fora do fungo, ele **abandona a
perseguição** e corre para o tapete mais próximo dentro de 14 tiles.

O contra-jogo não está escrito em lugar nenhum do jogo. Está no fato de o próprio
chefe **apontar para o que o mantém vivo** toda vez que se machuca. Queimar a arena é
a conclusão que o jogador tira sozinho depois de vê-lo fugir duas vezes.

Sem fungo ao alcance ele volta a perseguir: a arena queimada não o deixa acuado, só o
deixa mortal. Do contrário, queimar tudo seria um botão de desligar o chefe.

E ele não para para cuspir enquanto recua — uma ação à distância no meio da retirada
apagaria o tell, fazendo-o parecer que está manobrando em vez de correndo para um
lugar específico.

### Por que 260 de vida, e não 420

Vida grande **mais** cura cobraria duas vezes pelo mesmo problema e transformaria a
luta em espera. Fora do fungo ele cai depressa — é para cair depressa. A dificuldade
mora no piso.

### Supernova Fúngica — o que impede o counter de virar truque

Queimar a arena resolvia a luta **uma vez**. O jogador aprendia a resposta certa e o
resto do encontro virava formalidade — que é o problema de qualquer chefe com uma
única chave.

A Supernova é a resposta dele a ter perdido o chão: dano em 360° e o tapete
**replantado** num raio de 5,5. A resposta certa continua certa e passa a ter de ser
**repetida**, que é a diferença entre um truque e uma luta.

O gatilho é o que faz ela funcionar. Ela **não** dispara por cooldown: sai apenas
quando ele está ferido **e** não achou fungo nenhum ao alcance. Assim o jogador vive a
sequência inteira como causa e efeito — *queimei o tapete, ele fugiu, não achou nada,
plantou*. Disparando por relógio, o replantio seria um evento que acontece **com** o
jogador; assim é um evento que ele **provocou**.

Ela não planta sobre fogo vivo. Apagar o incêndio que o jogador acabou de acender
transformaria a ação dele em nada — o fungo cresce onde o fogo já passou, nunca por
cima dele.

### O evento `pulse` passou a carregar o raio

A Supernova reusa o evento `pulse`, que até então só existia para a habilidade
cinética do jogador — e o cliente desenhava a frente com a constante `ABILITY_RADIUS`
copiada. Com duas fontes de alcances diferentes, essa cópia prometeria **3,2 tiles
onde o dano chega a 5,5**.

A frente de partículas existe justamente para o jogador aprender o alcance *vendo*,
sem número nem manual. Uma frente que mente sobre isso é pior do que nenhuma, então o
raio passou a viajar no evento.

## 3. Corcel Fúngico — a investida é o depósito, o rastro é a mecânica

Ele não mata pelo impacto. Mata **tirando espaço da sala**.

- Telégrafo de **26 ticks (1,3 s)**, o mais longo do jogo, parado.
- A direção **congela no windup** e não se corrige mais.
- Exige **linha de visão** no instante em que começa.
- 22 ticks a 10,5 tiles/s: atravessa ~11 tiles.
- O fogo nasce **2,1 tiles atrás** dele.

O telégrafo é longo porque a investida é a única ação do jogo que **muda o mapa**.
Uma ameaça que altera o terreno tem de ser vista com folga, senão o jogador perde a
rota sem nunca ter tido a chance de escolher.

O atraso do rastro existe pelo mesmo motivo: sem ele, o fogo nasce sob as patas e
quem foi roçado já está em chamas antes de ver o que aconteceu. Com atraso, o cavalo
passa, o jogador vê o caminho que ele fez, e **só então** o fogo sobe.

### O rastro respeita a tabela de materiais

`igniteCell` primeiro — cada matéria tem a própria resposta ao calor (o fungo seca
antes de pegar, o gás dá flash, o esporo esteriliza). Só quando o chão não tem
resposta própria — rocha nua — o rastro traz o próprio combustível
(`HORSE_TRAIL_FUEL_TICKS`). O cavalo não é a exceção que atropela o sistema de
reações; ele é mais um cliente dele.

### Bater na pedra encerra a investida

É o único contra-jogo posicional que ele oferece: quem lê o telégrafo põe uma parede
no caminho e ganha o cooldown inteiro de graça. Continuar raspando na parede até o
tempo acabar tiraria a recompensa de ter lido a ameaça — e foi exatamente essa
distinção que o teste original **não** provava (ver §6).

### Ele ocupa a vaga do elite, não soma um inimigo

O sorteio decide **qual** é a ameaça de destaque do setor, nunca **quantas** existem.
Somar seria inflar a contagem num sorteio, e densidade é a coisa que menos deveria
variar por sorte: o mesmo mapa ficaria fácil ou apertado sem nada visível explicando
a diferença.

E ele não nasce com a flag `elite`: elite acende o fungo sob os próprios pés, e o
cavalo ficaria cercado do fogo que só a investida dele devia acender.

`HORSE_SPAWN_CHANCE = 0.34` — nem raro nem garantido. Garantido viraria mobília;
raro demais é conteúdo que a maioria das runs nunca vê, e um encontro que ninguém
encontra não ensina nada.

## 4. A decisão de implementação: a investida mora fora de `releaseAction`

Todas as outras ações resolvem tudo no **release** — a pedra sai, o golpe acerta ou
não — e por isso `advanceAction` pode devolver `true` e a criatura ficar parada na
recuperação. Na investida do cavalo a **recuperação é a ação**: ela dura dezenas de
ticks e precisa da posição exata de cada passo para acender o rastro.

Por isso `horseChargeStride` conduz o movimento tick a tick, e o ramo `charge` de
`releaseAction` retorna cedo para o cavalo — somar velocidade solta por cima daria
dois movimentos no mesmo tick e o fogo sairia desalinhado do caminho percorrido.

O rastro **não guarda histórico**: a célula que acende é a posição atual menos a
direção vezes o atraso. Guardar as células visitadas daria o mesmo resultado e
acrescentaria um campo por inimigo ao estado autoritativo — que é sincronizado,
hasheado e reenviado a cada resync.

## 5. O que arquétipo novo obriga a tocar

Adicionar um membro a `EnemyArchetype` **não** quebra o typecheck sozinho, mas quebra
duas coisas que só aparecem em produção:

1. `RunStats.kills` é um `Record<EnemyArchetype, number>` — `emptyStats()` precisa da
   chave;
2. `HASHED_ARCHETYPES` em `run.ts` alimenta o hash autoritativo — sem a entrada, o
   abate do bicho novo é invisível ao hash.

Novos entram no **fim** da lista, nunca no meio: inserir `bishop` antes de `guardian`
mudaria o hash de toda run existente sem mudar comportamento nenhum.

O teste `todo arquétipo tem definição e contador` é a guarda que faltava — compara as
chaves de `ARCHETYPES` com as de `emptyStats().kills` e falha na adição seguinte, em
vez de deixar a divergência aparecer só no co-op de alguém.

O bispo entra em `crushesWalls` mas **não** ganha a busca de rota do guardião: chefe
preso é chefe morto, mas a rota do guardião mora em `state.guardianPath`, um campo
único. Compartilhá-lo daria dois chefes disputando o mesmo array — inofensivo hoje,
porque um é do setor 2 e o outro do 3, e uma bomba armada no dia em que isso deixar
de ser verdade.

## 6. Verificação

```
pnpm --filter @voxelyn/survival-sim test    # tests/bosses.test.ts, 17 casos
```

Quatro mutações foram injetadas no código de produção para conferir que os testes
falham quando deviam:

| Mutação | Resultado |
| --- | --- |
| curar também em fungo aquecido | **pegou** |
| não acender rastro nenhum | **pegou** |
| bispo nunca recuar | **pegou** |
| investida não parar na parede | **passou** ← teste ruim |

A quarta expôs um teste que não provava a própria afirmação: `moveEntity` já recusa
atravessar sólido, então um cavalo que raspasse na pedra pela janela inteira passava
no mesmo `expect`. O que distingue as duas versões é a investida **acabar antes do
tempo dela**, e é isso que o teste mede agora — em quantos ticks a ação morreu.

## 7. Áudio

`bishopHeal` é a única voz do jogo que **sobe** em frequência. Todo o resto do banco
desce — tiro, impacto, morte, quebra — porque tudo o mais é alguma coisa terminando.
Contra um vocabulário inteiro de quedas, um glissando ascendente lê como *"isto está
voltando"* antes de o jogador saber o que é o som.

Prioridade 8 é alta para uma voz de dano-que-não-é-meu, e por um motivo estreito: ela
não descreve um impacto, descreve que **os impactos não estão valendo**. Perdê-la no
orçamento de vozes seria perder a pergunta da luta. O evento sai a cada 4 ticks
(200 ms) e não a cada tick — a 20 Hz o barramento levaria 20 curas por segundo só
deste inimigo, e o som se lê igual em 5 Hz.

A morte do bispo divide a voz `deathGuardian`: os dois são o fim de um ato, e o
jogador não precisa distingui-los pelo som — ele acabou de passar minutos olhando
para o que caiu.

## 8. Arte

### Bispo: atlas de verdade

O Bispo tem **atlas gerado** (`enemy-bishop`, 56×76, 4 direções, 27 frames por
direção), autorado como modelo voxel em `tools/entities.mjs` — o mesmo caminho dos
outros cinco inimigos. Não é o fallback: `drawEntity` o encontra e desenha.

Ele é o **único inimigo do jogo que é uma pessoa**, e o desenho diz isso antes de
qualquer mecânica. Os outros cinco são fauna — silhueta de bicho, membros, postura. O
Bispo é arquitetura vestida: base larga que se abre no chão, tronco que estreita,
mitra fina no alto, báculo subindo acima dela. A leitura pretendida é a de uma
catedral pequena andando.

Três decisões que vieram de **ver o resultado**, não de planejar:

1. **Não é verde.** O fungo do chão já é verde; um chefe da mesma cor do piso que o
   cura desaparece exatamente onde o jogador mais precisa enxergá-lo. Osso, ferrugem e
   ouro são o oposto do tapete e continuam dentro da paleta mestra.
2. **Foi comprimido.** Na primeira versão ele saía **mais alto que o Guardião** — e
   escala é hierarquia: um chefe de setor 2 maior que o do setor 3 promete uma ordem
   que o jogo não cumpre. O contraste com o Guardião continua, mas por **forma** (torre
   estreita contra massa larga), não por tamanho.
3. **O báculo se afastou do corpo.** Colado, ele e a mitra liam como duas torres
   gêmeas e o bicho parecia ter duas cabeças.

As raízes de micélio usam `electric`, não uma cor nova. A paleta mestra é validada e
não tem roxo; inventar um criaria uma cor que existe em um sprite do jogo inteiro.

### A cura é desenhada por partícula, não por frame

Um sprite de frames fixos **não sabe** o que é o chão debaixo dele. As raízes do atlas
são identidade; quem avisa que a cura está acontecendo *agora* é a partícula
`mycelium`, semeada pelo evento `heal`.

Ela **sobe**. Todo o resto do sistema cai — brasa, entulho, caco, respingo — porque
tudo o mais é matéria sendo arrancada de alguma coisa. Aqui é o contrário: é o chão
devolvendo vida ao Bispo, e a direção sozinha conta isso sem legenda.

No caminho de fallback, onde não há partícula garantida, `drawVoxelEntity` recebe
`charged` e acende as raízes. O renderer amostra a superfície sob a criatura em vez de
esperar um campo no snapshot: o cliente online já espelha os chunks, então o chão
debaixo do Bispo é um dado que ele **tem** — mandar um booleano por inimigo por tick
para dizer o que o mapa já diz seria pagar banda por uma leitura local.

### Corcel: atlas de verdade também

`enemy-fungal-horse`, 64×64, 4 direções, 27 frames por direção. É a **única silhueta
horizontal** do bestiário — todo o resto do jogo se lê como coluna. A leitura de "isto
vai atravessar a sala" não depende de reconhecer um cavalo: depende de ser a única
coisa mais larga do que alta, com quatro apoios e um pescoço caído à frente.

O `special` é a Investida Flamejante em duas metades: os três primeiros frames
**empinam** (o telégrafo de 1,3 s que o jogador tem de ler), os três últimos abaixam a
crista e esticam o corpo. Sem isso os frames de corrida seriam o mesmo cavalo só que
mais adiante.

Duas correções que só apareceram olhando o resultado:

1. **A crina é brasa, não fungo.** O rastro sai das patas, mas a fonte dele tem de
   estar visível no bicho **antes** de estar no chão — um cavalo verde deixando fogo
   para trás não explica de onde o fogo veio.
2. **As placas de armadura são separadas, não uma laje.** A laje corrida era o desenho
   óbvio e reproduzia exatamente o erro que a silhueta de fallback já tinha cometido:
   um retângulo claro e contínuo sobre quatro apoios lê como **tampo de mesa**, não
   como lombo. Placas discretas com vão entre elas devolvem a leitura de dorso — e
   ainda batem com a referência, que descreve *shelf fungi*, cogumelos de prateleira.

E a crina fica **atrás** da cabeça, nunca por cima: coberta por ela, a cabeça sumia
dentro do fogo e o bicho perdia o único ponto que diz para onde está virado.

## 9. O que fica pendente

- O Bispo compartilha `deathGuardian` e o anel de `pulse` com o jogador. A primeira é
  intencional (§7); a segunda é uma simplificação aceita — a mudança de mundo (um
  tapete inteiro nascendo) é o sinal real, não o anel.
- O Corcel não tem voz própria de investida além de `telegraphCharge`, que ele
  compartilha com o Guardião.
- `HORSE_SPAWN_CHANCE`, `BISHOP_REGEN_PER_TICK` e `BISHOP_NOVA_COOLDOWN_TICKS` são
  apostas de design, não medições. O histograma de estrelas da telemetria e
  `deathCauses` são o instrumento para calibrar as três depois do lançamento.
