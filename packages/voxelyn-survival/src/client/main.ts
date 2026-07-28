import { TICK_MS } from '@voxelyn/survival-sim';
import { createRun, stepRun } from '@voxelyn/survival-sim';
import type { SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { TouchCooldownOverlay } from './cooldown-overlay';
import { SurvivalInput, type TouchSafeArea } from './input';
import { SurvivalRenderer } from './render';
import { NetClient } from './net';
import { RestartGate } from './restart';
import {
  FpsGovernor,
  loadAudioSettings,
  loadQuality,
  nextLowerQuality,
  saveAudioSettings,
  saveQuality,
  type QualityLevel,
} from './settings';
import { audio } from './audio';
import { applyRun, loadRecords, saveRecords, type Records } from './records';
import { renderRecordsPanel } from './records-panel';
import { formatSeed, parseSeed } from './run-summary';
import { isValidRoomCode, normalizeRoomCode } from '@voxelyn/survival-protocol';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game nao encontrado.');

/** Espera antes de aceitar toque como reinicio: a tela de fim precisa ser lida. */
const RESTART_ARM_MS = 900;

const menu = document.getElementById('menu') as HTMLDivElement;
const banner = document.getElementById('banner') as HTMLDivElement;
const serverInput = document.getElementById('server') as HTMLInputElement;
const qualitySelect = document.getElementById('quality') as HTMLSelectElement;
const volumeInput = document.getElementById('volume') as HTMLInputElement;
const muteButton = document.getElementById('btn-mute') as HTMLButtonElement;
const seedInput = document.getElementById('seed') as HTMLInputElement;
const roomInput = document.getElementById('room') as HTMLInputElement;
const recordsOverlay = document.getElementById('records') as HTMLDivElement;
const recordsBody = document.getElementById('records-body') as HTMLDivElement;

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

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
// O contexto so nasce num gesto do usuario (ver AudioDirector.unlock). Os
// controles do menu ajustam volume ANTES disso, entao o estado vive aqui e e
// aplicado assim que o contexto existir.
const audioSettings = loadAudioSettings();
audio.setVolume(audioSettings.volume);
audio.setMuted(audioSettings.muted);
volumeInput.value = String(Math.round(audioSettings.volume * 100));

const renderMuteLabel = (): void => {
  muteButton.textContent = audioSettings.muted ? 'Som: desligado' : 'Som: ligado';
  muteButton.classList.toggle('primary', !audioSettings.muted);
};
renderMuteLabel();

const setMuted = (muted: boolean): void => {
  audioSettings.muted = muted;
  audio.setMuted(muted);
  saveAudioSettings(audioSettings);
  renderMuteLabel();
};

volumeInput.addEventListener('input', () => {
  audioSettings.volume = Number(volumeInput.value) / 100;
  audio.setVolume(audioSettings.volume);
  saveAudioSettings(audioSettings);
});

muteButton.addEventListener('click', () => {
  setMuted(!audioSettings.muted);
  // Toca DEPOIS de religar: sem um som imediato, o botao nao da nenhum retorno
  // e parece que nao fez nada.
  if (!audioSettings.muted) {
    audio.unlock();
    audio.ui();
  }
});

// A aba escondida nao pode continuar zumbindo: os leitos de ambiencia sao
// continuos e sobreviveriam a troca de aplicativo no celular.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.suspend();
  else audio.resume();
});

/** Atalho M: mudo sem voltar ao menu. */
window.addEventListener('keydown', (ev) => {
  if (ev.key !== 'm' && ev.key !== 'M') return;
  setMuted(!audioSettings.muted);
  if (!audioSettings.muted) audio.unlock();
  setBanner(audioSettings.muted ? 'Som desligado' : 'Som ligado');
  setTimeout(() => setBanner(null), 1200);
});

// ---------------------------------------------------------------------------
// Memoria entre runs
// ---------------------------------------------------------------------------
let records: Records = loadRecords();

/**
 * Registra uma run terminada, UMA VEZ.
 *
 * O guard por identidade do sumario e o que impede a run de ser contada a cada
 * quadro: a fase terminal persiste, o loop continua desenhando, e sem ele o
 * historico ganharia sessenta copias por segundo da mesma morte.
 */
let recordedSummary: unknown = null;
/** Seed fixada pelo jogador no menu, ou null para sortear a cada descida. */
let forcedSeed: number | null = null;
const recordRun = (state: SurvivalState): void => {
  if (!state.summary || state.summary === recordedSummary) return;
  recordedSummary = state.summary;
  records = applyRun(records, state.summary);
  saveRecords(records);
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

/**
 * Seed da proxima descida.
 *
 * Uma seed digitada vale para a run inteira, INCLUSIVE os reinicios: a razao de
 * o campo existir e alguem colar a seed de outra pessoa e tentar a mesma
 * descida, e sortear uma nova ao morrer destruiria exatamente esse uso.
 */
const nextSeed = (): number => forcedSeed ?? ((Date.now() ^ 0x5f3759df) >>> 0);

const runSolo = (): void => {
  renderer.setLocalPlayerId(1); // solo: o unico player e o id 1
  audio.setLocalPlayerId(1);
  audio.reset();
  let state: SurvivalState = createRun({ seed: nextSeed() });
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
      recordRun(state);
      const { drain, armed } = gate.frame(now, true);
      if (drain) input.clearPendingUiInput();
      audio.update(state, now);
      renderer.render(state, 1, input.state, now);
      renderer.renderEnd(state, vw, vh);
      if (armed && (input.hasTap() || input.consumeRestartKey())) {
        state = createRun({ seed: nextSeed() });
        audio.reset();
        recordedSummary = null;
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
      audio.ingest(result.events, now, state);
      haptics(result.events);
      accumulator -= TICK_MS;
      if (state.phase !== 'running') break;
    }
    const pendingChoice = state.playerExtra.pendingModuleChoice;
    // Toques comuns sao drenados; durante uma escolha, a fila pertence aos cards.
    if (!pendingChoice && gate.frame(now, false).drain) input.clearPendingUiInput();
    const alpha = accumulator / TICK_MS;
    audio.update(state, now);
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

const runOnline = (url: string, roomCode: string | null): void => {
  let ws: WebSocket | null = null;
  let running = true;
  let lastTime = performance.now();
  let reconnectAt = 0;
  let fatal = false; // erro sem retry (versao incompativel, URL invalida)
  const gate = new RestartGate(RESTART_ARM_MS);
  let queuedChoice: 0 | 1 | null = null;
  // Ultimo estado amostrado, guardado para o audio posicionar o ouvinte.
  // Os eventos chegam por `ws.onmessage`, fora do quadro, entao nao ha estado
  // "atual" ali — usar o do quadro anterior erra a posicao do ouvinte em no
  // maximo um quadro, que e menos que a resolucao do paneamento.
  let lastState: SurvivalState | null = null;

  // NetClient PERSISTENTE entre reconexoes: preserva resumeToken e a sequencia
  // de comandos. Se recriado a cada retry, o cliente enviaria seqs baixas que o
  // SequenceGate do servidor descartaria, travando os controles apos reconectar.
  const net = new NetClient((raw) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(raw);
  });
  // Sobrevive as reconexoes: a primeira queda de rede jogaria o jogador numa
  // sala qualquer, longe do parceiro, se o codigo vivesse so nesta chamada.
  net.roomCode = roomCode;
  net.onEvents = (events) => {
    const now = performance.now();
    renderer.ingestEvents(events, now);
    audio.ingest(events, now, lastState ?? undefined);
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
      // O codigo so aparece enquanto o parceiro NAO chegou: depois disso ele e
      // ruido permanente na tela, e a informacao que importa passa a ser o
      // jogo. Enquanto se joga sozinho, ele e a unica forma de convidar.
      const waiting = net.playerCount() < 2;
      setBanner(waiting && net.activeRoomCode ? `Sala ${net.activeRoomCode} — aguardando parceiro` : null);
      renderer.setLocalPlayerId(net.slot + 1); // co-op: slot 1 tem id 2
      audio.setLocalPlayerId(net.slot + 1);
      const cmd = input.snapshot(playerScreen());
      if (queuedChoice !== null) {
        cmd.choose = queuedChoice;
        queuedChoice = null;
      }
      net.setCommand(cmd);
      net.pump(now);
      const state = net.sampleRenderState(now);
      if (state) {
        lastState = state;
        const terminal = state.phase !== 'running';
        audio.update(state, now);
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
          recordRun(state);
          renderer.renderEnd(state, window.innerWidth, window.innerHeight);
          // a sala acabou: reiniciar significa entrar numa sala NOVA. Descarta o
          // resume token (senao o hello reentraria nesta mesma sala terminal) e
          // reabre o socket — o matchmaking so considera salas 'running'.
          if (armed && (input.hasTap() || input.consumeRestartKey())) {
            gate.reset();
            audio.reset();
            recordedSummary = null;
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

/**
 * O clique que inicia a run e o gesto que destrava o audio.
 *
 * Este e o unico momento garantido: o auto-start por query (?solo=1) NAO conta
 * como gesto, entao naquele caminho o contexto so nasce no primeiro toque
 * dentro do jogo — e por isso `unlock` tambem e chamado pelo input.
 */
const startSolo = (): void => {
  audio.unlock();
  audio.ui();
  menu.classList.add('hidden');
  stopLoop?.();
  runSolo();
};
const startOnline = (): void => {
  const code = normalizeRoomCode(roomInput.value);
  if (code !== '' && !isValidRoomCode(code)) {
    setBanner(`Código de sala inválido: ${code}`);
    setTimeout(() => setBanner(null), 2400);
    return;
  }
  audio.unlock();
  audio.ui();
  menu.classList.add('hidden');
  stopLoop?.();
  runOnline(serverInput.value.trim() || defaultServerUrl(), code || null);
};

// Rede de seguranca para o auto-start por query e para browsers que exigem um
// gesto DENTRO do documento: qualquer primeiro toque/tecla destrava o audio.
// `once` porque depois disso o unlock e responsabilidade do ciclo de vida.
for (const evt of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(evt, () => audio.unlock(), { once: true, passive: true });
}

document.getElementById('btn-solo')?.addEventListener('click', startSolo);
document.getElementById('btn-online')?.addEventListener('click', startOnline);
serverInput.placeholder = defaultServerUrl();

// ---------------------------------------------------------------------------
// Seed e registro
// ---------------------------------------------------------------------------
const syncSeedFromInput = (): void => {
  forcedSeed = parseSeed(seedInput.value);
  // Normaliza para hex assim que a seed e aceita: o campo passa a mostrar
  // exatamente o texto que a tela de fim imprime, que e o que se compartilha.
  if (forcedSeed !== null) seedInput.value = formatSeed(forcedSeed);
};
seedInput.addEventListener('change', syncSeedFromInput);

// ?seed= permite mandar um link para a mesma descida, nao so o numero.
const seedParam = new URLSearchParams(location.search).get('seed');
if (seedParam) {
  seedInput.value = seedParam;
  syncSeedFromInput();
}

// O menu SAI enquanto o registro esta aberto. As duas overlays usam o mesmo
// fundo a 92% de opacidade, entao empilhadas o titulo "VOXELYN SURVIVAL"
// aparecia atras de "REGISTRO" — legivel o bastante para parecer defeito.
document.getElementById('btn-records')?.addEventListener('click', () => {
  renderRecordsPanel(recordsBody, records);
  menu.classList.add('hidden');
  recordsOverlay.classList.remove('hidden');
  audio.unlock();
  audio.ui();
});
document.getElementById('btn-records-close')?.addEventListener('click', () => {
  recordsOverlay.classList.add('hidden');
  menu.classList.remove('hidden');
  audio.ui();
});

// auto-start por query (?online=1). ?room=XYZ transforma o convite num LINK,
// que e como as pessoas realmente compartilham: quem recebe entra direto.
const params = new URLSearchParams(location.search);
const roomParam = params.get('room');
if (roomParam) roomInput.value = normalizeRoomCode(roomParam);
if (roomParam || params.get('online') === '1') startOnline();
else if (params.get('solo') === '1') startSolo();

// PWA: registra o service worker (app shell offline para o solo)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* PWA opcional; o jogo funciona sem SW */
    });
  });
}
