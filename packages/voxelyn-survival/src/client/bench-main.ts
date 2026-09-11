// O RIG DE CAPTURA do benchmark do Magnetarca (bench.html).
//
// Ele existe para uma coisa so: deixar VER a partida que o bot mediu, com o
// renderer de verdade, para virar video. Nao e ferramenta de jogar — nao tem
// seletor, nao le teclado e nao decide nada.
//
// POR QUE SEPARADO DA ARENA. A Arena de Chefes (`arena.html`) monta o cenario
// dela — recorte de arena, lago de gelo, vida escolhida no seletor — e isso e
// justamente o que o benchmark NAO usa. Reproduzir um log de comandos contra um
// estado inicial diferente dessincroniza no primeiro tick, e o video mostraria
// uma partida que ninguem mediu. Aqui o estado vem de `createMagnetarchBench`,
// na simulacao, que e a MESMA funcao que o bot chama em Node.
//
// O QUE ELE COMPARTILHA COM O JOGO, e o que faz a captura valer: `stepRun` a
// 20 Hz, `LocalPlayout` interpolando para o desenho, `SurvivalRenderer` e
// `TickEventQueue`. O que fica fora e o que pertence a quem joga (entrada,
// assistencia de mira, audio) — os comandos ja estao gravados, e o audio nao
// nasce sem gesto do usuario num navegador sem usuario.

import { TICK_MS, createMagnetarchBench, stepRun } from '@voxelyn/survival-sim';
import type { PlayerCommand, SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { SurvivalInput } from './input';
import { SurvivalRenderer } from './render';
import { LocalPlayout } from './local-playout';
import { TickEventQueue } from './playout';

/** O formato que `magnetarch-bot.mjs --captures` grava. */
type Capture = {
  seed: number;
  strategy: string;
  fauna: boolean;
  outcome: string;
  ticks: number;
  hpLeft: number;
  cracked: number;
  shattered: number;
  flatTicks: number;
  chamber: string;
  /** Um comando por tick: [moveX, moveY, aimX, aimY, fire, dodge]. */
  commands: number[][];
};

const canvas = document.getElementById('game') as HTMLCanvasElement;
const badge = document.getElementById('badge') as HTMLElement;
const renderer = new SurvivalRenderer(canvas);
// O input existe porque `render` recebe o estado dele para desenhar o HUD de
// toque. Nenhum evento chega aqui: ele nasce neutro e fica neutro.
const input = new SurvivalInput(canvas);

const resize = (): void => {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
};
resize();
window.addEventListener('resize', resize);

const commandAt = (capture: Capture, tick: number): PlayerCommand => {
  const row = capture.commands[tick];
  return {
    move: { x: row?.[0] ?? 0, y: row?.[1] ?? 0 },
    aim: { x: row?.[2] ?? 0, y: row?.[3] ?? 0 },
    fire: (row?.[4] ?? 0) === 1,
    dodge: (row?.[5] ?? 0) === 1,
    ability: false,
    interact: false,
    purge: false,
    choose: null,
  };
};

const run = async (): Promise<void> => {
  const params = new URLSearchParams(location.search);
  const url = params.get('log');
  if (!url) {
    badge.textContent = 'falta ?log=<arquivo.json>';
    return;
  }
  const capture: Capture = await (await fetch(url)).json();
  const bench = createMagnetarchBench(capture.seed, { fauna: capture.fauna });
  if (!bench) {
    badge.textContent = `a seed ${capture.seed} nao monta o benchmark`;
    return;
  }
  const state: SurvivalState = bench.state;
  const playout = new LocalPlayout();
  // A fila entrega os eventos do tick NO QUADRO em que aquele tick aparece —
  // sem isso o clarao do estilhaco sai antes de o corpo chegar ao chefe. Sem
  // audio: ele nao nasce sem gesto do usuario, e nao ha usuario aqui.
  let frameNow = performance.now();
  const eventQueue = new TickEventQueue<SemanticEvent>((events) => {
    renderer.ingestEvents(events, frameNow);
  });
  playout.capture(state);

  badge.textContent =
    `seed ${capture.seed} · camara ${capture.chamber} · ${capture.strategy} · ` +
    `${capture.outcome} em ${(capture.ticks / 20).toFixed(1)}s · ` +
    `massas ${capture.cracked} · cauda ${(capture.flatTicks / 20).toFixed(1)}s`;

  // A CADENCIA E A DO JOGO, e nao a do `requestAnimationFrame`: o acumulador
  // gasta TICK_MS por passo, como em `main.ts`. Um rig que andasse um tick por
  // quadro mostraria a luta em velocidade de hardware.
  let last = performance.now();
  let accumulator = 0;
  let fed = 0;
  const frame = (now: number): void => {
    frameNow = now;
    accumulator += Math.min(250, now - last);
    last = now;
    while (accumulator >= TICK_MS && fed < capture.commands.length) {
      const result = stepRun(state, [commandAt(capture, fed)]);
      fed++;
      playout.capture(state);
      eventQueue.push(state.tick, result.events);
      accumulator -= TICK_MS;
    }
    const alpha = accumulator / TICK_MS;
    const view = playout.sample(state, alpha) ?? state;
    eventQueue.flush(view.tick);
    renderer.render(view, 1, input.state, now);
    // Marca o fim para quem assiste: o log acabou, e o estado congela onde o
    // bot parou. Sem isto o ultimo quadro ficaria indistinguivel de um travamento.
    if (fed >= capture.commands.length) {
      badge.dataset.done = 'true';
      badge.textContent = `FIM — ${badge.textContent?.replace(/^FIM — /, '') ?? ''}`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

void run();
