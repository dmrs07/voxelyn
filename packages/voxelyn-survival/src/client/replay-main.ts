// Ponto de entrada do REPLAY AUTORITATIVO: `replay.html`, aberto pelo botao ao
// lado de uma run no livro do ranking (ver `rank-panel.ts` e o handler em
// `main.ts`). Ferramenta isolada, no mesmo espirito de `arena-main.ts` — o
// mesmo motor de render/simulacao do jogo real, sem nada que pertenca a
// EXPEDICAO em si (sem input, sem gravacao, sem homologacao: aqui so se
// assiste).
//
// O que este arquivo faz e literalmente o que o servidor fez para aceitar a
// run no livro: pega a seed e o log canonico, e re-simula. A diferenca e que
// aqui cada tick e desenhado em vez de descartado. Nao ha nada "confiavel" a
// mais no que se ve: e a MESMA re-simulacao, so que na tela.
import {
  TICK_MS,
  createRun,
  stepRun,
  type PlayerCommand,
  type PlayerTuning,
  type RunDepthConfig,
  type SemanticEvent,
} from '@voxelyn/survival-sim';
import { decodeCommandLog, fromBase64 } from '@voxelyn/survival-protocol';
import { SurvivalInput } from './input';
import { SurvivalRenderer } from './render';
import { LocalPlayout } from './local-playout';
import { TickEventQueue } from './playout';
import { loadQuality } from './settings';
import { MAX_RECORDED_TICKS, fetchReplay } from './run-recorder';
import { formatDuration } from './run-summary';
import { applyStaticTranslations, t } from './i18n';

// So o `<body>`, nunca o documento inteiro: `applyStaticTranslations()` troca
// `document.title` e `documentElement.lang` quando o escopo E o documento, e
// este arquivo tem titulo PROPRIO no HTML — "Voxelyn Survival — Replay" nao
// pode virar so "Voxelyn Survival" so porque a pagina tambem tem texto para
// traduzir.
applyStaticTranslations(document.body);

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game nao encontrado.');
const hudNote = document.getElementById('hud-note') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const statusTitle = document.getElementById('status-title') as HTMLHeadingElement;
const statusDetail = document.getElementById('status-detail') as HTMLParagraphElement;
const playbar = document.getElementById('playbar') as HTMLDivElement;
const btnToggle = document.getElementById('btn-toggle') as HTMLButtonElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const scrub = document.getElementById('scrub') as HTMLInputElement;
const clockEl = document.getElementById('clock') as HTMLSpanElement;

/**
 * Mesma heuristica de `main.ts` (`defaultServerUrl`), duplicada de proposito:
 * esta pagina abre em NAVEGACAO PROPRIA, sem nenhum estado do app principal
 * disponivel — o unico jeito honesto de saber o servidor e o que veio na URL.
 */
const defaultServerUrl = (): string => {
  const env = (import.meta.env as Record<string, string | undefined>).VITE_SERVER_URL;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname || 'localhost'}:8080`;
};

const showStatus = (title: string, detail: string): void => {
  statusTitle.textContent = title;
  statusDetail.textContent = detail;
  statusEl.classList.remove('hidden');
  canvas.classList.add('hidden');
  hudNote.classList.add('hidden');
  playbar.classList.add('hidden');
};

const params = new URLSearchParams(location.search);
const id = Number(params.get('id'));
const serverUrl = params.get('server') || defaultServerUrl();

const boot = async (): Promise<void> => {
  if (!Number.isInteger(id) || id <= 0) {
    showStatus(t('replay.invalid.title'), t('replay.invalid.detail'));
    return;
  }

  const payload = await fetchReplay(serverUrl, id);
  if (!payload) {
    showStatus(t('replay.unavailable.title'), t('replay.unavailable.detail'));
    return;
  }

  const bytes = fromBase64(payload.log);
  const commands = bytes ? decodeCommandLog(bytes, MAX_RECORDED_TICKS) : null;
  if (!commands || commands.length === 0) {
    showStatus(t('replay.corrupt.title'), t('replay.corrupt.detail'));
    return;
  }

  statusEl.classList.add('hidden');
  canvas.classList.remove('hidden');
  hudNote.classList.remove('hidden');
  playbar.classList.remove('hidden');

  runReplay(payload.seed, commands, payload.tuning, payload.depth);
};

const runReplay = (
  seed: number,
  commands: readonly PlayerCommand[],
  tuning: PlayerTuning | undefined,
  depth: RunDepthConfig | undefined,
): void => {
  const renderer = new SurvivalRenderer(canvas);
  renderer.setLocalPlayerId(1);
  renderer.setQuality(loadQuality());
  // Nunca `attach()`: o replay nao le teclado nem toque — o unico "input" dele
  // e o log. A instancia serve so para dar a `render()` o `InputState` default
  // que o desenho do HUD de toque espera.
  const input = new SurvivalInput(canvas);

  const resize = (): void => {
    renderer.resize();
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  resize();

  scrub.max = String(commands.length);
  scrub.value = '0';
  clockEl.textContent = formatDuration(0);

  let state = createRun({ seed, playerCount: 1, tuning, depth });
  let playout = new LocalPlayout();
  playout.capture(state);
  let frameNow = performance.now();
  let eventQueue = new TickEventQueue<SemanticEvent>((events) => {
    renderer.ingestEvents(events, frameNow);
  });

  let tickIndex = 0;
  let playing = true;
  let accumulator = 0;
  let lastTime = performance.now();

  /** Reconstroi a run do zero — usado pelo reinicio e pelo arrasto da barra. */
  const seekTo = (targetTick: number): void => {
    state = createRun({ seed, playerCount: 1, tuning, depth });
    playout = new LocalPlayout();
    playout.capture(state);
    eventQueue = new TickEventQueue<SemanticEvent>((events) => {
      renderer.ingestEvents(events, frameNow);
    });
    tickIndex = 0;
    // Avanca em bloco ate o alvo, sem desenhar quadro nenhum: e a MESMA
    // re-simulacao que o servidor faz para verificar a run inteira, so que
    // parada no meio — nao ha estado intermediario que valha a pena mostrar
    // quando o pedido e "pule para o minuto 8".
    while (tickIndex < targetTick && tickIndex < commands.length && state.phase === 'running') {
      const result = stepRun(state, [commands[tickIndex]]);
      playout.capture(state);
      eventQueue.push(state.tick, result.events);
      tickIndex++;
    }
    accumulator = 0;
    scrub.value = String(tickIndex);
    clockEl.textContent = formatDuration(state.tick);
  };

  btnToggle.addEventListener('click', () => {
    playing = !playing;
    btnToggle.textContent = playing ? t('replay.pause') : t('replay.resume');
  });
  btnRestart.addEventListener('click', () => {
    seekTo(0);
    playing = true;
    btnToggle.textContent = t('replay.pause');
  });
  // `input` (e nao `change`): arrastar a barra realimenta a cada passo, do
  // jeito que um controle de video normal se comporta.
  scrub.addEventListener('input', () => {
    playing = false;
    btnToggle.textContent = t('replay.resume');
    seekTo(Number(scrub.value));
  });

  const frame = (now: number): void => {
    frameNow = now;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const stepping = playing && state.phase === 'running' && tickIndex < commands.length;

    if (stepping) {
      const delta = Math.min(120, now - lastTime);
      accumulator += delta;
      while (accumulator >= TICK_MS && tickIndex < commands.length && state.phase === 'running') {
        const result = stepRun(state, [commands[tickIndex]]);
        playout.capture(state);
        eventQueue.push(state.tick, result.events);
        tickIndex++;
        accumulator -= TICK_MS;
      }
      scrub.value = String(tickIndex);
      clockEl.textContent = formatDuration(state.tick);
    }
    // Sempre atualizado, mesmo pausado: sem isto, um `delta` de segundos se
    // acumula enquanto a barra esta parada e o replay salta para frente
    // inteiro no primeiro quadro depois de retomar.
    lastTime = now;

    if (state.phase !== 'running') {
      eventQueue.flush(Number.POSITIVE_INFINITY);
      renderer.render(state, 1, input.state, now);
      // Sem gate por `endShown`: a tela de fim tem a PROPRIA animacao (ver
      // `renderEnd` em render.ts) e precisa ser chamada a cada quadro para
      // avancar, do mesmo jeito que `arena-main.ts` faz.
      renderer.renderEnd(state, vw, vh, now, { input: input.state, actions: false });
      requestAnimationFrame(frame);
      return;
    }

    const alpha = accumulator / TICK_MS;
    const view = playout.sample(state, alpha) ?? state;
    eventQueue.flush(view.tick);
    renderer.render(view, 1, input.state, now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

void boot();
