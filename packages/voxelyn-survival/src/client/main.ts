import { TICK_MS } from '@voxelyn/survival-sim';
import { createRun, stepRun } from '@voxelyn/survival-sim';
import type { SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { SurvivalInput } from './input';
import { SurvivalRenderer } from './render';
import { NetClient } from './net';
import { FpsGovernor, loadQuality, nextLowerQuality, saveQuality, type QualityLevel } from './settings';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game nao encontrado.');

const menu = document.getElementById('menu') as HTMLDivElement;
const banner = document.getElementById('banner') as HTMLDivElement;
const serverInput = document.getElementById('server') as HTMLInputElement;
const qualitySelect = document.getElementById('quality') as HTMLSelectElement;

const renderer = new SurvivalRenderer(canvas);
const input = new SurvivalInput(canvas);
input.attach();

let quality: QualityLevel = loadQuality();
qualitySelect.value = quality;
renderer.setQuality(quality);
const governor = new FpsGovernor();

const resize = (): void => {
  renderer.resize();
  input.layoutButtons(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

const playerScreen = (): { x: number; y: number } => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

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
  let state: SurvivalState = createRun({ seed: (Date.now() ^ 0x5f3759df) >>> 0 });
  let accumulator = 0;
  let lastTime = performance.now();
  let running = true;

  const restartKey = (e: KeyboardEvent): void => {
    if (e.key.toLowerCase() === 'r' && state.phase !== 'running' && state.phase !== 'choice') {
      state = createRun({ seed: (Date.now() ^ 0x9e3779b9) >>> 0 });
    }
  };
  window.addEventListener('keydown', restartKey);

  const frame = (now: number): void => {
    if (!running) return;
    const delta = Math.min(120, now - lastTime);
    applyAdaptiveQuality(delta);
    lastTime = now;
    accumulator += delta;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (state.phase === 'choice' && state.pendingChoice) {
      renderer.render(state, 1, input.state, now);
      const regions = renderer.renderChoice(state.pendingChoice, vw, vh);
      const choice = input.consumeChoiceTap(regions);
      if (choice !== null) {
        const cmd = { ...input.snapshot(playerScreen()), choose: choice };
        const result = stepRun(state, [cmd]);
        renderer.ingestEvents(result.events, now);
      }
      accumulator = 0;
      requestAnimationFrame(frame);
      return;
    }

    if (state.phase !== 'running') {
      renderer.render(state, 1, input.state, now);
      renderer.renderEnd(state, vw, vh);
      if (input.hasTap()) state = createRun({ seed: (Date.now() ^ 0x51ed270b) >>> 0 });
      accumulator = 0;
      requestAnimationFrame(frame);
      return;
    }

    while (accumulator >= TICK_MS) {
      const cmd = input.snapshot(playerScreen());
      const result = stepRun(state, [cmd]);
      renderer.ingestEvents(result.events, now);
      haptics(result.events);
      accumulator -= TICK_MS;
      if (state.phase !== 'running') break;
    }
    renderer.render(state, accumulator / TICK_MS, input.state, now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  stopLoop = () => {
    running = false;
    window.removeEventListener('keydown', restartKey);
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

  const connect = (): void => {
    setBanner(net.resumeToken ? 'Reconectando…' : 'Conectando…');
    ws = new WebSocket(url);
    ws.onopen = () => net.connect(net.resumeToken ?? undefined);
    ws.onmessage = (ev) => net.receive(typeof ev.data === 'string' ? ev.data : '', performance.now());
    ws.onclose = () => {
      net.markOffline();
      if (running) reconnectAt = performance.now() + 1500;
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
      const cmd = input.snapshot(playerScreen());
      net.setCommand(cmd);
      net.pump(now);
      const state = net.sampleRenderState(now);
      if (state) {
        renderer.render(state, 1, input.state, now);
        if (state.phase !== 'running' && state.phase !== 'choice') {
          renderer.renderEnd(state, window.innerWidth, window.innerHeight);
        }
      }
    } else {
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
