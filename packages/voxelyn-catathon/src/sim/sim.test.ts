import { describe, expect, it } from 'vitest';
import { ABILITY_COOLDOWN, HACK_TICKS, PET_MEMORY_TICKS, STRESS_DANGER, TASK_CORE_COST, TREATS_START } from './constants.js';
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
  // Ate o FIM — inclusive o pitch, onde ficar parado tambem perde: a plateia
  // esfria e a crise de demo passa sem resposta.
  while (state.phase !== 'done') step(state, emptyCommand());
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
/** A ordem de palco do bot: revezar habilidades (repetir rende metade). */
const PITCH_ORDER = ['bigode', 'cheeto', 'almofada', 'smoking'] as const;

const runCompetent = (state: HackState): void => {
  let stage = 0;
  while (state.phase !== 'done') {
    if (state.phase === 'pitch') {
      // No palco: revezar quem age, sempre que alguem estiver pronto — e
      // qualquer um pronto responde a crise (a janela e curta).
      const p = state.pitch!;
      const ready = PITCH_ORDER.filter((id) => (p.readyAt[id] ?? 0) <= state.tick);
      const pick = ready.find((id) => id === PITCH_ORDER[stage % 4]) ?? ready[0];
      if (pick) {
        stage++;
        step(state, { ability: pick });
      } else {
        step(state, emptyCommand());
      }
      continue;
    }
    const cmd: Command = {};
    // Decisao aberta e a PRIMEIRA prioridade: mesa parada nao produz.
    const open = state.tasks.find((t) => t.choice && t.chosen === null && !t.done && !t.cut);
    if (open) {
      const pickOption = open.id === 'b1' ? 'micro' : open.id === 'd1' ? 'sistemaPrimeiro' : 'pipelineCompleto';
      step(state, { choose: { task: open.id, option: pickOption } });
      continue;
    }
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

  it('o alvo de movimento entra no hash: dois estados prestes a divergir divergem JA', () => {
    const a = createHackathon(9);
    const b = createHackathon(9);
    // Mesma posicao, mesmo modo — so o DESTINO difere. No proximo tick as
    // posicoes divergem; o hash tem de acusar antes.
    for (const s of [a, b]) {
      const c = catOf(s, 'bigode')!;
      c.mode = 'walk';
      c.targetY = c.y;
    }
    catOf(a, 'bigode')!.targetX = 100;
    catOf(b, 'bigode')!.targetX = 400;
    expect(hashState(a)).not.toBe(hashState(b));
    step(a, emptyCommand());
    step(b, emptyCommand());
    expect(catOf(a, 'bigode')!.x).not.toBe(catOf(b, 'bigode')!.x);
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
    // Forca o fim das 48h, atravessa o pitch e confere que a cortada nao
    // conta como ponta solta.
    state.tick = HACK_TICKS - 1;
    while (state.phase !== 'done') step(state, emptyCommand());
    expect(state.result!.looseEnds).toBe(0);
  });
});

describe('psicologia felina (cada traco e mecanico)', () => {
  it('o perfeccionista SEGURA a feature pronta; o carinho e o "shipa"', () => {
    const state = createHackathon(3);
    const bigode = catOf(state, 'bigode')!;
    step(state, { choose: { task: 'b1', option: 'monolito' } });
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

describe('territorio', () => {
  it('o desalojado ANDA para longe da mesa — nao fica embaixo do novo dono', () => {
    const state = createHackathon(11);
    const invader = catOf(state, 'cheeto')!;
    const owner = catOf(state, 'bigode')!;
    step(state, { grab: 'bigode' });
    step(state, { drop: 'desk-backend' });
    while (catOf(state, 'bigode')!.mode === 'walk') step(state, emptyCommand());
    const deskX = owner.x;
    step(state, { grab: 'cheeto' });
    step(state, { drop: 'desk-backend' });
    expect(owner.slot).toBeNull();
    while (catOf(state, 'bigode')!.mode === 'walk') step(state, emptyCommand());
    expect(invader.slot).toBe('desk-backend');
    expect(Math.abs(owner.x - deskX)).toBeGreaterThanOrEqual(18);
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
    step(state, { choose: { task: 'd1', option: 'componentesLocais' } });
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

describe('carinho com memoria (o exploit morreu)', () => {
  const petSession = (state: HackState, cat: string, ticks: number): void => {
    for (let i = 0; i < ticks; i++) step(state, { pet: cat as 'cheeto' });
    step(state, emptyCommand()); // fecha a sessao: a memoria registra
  };

  it('carinho baixa estresse e sobe moral — e NAO recupera energia', () => {
    const state = createHackathon(21);
    const cheeto = catOf(state, 'cheeto')!;
    cheeto.stress = 0.6;
    const moral0 = cheeto.moral;
    const energy0 = cheeto.energy;
    petSession(state, 'cheeto', 30);
    expect(cheeto.stress).toBeLessThan(0.6);
    expect(cheeto.moral).toBeGreaterThan(moral0);
    expect(cheeto.energy).toBeLessThanOrEqual(energy0);
  });

  it('a terceira sessao seguida SUPERESTIMULA: estresse sobe', () => {
    const state = createHackathon(21);
    const cheeto = catOf(state, 'cheeto')!;
    cheeto.stress = 0.5;
    petSession(state, 'cheeto', 20);
    petSession(state, 'cheeto', 20);
    const before = cheeto.stress;
    petSession(state, 'cheeto', 20);
    expect(cheeto.stress).toBeGreaterThan(before);
    expect(state.events.some((e) => e.kind === 'overpet' && e.cat === 'cheeto')).toBe(true);
  });

  it('a memoria decai: depois de um tempo, carinho vale cheio de novo', () => {
    const state = createHackathon(21);
    const cheeto = catOf(state, 'cheeto')!;
    petSession(state, 'cheeto', 20);
    petSession(state, 'cheeto', 20);
    // Passa o tempo da memoria sem carinho nenhum — jogando, nao editando.
    for (let i = 0; i < PET_MEMORY_TICKS + 2; i++) step(state, emptyCommand());
    cheeto.stress = 0.5;
    const before = cheeto.stress;
    petSession(state, 'cheeto', 20);
    expect(cheeto.stress).toBeLessThan(before);
  });
});

describe('decisoes de engenharia', () => {
  it('tarefa com decisao aberta NAO anda; decidir muda custo e tags', () => {
    const state = createHackathon(5);
    step(state, { grab: 'bigode' });
    step(state, { drop: 'desk-backend' });
    while (catOf(state, 'bigode')!.mode === 'walk') step(state, emptyCommand());
    const b1 = state.tasks.find((t) => t.id === 'b1')!;
    for (let i = 0; i < 320; i++) step(state, emptyCommand());
    expect(b1.progress).toBe(0);
    expect(state.events.some((e) => e.kind === 'decision-needed')).toBe(true);

    step(state, { choose: { task: 'b1', option: 'serverless' } });
    expect(b1.chosen).toBe('serverless');
    expect(b1.cost).toBe(Math.round(TASK_CORE_COST * 0.7));
    expect(state.sponsorRisk).toBe(true);
    expect(state.innovation).toBe(1);
    for (let i = 0; i < 30; i++) step(state, emptyCommand());
    expect(b1.progress).toBeGreaterThan(0);
  });

  it('microsservicos custam agora e pagam depois: b2 fica mais barato', () => {
    const state = createHackathon(5);
    const b2 = state.tasks.find((t) => t.id === 'b2')!;
    const before = b2.cost;
    step(state, { choose: { task: 'b1', option: 'micro' } });
    expect(b2.cost).toBeLessThan(before);
  });
});

describe('o pitch e jogavel', () => {
  const toPitch = (state: HackState): void => {
    state.tick = HACK_TICKS - 1;
    step(state, emptyCommand());
    expect(state.phase).toBe('pitch');
  };

  it('parado no palco, a plateia esfria — pitch tambem sabe ser perdido', () => {
    const state = createHackathon(2);
    toPitch(state);
    while (state.phase !== 'done') step(state, emptyCommand());
    expect(state.result!.plateia).toBeLessThan(0.2);
    expect(state.result!.dimensions.pitch).toBeLessThanOrEqual(5);
  });

  it('habilidade sobe o gauge; repetir a MESMA rende metade', () => {
    const state = createHackathon(2);
    toPitch(state);
    step(state, { ability: 'bigode' });
    const first = state.events.filter((e) => e.kind === 'ability').at(-1)!;
    for (let i = 0; i < ABILITY_COOLDOWN + 1; i++) step(state, emptyCommand());
    step(state, { ability: 'bigode' });
    const second = state.events.filter((e) => e.kind === 'ability').at(-1)!;
    expect(first.kind === 'ability' && second.kind === 'ability').toBe(true);
    if (first.kind === 'ability' && second.kind === 'ability') {
      expect(second.effect).toBeCloseTo(first.effect * 0.5, 5);
    }
  });

  it('crise respondida vira improviso heroico; ignorada, a demo crasha', () => {
    const answer = createHackathon(2);
    toPitch(answer);
    answer.pitch!.crisisAt = 10;
    answer.pitch!.crisisResolved = false;
    for (let i = 0; i < 11; i++) step(answer, emptyCommand());
    expect(answer.events.some((e) => e.kind === 'demo-glitch')).toBe(true);
    step(answer, { ability: 'almofada' });
    expect(answer.events.some((e) => e.kind === 'improviso')).toBe(true);
    while (answer.phase !== 'done') step(answer, emptyCommand());
    expect(answer.result!.crashed).toBe(false);
    expect(answer.result!.improvised).toBe(true);

    const ignore = createHackathon(2);
    toPitch(ignore);
    ignore.pitch!.crisisAt = 10;
    ignore.pitch!.crisisResolved = false;
    while (ignore.phase !== 'done') step(ignore, emptyCommand());
    expect(ignore.result!.crashed).toBe(true);
    expect(ignore.result!.outcome).toBe('crashed');
  });
});
