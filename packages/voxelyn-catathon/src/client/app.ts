import { presentToCanvas } from '@voxelyn/core/adapters/canvas2d';
import { TICK_MS, createHackathon, step } from '../sim/index.js';
import type { HackState, SimEvent } from '../sim/types.js';
import { createAudio, setPurr, sfxAlarm, sfxBug, sfxClack, sfxDrop, sfxGrab, sfxMeow, sfxShip, sfxTreat, unlock, type AudioEngine } from './audio.js';
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

const playSfx = (app: App, events: SimEvent[]): void => {
  for (const e of events) {
    switch (e.kind) {
      case 'ship':
      case 'shortcut':
        sfxShip(app.audio);
        break;
      case 'bug':
        sfxBug(app.audio);
        break;
      case 'cable':
      case 'hairball':
      case 'build-broken':
        sfxAlarm(app.audio);
        break;
      case 'zoomies':
        sfxMeow(app.audio);
        break;
      case 'treat':
        sfxTreat(app.audio);
        break;
      default:
        break;
    }
  }
  // Clacks de teclado enquanto alguem trabalha: o som ambiente do hackathon.
  if (app.state.cats.some((c) => c.mode === 'work') && app.state.tick % 9 === 0 && Math.random() < 0.6) {
    sfxClack(app.audio);
  }
};

const tickGame = (app: App): void => {
  const wasHeld = app.state.held;
  const cmd = buildCommand(app.input, app.state, () => performance.now());
  const events = step(app.state, cmd);

  if (!wasHeld && app.state.held) sfxGrab(app.audio);
  if (wasHeld && !app.state.held) sfxDrop(app.audio);
  setPurr(app.audio, app.input.petting !== null && app.state.phase === 'hack');

  playSfx(app, events);
  pushFeed(app.hud, app.state, events);

  if (app.state.phase === 'done') {
    app.phase = 'result';
    setPurr(app.audio, false);
    showResult(app.screenHost, app.state, () => restart(app));
  }
};

const restart = (app: App): void => {
  clearScreens(app.screenHost);
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
    }),
    audio: createAudio(),
    screenHost,
    phase: 'title',
    accumulator: 0,
    lastFrame: 0,
    frameHandle: 0,
    detach: [],
  };

  app.detach.push(attachInput(input, canvas, () => app.state, () => performance.now()));
  app.detach.push(attachKeyboard(input, () => app.state));
  window.addEventListener('pointerdown', () => unlock(app.audio), { once: true });

  showTitle(screenHost, () => {
    clearScreens(screenHost);
    restart(app);
  });

  return app;
};

export const start = (app: App): void => {
  app.frameHandle = requestAnimationFrame((t) => frame(app, t));
};
