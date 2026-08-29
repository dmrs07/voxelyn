// @vitest-environment happy-dom
//
// A abertura ligada de ponta a ponta: maquina + preload + DOM.
//
// Os testes de `boot-flow` provam a ORDEM e os de `boot-tasks` provam o
// PROGRESSO; falta provar que o fio que liga os dois a tela nao inverte nada e,
// principalmente, que o menu e entregue UMA vez. Essa e a garantia que um
// refactor distraido quebra sem que nenhum dos outros testes perceba.
//
// O markup montado aqui e o mesmo de `index.html`, reduzido aos ids que
// `boot-screen` procura. Um id que sumir do HTML de verdade nao quebra este
// teste — quebra a tela; por isso `boot-screen` trata todo elemento como
// opcional e nunca lanca.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runBootSequence } from './index';
import { BOOT_TIMING_FULL, identityTotalMs } from './boot-flow';
import type { BootTask } from './boot-tasks';

const mountBootMarkup = (): void => {
  document.body.innerHTML = `
    <div id="boot" class="ax-boot" data-phase="identity">
      <img id="boot-keyart" alt="" />
      <section class="ax-boot-stage is-current" id="boot-identity">
        <div id="boot-ident-mark"></div>
        <div id="boot-ident-name"></div>
      </section>
      <section class="ax-boot-stage" id="boot-loading">
        <div id="boot-meter" role="progressbar" aria-valuenow="0">
          <i id="boot-meter-fill"></i>
        </div>
        <span id="boot-status"></span><span id="boot-percent">0%</span>
      </section>
      <section class="ax-boot-stage" id="boot-failure">
        <p id="boot-error-detail"></p>
        <button id="btn-boot-retry">Tentar de novo</button>
      </section>
    </div>
    <div id="menu" class="overlay hidden"></div>
  `;
};

const boot = (): HTMLElement => document.getElementById('boot') as HTMLElement;
const menu = (): HTMLElement => document.getElementById('menu') as HTMLElement;
const phase = (): string | undefined => boot().dataset.phase;
const currentStage = (): string | undefined =>
  document.querySelector('.ax-boot-stage.is-current')?.id;

/** Deixa o laco de `requestAnimationFrame` girar `frames` vezes. */
const advanceFrames = async (frames: number): Promise<void> => {
  for (let i = 0; i < frames; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

let now = 0;
beforeEach(() => {
  mountBootMarkup();
  now = 0;
  // Relogio e quadros sob controle: sem isto o teste esperaria os ~1,9 s reais
  // da apresentacao, e a suite inteira pagaria por cada caso.
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = setTimeout(() => cb(now), 0);
    return id as unknown as number;
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** Uma tarefa cujo desfecho o teste controla. */
const deferredTask = (id: string, critical: boolean) => {
  let settle!: (ok: boolean) => void;
  const gate = new Promise<void>((resolve, reject) => {
    settle = (ok: boolean) => (ok ? resolve() : reject(new Error(`${id} indisponivel`)));
  });
  let runs = 0;
  const task: BootTask = {
    id,
    weight: 1,
    critical,
    run: () => {
      runs += 1;
      return gate;
    },
  };
  return { task, settle, runs: () => runs };
};

describe('abertura ligada de ponta a ponta', () => {
  it('identidade -> carregamento -> menu, entregue uma unica vez', async () => {
    const onReady = vi.fn(() => menu().classList.remove('hidden'));
    const gate = deferredTask('atlas-core', true);

    const done = runBootSequence({
      buildTasks: () => [gate.task],
      onReady,
      env: { withoutIdentity: false },
    });

    // Primeiro quadro: identidade no ar, menu ainda oculto. E o requisito de
    // "zero flash de menu" observado onde ele pode falhar.
    expect(currentStage()).toBe('boot-identity');
    expect(phase()).toBe('identity');
    expect(menu().classList.contains('hidden')).toBe(true);
    expect(onReady).not.toHaveBeenCalled();

    // O preload liquida DURANTE a identidade — o caso do PWA em cache.
    gate.settle(true);
    await advanceFrames(2);
    expect(currentStage()).toBe('boot-identity');
    expect(menu().classList.contains('hidden')).toBe(true);

    // Passado o tempo da marca, a tela de carregamento entra.
    now = identityTotalMs(BOOT_TIMING_FULL);
    await advanceFrames(2);
    expect(currentStage()).toBe('boot-loading');
    expect(document.getElementById('boot-percent')?.textContent).toBe('100%');
    expect(document.getElementById('boot-meter')?.getAttribute('aria-valuenow')).toBe('100');
    expect(onReady).not.toHaveBeenCalled();

    // Cumprido o piso da tela, vem a entrega.
    now += BOOT_TIMING_FULL.loadingMinMs;
    await advanceFrames(2);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(menu().classList.contains('hidden')).toBe(false);
    expect(phase()).toBe('done');

    now += 10_000;
    await advanceFrames(4);
    await done;
    // Muitos quadros depois: continua UMA entrega.
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(gate.runs()).toBe(1);
  });

  it('a marca do DESENVOLVEDOR e montada na tela de identidade', async () => {
    const gate = deferredTask('atlas-core', true);
    void runBootSequence({
      buildTasks: () => [gate.task],
      onReady: () => {},
      ident: { name: 'ESTUDIO DE TESTE', markUrl: 'ident/exemplo.svg' },
      env: { withoutIdentity: false },
    });
    expect(document.getElementById('boot-ident-name')?.textContent).toBe('ESTUDIO DE TESTE');
    expect(document.querySelector('#boot-ident-mark img')?.getAttribute('src')).toBe(
      'ident/exemplo.svg',
    );
    gate.settle(true);
  });

  it('a barra anda com trabalho real, e o fundo so acende quando decodifica', async () => {
    const core = deferredTask('atlas-core', true);
    const art = deferredTask('keyart', false);
    void runBootSequence({
      buildTasks: () => [
        { ...core.task, weight: 3 },
        { ...art.task, weight: 1 },
      ],
      onReady: () => {},
      env: { withoutIdentity: false },
    });

    expect(document.getElementById('boot-percent')?.textContent).toBe('0%');
    expect(document.getElementById('boot-keyart')?.classList.contains('is-ready')).toBe(false);

    art.settle(true);
    await advanceFrames(2);
    // Peso 1 de 4 liquidado: 25%, e nao "metade das tarefas".
    expect(document.getElementById('boot-percent')?.textContent).toBe('25%');

    core.settle(true);
    await advanceFrames(2);
    expect(document.getElementById('boot-percent')?.textContent).toBe('100%');
    expect(document.getElementById('boot-keyart')?.classList.contains('is-ready')).toBe(true);
  });

  it('falha nao critica nao segura a abertura', async () => {
    const onReady = vi.fn();
    const core = deferredTask('atlas-core', true);
    const art = deferredTask('keyart', false);
    void runBootSequence({ buildTasks: () => [core.task, art.task], onReady, env: { skip: true } });

    core.settle(true);
    art.settle(false);
    await advanceFrames(3);
    expect(onReady).toHaveBeenCalledTimes(1);
    // O fundo falhou: a camada nunca acende, e o resto da tela e a mesma.
    expect(document.getElementById('boot-keyart')?.classList.contains('is-ready')).toBe(false);
  });

  it('falha critica para na tela de erro — e nao entrega o menu', async () => {
    const onReady = vi.fn();
    const core = deferredTask('atlas-core', true);
    void runBootSequence({ buildTasks: () => [core.task], onReady, env: { skip: true } });

    core.settle(false);
    await advanceFrames(4);

    expect(currentStage()).toBe('boot-failure');
    expect(phase()).toBe('failed');
    expect(document.getElementById('boot-error-detail')?.textContent).toContain('atlas-core');
    expect(onReady).not.toHaveBeenCalled();
    expect(menu().classList.contains('hidden')).toBe(true);

    // Muitos quadros depois continua parada ali: uma falha critica nunca vira
    // menu pelo simples passar do tempo.
    now += 60_000;
    await advanceFrames(6);
    expect(onReady).not.toHaveBeenCalled();
  });

  it('a nova tentativa refaz o preload e entrega o menu quando da certo', async () => {
    const onReady = vi.fn();
    let attempt = 0;
    const tasks: BootTask[] = [
      {
        id: 'atlas-core',
        weight: 1,
        critical: true,
        run: async () => {
          attempt += 1;
          if (attempt === 1) throw new Error('primeira tentativa falhou');
        },
      },
    ];
    void runBootSequence({ buildTasks: () => tasks, onReady, env: { skip: true } });

    await advanceFrames(4);
    expect(currentStage()).toBe('boot-failure');
    expect(attempt).toBe(1);

    (document.getElementById('btn-boot-retry') as HTMLButtonElement).click();
    await advanceFrames(4);

    expect(attempt).toBe(2);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(phase()).toBe('done');
  });

  it('sem identidade cadastrada, a abertura comeca na tela de carregamento', async () => {
    // O estado de HOJE do repositorio: `DEVELOPER_IDENT` esta vazio porque a
    // marca do desenvolvedor ainda nao existe, e a Aurix Dynamics — a
    // companhia FICTICIA do jogo — nao pode fazer as vezes dela. A fase de
    // identidade continua na maquina (a ordem e um contrato), mas dura zero:
    // ninguem espera dois segundos diante de um preto vazio.
    const onReady = vi.fn();
    const gate = deferredTask('atlas-core', true);
    void runBootSequence({ buildTasks: () => [gate.task], onReady });

    await advanceFrames(2);
    expect(currentStage()).toBe('boot-loading');
    expect(document.getElementById('boot-ident-name')?.textContent).toBe('');
    expect(document.querySelector('#boot-ident-mark img')).toBeNull();
    expect(onReady).not.toHaveBeenCalled();

    gate.settle(true);
    now += BOOT_TIMING_FULL.loadingMinMs;
    await advanceFrames(3);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('sem o markup da abertura, o menu e entregue direto', async () => {
    document.body.innerHTML = '<div id="menu" class="overlay hidden"></div>';
    const onReady = vi.fn();
    await runBootSequence({ buildTasks: () => [], onReady });
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
