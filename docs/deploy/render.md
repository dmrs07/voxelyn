# Deploy no Render — Voxelyn Survival (alpha)

Blueprint: [`render.yaml`](../../render.yaml). Dois serviços:

- **voxelyn-survival-server** — Web Service Node (HTTP + WebSocket autoritativo).
- **voxelyn-survival-client** — Static Site (PWA).

Durante o alpha o servidor roda em **instância única** (o estado das salas é em
memória; sem Postgres nem Key Value). Não escale horizontalmente ainda — dois
processos não compartilham salas.

## Pré-requisitos

- Conta no Render com acesso ao repositório `dmrs07/voxelyn`.
- Node 22 / pnpm 10 (o blueprint usa `corepack enable`; a raiz declara
  `packageManager` e `engines.node`).

## Passo a passo

1. **New → Blueprint** no Render e selecione o repositório. O Render lê
   `render.yaml` e cria os dois serviços.
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
| server | `NODE_VERSION` | `22` | build |
| client | `VITE_SERVER_URL` | `wss://…server.onrender.com` | **build-time** |

O client também aceita override em runtime: `?server=wss://host` na URL, ou o
campo "Servidor" no menu. Útil para testar contra outro backend sem rebuild.

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
4. encerra HTTP e sai com código 0.

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
(o blueprint usa `oregon` como placeholder). O snapshot já traz `serverTick`; o
cliente pode medir RTT via `ping`/`pong`. Se o RTT ficar alto, escolha a região
Render mais próxima disponível e reavalie — o slice usa interpolação e tolerâncias
de co-op (sem rollback netcode), então latências moderadas são aceitáveis, mas
picos altos degradam a sensação.

## Limites do alpha (não fazer ainda)

- Sem Postgres (não há persistência real) nem Render Key Value (não há múltiplas
  instâncias/matchmaking distribuído).
- Instância única de server. Escalar exige mover o estado de salas para fora do
  processo — fora do escopo do alpha.
- O **solo** e a **PWA** continuam utilizáveis mesmo com o server fora do ar
  (app shell em cache; o menu "Descer sozinho" não depende de rede).

## Verificação local (equivalente ao ambiente Render)

```sh
# servidor (equivale ao startCommand do blueprint)
pnpm --filter @voxelyn/survival-sim build \
  && pnpm --filter @voxelyn/survival-protocol build \
  && pnpm --filter @voxelyn/survival-server build
PORT=8080 ALLOWED_ORIGINS="http://localhost:4180" \
  node packages/voxelyn-survival-server/dist/bin/serve.js

# cliente (equivale ao buildCommand + staticPublishPath)
VITE_SERVER_URL="ws://localhost:8080" pnpm --filter @voxelyn/survival build
pnpm --filter @voxelyn/survival preview --port 4180
# abra http://localhost:4180 e escolha "Co-op online" em duas abas
```
