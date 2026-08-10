# Pipeline do devlog retroativo

O trabalho no Voxelyn já aconteceu — 49 PRs entre 31/07 e 10/08/2026. Este pipeline
publica esse histórico **um post por dia**, na ordem em que foi feito, como se estivesse
acontecendo agora. A ficção é só o calendário: o texto, os números e as imagens são todos
do dia real do commit.

O que sustenta isso é a captura: cada screenshot é gerada **construindo o commit daquela
época** numa worktree isolada e dirigindo um Chromium até o quadro. O post do PR #86
mostra o jogo do PR #86 — HUD mais simples, sem barra de comandos, sem contador de carga.
Nada de usar o build de hoje fingindo ser o de duas semanas atrás.

## As quatro etapas

```
plan.mjs  →  shoot.mjs  →  [redação]  →  carousel.mjs  →  publish.mjs
  fila       screenshot     texto        slides do IG      registro
```

| Comando                          | O que faz                                                          |
| -------------------------------- | ------------------------------------------------------------------ |
| `pnpm devlog:plan`               | Reconcilia `plan.json` com o histórico do git                      |
| `pnpm devlog:plan -- --list`     | Imprime a fila e o status de cada entrada                          |
| `pnpm devlog:shoot -- --next`    | Constrói o commit da próxima entrada e captura as screenshots      |
| `pnpm devlog:carousel -- --next` | Renderiza os slides 1080x1350 do Instagram                         |
| `pnpm devlog:publish -- --next`  | Confere que está tudo pronto, marca publicada e reescreve o índice |

Todos aceitam `--entry NNN` no lugar de `--next`.

## O que fica em disco

```
docs/devlog/
  plan.json                 # a fila: uma entrada por PR, com status (GERADO)
  INDEX.md                  # índice das entradas publicadas (GERADO)
  entries/NNN-slug.md       # o post do repositório, escrito à mão
  social/NNN.json           # a copy do Instagram (hook, slides, legenda, tags)
  media/NNN-receita.png     # screenshot crua, do build da época
  carousel/NNN-NN.png       # os slides prontos pra postar
```

As worktrees dos commits antigos vivem em `../.voxelyn-devlog-work/`, **fora** do repo, e
são removidas ao fim de cada captura (`--keep` preserva para depurar).

## plan.json

A fila é a única fonte da verdade. Ela é derivada do git percorrendo a linha principal
(`--first-parent`): cada merge de PR vira uma entrada, e commits feitos direto na main
viram entradas avulsas em vez de sumirem.

Regerar o plano **nunca perde progresso** — o status é reconciliado pelo sha do merge, não
pela posição na fila. Se um PR novo entrar amanhã, ele é acrescentado no fim sem renumerar
nem republicar nada.

O campo `stat.partial` marca entradas cujo diff é incompleto porque o commit está na borda
do clone shallow. Nessas, o carrossel omite o slide de números: um post anunciando
"+121.586 linhas" para um commit de seis arquivos desmentiria o resto.

Para pular uma entrada (um PR de review que não rende post), marque `"skipped": true` nela.

## As receitas de captura

`scripts/devlog/lib/recipes.mjs` define como dirigir o build até o quadro:

| Receita        | Página         | O que mostra                               |
| -------------- | -------------- | ------------------------------------------ |
| `solo`         | `index.html`   | Uma run solo em andamento — o leito seguro |
| `menu`         | `index.html`   | O terminal (Ordem de Despacho)             |
| `arena`        | `arena.html`   | A arena de chefes                          |
| `sprites`      | `sprites.html` | O visualizador de atlas                    |
| `atlas-studio` | Atlas Studio   | O editor, em retrato                       |

`plan.mjs` escolhe as receitas de cada entrada pelas áreas que o PR tocou, e a escolha
fica gravada no `plan.json` — pode ser editada à mão antes de capturar.

Três decisões tornam a captura confiável contra commits antigos:

- **Espera por pixel, não por relógio.** `waitForInk` tira screenshots do canvas até a
  variância de luminância passar do limiar. Esperar tempo fixo fotografaria o véu de
  deploy; esperar por seletor não ajuda, porque o `<canvas>` existe vazio desde o
  primeiro quadro.
- **Storage semeado.** Todo contexto novo do Playwright é um jogador de primeira viagem, e
  o jogo trata isso com telas que param o fluxo (Indução, dica de pausa). Sem semear
  `voxelyn.induction.seen`, toda captura de gameplay vira foto de onboarding.
- **Passos opcionais.** Um seletor que só nasceu no PR #120 não pode derrubar a captura do
  PR #95. O que derruba é terminar sem imagem nenhuma.

## A redação

Entre a captura e o carrossel entra o texto — é a etapa que não se automatiza, porque é
ela que faz o post valer alguma coisa. A matéria-prima está no corpo dos commits, que
neste repositório é detalhado (`git log -1 --format=%B <sha>`).

Cada entrada produz dois arquivos:

**`entries/NNN-slug.md`** — o post do repositório. H1 no formato `NNN — Título`, a
screenshot logo abaixo do cabeçalho, e o corpo contando o que mudou e **por quê**.

**`social/NNN.json`** — a copy do Instagram:

```json
{
  "hook": "frase curta da capa",
  "slides": [{ "title": "…", "body": "…", "shot": "001-solo.png" }],
  "caption": "legenda do post",
  "tags": ["#gamedev"]
}
```

`shot` é opcional: com ele o slide vira imagem com legenda, sem ele vira slide de texto.
Sem `social/NNN.json` o carrossel ainda sai, derivado dos assuntos de commit — serve para
testar o pipeline, não para publicar.

Veja `entries/001-o-chao-parou-de-ser-um-bloco-so.md` e `social/001.json` como referência
de tom e tamanho.

## A publicação

`publish.mjs` confere que cada peça existe **em disco** antes de marcar a entrada como
publicada — é a rede de segurança da tarefa diária, que roda sem ninguém olhando. Uma
entrada sem redação ou sem carrossel falha alto em vez de virar um post vazio.

"Publicada" aqui significa _pronta e registrada no repositório_. Postar no Instagram
continua sendo um ato humano: os slides ficam em `carousel/` e a legenda em `social/`.
