import { describe, expect, it } from 'vitest';
import { HACK_TICKS, STRESS_DANGER, TREATS_START } from './constants.js';
import { catOf, createHackathon, emptyCommand, hashState, liveBug, nextTask, step, workable } from './index.js';
import type { CatId, Command, HackState, SlotId } from './types.js';

/**
 * A licao do Livro II da Iliada, aplicada desde o primeiro commit: uma partida
 * tem de saber SER PERDIDA e ser vencida, e as duas coisas se provam JOGANDO a
 * simulacao — nunca inspecionando constantes.
 */

const DESKS: Record<CatId, SlotId> = {
  bigode: 'desk-backend',
  cheeto: 'desk-frontend',
  almofada: 'desk-devops',
  smoking: 'desk-design',
};

const runIdle = (state: HackState): void => {
  while (state.phase === 'hack') step(state, emptyCommand());
};

/**
 * O jogador DECENTE: cada gato na propria mesa, carinho em quem esta na zona
 * de perigo, "shipa" no perfeccionista, o gato mais descansado nas
 * emergencias do rack. Uma acao por tick, como o jogo permite.
 *
 * A escolha do bombeiro pelo MAIS DESCANSADO nao e detalhe: a primeira versao
 * mandava sempre o mesmo gato, e quando a bola de pelo o pegava dormindo, o
 * bot o arrancava do puff, ele fugia de volta, e o build quebrava com o
 * "conserto" em andamento. A triagem e o jogo.
 */
const runCompetent = (state: HackState): void => {
  while (state.phase === 'hack') {
    const cmd: Command = {};
    const emergency = state.hairball.active || state.cableOut;
    const atRack = state.cats.find((c) => c.slot === 'rack' && c.mode !== 'nap');
    // O bombeiro e o gato com a PIOR necessidade mais folgada: energia OU fome
    // baixa o tiram do rack no meio do conserto (a fome custou um build na
    // primeira versao deste bot — ele mandou um gato faminto, que largou a
    // emergencia para ir ao balcao).
    const fitness = (c: (typeof state.cats)[number]) => Math.min(c.energy, c.hunger);
    const fixer = atRack ?? [...state.cats].sort((a, b) => fitness(b) - fitness(a))[0];

    if (state.held) {
      const held = catOf(state, state.held)!;
      cmd.drop = emergency && held.id === fixer.id ? 'rack' : DESKS[held.id];
    } else if (emergency && fitness(fixer) < 0.4 && state.treats > 0) {
      cmd.treat = fixer.id;
    } else if (emergency && fixer.slot !== 'rack' && fixer.mode !== 'held') {
      cmd.grab = fixer.id;
    } else {
      const awaiting = state.tasks.some((t) => t.awaitingShip && !t.cut);
      const bigode = catOf(state, 'bigode')!;
      const risky = state.cats.find((c) => c.stress > STRESS_DANGER - 0.06 && c.mode === 'work');
      const loose = state.cats.find(
        (c) => c.mode === 'idle' && c.slot === null && !(emergency && c.id === fixer.id)
      );
      if (awaiting && bigode.mode !== 'held' && bigode.mode !== 'nap') cmd.pet = 'bigode';
      else if (risky) cmd.pet = risky.id;
      else if (loose) cmd.grab = loose.id;
    }
    step(state, cmd);
  }
};

describe('determinismo', () => {
  it('mesma semente, mesmos comandos, mesmo hash', () => {
    const a = createHackathon(777);
    const b = createHackathon(777);
    for (let i = 0; i < 4000; i++) {
      step(a, emptyCommand());
      step(b, emptyCommand());
    }
    expect(hashState(a)).toBe(hashState(b));
  });

  it('sementes diferentes divergem', () => {
    const a = createHackathon(1);
    const b = createHackathon(2);
    for (let i = 0; i < 4000; i++) {
      step(a, emptyCommand());
      step(b, emptyCommand());
    }
    expect(hashState(a)).not.toBe(hashState(b));
  });
});

describe('a partida sabe ser perdida', () => {
  it('parado, o build quebra e a demo crasha — em qualquer semente', () => {
    for (const seed of [7, 42, 99, 12345]) {
      const state = createHackathon(seed);
      runIdle(state);
      expect(state.buildBroken, `seed ${seed}`).toBe(true);
      expect(state.result?.outcome, `seed ${seed}`).toBe('crashed');
      expect(state.result?.core, `seed ${seed}`).toBe(0);
    }
  });
});

describe('a partida sabe ser vencida', () => {
  it('o jogador decente sobe ao podio, em varias sementes', () => {
    for (const seed of [42, 7, 99, 2026]) {
      const state = createHackathon(seed);
      runCompetent(state);
      const r = state.result!;
      expect(r, `seed ${seed}`).not.toBeNull();
      expect(state.buildBroken, `seed ${seed}`).toBe(false);
      expect(r.crashed, `seed ${seed}: crashou com ${r.bugs} bugs`).toBe(false);
      expect(['grand-prize', 'podio'], `seed ${seed}: ${r.outcome} score=${r.score}`).toContain(r.outcome);
    }
  });
});

describe('o grafo de dependencias', () => {
  it('o dashboard NAO anda antes da API, e a API nao anda antes do schema', () => {
    const state = createHackathon(1);
    const f2 = state.tasks.find((t) => t.id === 'f2')!;
    const b2 = state.tasks.find((t) => t.id === 'b2')!;
    expect(workable(state, f2)).toBe(false);
    expect(workable(state, b2)).toBe(false);
    state.tasks.find((t) => t.id === 'b1')!.done = true;
    expect(workable(state, b2)).toBe(true);
    expect(workable(state, f2)).toBe(false);
    b2.done = true;
    state.tasks.find((t) => t.id === 'd1')!.done = true;
    expect(workable(state, f2)).toBe(true);
  });

  it('uma mesa sem tarefa desbloqueada nao produz nada', () => {
    const state = createHackathon(1);
    // frontend: f1 depende de d1, f2 de b2+d1 — no comeco, nada workable.
    expect(nextTask(state, 'frontend')).toBeUndefined();
  });

  it('cortar tira a tarefa do quadro e ela nao vira ponta solta', () => {
    const state = createHackathon(1);
    const f3 = state.tasks.find((t) => t.id === 'f3')!;
    f3.progress = 100;
    step(state, { cut: 'f3' });
    expect(f3.cut).toBe(true);
    // Forca a demo e confere que a cortada nao conta como ponta solta.
    state.tick = HACK_TICKS - 1;
    step(state, emptyCommand());
    expect(state.result!.looseEnds).toBe(0);
  });
});

describe('psicologia felina (cada traco e mecanico)', () => {
  it('o perfeccionista SEGURA a feature pronta; o carinho e o "shipa"', () => {
    const state = createHackathon(3);
    const bigode = catOf(state, 'bigode')!;
    step(state, { grab: 'bigode' });
    step(state, { drop: 'desk-backend' });
    while (bigode.mode === 'walk') step(state, emptyCommand());
    const b1 = state.tasks.find((t) => t.id === 'b1')!;
    b1.progress = b1.cost - 2;
    let guard = 0;
    while (!b1.awaitingShip && guard++ < 200) step(state, emptyCommand());
    expect(b1.awaitingShip).toBe(true);
    expect(b1.done).toBe(false);

    guard = 0;
    while (!b1.done && guard++ < 40) step(state, { pet: 'bigode' });
    expect(b1.done).toBe(true);
  });

  it('o cowboy shipa mais rapido e mais sujo: bugs "sem-teste" existem', () => {
    // Estatistico mas semeado: com custo curto o Cheeto shipa varias vezes, e
    // a chance de 35% tem de aparecer em ~40 ships.
    let dirty = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const state = createHackathon(seed);
      for (const t of state.tasks) {
        (t as { deps: readonly string[] }).deps = [];
        (t as { cost: number }).cost = 60;
      }
      step(state, { grab: 'cheeto' });
      step(state, { drop: 'desk-frontend' });
      for (let i = 0; i < 3000 && state.phase === 'hack'; i++) step(state, emptyCommand());
      dirty += state.events.filter((e) => e.kind === 'bug' && e.cause === 'sem-teste').length;
    }
    expect(dirty).toBeGreaterThan(0);
  });

  it('o Cheeto morde o cabo fora da mesa, e o rack religa', () => {
    const state = createHackathon(11);
    const cheeto = catOf(state, 'cheeto')!;
    let guard = 0;
    while (!state.cableOut && guard++ < 20000 && state.phase === 'hack') {
      cheeto.stress = Math.max(cheeto.stress, 0.95);
      step(state, emptyCommand());
    }
    expect(state.cableOut).toBe(true);

    // Com o cabo fora, nenhuma mesa progride.
    const smoking = catOf(state, 'smoking')!;
    step(state, { grab: 'smoking' });
    step(state, { drop: 'desk-design' });
    while (smoking.mode === 'walk') step(state, emptyCommand());
    const before = state.tasks.find((t) => t.id === 'd1')!.progress;
    for (let i = 0; i < 60; i++) step(state, emptyCommand());
    expect(state.tasks.find((t) => t.id === 'd1')!.progress).toBe(before);

    step(state, { grab: 'almofada' });
    step(state, { drop: 'rack' });
    guard = 0;
    while (state.cableOut && guard++ < 2000) step(state, emptyCommand());
    expect(state.cableOut).toBe(false);
  });

  it('o calmo estressa mais devagar que o julgador com bug vivo', () => {
    const state = createHackathon(5);
    state.bugs.push({ id: 0, track: 'backend', by: 'cheeto', cost: 600, progress: 0, fixed: false });
    const calmo = catOf(state, 'almofada')!;
    const julgador = catOf(state, 'smoking')!;
    calmo.stress = 0.2;
    julgador.stress = 0.2;
    for (let i = 0; i < 300; i++) step(state, emptyCommand());
    // Compara o GANHO, nao o valor absoluto: ambos partem de 0.2, e a taxa do
    // julgador com bug vivo (1.5x) e tres vezes a do calmo (0.5x).
    const gainCalmo = calmo.stress - 0.2;
    const gainJulgador = julgador.stress - 0.2;
    expect(gainJulgador).toBeGreaterThan(gainCalmo * 2.5);
  });
});

describe('necessidades', () => {
  it('fome baixa manda o gato ao balcao, e ele volta cheio', () => {
    const state = createHackathon(9);
    const cat = catOf(state, 'smoking')!;
    cat.hunger = 0.21;
    let guard = 0;
    while (cat.mode !== 'eat' && guard++ < 3000) step(state, emptyCommand());
    expect(cat.mode).toBe('eat');
    while (cat.mode === 'eat') step(state, emptyCommand());
    expect(cat.hunger).toBe(1);
  });

  it('sentar no teclado cria bug NA MESA; petiscos acabam', () => {
    const state = createHackathon(5);
    const cat = catOf(state, 'smoking')!;
    step(state, { grab: 'smoking' });
    step(state, { drop: 'desk-design' });
    while (cat.mode === 'walk') step(state, emptyCommand());
    let guard = 0;
    while (!state.bugs.some((b) => b.track === 'design') && guard++ < 9000) {
      cat.stress = Math.max(cat.stress, 0.95);
      cat.hunger = 1;
      cat.energy = 1;
      step(state, emptyCommand());
    }
    expect(state.bugs.some((b) => b.track === 'design' && b.by === 'smoking')).toBe(true);

    for (let i = 0; i < TREATS_START + 2; i++) step(state, { treat: 'smoking' });
    expect(state.treats).toBe(0);
  });

  it('bug vivo bloqueia a trilha e consertar reabre', () => {
    const state = createHackathon(9);
    state.bugs.push({ id: 0, track: 'design', by: 'cheeto', cost: 60, progress: 0, fixed: false });
    step(state, { grab: 'smoking' });
    step(state, { drop: 'desk-design' });
    const cat = catOf(state, 'smoking')!;
    while (cat.mode === 'walk') step(state, emptyCommand());
    const before = state.tasks.find((t) => t.id === 'd1')!.progress;
    for (let i = 0; i < 90; i++) step(state, emptyCommand());
    expect(state.bugs[0].fixed).toBe(true);
    expect(state.tasks.find((t) => t.id === 'd1')!.progress).toBeGreaterThan(before);
    expect(liveBug(state, 'design')).toBeUndefined();
  });
});

describe('a bola de pelo', () => {
  it('ignorada, quebra o build na janela', () => {
    const state = createHackathon(11);
    while (!state.hairball.active && state.phase === 'hack') step(state, emptyCommand());
    expect(state.hairball.active).toBe(true);
    while (state.hairball.active && state.phase === 'hack') step(state, emptyCommand());
    expect(state.buildBroken).toBe(true);
  });

  it('um gato no rack resolve e o build sobrevive', () => {
    const state = createHackathon(11);
    while (!state.hairball.active && state.phase === 'hack') step(state, emptyCommand());
    step(state, { grab: 'almofada' });
    step(state, { drop: 'rack' });
    let guard = 0;
    while (state.hairball.active && guard++ < HACK_TICKS) step(state, emptyCommand());
    expect(state.buildBroken).toBe(false);
    expect(state.events.some((e) => e.kind === 'hairball-fixed')).toBe(true);
  });
});
