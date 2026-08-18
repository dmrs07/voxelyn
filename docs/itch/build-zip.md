# itch.io — como gerar o zip do jogo

```
VITE_SERVER_URL="wss://voxelyn-survival-server.onrender.com" \
  pnpm --filter @voxelyn/survival run build:offline-check

cd packages/voxelyn-survival/dist && zip -rq ../../../voxelyn-survival-$(git rev-parse --short HEAD).zip . -x '.*'
```

Duas coisas erram calado neste comando. As duas já erraram.

## 1. `VITE_SERVER_URL` — sem ela o co-op online NÃO funciona no itch

`defaultServerUrl()` (`client/main.ts`) resolve nesta ordem:

1. `?server=` na query — override de runtime;
2. **`VITE_SERVER_URL`, embutida no BUILD**;
3. fallback: `wss://<hostname atual>:8080`.

O fallback existe para desenvolvimento, onde o cliente e o servidor moram no
mesmo host. No itch.io o jogo é servido do CDN deles dentro de um iframe, então
o fallback vira `wss://html-classic.itch.zone:8080` — um host que não é o nosso
servidor e não escuta naquela porta. O jogo abre, o solo funciona inteiro, e o
co-op falha; é por isso que o erro passa por um build inteiro sem aparecer.

Como conferir ANTES de subir (o grep é a diferença entre saber e torcer):

```
grep -ro "wss://[^\"']*" packages/voxelyn-survival/dist/assets/*.js | sort -u
```

Tem de sair a URL do servidor. Se sair vazio, a variável não chegou ao build e
o zip está quebrado para co-op.

O `?server=wss://host` continua valendo como escape hatch — mas no itch o jogo
roda em iframe, onde ninguém digita query string. No build publicado, o valor
embutido é o que vale.

## 2. `ALLOWED_ORIGINS` no servidor — o outro lado, e é runtime

Só a URL não basta para tudo. Vale separar o que quebra e o que não:

| O quê | Checa origem? | Funciona no itch sem mexer no servidor? |
| --- | --- | --- |
| Co-op (WebSocket) | Não. `new WebSocketServer({ server: http })`, sem `verifyClient` | **Sim** |
| Ranking, progressão, ecos de morte (HTTP) | Sim, por CORS | **Só se a origem do itch estiver liberada** |

A regra do servidor é
`if (origin && (!allowedOrigins || allowedOrigins.includes(origin)))`: com
`ALLOWED_ORIGINS` **ausente**, tudo é liberado; **definida**, é lista branca
estrita.

Então, se `ALLOWED_ORIGINS` estiver preenchida com a URL do Static Site do
Render, o jogador que vier pelo itch salva progressão em lugar nenhum. Some a
origem do itch à lista (`https://html-classic.itch.zone`, e confira no
DevTools qual origem o iframe realmente manda — a itch já mudou esse host
antes).

## Verificação que o zip precisa passar

- `index.html` na RAIZ do zip, sem diretório embrulhando. Zip com pasta dentro
  abre como listagem de arquivos, não como jogo.
- Caminhos relativos: `vite.config.ts` fixa `base: './'`. Um `/assets/…`
  absoluto quebraria no subcaminho do itch.
- `precache OK` no fim do `build:offline-check` — o manifesto do service worker
  bate com os bundles com hash.
- No upload, marcar **"This file will be played in the browser"**.

> **Não verificado:** `onrender.com` é bloqueado pelo proxy deste ambiente, então
> a URL acima vem de `docs/deploy/render.md` e do nome do serviço em
> `render.yaml`, e não de um request que respondeu. Confirme no painel do Render
> antes de publicar; se o serviço tiver outro nome ou domínio próprio, é a
> variável do comando que muda, não o comando.
