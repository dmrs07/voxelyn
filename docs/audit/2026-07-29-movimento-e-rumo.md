# Velocidade em diagonal e o Miner "em flicker" (2026-07-29)

Dois bugs reportados juntos, com causas separadas. Os dois eram do mesmo tipo:
**alguém somando o que não devia somar**. O primeiro somava catetos, o segundo
somava duas fontes de verdade sobre o rumo.

## 1. Velocidade dependendo do rumo

> "há um bug comum em jogos como Tíbia que a velocidade do usuário 'aumenta'
> quando percorre vetores em diagonal, pois soma os vetores catetos"

### O bug clássico não existia; um parente dele existia

Vale começar pela parte que estava certa, porque foi por aí que a busca começou
errada. A soma de catetos na simulação **não** acontecia: `stepPlayer` normaliza
o comando por `hypot` antes de aplicar `speed * dt`, e continua normalizando.
Andar em diagonal nunca foi 1,41x mais rápido.

O que existia era o mesmo erro um andar acima, no cliente. O toque/analógico
virava comando de mundo assim:

```ts
cmd.move = { x: mx + my * 2, y: my * 2 - mx };
```

Essa é a inversa da projeção isométrica, e está certa como *direção*. O que ela
não faz é preservar módulo: `|(mx + 2my, 2my − mx)|` varia com o ângulo entre
1,41 e 2,83 para o mesmo `|(mx, my)| = 1`. A simulação recebe isso, vê um vetor
maior que 1, e **clampa** — que é o que salvava o caso do teclado e escondia o
bug. Com o analógico o clamp não salva nada: ele achata inclinações diferentes na
mesma velocidade, e em rumos diferentes achata em pontos diferentes.

### Medição

Velocidade resultante em fração da velocidade base, por rumo de tela e por
inclinação do analógico (o clamp da simulação incluído):

| Inclinação | Rumo | Antes | Depois |
| --- | --- | --- | --- |
| 100% | qualquer um dos 8 | 100% | 100% |
| 50% | esquerda / direita | 70,7% | 50% |
| 50% | cima / baixo | 100% | 50% |
| 50% | as 4 diagonais | 100% | 50% |
| 25% | esquerda / direita | 35,4% | 25% |
| 25% | cima / baixo | 70,7% | 25% |
| 25% | as 4 diagonais | 55,9% | 25% |

Duas coisas de uma vez, e as duas do mesmo lugar:

1. **Rumo mudava a velocidade.** A meio analógico, ir para cima andava a 100% e
   ir para o lado a 70,7%. A um quarto, 70,7% contra 35,4% — o dobro exato. É
   isto que se sente como "diagonal mais rápida": não é a diagonal
   especificamente, é que quase todo rumo era mais rápido que o eixo horizontal.
2. **O analógico quase não era analógico.** Meio analógico dava 100% em 6 dos 8
   rumos. Só dava para andar devagar indo para os lados.

A primeira tentativa de medir isto deu de 39% a 100% e não fazia sentido: o
jogador nasce perto da borda do mapa e estava colidindo. Vale registrar porque
foi quase uma conclusão errada — o número sujo *parecia* dizer que a diagonal era
mais **lenta**.

### Correção

`screenToWorldMove` em `packages/voxelyn-survival/src/client/input.ts`: extrai o
módulo do *input* (que é o que o jogador escolheu), normaliza a direção de mundo,
e reaplica o módulo. 40% de inclinação anda a 40% em qualquer rumo.

O módulo é tirado antes da transformação, não depois, porque `|(mx+2my, 2my−mx)|`
não é `|(mx,my)|` — usar o comprimento pós-transformação devolveria o mesmo bug
com passos extras.

Testes: `packages/voxelyn-survival/src/client/input.test.ts`,
`packages/voxelyn-survival-sim/tests/movement-speed.test.ts`.

## 2. O mesmo erro, do outro lado da tela: inimigo raspando parede

Não foi reportado — apareceu procurando o primeiro. O laço de perseguição tinha,
depois de mover, um segundo empurrão "para o inimigo não grudar na parede":

```ts
moveEntity(state, enemy, (moved.blockedX ? 0 : dirX) * speed * dt * 0.6, ...);
```

Isso era desnecessário e nocivo: `moveEntity` já resolve os eixos em separado, o
que significa que o eixo livre **sempre** andava inteiro e o deslizamento já
acontecia sozinho. O empurrão extra somava 60% por cima.

Medido: um spitter colado numa parede, perseguindo em diagonal, andava a **114%**
da própria velocidade. Raspar parede era mais rápido que campo aberto.

### Consequência de balanceamento, registrada de propósito

Inimigos agora andam exatamente na velocidade projetada, ou seja, ficaram um
pouco mais lentos em corredor. Isso mudou o desfecho da run de fixture do
leaderboard: com seed 4242 e o script de input em círculos, o jogador **morria
antes de 4000 ticks** e agora **extrai em 5688**. Três testes do servidor
dependiam disso e foram corrigidos (o teto de ticks é guarda contra loop
infinito, não botão de dificuldade — está em 12 000 com folga).

Um deles, `nunca aceita um resultado vindo do cliente`, abria com
`if (phase === 'running') return` e por isso vinha passando **vazio**: nunca
chegou a submeter nada. O escape foi removido; agora falha se a fixture não
terminar. Ao voltar a rodar de verdade ele bateu no limite de 6 submissões por
janela por origem — que ninguém testava pelo caminho HTTP, e agora tem teste
próprio (`corta a submissão acima do teto por janela`).

## 3. O Miner "em flicker"

> "há também um bug em que o Miner fica em flicker"
>
> "na vdd o Flicker acontece pois ele fica rodando no seu eixo no modo passivo"

### Diagnóstico errado primeiro

Culpei a óptica do sprite, que alternava `biolum`/`fungus` por paridade de frame
(a ficha de conceito pede "optics flicker"). Isso *era* um problema real —
medido no atlas: 6 pixels de `biolum` contra ZERO em frames alternados, 3 Hz no
`idle`, no aglomerado mais claro de um corpo inteiramente escuro. Mas não era o
bug relatado. A correção do jogador ("ele fica rodando no seu eixo") apontava
para geometria, não para cor.

A óptica virou queda única a cada 4 frames em vez de estrobo, com teste que
mede **transições por ciclo** e não fração apagada
(`packages/voxelyn-survival-content/tests/emissive-flicker.test.ts`). Contar
fração reprovava o `special` do Bruiser, que apaga 3 de 8 frames **seguidos** e
lê como golpe carregando; e aprovaria um `6,0,6,0,6,0` curto, que é pisca-pisca.

### A simulação estava inocente

Instrumentada direto:

| Cenário | Trocas de rumo |
| --- | --- |
| passivo, 40 ticks | 1 |
| fugindo, encurralado, 30 ticks | 0 |

A simulação não girava nada. O giro era do cliente.

### Causa

`locomotionFacing` preferia o **deslocamento observado** ao `entity.facing`
autoritativo durante `walk`. Instrumentando `SpriteBank.prototype.drawEntity`
num navegador headless, com run real e jogador andando e atirando, o histograma
de rumos do Miner saiu assim:

```
FACINGS {"1,0":64, ..., "0,-1":8, ...}
```

`(0.94, −0.33)` → `sdx=1.27, sdy=0.61` → quadrante **`dr`**
`(0, −1)` → `sdx=1, sdy=−1` → quadrante **`ur`**

O Miner fugindo por túnel raspa parede; a colisão zera o eixo x; o deslocamento
observado colapsa para `(0,−1)` exato por alguns quadros e volta. Dois
quadrantes isométricos alternando: pião. O Miner expõe isso porque é o inimigo
que passa mais tempo colado em parede.

### Correção, em dois lados

1. `entities.ts`: movimento por **velocidade** (perambular, impulso de investida,
   empurrão) agora também atualiza `enemy.facing`. Antes não atualizava — e é
   *por isso* que o cliente tinha passado a adivinhar o rumo pelo deslocamento.
2. `presentation.ts`: rumo observado só vale para o Prospector, cujo `facing` é a
   **mira** e não o andar (sem derivar do deslocamento ele andaria de lado com as
   pernas apontando para onde atira). Para inimigos, `facing` já *é* a direção de
   locomoção que a simulação escolheu, e o observado é uma versão pior dela.

Verificado no mesmo harness de navegador: o `"0,-1":8` desapareceu, restando só
a sequência lisa em torno de `(0.94, −0.33)`.

Teste de regressão em `presentation.test.ts` — replica a sequência capturada e
cobra o que o jogador vê: **um** quadrante, do primeiro ao último quadro.

## Método

Nenhum destes cinco números veio de leitura de código. Vieram de: harness de
mundo aberto para velocidade, contagem de pixel por frame para emissivos,
instrumentação da simulação para rumo, e monkey-patch do render real em
navegador para o que de fato chega na tela. As duas vezes em que confiei em
inspeção — a primeira medição de diagonal e o diagnóstico do flicker — errei.
