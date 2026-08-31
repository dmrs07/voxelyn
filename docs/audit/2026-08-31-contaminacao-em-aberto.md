# O que a contaminação deixou em aberto (2026-08-31)

O relógio do ar passou a ser relativo à duração da run (`contaminationPerTick`),
o que corrigiu um defeito que não dava erro em lugar nenhum: a descida de sete
setores saturava a ~58% do caminho, com cinco setores de subida pela frente e
vinte e um segundos de vida. Isso está fechado, medido e testado
(`tests/contaminacao-por-profundidade.test.ts`).

O ajuste **não** mexeu na forma do sistema, e é isso que este documento registra.
Duas coisas continuam como estavam por decisão, não por esquecimento — e as duas
são a mesma pergunta vista de lados opostos: **o jogador não tem nenhuma alavanca
contra a barra além de andar mais rápido.**

Cada item traz **o que acontece**, **por que ficou assim**, **o que custaria
fazer** e **onde mexer**.

---

## 1. A Célula de Purga promete descontaminação e só entrega a local

**O que acontece.** O comentário que abre o bloco em `run.ts` chama a célula de
*"cartucho interno de cura e descontaminação"*. Ela cumpre metade: cura 18 de
vida (`PURGE_CELL_HEAL`) e limpa `SURF_GAS` / `SURF_SPORES` num raio de 3 tiles
(`PURGE_CELL_RADIUS`). Em `state.contamination` — a barra global, o relógio que
de fato encerra a run — ela **não toca**.

O resultado é que a contaminação é o único sistema de pressão do jogo sem
contrajogada nenhuma. Ela sobe, acelera por setor, dobra com o Núcleo na carga, e
a única resposta disponível é andar mais rápido. Descer alivia (×0,6 no poço), e
descer é justamente o que aumenta o ritmo dali em diante.

**Por que ficou assim.** Não foi decidido contra — nunca chegou a ser decidido. A
célula nasceu como resposta ao **gás na sua frente**, que é um problema local e
tem uma leitura clara ("o chão está te matando, limpe o chão"). A barra global
nasceu depois, como relógio da run, e as duas nunca foram postas na mesma mesa.

Há também uma razão boa para hesitar: a contaminação é o que impede a run de ser
infinita. Uma célula que a corte transforma "quanto tempo você tem" em "quantas
células você carrega", e a decisão deixa de ser sobre o Veio e passa a ser sobre
inventário. É uma troca real, e ela precisa ser feita de propósito.

**O que custaria fazer.** Uma linha na simulação; o trabalho todo é de
calibragem. Um corte **percentual** (`contamination *= 1 - PURGE_CONTAMINATION_CUT`)
tem uma propriedade que um corte absoluto não tem: ele se ajusta sozinho ao
momento e à profundidade. Medido, com o relógio relativo já em vigor:

| a célula limpa | 3 setores: setor 1 / setor 3 com Núcleo | 7 setores: setor 1 / setor 7 com Núcleo |
| ---: | ---: | ---: |
| 5% | 42s / **10s** | 98s / **12s** |
| 10% | 84s / **20s** | 196s / **24s** |
| 15% | 126s / **30s** | 294s / **36s** |
| 25% | 210s / **50s** | 490s / **60s** |

Duas leituras dessa tabela, e as duas são o argumento a favor do percentual:

1. **Ela compra muito onde não faz falta e pouco onde faz.** No setor 1, com o ar
   lento, 10% valem um minuto e meio — e ninguém está em perigo lá. No pior
   momento da run (fundo, com o Núcleo, subindo) os mesmos 10% valem **20 a 24
   segundos**: uma sala a mais, não um relógio novo. É o tamanho certo para um
   resgate.
2. **O valor no momento da crise quase não muda com a profundidade** (20s numa
   run de três setores, 24s numa de sete), porque o corte é relativo ao mesmo
   relógio que já é relativo à run. Calibra-se **um** número, não um por geração.

A faixa a testar é **10–15%**. Abaixo de 10% a célula não muda decisão nenhuma e
vira ruído de HUD; acima de 25% o sprint final — que é o clímax pretendido e
funciona hoje em três setores — vira negociável, e a saturação deixa de ser um
fim para virar um custo.

**Riscos de desenho, na ordem em que apareceriam.**

- **Economia de células.** Cada cofre de salvage dá uma
  (`extra.purgeCells++`), o worldgen recusa setor com menos de três sites, e o
  setor é **regenerado na subida** — os cofres voltam. Numa descida de sete
  setores isso são vinte e uma células potenciais. Com corte de 15%, isso é a
  barra inteira duas vezes. Se a célula passar a cortar a barra, ou o teto de
  posse ou o custo de abrir cofre passa a importar de um jeito que hoje não
  importa. **Este é o item que decide se a ideia funciona**, e ele não aparece em
  nenhum teste — só jogando.
- **Co-op.** Hoje a célula é do jogador (`extra.purgeCells`), mas a
  contaminação é da **sala**. Dois jogadores queimando célula no mesmo segundo
  cortariam a barra duas vezes; o corte precisa ser idempotente por janela, ou a
  dupla ganha um relógio pela metade só por estar em dois.
- **Determinismo.** `state.contamination` entra no hash autoritativo
  (`run.ts`, `mix(Math.round(state.contamination * 100000))`). Qualquer mudança
  aqui é bump de `SIMULATION_VERSION` — hoje 43.
- **Leitura na tela.** Um corte que o jogador não vê acontecer não é
  contrajogada, é sorte. O evento `purge_cell_used` já existe e já é desenhado;
  a barra precisaria de um recuo animado, senão o número muda entre dois quadros
  e ninguém associa uma coisa à outra.

**Onde mexer.**
`packages/voxelyn-survival-sim/src/run.ts`, no bloco `if (cmd.purge && extra.purgeCells > 0)`
(hoje: cura, limpa superfície, emite `purge_cell_used`) —
`packages/voxelyn-survival-sim/src/constants.ts` para a constante nova, ao lado
de `PURGE_CELL_HEAL` —
`packages/voxelyn-survival/src/client/hud.ts` para o recuo da barra —
`packages/voxelyn-survival-protocol/src/version.ts` para o bump.

---

## 2. A subida não tem alívio nenhum

**O que acontece.** `descend` aplica `CONTAMINATION_CARRYOVER` (×0,6); `ascend`
não toca em `state.contamination`. Verificado dirigindo a simulação, não lendo o
código: descendo 1→7 o poço alivia em toda transição; subindo 7→1 a barra não cai
uma vez.

**Por que ficou assim.** É a ficção funcionando: descer é ar novo, voltar é a
cobrança. O caminho de volta *deve* ser a parte cara da run — é ele que dá peso à
decisão de pegar o Núcleo.

**Por que fica registrado assim mesmo.** Porque é a alavanca **alternativa** à do
item 1, e quem for avaliar um dos dois precisa saber que o outro existe. Medido:
subindo de 7 até 1 com o Núcleo, partindo de contaminação **zero** no fundo —
cenário que nenhuma run real alcança — cabem 2:40 de subida. O relógio relativo
resolveu o descompasso de escala, mas o trecho de subida continua sendo,
estruturalmente, a parte sem freio da run.

Se o playtest disser que o retorno fundo ainda sufoca, há dois botões e eles não
são equivalentes: um carryover na subida (mesmo menor que 0,6) resolve **sem
pedir nada do jogador** e por isso não cria decisão nenhuma; a célula do item 1
resolve **cobrando um recurso** e por isso cria. Preferir o segundo é preferir que
o jogador tenha o que fazer.

**Onde mexer.** `packages/voxelyn-survival-sim/src/sectors.ts`, `ascend` — o
espelho do bloco que já existe em `descend`.
