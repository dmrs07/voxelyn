import { TICK_MS } from '@voxelyn/survival-sim';
import { createRun, stepRun } from '@voxelyn/survival-sim';
import type { SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { TouchCooldownOverlay } from './cooldown-overlay';
import { SurvivalInput, type TouchSafeArea } from './input';
import { SurvivalRenderer } from './render';
import { NetClient } from './net';
import { RestartGate } from './restart';
import { FpsGovernor, loadQuality, nextLowerQuality, saveQuality, type QualityLevel } from './settings';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game nao encontrado.');

/** Espera antes de aceitar toque como reinicio: a tela de fim precisa ser lida. */
const RESTART_ARM_MS = 900;

const menu = document.getElementById('menu') as HTMLDivElement;
const banner = document.getElementById('banner') as HTMLDivElement;
const serverInput = document.getElementById('server') as HTMLInputElement;
const qualitySelect = document.getElementById('quality') as HTMLSelectElement;

const renderer = new SurvivalRenderer(canvas);
const input = new SurvivalInput(canvas);
const cooldownOverlay = new TouchCooldownOverlay(canvas);
input.attach();

let quality: QualityLevel = loadQuality();
qualitySelect.value = quality;
renderer.setQuality(quality);
const governor = new FpsGovernor();

const readCssPixels = (name: string): number => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

const readSafeArea = (): TouchSafeArea => ({
  top: readCssPixels('--safe-area-inset-top'),
  right: readCssPixels('--safe-area-inset-right'),
  bottom: readCssPixels('--safe-area-inset-bottom'),
  left: readCssPixels('--safe-area-inset-left'),
});

const resize = (): void => {
  const safeArea = readSafeArea();
  renderer.setSafeArea(safeArea);
  renderer.resize();
  input.layoutButtons(window.innerWidth, window.innerHeight, safeArea);
};
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

const playerScreen = (): { x: number; y: number } => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

/** Devolve o jogador ao menu (erro sem retry: URL invalida, versao incompativel). */
const backToMenu = (): void => {
  menu.classList.remove('hidden');
};

const setBanner = (text: string | null): void => {
  if (!text) {
    banner.classList.add('hidden');
  } else {
    banner.textContent = text;
    banner.classList.remove('hidden');
  }
};

const haptics = (events: SemanticEvent[]): void => {
  if (!('vibrate' in navigator)) return;
  for (const e of events) {
    if (e.t === 'player_down') navigator.vibrate(120);
    else if (e.t === 'dodge') navigator.vibrate(15);
  }
};

const applyAdaptiveQuality = (dt: number): void => {
  governor.sample(dt);
  if (governor.shouldDowngrade(renderer.quality.targetFps)) {
    const lower = nextLowerQuality(renderer.quality.level);
    if (lower) {
      quality = lower;
      renderer.setQuality(lower);
      saveQuality(lower);
      qualitySelect.value = lower;
      setBanner(`Qualidade reduzida para ${lower} (desempenho)`);
      setTimeout(() => setBanner(null), 1800);
    }
  }
};

// ---------------------------------------------------------------------------
// SOLO (simulacao local, funciona offline)
// ---------------------------------------------------------------------------
let stopLoop: (() => void) | null = null;

const runSolo = (): void => {
  renderer.setLocalPlayerId(1); // solo: o unico player e o id 1
  let state: SurvivalState = createRun({ seed: (Date.now() ^ 0x5f3759df) >>> 0 });
  let accumulator = 0;
  let lastTime = performance.now();
  let running = true;
  let queuedChoice: 0 | 1 | null = null;

  const gate = new RestartGate(RESTART_ARM_MS);

  const frame = (now: number): void => {
    if (!running) return;
    const delta = Math.min(120, now - lastTime);
    applyAdaptiveQuality(delta);
    lastTime = now;
    accumulator += delta;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (state.phase !== 'running') {
      const { drain, armed } = gate.frame(now, true);
      if (drain) input.clearPendingUiInput();
      renderer.render(state, 1, input.state, now);
      renderer.renderEnd(state, vw, vh);
      if (armed && (input.hasTap() || input.consumeRestartKey())) {
        state = createRun({ seed: (Date.now() ^ 0x51ed270b) >>> 0 });
        gate.reset();
      }
      accumulator = 0;
      requestAnimationFrame(frame);
      return;
    }

    while (accumulator >= TICK_MS) {
      const cmd = input.snapshot(playerScreen());
      if (queuedChoice !== null) {
        cmd.choose = queuedChoice;
        queuedChoice = null;
      }
      const result = stepRun(state, [cmd]);
      renderer.ingestEvents(result.events, now);
      haptics(result.events);
      accumulator -= TICK_MS;
      if (state.phase !== 'running') break;
    }
    const pendingChoice = state.playerExtra.pendingModuleChoice;
    // Toques comuns sao drenados; durante uma escolha, a fila pertence aos cards.
    if (!pendingChoice && gate.frame(now, false).drain) input.clearPendingUiInput();
    const alpha = accumulator / TICK_MS;
    renderer.render(state, alpha, input.state, now);
    cooldownOverlay.render(state, input.state, state.tick + alpha, now);
    if (pendingChoice && renderer.isChoiceRevealReady(now)) {
      const regions = renderer.renderChoice(state, vw, vh, input.state);
      const choice = input.consumeChoiceTap(regions);
      if (choice !== null) queuedChoice = choice;
    } else if (pendingChoice) {
      input.clearPendingChoiceInput();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  stopLoop = () => {
    running = false;
  };
};

// ---------------------------------------------------------------------------
// ONLINE (servidor autoritativo; solo permanece disponivel offline)
// ---------------------------------------------------------------------------
const defaultServerUrl = (): string => {
  // 1) override em runtime por query (?server=)  2) build-time (VITE_SERVER_URL)
  // 3) fallback local
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  const env = (import.meta.env as Record<string, string | undefined>).VITE_SERVER_URL;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname || 'localhost'}:8080`;
};

const runOnline = (url: string): void => {
  let ws: WebSocket | null = null;
  let running = true;
  let lastTime = performance.now();
  let reconnectAt = 0;
  let fatal = false; // erro sem retry (versao incompativel, URL invalida)
  const gate = new RestartGate(RESTART_ARM_MS);
  let queuedChoice: 0 | 1 | null = null;

  // NetClient PERSISTENTE entre reconexoes: preserva resumeToken e a sequencia
  // de comandos. Se recriado a cada retry, o cliente enviaria seqs baixas que o
  // SequenceGate do servidor descartaria, travando os controles apos reconectar.
  const net = new NetClient((raw) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(raw);
  });
  net.onEvents = (events) => {
    renderer.ingestEvents(events, performance.now());
    haptics(events);
  };
  // Nem todo reject e recuperavel. Incompatibilidade de versao (o servidor
  // marca o campo) nunca melhora com retry: o cliente e antigo. Reconectar em
  // loop so gera churn durante um deploy — melhor parar e pedir recarga.
  net.onReject = (reason, field) => {
    if (field) {
      fatal = true;
      setBanner(`Versao incompativel (${field}) — recarregue a pagina.`);
      ws?.close();
      return;
    }
    setBanner('Sessao expirada — reconectando…');
    ws?.close();
  };
  net.onDiverged = () => setBanner('Ressincronizando o mundo…');

  const connect = (): void => {
    setBanner(net.resumeToken ? 'Reconectando…' : 'Conectando…');
    try {
      // URL malformada ou esquema nao-WebSocket lanca AQUI, de forma sincrona.
      // Sem tratar, o menu ja esta escondido e o loop ainda nao comecou: o
      // jogador fica numa tela morta, sem retry e sem como corrigir a URL.
      ws = new WebSocket(url);
    } catch {
      fatal = true;
      setBanner(`Endereco de servidor invalido: ${url}`);
      backToMenu();
      return;
    }
    ws.onopen = () => net.connect(net.resumeToken ?? undefined);
    ws.onmessage = (ev) => net.receive(typeof ev.data === 'string' ? ev.data : '', performance.now());
    ws.onclose = () => {
      net.markOffline();
      if (running && !fatal) reconnectAt = performance.now() + 1500;
    };
    ws.onerror = () => ws?.close();
  };
  connect();

  const frame = (now: number): void => {
    if (!running) return;
    const delta = Math.min(120, now - lastTime);
    applyAdaptiveQuality(delta);
    lastTime = now;

    if (net.status === 'online') {
      setBanner(null);
      renderer.setLocalPlayerId(net.slot + 1); // co-op: slot 1 tem id 2
      const cmd = input.snapshot(playerScreen());
      if (queuedChoice !== null) {
        cmd.choose = queuedChoice;
        queuedChoice = null;
      }
      net.setCommand(cmd);
      net.pump(now);
      const state = net.sampleRenderState(now);
      if (state) {
        const terminal = state.phase !== 'running';
        renderer.render(state, 1, input.state, now);
        cooldownOverlay.render(state, input.state, state.tick, now);
        const pendingChoice = state.playerExtra.pendingModuleChoice;
        if (pendingChoice && renderer.isChoiceRevealReady(now)) {
          const regions = renderer.renderChoice(state, window.innerWidth, window.innerHeight, input.state);
          const choice = input.consumeChoiceTap(regions);
          if (choice !== null) queuedChoice = choice;
        } else if (pendingChoice) {
          input.clearPendingChoiceInput();
        }
        const { drain, armed } = gate.frame(now, terminal);
        if (drain && !pendingChoice) input.clearPendingUiInput();
        if (terminal) {
          renderer.renderEnd(state, window.innerWidth, window.innerHeight);
          // a sala acabou: reiniciar significa entrar numa sala NOVA. Descarta o
          // resume token (senao o hello reentraria nesta mesma sala terminal) e
          // reabre o socket — o matchmaking so considera salas 'running'.
          if (armed && (input.hasTap() || input.consumeRestartKey())) {
            gate.reset();
            setBanner('Descendo de novo…');
            net.resetSession();
            ws?.close(); // onclose agenda o reconnect, agora sem token
          }
        }
      }
    } else {
      if (fatal) {
        requestAnimationFrame(frame);
        return; // banner ja explica; nao insiste
      }
      setBanner(net.status === 'reconnecting' ? 'Reconectando…' : 'Offline — tentando reconectar');
      if (reconnectAt && now >= reconnectAt && (!ws || ws.readyState === WebSocket.CLOSED)) {
        reconnectAt = 0;
        connect();
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  stopLoop = () => {
    running = false;
    ws?.close();
  };
};

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
qualitySelect.addEventListener('change', () => {
  quality = qualitySelect.value as QualityLevel;
  renderer.setQuality(quality);
  saveQuality(quality);
});

const startSolo = (): void => {
  menu.classList.add('hidden');
  stopLoop?.();
  runSolo();
};
const startOnline = (): void => {
  menu.classList.add('hidden');
  stopLoop?.();
  runOnline(serverInput.value.trim() || defaultServerUrl());
};

document.getElementById('btn-solo')?.addEventListener('click', startSolo);
document.getElementById('btn-online')?.addEventListener('click', startOnline);
serverInput.placeholder = defaultServerUrl();

// auto-start por query (?online=1)
const params = new URLSearchParams(location.search);
if (params.get('online') === '1') startOnline();
else if (params.get('solo') === '1') startSolo();

// PWA: registra o service worker (app shell offline para o solo)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* PWA opcional; o jogo funciona sem SW */
    });
  });
}
