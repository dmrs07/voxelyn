import { describe, expect, it } from 'vitest';
import { ABILITY_COOLDOWN, HACK_TICKS, PET_MEMORY_TICKS, TASK_CORE_COST, TREATS_START } from './constants.js';
import { CLASSIC_TEAM, catOf, createHackathon, emptyCommand, hashState, liveBug, nextTask, step, workable } from './index.js';
import { runCompetent, runIdle } from './bots.js';
import type { HackState } from './types.js';

/**
 * A licao do Livro II da Iliada, aplicada desde o primeiro commit: uma partida
 * tem de saber SER PERDIDA e ser vencida, e as duas coisas se provam JOGANDO a
 * simulacao — nunca inspecionando constantes.
 */

/*
 * Os bots (parado e decente) moram em bots.ts desde o Slice D: a suite do
 * rival joga com os MESMOS dois jogadores desta suite.
 */

describe('determinismo', () => {
  it('mesma semente, mesmos comandos, mesmo hash', () => {
    const a = createHackathon(777, CLASSIC_TEAM, { classic: true });
    const b = createHackathon(777, CLASSIC_TEAM, { classic: true });
    for (let i = 0; i < 4000; i++) {
      step(a, emptyCommand());
      step(b, emptyCommand());
    }
    expect(hashState(a)).toBe(hashState(b));
  });

  it('sementes diferentes divergem', () => {
    const a = createHackathon(1, CLASSIC_TEAM, { classic: true });
    const b = createHackathon(2, CLASSIC_TEAM, { classic: true });
    for (let i = 0; i < 4000; i++) {
      step(a, emptyCommand());
      step(b, emptyCommand());
    }
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('o alvo de movimento entra no hash: dois estados prestes a divergir divergem JA', () => {
    const a = createHackathon(9, CLASSIC_TEAM, { classic: true });
    const b = createHackathon(9, CLASSIC_TEAM, { classic: true });
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
      const state = createHackathon(seed, CLASSIC_TEAM, { classic: true });
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
      const state = createHackathon(seed, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(1, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(1, CLASSIC_TEAM, { classic: true });
    // frontend: f1 depende de d1, f2 de b2+d1 — no comeco, nada workable.
    expect(nextTask(state, 'frontend')).toBeUndefined();
  });

  it('cortar tira a tarefa do quadro e ela nao vira ponta solta', () => {
    const state = createHackathon(1, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(3, CLASSIC_TEAM, { classic: true });
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
      const state = createHackathon(seed, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(11, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(5, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(11, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(9, CLASSIC_TEAM, { classic: true });
    const cat = catOf(state, 'smoking')!;
    cat.hunger = 0.21;
    let guard = 0;
    while (cat.mode !== 'eat' && guard++ < 3000) step(state, emptyCommand());
    expect(cat.mode).toBe('eat');
    while (cat.mode === 'eat') step(state, emptyCommand());
    expect(cat.hunger).toBe(1);
  });

  it('sentar no teclado cria bug NA MESA; petiscos acabam', () => {
    const state = createHackathon(5, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(9, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(11, CLASSIC_TEAM, { classic: true });
    while (!state.hairball.active && state.phase === 'hack') step(state, emptyCommand());
    expect(state.hairball.active).toBe(true);
    while (state.hairball.active && state.phase === 'hack') step(state, emptyCommand());
    expect(state.buildBroken).toBe(true);
  });

  it('um gato no rack resolve e o build sobrevive', () => {
    const state = createHackathon(11, CLASSIC_TEAM, { classic: true });
    while (!state.hairball.active && state.phase === 'hack') step(state, emptyCommand());
    step(state, { grab: 'almofada' });
    step(state, { drop: 'rack' });
    let guard = 0;
    while (state.hairball.active && guard++ < HACK_TICKS) step(state, emptyCommand());
    expect(state.buildBroken).toBe(false);
    expect(state.events.some((e) => e.kind === 'hairball-fixed')).toBe(true);
  });
});

describe('recuperacao, venues e brigas', () => {
  it('um build perdido volta quando um gato trabalha no rack', () => {
    const state = createHackathon(11, CLASSIC_TEAM, { classic: true });
    while (!state.hairball.active && state.phase === 'hack') step(state, emptyCommand());
    while (state.hairball.active && state.phase === 'hack') step(state, emptyCommand());
    expect(state.buildBroken).toBe(true);
    step(state, { grab: 'almofada' });
    step(state, { drop: 'rack' });
    let guard = 0;
    while (state.buildBroken && guard++ < HACK_TICKS) step(state, emptyCommand());
    expect(state.buildBroken).toBe(false);
    expect(state.buildProgress).toBe(0);
    expect(state.events.some((e) => e.kind === 'build-fixed')).toBe(true);
  });

  it('gatos no mesmo venue recebem alvos separados e tocaveis', () => {
    const state = createHackathon(5, CLASSIC_TEAM, { classic: true });
    step(state, { grab: 'bigode' });
    step(state, { drop: 'cafe' });
    step(state, { grab: 'cheeto' });
    step(state, { drop: 'cafe' });
    const a = catOf(state, 'bigode')!;
    const b = catOf(state, 'cheeto')!;
    expect(Math.hypot(a.targetX - b.targetX, a.targetY - b.targetY)).toBeGreaterThan(20);
  });

  it('pegar um briguento separa a dupla', () => {
    const state = createHackathon(8, CLASSIC_TEAM, { classic: true });
    const a = catOf(state, 'bigode')!;
    const b = catOf(state, 'cheeto')!;
    a.mode = b.mode = 'fight';
    a.slot = b.slot = null;
    state.fight = { a: a.id, b: b.id };
    step(state, { grab: a.id });
    expect(state.fight).toBeNull();
    expect(a.mode).toBe('held');
    expect(b.mode).toBe('walk');
    expect(state.events.some((e) => e.kind === 'fight-separated')).toBe(true);
  });

  it('o rack e posto social: o segundo gato NAO desaloja o primeiro', () => {
    const state = createHackathon(5, CLASSIC_TEAM, { classic: true });
    step(state, { grab: 'bigode' });
    step(state, { drop: 'rack' });
    step(state, { grab: 'cheeto' });
    step(state, { drop: 'rack' });
    const a = catOf(state, 'bigode')!;
    const b = catOf(state, 'cheeto')!;
    expect(a.slot).toBe('rack');
    expect(b.slot).toBe('rack');
    expect(Math.hypot(a.targetX - b.targetX, a.targetY - b.targetY)).toBeGreaterThan(10);
  });

  it('o PM e presenca fixa: pep talk sobe a moral de quem trabalha', () => {
    const state = createHackathon(5, CLASSIC_TEAM, { classic: true });
    expect(state.cats.length).toBe(4); // o PM NAO e contratavel nem pegavel
    expect(state.pm).toBeTruthy();
    step(state, { choose: { task: 'b1', option: 'monolito' } });
    step(state, { grab: 'bigode' });
    step(state, { drop: 'desk-backend' });
    const cat = catOf(state, 'bigode')!;
    while (cat.mode === 'walk') step(state, emptyCommand());
    cat.moral = 0.3;
    // Um periodo de pep + a caminhada do PM ate a mesa.
    let guard = 0;
    while (!state.events.some((e) => e.kind === 'pep') && guard++ < 3000) step(state, emptyCommand());
    expect(state.events.some((e) => e.kind === 'pep' && e.cat === 'bigode')).toBe(true);
    expect(cat.moral).toBeGreaterThan(0.3);
  });

  it('atras da curva, o PM resmunga o prazo — com teto de frequencia', () => {
    const state = createHackathon(5, CLASSIC_TEAM, { classic: true });
    state.tick = Math.round(HACK_TICKS / 2); // metade da run, zero entregas
    step(state, emptyCommand());
    expect(state.events.filter((e) => e.kind === 'pm-worry').length).toBe(1);
    step(state, emptyCommand());
    expect(state.events.filter((e) => e.kind === 'pm-worry').length).toBe(1);
  });

  it('fracoes do conserto entram no hash: 1078.6 e 1079.4 NAO colidem', () => {
    // fixSpeed 1.3 avanca em decimos: na escala 1 estes dois estados davam o
    // mesmo hash e o tick seguinte conserta um build e deixa o outro quebrado.
    const a = createHackathon(3, CLASSIC_TEAM, { classic: true });
    const b = createHackathon(3, CLASSIC_TEAM, { classic: true });
    a.buildBroken = b.buildBroken = true;
    a.buildProgress = 1078.6;
    b.buildProgress = 1079.4;
    expect(hashState(a)).not.toBe(hashState(b));
  });
});

describe('carinho com memoria (o exploit morreu)', () => {
  const petSession = (state: HackState, cat: string, ticks: number): void => {
    for (let i = 0; i < ticks; i++) step(state, { pet: cat as 'cheeto' });
    step(state, emptyCommand()); // fecha a sessao: a memoria registra
  };

  it('carinho baixa estresse e sobe moral — e NAO recupera energia', () => {
    const state = createHackathon(21, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(21, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(21, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(5, CLASSIC_TEAM, { classic: true });
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
    // A cena de decisao custa a caminhada de volta do quadro ate a mesa.
    for (let i = 0; i < 200; i++) step(state, emptyCommand());
    expect(b1.progress).toBeGreaterThan(0);
  });

  it('decisao aberta e CENA: o dev vai ao quadro e volta quando decidem', () => {
    const state = createHackathon(5, CLASSIC_TEAM, { classic: true });
    step(state, { grab: 'bigode' });
    step(state, { drop: 'desk-backend' });
    const cat = catOf(state, 'bigode')!;
    for (let i = 0; i < 260; i++) step(state, emptyCommand());
    // Juntou-se na frente do quadro de planejamento (x ~240, y ~156)...
    expect(Math.abs(cat.x - 240)).toBeLessThan(40);
    expect(Math.abs(cat.y - 160)).toBeLessThan(20);
    // ...e a mesa continua sendo o slot dele: decidir manda ele de volta.
    expect(cat.slot).toBe('desk-backend');
    step(state, { choose: { task: 'b1', option: 'monolito' } });
    for (let i = 0; i < 200; i++) step(state, emptyCommand());
    const seat = state.slots.find((s) => s.id === 'desk-backend')!;
    expect(Math.hypot(cat.x - seat.x, cat.y - seat.y)).toBeLessThanOrEqual(2);
    expect(state.tasks.find((t) => t.id === 'b1')!.progress).toBeGreaterThan(0);
  });

  it('microsservicos custam agora e pagam depois: b2 fica mais barato', () => {
    const state = createHackathon(5, CLASSIC_TEAM, { classic: true });
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
    const state = createHackathon(2, CLASSIC_TEAM, { classic: true });
    toPitch(state);
    while (state.phase !== 'done') step(state, emptyCommand());
    expect(state.result!.plateia).toBeLessThan(0.2);
    expect(state.result!.dimensions.pitch).toBeLessThanOrEqual(5);
  });

  it('habilidade sobe o gauge; repetir a MESMA rende metade', () => {
    const state = createHackathon(2, CLASSIC_TEAM, { classic: true });
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
    const answer = createHackathon(2, CLASSIC_TEAM, { classic: true });
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

    const ignore = createHackathon(2, CLASSIC_TEAM, { classic: true });
    toPitch(ignore);
    ignore.pitch!.crisisAt = 10;
    ignore.pitch!.crisisResolved = false;
    while (ignore.phase !== 'done') step(ignore, emptyCommand());
    expect(ignore.result!.crashed).toBe(true);
    expect(ignore.result!.outcome).toBe('crashed');
  });
});
