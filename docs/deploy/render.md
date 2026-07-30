# Deploy no Render — Voxelyn Survival (alpha)

Blueprint: [`render.yaml`](../../render.yaml). Três recursos:

- **voxelyn-survival-server** — Web Service Node (HTTP + WebSocket autoritativo).
- **voxelyn-survival-client** — Static Site (PWA).
- **voxelyn-leaderboard** — Render Postgres, usado somente pelo ranking.

Durante o alpha o servidor roda em **instância única**: o estado das salas continua
em memória e dois processos não compartilhariam partidas. O Postgres persiste apenas
o ranking; ele não torna as salas distribuídas.

## Pré-requisitos

- Conta no Render com acesso ao repositório `dmrs07/voxelyn`.
- Node 22 / pnpm 10. A raiz declara `packageManager` e limita `engines.node` à
  série 22; o próprio `buildCommand` ativa o Corepack e instala o lockfile congelado.

## Passo a passo

1. **New → Blueprint** no Render e selecione o repositório. O Render lê
   `render.yaml` e cria o Web Service, o Static Site e o banco Postgres.
2. Primeiro deploy do **server**. Após ficar `live`, copie a URL pública
   (ex.: `https://voxelyn-survival-server.onrender.com`).
3. Configure as variáveis de ambiente (marcadas `sync: false`, pedidas na UI):
   - **client** → `VITE_SERVER_URL` = a URL do server em `wss://`
     (ex.: `wss://voxelyn-survival-server.onrender.com`). É **build-time**:
     redeploy do client após alterar.
   - **server** → `ALLOWED_ORIGINS` = a origem pública do client em `https://`
     (ex.: `https://voxelyn-survival-client.onrender.com`). Aceita lista
     separada por vírgula. Vazio = sem restrição de origem (evite em produção).
4. **Redeploy do client** para embutir `VITE_SERVER_URL` no bundle.
5. Teste: abra a URL do client, **Co-op online**, em duas abas/aparelhos.

### Variáveis de ambiente

| Serviço | Variável | Exemplo | Quando aplica |
| --- | --- | --- | --- |
| server | `PORT` | injetada pelo Render | runtime (bind `0.0.0.0:$PORT`) |
| server | `ALLOWED_ORIGINS` | `https://…client.onrender.com` | runtime |
| server | `NODE_VERSION` | `22.22.0` | build |
| server | `TRUST_PROXY_HOPS` | `1` | runtime |
| server | `DATABASE_URL` | injetada por `fromDatabase.connectionString` | runtime |
| client | `NODE_VERSION` | `22.22.0` | build |
| client | `VITE_SERVER_URL` | `wss://…server.onrender.com` | **build-time** |

`TRUST_PROXY_HOPS=1` declara somente o balanceador imediatamente à frente do Web
Service como confiável. O rate limiter lê `X-Forwarded-For` da direita para a
esquerda; valores que o cliente prependa ao header não mudam sua chave. Fora do
Render, mantenha `0` ou omita a variável: nesse caso o servidor ignora o header e
usa `socket.remoteAddress`.

O client também aceita override em runtime: `?server=wss://host` na URL, ou o
campo "Servidor" no menu. Útil para testar contra outro backend sem rebuild.

## Build no Render

O checkout do Render é limpo. Os dois recursos executam explicitamente a mesma
preparação declarada no Blueprint e falham alto se o lockfile estiver defasado:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @voxelyn/survival-server... build # servidor
pnpm --filter @voxelyn/survival... build        # cliente
```

Mantenha esta seção sincronizada com `render.yaml`; não dependa de uma instalação
implícita fora do `buildCommand`.

## Health checks

- `GET /healthz` → `200 {"ok":true,"rooms":N,"conns":N}` (liveness).
- `GET /readyz` → `200` quando pronto; `503` durante draining (readiness).

O `healthCheckPath` do server aponta para `/healthz`. O Render reinicia o serviço
se o health falhar.

## Graceful shutdown / draining

No deploy ou restart, o Render envia `SIGTERM`. O server:

1. marca `/readyz` como `503` (para de receber novas conexões);
2. para o loop de tick;
3. fecha os WebSockets com código `1001` (server shutdown);
4. encerra HTTP, fecha o pool do ranking e sai com código 0.

Clientes detectam o fechamento e entram em **reconnect** por resume token; ao
subir a nova versão, reanexam à mesma sala se ela ainda existir. Como o estado é
em memória, um deploy **encerra as runs em andamento** — comunique janelas de
deploy no alpha.

## Rollback

- **Via dashboard**: no serviço, aba **Deploys** → escolha um deploy anterior
  bem-sucedido → **Rollback**. O Render republica aquele artefato.
- **Via git**: reverta o commit problemático na branch de deploy e faça push;
  com `autoDeploy: true` o Render reconstrói. Para reverter só um serviço,
  ajuste/relance apenas ele pela UI.
- **Ordem segura**: se um deploy quebrou a compatibilidade de protocolo, faça
  rollback do **server** primeiro (é a autoridade), depois do client. As versões
  `protocolVersion`/`simulationVersion`/`contentVersion` fazem o handshake
  rejeitar clientes incompatíveis com mensagem clara, então um cliente velho
  contra server novo (ou vice-versa) falha de forma explícita, não silenciosa.

## Latência (Brasil)

Antes de declarar o co-op adequado, meça o RTT do Brasil para a região escolhida
(o blueprint usa `virginia`). O snapshot já traz `serverTick`; o cliente pode
medir RTT via `ping`/`pong`. Se o RTT ficar alto, escolha a região Render mais
próxima disponível e reavalie — o slice usa interpolação e tolerâncias de co-op
(sem rollback netcode), então latências moderadas são aceitáveis, mas picos altos
degradam a sensação.

## PWA instalado: o lançamento não pode depender da rede

Um PWA que "às vezes abre e às vezes não" quase sempre é o service worker
esperando a rede. As garantias que sustentam o contrário estão em
`packages/voxelyn-survival/public/sw.js` (cobertas por `src/client/sw.test.ts`):

- **Teto de 3 s na navegação.** Celular com sinal ruim não devolve erro — ele
  pendura o `fetch`. Passado o teto, o shell sai do cache.
- **Resposta `!ok` também cai para o cache.** Janela de deploy, 5xx do host ou
  portal captivo não podem apagar a tela do jogo havendo shell guardado.
- **A raiz só é gravada no `install`,** que grava index e bundles atomicamente.
  Gravar a navegação em runtime colocaria o index novo ao lado dos bundles
  velhos e quebraria o lançamento offline seguinte.
- **Um cache por build** (`__VOXELYN_BUILD__`, derivado dos hashes dos assets e
  do HTML emitido). Isso faz cada deploy instalar um SW novo mesmo quando só o
  HTML mudou, e descarta o cache anterior em vez de acumular deploys até o
  navegador despejar a origem por quota.
- **Headers**: `/sw.js`, `/` e `/index.html` com `no-cache` (ver `render.yaml`).
  Os bundles em `/assets/` têm hash no nome e podem ser cacheados à vontade.

Ao investigar um relato, peça: versão do build, se estava online, e o resultado
de `caches.keys()` no DevTools remoto — mais de um `voxelyn-survival-*` indica
um `activate` que não rodou.

## Limites do alpha (não fazer ainda)

- O Postgres persiste somente o ranking. Não há Render Key Value nem múltiplas
  instâncias/matchmaking distribuído.
- O rate limit é local à instância. Isso é coerente com `numInstances: 1`; antes
  de escalar, mova também os buckets para um store distribuído.
- O plano gratuito do Postgres é adequado ao alpha, mas expira após 30 dias. Para
  ranking persistente em produção, altere o banco para um plano pago antes disso.
- Instância única de server. Escalar exige mover o estado de salas para fora do
  processo — fora do escopo do alpha.
- O **solo** e a **PWA** continuam utilizáveis mesmo com o server fora do ar
  (app shell em cache; o menu "Descer sozinho" não depende de rede).

## Verificação local (equivalente ao Blueprint)

```sh
corepack enable
pnpm install --frozen-lockfile

# servidor: mesma cadeia de build e start do Web Service
pnpm --filter @voxelyn/survival-server... build
PORT=8080 \
ALLOWED_ORIGINS="http://localhost:4180" \
TRUST_PROXY_HOPS=0 \
DATABASE_URL="postgresql://voxelyn:voxelyn@localhost:5432/voxelyn" \
  node packages/voxelyn-survival-server/dist/bin/serve.js

# cliente: mesmo buildCommand e staticPublishPath do Static Site
VITE_SERVER_URL="ws://localhost:8080" pnpm --filter @voxelyn/survival... build
pnpm --filter @voxelyn/survival preview --port 4180
# abra http://localhost:4180 e escolha "Co-op online" em duas abas
```

Para desenvolvimento sem Postgres, omita `DATABASE_URL`; o servidor usa o store
em memória e mantém todas as rotas e partidas funcionais.
