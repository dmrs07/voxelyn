# Fase 4 — Co-op online (2026-07-24)

Servidor autoritativo de co-op PvE para até 2 jogadores, sobre a simulação
headless determinística (Fase 2) e o protocolo versionado (Fase 2). A experiência
solo e o roguelike legado permanecem intactos.

## Simulação multiplayer (`@voxelyn/survival-sim`)

- `createRun({ playerCount })` cria 1 (solo, padrão) ou 2 players. `players[]`/
  `playerExtras[]` são a fonte da verdade; `player`/`playerExtra` seguem como
  aliases do slot 0 — o caminho solo é byte-idêntico.
- `stepRun` consome comandos por slot; inimigos miram o player de pé mais próximo;
  perigos, descargas e explosões atingem todos os players.
- **Estado abatido/revive**: um player a 0 HP com um aliado de pé fica *abatido*
  (timer de sangramento) em vez de morrer; um aliado revive interagindo por perto.
  A run só acaba quando ninguém pode agir. No solo não há aliado → 0 HP é morte
  imediata: **permadeath preservado**.
- **Loot compartilhado**: caches são da sala; no co-op abrir concede um modificador
  na hora (nunca pausa a sim autoritativa), o solo mantém o menu de escolha. A
  **extração é coletiva**: todos os players de pé precisam estar na saída.

## Servidor autoritativo (`@voxelyn/survival-server`)

- **Core transport-agnostic** (`SurvivalServer` + `GameRoom`), testável em Node:
  recebe mensagens cruas, valida via protocolo, roteia para salas, avança a sim a
  20 Hz e produz snapshots.
- **Autoridade**: clientes enviam só intenções; a validação descarta fatos
  forjados (hp/dano/kills/itens). Dedup por sequência, rate limit por conexão.
- **Sync do mundo destrutível**: `ChunkTracker` por sala emite diffs por chunk das
  células alteradas a cada tick (nunca o grid inteiro); snapshots trazem entidades,
  projéteis, eventos semânticos, `ackSeq` e um `authHash` periódico.
- **Reconnect** por resume token reanexa o mesmo slot (a sim continua durante a
  desconexão); **full resync** reconstrói o mundo de um cliente divergente.
- **Adaptador ws** (`createWsServer`): HTTP `/healthz` + `/readyz`, WebSocket,
  bind `0.0.0.0:$PORT`, CORS por origem, logs estruturados, `SIGTERM`/`SIGINT`
  com draining e graceful shutdown. Entrypoint `bin/serve.ts`.

## Gate da Fase 4 (provado)

Testes de integração (9) + smoke test real de ws:

- dois clientes entram na mesma sala em slots distintos e completam a run
  (extração coletiva via intents validados);
- cliente malicioso **não** concede vida nem itens (servidor ignora os fatos);
- desconexão não corrompe a partida; reconnect por resume token reanexa o slot;
- mundo modificado permanece consistente (espelho do cliente = mundo autoritativo
  via geração local + diffs incrementais);
- hash/estado divergente dispara resync que reconstrói o mundo.

Smoke test real: `node dist/bin/serve.js` → `/healthz` e `/readyz` 200; cliente ws
recebe `welcome` + `full_resync` + ~20 snapshots/s com 2 players; `SIGTERM`
encerra graciosamente.

## Notas e próximos passos

- O cliente de rede no PWA (substituir a sim local por conexão ws com
  interpolação) é o próximo passo de integração — o solo local permanece
  utilizável mesmo com o online fora do ar.
- Deploy (Fase 6): `render.yaml` com Static Site (PWA) + Web Service (ws), instância
  única no alpha. Medir latência do Brasil antes de declarar o co-op adequado.
