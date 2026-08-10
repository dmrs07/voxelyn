# Pipeline do devlog retroativo

O trabalho no Voxelyn já aconteceu — **107 unidades de trabalho entre 18/01 e 10/08/2026**.
Este pipeline publica esse histórico **um post por dia**, na ordem em que foi feito, como
se estivesse acontecendo agora. A ficção é só o calendário: o texto, os números e as
imagens são todos do dia real do commit.

O que sustenta isso é a captura: cada screenshot é gerada **construindo o commit daquela
época** numa worktree isolada e dirigindo um Chromium até o quadro. O post do PR #86
mostra o jogo do PR #86 — HUD mais simples, sem barra de comandos, sem contador de carga.
Nada de usar o build de hoje fingindo ser o de duas semanas atrás.

## As quatro eras

O que existia para ser fotografado mudou três vezes em sete meses, e a escolha de receita
respeita isso perguntando à árvore daquele commit quais apps existiam:

| Era                           | O que dava para mostrar                           |
| ----------------------------- | ------------------------------------------------- |
| jan/2026                      | Os demos do core: Noita-like e iso Diablo-like    |
| jan/2026 (a partir do dia 20) | O editor VoxelForge                               |
| fev/2026                      | O Voxelyn Roguelike                               |
| jul/2026 em diante            | O Voxelyn Survival, e o Atlas Studio desde agosto |

Isso vale até para a assinatura do rodapé do carrossel: um post sobre 18 de janeiro assina
`VOXELYN`, não `VOXELYN SURVIVAL` — o Survival só nasceria cinco meses depois.

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
  social/NNN.en.json        # a copy em inglês, para o LinkedIn
  media/NNN-receita.png     # screenshot crua, do build da época
  carousel/NNN-NN.png       # os slides prontos pra postar
  carousel/en/NNN-NN.png    # os mesmos slides em inglês
  carousel/en/NNN.pdf       # o documento do LinkedIn
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

| Receita        | App          | O que mostra                                         |
| -------------- | ------------ | ---------------------------------------------------- |
| `noita`        | examples     | O demo de areia/água — a origem visual do projeto    |
| `iso`          | examples     | O demo isométrico, do mesmo commit inicial           |
| `editor`       | editor       | O VoxelForge                                         |
| `roguelike`    | roguelike    | O roguelike rodando (seed fixa, sem menu)            |
| `solo`         | survival     | Uma run solo em andamento — o leito seguro de julho+ |
| `menu`         | survival     | O terminal (Ordem de Despacho)                       |
| `arena`        | survival     | A arena de chefes                                    |
| `sprites`      | survival     | O visualizador de atlas                              |
| `atlas-studio` | atlas-studio | O editor de atlas, em retrato                        |

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

### Duas formas de construir

Os apps em pacote saem de `vite build` — chamado direto, não pelo script `build` do
pacote, porque vários rodam `tsc --noEmit` antes e o typecheck de um commit de janeiro
contra o TypeScript de hoje falha por motivos que não mudam um pixel do bundle.

Os demos do core são outra história. Eles importam a biblioteca por caminho relativo **sem
extensão** (`from "../../src/index"`), e o `tsc` da época emitia o `.js` mantendo o
especificador como estava — coisa que nenhum browser resolve. Na prática aquele demo nunca
rodou a partir do output do `tsc`. O pipeline empacota com o esbuild deste checkout: o
código é o do commit, byte a byte, e o que muda é só quem costura os módulos. Ferramenta,
não conteúdo.

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
testar o pipeline, não para publicar, e o `publish.mjs` recusa uma entrada nesse estado.

### Inglês e LinkedIn

`social/NNN.en.json` tem o mesmo formato e carrega a versão em inglês:

```
node scripts/devlog/carousel.mjs --entry NNN --lang en
```

Isso escreve em `carousel/en/` e, junto dos PNGs, um **`NNN.pdf`**. O PDF não é
conveniência: o carrossel do LinkedIn é um _documento_, não uma sequência de imagens, e
subir PDF é a única forma de conseguir aquele formato lá. Ele sai da mesma página
renderizada que os PNGs, então os dois formatos nunca divergem.

A legenda do LinkedIn é mais longa e mais sóbria que a do Instagram, com três ou quatro
hashtags no máximo — o público é outro. A primeira linha é o que aparece antes do "ver
mais", então ela precisa se sustentar sozinha.

Veja `entries/001-dia-1-uma-biblioteca-sem-tela.md` e `social/001.json` como referência de
tom e tamanho.

## A publicação

`publish.mjs` confere que cada peça existe **em disco** antes de marcar a entrada como
publicada — é a rede de segurança da tarefa diária, que roda sem ninguém olhando. Uma
entrada sem redação ou sem carrossel falha alto em vez de virar um post vazio.

"Publicada" aqui significa _pronta e registrada no repositório_. Postar no Instagram
continua sendo um ato humano: os slides ficam em `carousel/` e a legenda em `social/`.
