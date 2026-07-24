import { TICK_MS } from '../sim/constants';
import { createRun, stepRun } from '../sim/run';
import type { SurvivalState } from '../sim/types';
import { SurvivalInput } from './input';
import { SurvivalRenderer } from './render';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas #game nao encontrado.');
}

const renderer = new SurvivalRenderer(canvas);
const input = new SurvivalInput(canvas);
input.attach();

let state: SurvivalState = createRun({ seed: (Date.now() ^ 0x5f3759df) >>> 0 });
let accumulator = 0;
let lastTime = performance.now();

const resize = (): void => {
  renderer.resize();
  input.layoutButtons(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', resize);
resize();

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r' && state.phase !== 'running' && state.phase !== 'choice') {
    state = createRun({ seed: (Date.now() ^ 0x9e3779b9) >>> 0 });
  }
});

const frame = (now: number): void => {
  const delta = Math.min(120, now - lastTime);
  lastTime = now;
  accumulator += delta;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (state.phase === 'choice' && state.pendingChoice) {
    // overlay pausado: renderiza mundo + cartas e espera escolha
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
    if (input.hasTap()) {
      state = createRun({ seed: (Date.now() ^ 0x51ed270b) >>> 0 });
    }
    accumulator = 0;
    requestAnimationFrame(frame);
    return;
  }

  while (accumulator >= TICK_MS) {
    const cmd = input.snapshot(playerScreen());
    const result = stepRun(state, [cmd]);
    renderer.ingestEvents(result.events, now);
    accumulator -= TICK_MS;
    if (state.phase !== 'running') break;
  }

  renderer.render(state, accumulator / TICK_MS, input.state, now);
  requestAnimationFrame(frame);
};

/** Posicao do jogador em coordenadas de tela (para mira com mouse). */
const playerScreen = (): { x: number; y: number } => {
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
};

requestAnimationFrame(frame);

// re-layout em mudanca de orientacao
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
