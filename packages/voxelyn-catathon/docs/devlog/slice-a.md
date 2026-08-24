# Devlog — Slice A: a run com decisões

*CATATHON · dois commits (`bf872da` sim, `0952ea7` cliente) · 41 testes · PR #156*

## O que este slice corrige

O playtest no aparelho real (uma run inteira, 12/12 features) expôs quatro
problemas de fundo. O Slice A é a resposta: **corrigir a partida atual antes
de qualquer variabilidade**.

## 1. O exploit do carinho

O maior achado do playtest nem foi visual: lendo a sim, o carinho recuperava
**energia** (`ENERGY_PET_RATE`). Segurar o dedo substituía comida, sono e
planejamento — o jogo inteiro colapsava num gesto.

A correção não foi "nerfar o número", foi dar ESTRUTURA ao gesto:

- **Moral** virou o quarto medidor. Sobe com carinho bem dado, ship próprio
  (+0.10) e da equipe (+0.04); desce trabalhando exausto e sendo despejado.
  E manda na velocidade (0.85×–1.1×): nenhum medidor é enfeite.
- **Carinho tem memória** (`petStreak`/`petLastTick`, ambos no hash): a
  segunda sessão seguida rende metade; a terceira **superestimula** — o
  estresse SOBE e o feed avisa. ~40s sem carinho zeram o streak.
- **Personalidade responde diferente**: o cowboy é carente (1.2×/1.3×), o
  calmo já está bem (0.6×/0.7×), o julgador-em-silêncio precisa ser visto.
- O "shipa" do perfeccionista **funciona em qualquer streak**: é
  comunicação, não cuidado.

O jogador agora aprende o ritmo de cada gato em vez de esfregar o botão.

## 2. Decisões de engenharia

"Colocar um gato e esperar a barra encher não é jogo." Três tarefas-raiz
ganharam `choice`: arquitetura (b1), abordagem de UI (d1) e deploy (o1).
A tarefa **não anda** até o jogador decidir — o gato senta, o quadro pisca.

Cada opção muda o formato da run, nunca só um número: monólito é barato e
cria dívida; microsserviços custam agora e barateiam b2/b3; serverless é
rapidíssimo e **amarra a demo no sponsor** (risco real de crash no palco);
design system primeiro paga nas telas seguintes; pipeline completo compra
estabilidade na banca.

## 3. O pitch é jogável

O crash da demo era um sorteio ao fim — decisivo e inassistível. Virou
**fase**: 30 segundos de palco, gauge da plateia decaindo sozinho, uma
habilidade por gato (cooldown de 4s; repetir a MESMA rende metade; o cursor
do Cheeto pode mudar o slide), e o sorteio do crash virou **crise
respondível** no meio do pitch: qualquer habilidade dentro da janela de 3s
vira *improviso heroico* (+gauge, a plateia ama); ignorada, a demo crasha de
verdade.

## 4. Pontuação em cinco dimensões

Técnica, estabilidade, experiência, inovação e pitch + voto popular. Dívida
morde a estabilidade; escolhas pagam onde prometeram; o pitch vale até 30.
Cortes retunados (118/74/36) e — como sempre — validados **jogando**: o bot
parado perde até no palco; o bot decente decide, revezar habilidades e sobe
ao pódio em quatro sementes.

## A tela obedeceu (§16 do brief)

- A ficha do gato cobria **um quarto da área jogável**, exatamente sobre a
  estação do selecionado. Virou **ficha compacta no rodapé** (nome, "agora:
  …", três micro-medidores; bio e fome atrás de `detalhes`).
- **Barra da equipe** na borda esquerda com anéis de estado (verde
  trabalhando, coral piscando na zona de perigo).
- **Feed em faixa única** + histórico atrás de toque: três logs empilhados
  cobriam o canto de descanso.
- Chip `features n/12` com palavra; **chip de bug é botão** que abre o
  projeto; no palco, as ações de booth saem do caminho sozinhas.

## Defeitos pegos pelos portões durante o slice

1. O teste de memória do carinho rebobinava `petLastTick` para negativo — e
   o sentinela ignorava. O teste passou a **passar o tempo jogando**.
2. O painel do projeto ficava aberto POR CIMA do palco: o pitch agora fecha
   os painéis de booth ao começar.
3. As dimensões do resultado nasceram sem estilo ("tecnica-5" grudado) — o
   screenshot pegou antes de qualquer humano.

## Números

- 41 testes (eram 33): +superestimulação, +decaimento da memória, +decisão
  trava/aplica, +micro barateia b2, +palco parado perde, +repetição rende
  metade, +crise respondida/ignorada.
- Fumaça: 6 portões novos — decisão pelo dedo, ficha compacta NO RODAPÉ,
  faixa de feed, **carinho não recupera energia** (o exploit vigiado para
  sempre), habilidade mexe na plateia, resultado em cinco dimensões.
- Hash: moral, memória de carinho, custos decididos, estado inteiro do
  pitch.
