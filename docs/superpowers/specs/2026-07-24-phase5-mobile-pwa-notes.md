# Fase 5 — Mobile, PWA e cliente online (2026-07-24)

Torna o Voxelyn Survival instalável e jogável por toque, e conecta o cliente ao
servidor autoritativo da Fase 4 — sem perder a experiência solo offline.

## Cliente de rede (`NetClient`)

- Sem DOM, transport-agnostic (recebe um `send(raw)`, consome `receive(raw)`),
  testável em Node contra o `SurvivalServer`.
- Handshake `hello` → gera o mundo estático localmente pela mesma seed
  (`createRun`) e aponta as camadas do render para um `ClientWorldMirror`; aplica
  diffs de chunk incrementais dos snapshots e `full_resync` quando pedido.
- Reconstrói um `SurvivalState` renderável a cada frame (reusa o renderer inteiro):
  entidades e projéteis do snapshot com **interpolação** entre os dois últimos
  frames, HUD do jogador local via o campo `you` (heat/consumíveis/modificadores/
  aim/hasCore/downed) do protocolo.
- Envia intenções com throttle (~25 Hz) e sequência incremental; `reconnect` por
  resume token; estados `connecting/online/reconnecting/offline`.

Protocolo estendido: `EntitySnapshot.downed/facing`, `ServerSnapshot.you`
(`ViewerState`). O servidor preenche ambos por viewer.

## PWA

- `public/manifest.webmanifest` (landscape, fullscreen, tema `#0b0e14`, ícones
  192/512/maskable gerados com a identidade do Veio).
- `public/sw.js`: app shell em cache (network-first para navegação, cache-first
  para assets) → **solo jogável offline**; WebSocket nunca passa pelo SW.
- `index.html`: meta PWA, safe-area insets, menu sem overflow, banner de conexão.

## Qualidade adaptável e mobile

- Presets `high/medium/low` (`settings.ts`): limite de DPR, teto de FX, luzes
  dinâmicas on/off, escala de shake, FPS-alvo (60/45/30). Persistidos em
  localStorage e configuráveis no menu.
- `FpsGovernor`: mede FPS e **rebaixa automaticamente** o preset após ~2s
  sustentados abaixo do alvo (fallback para 30 FPS em hardware modesto).
- Háptica opcional (`navigator.vibrate`) em queda e esquiva.

## Modos no cliente

Menu inicial: **Descer sozinho** (sim local, offline) ou **Co-op online** (URL de
servidor configurável; default `ws(s)://host:8080`). Query params `?online=1`,
`?solo=1`, `?server=…`. O solo permanece 100% funcional com o online fora do ar.

## Gate da Fase 5 (verificado)

- **Duas abas completam o handshake e jogam juntas** no navegador: teste com
  Playwright + Chromium → servidor reporta `rooms:1, conns:2`, ambas as abas
  `online` e renderizando o **mesmo mundo autoritativo** (evidências:
  `docs/audit/baseline/2026-07-24-coop-tab1.png` e `-tab2.png`).
- Interface sem overflow em 844×390 (`2026-07-24-survival-menu-mobile-844x390.png`).
- Controles touch completos (Fase 1) + qualidade configurável + auto-downgrade.
- Instalável como PWA (manifest + SW 200) e solo offline via app shell.
- Feedback de offline/reconnect por banner.

Testes: NetClient↔Server em memória (5), cobrindo handshake, sync do mundo
destrutível, HUD autoritativo, reconnect por token e extração coletiva chegando
ao view.

## Próximo (Fase 6 — Render alpha)

`render.yaml` (Static Site PWA + Web Service ws), deploy público, medir latência
do Brasil, docs de deploy/rollback.
