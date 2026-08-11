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
  live/NNN/<receita>/       # o build daquele commit, para rodar no post
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

## Imagens fora do git

Cada entrada carrega ~1,3 MB de PNG. Nas 107, seriam ~140 MB versionados num repositório
de código — e o git guarda **cada versão** de cada binário para sempre, então recapturar
uma entrada somaria peso em vez de substituí-lo.

Os binários vão para o Cloudinary:

```
export CLOUDINARY_CLOUD_NAME=<cloud>
export CLOUDINARY_API_KEY=<key>
export CLOUDINARY_API_SECRET=<secret>
# (ou, numa variável só: CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>)

node scripts/devlog/upload.mjs --entry 001     # uma entrada
node scripts/devlog/upload.mjs --all           # tudo que existe em disco
```

**O ambiente precisa alcançar o Cloudinary.** O ambiente remoto do Claude Code só fala com
hosts na allowlist de egresso, e por padrão o Cloudinary não está nela — o upload falha com
`403 Host not in allowlist` mesmo com credencial correta. Libere:

- `api.cloudinary.com` — o upload;
- `res.cloudinary.com` — a conferência `HEAD` que o `--prune` faz antes de apagar.

Isso vale também para o ambiente da tarefa diária: sem a liberação, ela captura e escreve
normalmente e só o passo de upload falha.

O upload grava, em cada entrada do plano, um mapa `cdn` de caminho relativo para URL
pública, e reescreve as imagens do post para essas URLs — sem isso, tirar os PNGs do git
quebraria a renderização do markdown no próprio GitHub.

**Quem exibe prefere a URL e cai no arquivo local quando ela não existe.** Vale para o
serviço, para o carrossel e para o markdown. É isso que torna a migração incremental:
entradas que ainda não subiram continuam funcionando pela rota local.

O `public_id` é determinístico (`voxelyn/devlog/media/001-noita`), com `overwrite` e
`invalidate`: recapturar a entrada 032 troca a imagem **naquela** URL em vez de criar uma
segunda. Um devlog cujo link muda a cada reexecução não serve para nada.

Nada de SDK: a assinatura é um SHA-1 dos parâmetros ordenados com o segredo no fim, e o
upload é um POST de formulário — `node:crypto` mais `fetch` bastam. As credenciais vêm do
ambiente e nunca de arquivo versionado; o que fica no `plan.json` é só a URL pública.

### A virada

Enquanto houver entrada sem `cdn`, os PNGs precisam continuar no git. Depois que
`--all` cobrir tudo:

```
node scripts/devlog/upload.mjs --all --prune   # apaga o local que já subiu
printf 'docs/devlog/media/\ndocs/devlog/carousel/\n' >> .gitignore
git rm -r --cached docs/devlog/media docs/devlog/carousel
```

`--prune` faz um `HEAD` na URL antes de apagar cada arquivo, e mantém em disco o que não
responder. Ele está prestes a remover o único outro lugar onde a imagem existe; confiar no
"200 OK" do upload sem conferir a entrega seria apagar o original porque a copiadora não
reclamou.

O `publish.mjs` aceita peça que esteja **em disco ou no CDN**, então podar não trava a
publicação das entradas que ainda estão na fila. E `plan.mjs` carrega o mapa `cdn` entre
reconciliações — ele roda no começo de toda tarefa diária, e perdê-lo deixaria a vitrine
apontando para arquivo que não existe mais em lugar nenhum.

Isso não recupera o histórico: os PNGs já commitados continuam nos objetos do git. Para
zerar de verdade seria preciso reescrever a história, o que não vale a pena por ~1 MB.

## Embeds interativos

Onde o build é leve, o post não mostra só a screenshot: mostra a **engine daquele commit
rodando**. O demo de areia caindo de 18 de janeiro tem 10 KB de bundle — menos que o PNG
dele — e ali o quadro parado sempre foi o pior jeito de contar a história.

A captura já constrói o commit; `snapshotLive` apenas deixa de jogar o resultado fora e
copia o site para `docs/devlog/live/<id>/<receita>/`.

Quem entra é decidido por **peso**, não por interesse, através de `live: true` na receita:

| Receita                                    | Build           | Embute? |
| ------------------------------------------ | --------------- | ------- |
| `noita`, `iso`                             | 30 KB (os dois) | sim     |
| `roguelike`                                | 100 KB          | sim     |
| `editor`                                   | o teto decide   | tenta   |
| `solo`, `arena`, `sprites`, `atlas-studio` | 9,28 MB         | não     |

O dist do Survival tem 9,28 MB, dos quais 7,9 MB são atlas PNG; as ~91 entradas dele
dariam uns 845 MB. Um teto de 2 MB por snapshot recusa qualquer coisa desse tamanho, com
aviso, e a entrada segue apenas com a screenshot — é o que impede alguém marcar `live` num
app pesado e dobrar o repositório sem perceber.

### O isolamento, e o que ele cobra

O embed roda em `<iframe sandbox="allow-scripts">` **sem `allow-same-origin`**. O código é
do próprio repositório, mas é código de sete meses atrás rodando numa origem que também
serve o console de operação — e o token do console viaja na query string. Sem
`allow-same-origin`, o iframe é uma origem opaca e não alcança a página que o contém. A
rota repete o isolamento no cabeçalho (`Content-Security-Policy: sandbox allow-scripts`),
para valer também se alguém abrir a URL direto numa aba.

Isso cobra um preço que só aparece rodando: com origem opaca, o iframe é `null`, e
`<script type="module">` é **sempre** buscado com CORS. Sem `Access-Control-Allow-Origin`
o módulo é bloqueado e o embed vira uma moldura preta — foi exatamente o que aconteceu na
primeira tentativa. Por isso a rota manda `*`, o que não custa nada: são arquivos
estáticos de uma entrada já publicada.

E o `src` só é preenchido no clique. Uma simulação célula a célula iniciando sozinha numa
página aberta no celular queima bateria à toa.

## O serviço

O `@voxelyn/survival-server` serve o devlog em `/devlog`. Não é um projeto novo: são
rotas no servidor que já está no Render, reaproveitando o rate limiter, o logging e os
stores de telemetria que já existiam.

| Rota                     | Acesso | O que é                                          |
| ------------------------ | ------ | ------------------------------------------------ |
| `/devlog`                | aberto | As entradas publicadas, da mais recente pra trás |
| `/devlog/e/<id>`         | aberto | O post, com as imagens da época                  |
| `/devlog/a/<caminho>`    | aberto | Asset — **só** de entrada publicada              |
| `/devlog/console?token=` | token  | A próxima entrada a postar, pronta para baixar   |
| `/devlog/panel?token=`   | token  | Os digests de telemetria do jogo                 |

O token é `DEVLOG_TOKEN`. Sem ele as duas rotas de operador respondem 404 — mesma política
de `/telemetry`, e mesma sensibilidade: quem o tem lê o funil de setor e vê material que
ainda não saiu. É credencial de operador, não de leitor.

**O acesso público deriva do status no plano, nunca do disco.** O pipeline gera as 107
entradas de uma vez, então o carrossel do dia 40 já existe em disco hoje; servir o
diretório entregaria a fila inteira cinco semanas antes da hora. A rota pública exige que
o arquivo esteja em `media/` ou `carousel/` **e** que o id no nome pertença a uma entrada
publicada.

**O painel não coleta nada.** Ele desenha o digest que `/telemetry` e `/arena-telemetry`
já produzem — a mesma função pura, os mesmos números. Nenhum evento novo, nenhum
identificador, nenhum cookie: a disciplina de `telemetry.ts` (sem PII, sessão efêmera,
opt-out) continua valendo porque o serviço não tem como quebrá-la.

Para rodar local:

```
DEVLOG_TOKEN=umsegredo pnpm dev:server
# http://localhost:8080/devlog
```

`DEVLOG_DIR` aponta o serviço para outro diretório de devlog; sem ela, ele sobe a árvore
procurando `docs/devlog/plan.json`, o que funciona tanto rodando de `src/` quanto de
`dist/`.

## A publicação

`publish.mjs` confere que cada peça existe **em disco** antes de marcar a entrada como
publicada — é a rede de segurança da tarefa diária, que roda sem ninguém olhando. Uma
entrada sem redação ou sem carrossel falha alto em vez de virar um post vazio.

"Publicada" aqui significa _pronta e registrada no repositório_. Postar no Instagram
continua sendo um ato humano: os slides ficam em `carousel/` e a legenda em `social/`.
