import { presentToCanvas } from '@voxelyn/core/adapters/canvas2d';
import { TICK_MS, createHackathon, step } from '../sim/index.js';
import type { HackState, SimEvent } from '../sim/types.js';
import {
  createAudioEngine,
  demoAudio,
  eventsAudio,
  getLevels,
  grabVocal,
  setLevel,
  setPetPurr,
  startGameAudio,
  stopGameAudio,
  tickAudio,
  unlockAudio,
  type AudioEngine,
  type BusId,
} from './audio/index.js';
import { attachInput, attachKeyboard, buildCommand, createInput, type InputState, type InputTeardown } from './input.js';
import { clearScreens, createHud, drawCard, drawHud, pushFeed, showResult, showTitle, type Hud } from './hud.js';
import { createView, drawHand, drawScene, type View } from './render.js';

export type App = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  view: View;
  state: HackState;
  input: InputState;
  hud: Hud;
  audio: AudioEngine;
  screenHost: HTMLElement;
  phase: 'title' | 'playing' | 'result';
  accumulator: number;
  lastFrame: number;
  frameHandle: number;
  detach: InputTeardown[];
};

/**
 * VIBRACAO: o tato do telefone, com a mesma disciplina das vozes — escassa.
 * Pegar e soltar sao toquinhos; so os CRITICOS ganham padrao. Guardada porque
 * nem todo aparelho (nem todo humano) quer vibrar.
 */
const buzz = (pattern: number | number[]): void => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // sem vibracao nao e sem jogo
  }
};

const tickGame = (app: App): void => {
  const wasHeld = app.state.held;
  const cmd = buildCommand(app.input, app.state, () => performance.now());
  const events = step(app.state, cmd);

  // Pegar um gato PODE arrancar um chirp de reconhecimento — pode: as regras
  // de escassez (cooldown, vaga global, 1 em 3 silencioso) moram no modulo de
  // vozes, nao aqui.
  if (!wasHeld && app.state.held) {
    grabVocal(app.audio, app.state, app.state.held);
    buzz(8);
  }
  if (wasHeld && !app.state.held) buzz(14);

  const petted = app.input.petting ? app.state.cats.find((c) => c.id === app.input.petting) ?? null : null;
  setPetPurr(app.audio, app.state.phase === 'hack' ? petted : null);

  tickAudio(app.audio, app.state);
  eventsAudio(app.audio, app.state, events);
  for (const e of events) {
    if (e.kind === 'hairball' || e.kind === 'cable' || e.kind === 'build-broken' || e.kind === 'demo-glitch') buzz([30, 40, 30]);
    else if (e.kind === 'ship' || e.kind === 'improviso') buzz(12);
    else if (e.kind === 'treat') buzz([8, 20, 8]);
  }
  pushFeed(app.hud, app.state, events);

  if (app.state.phase === 'done') {
    app.phase = 'result';
    // O ritual da submissao: a musica congela, o deploy fala, e o final e
    // festa intima ou feltro gentil — nunca tragedia.
    demoAudio(app.audio, app.state);
    showResult(app.screenHost, app.state, () => restart(app));
  }
};

const restart = (app: App): void => {
  clearScreens(app.screenHost);
  stopGameAudio(app.audio);
  startGameAudio(app.audio);
  // A semente vem do relogio UMA vez, aqui no cliente. A simulacao nunca ve
  // tempo real — so a semente congelada.
  app.state = createHackathon((Date.now() ^ 0xca7a7040) >>> 0);
  app.input.selected = null;
  app.input.queue.length = 0;
  app.phase = 'playing';
};

const frame = (app: App, now: number): void => {
  const delta = Math.min(200, now - (app.lastFrame || now));
  app.lastFrame = now;

  if (app.phase === 'playing') {
    app.accumulator += delta;
    let steps = 0;
    while (app.accumulator >= TICK_MS && steps < 6) {
      tickGame(app);
      app.accumulator -= TICK_MS;
      steps++;
      if (app.phase !== 'playing') break;
    }
    drawHud(app.hud, app.state);
    drawCard(app.hud, app.state, app.input.selected);
    // O botao de petisco pulsa enquanto armado: o proximo toque num gato
    // alimenta, e o jogador precisa VER que o modo esta ligado.
    app.hud.treatsBtn.classList.toggle('armed', app.input.feedArmed);
    app.hud.root.hidden = false;
  } else {
    app.accumulator = 0;
    app.hud.root.hidden = app.phase === 'title';
  }

  drawScene(app.view, app.state, app.state.tick, app.input.selected);
  if (app.phase === 'playing') drawHand(app.view, app.input.x, app.input.y, app.state.held !== null);
  presentToCanvas(app.ctx, app.view.surface);
  app.frameHandle = requestAnimationFrame((t) => frame(app, t));
};

export const createApp = (canvas: HTMLCanvasElement, hudHost: HTMLElement, screenHost: HTMLElement): App => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponivel');
  canvas.width = 480;
  canvas.height = 270;

  const input = createInput();
  const audio = createAudioEngine();
  const app: App = {
    canvas,
    ctx,
    view: createView(),
    state: createHackathon(20260821),
    input,
    hud: createHud(hudHost, {
      onCut: (taskId) => input.queue.push({ cut: taskId }),
      onFeedToggle: () => {
        input.feedArmed = !input.feedArmed;
      },
      onLevel: (bus, level) => setLevel(audio, bus as BusId, level),
      levels: () => getLevels(audio),
      // Selecao pelos retratos da equipe: sem cacar 22 pixels em movimento.
      onSelect: (cat) => {
        input.selected = input.selected === cat ? null : cat;
      },
      onChoose: (task, option) => input.queue.push({ choose: { task, option } }),
      onAbility: (cat) => input.queue.push({ ability: cat }),
    }),
    audio,
    screenHost,
    phase: 'title',
    accumulator: 0,
    lastFrame: 0,
    frameHandle: 0,
    detach: [],
  };

  app.detach.push(attachInput(input, canvas, () => app.state, () => performance.now()));
  app.detach.push(attachKeyboard(input, () => app.state));
  window.addEventListener('pointerdown', () => unlockAudio(app.audio), { once: true });
  window.addEventListener('touchstart', () => unlockAudio(app.audio), { once: true, passive: true });

  showTitle(screenHost, () => {
    clearScreens(screenHost);
    restart(app);
  });

  return app;
};

export const start = (app: App): void => {
  app.frameHandle = requestAnimationFrame((t) => frame(app, t));
};
