import { describe, expect, it } from 'vitest';
import {
  CIRCUIT,
  CLASSIC_TEAM,
  EARLY_SCORE_MAX,
  FREEZE_STABILITY,
  HACK_TICKS,
  STRETCH_MULT_STEP,
  STRETCH_SPONSOR_PRIZE,
  STRETCH_TRACK,
  catOf,
  createHackathon,
  emptyCommand,
  eventForRep,
  hashState,
  nextLockedEvent,
  rollStretchOffers,
  step,
} from './index.js';
import type { HackState, StretchKind } from './types.js';

/**
 * Slice E: o STRETCH SPRINT (o fim de run vira decisao) e o CATATHON
 * CIRCUIT (a identidade declarada do palco) — provados JOGANDO, como tudo.
 */

const mk = (seed: number, opts: Parameters<typeof createHackathon>[2] = {}): HackState =>
  createHackathon(seed, CLASSIC_TEAM, { classic: true, ...opts });

/** Fecha o NUCLEO na mao: o MVP e o gatilho, nao o merito, destes testes. */
const shipCore = (state: HackState): void => {
  for (const t of state.tasks) if (!t.polish) t.done = true;
};

const toDone = (state: HackState): void => {
  state.tick = HACK_TICKS - 1;
  while (state.phase !== 'done') step(state, emptyCommand());
};

const seat = (state: HackState, cat: string, slot: string): void => {
  step(state, { grab: cat });
  step(state, { drop: slot as 'desk-backend' });
  while (catOf(state, cat)!.mode === 'walk') step(state, emptyCommand());
};

describe('stretch sprint: as oportunidades da edicao', () => {
  it('tres ofertas por semente, deterministicas, uma por tier de risco', () => {
    expect(rollStretchOffers(7)).toEqual(rollStretchOffers(7));
    const tiers: readonly (readonly StretchKind[])[] = [
      ['polimento-obsessivo', 'demo-viral'],
      ['feature-patrocinada', 'refactor-heroico'],
      ['escala-absurda', 'easter-egg-felino'],
    ];
    for (const seed of [1, 7, 42, 999]) {
      const offers = rollStretchOffers(seed);
      expect(offers.length).toBe(3);
      offers.forEach((kind, i) => expect(tiers[i]).toContain(kind));
    }
  });

  it('o MVP fechado abre o sprint: evento no feed e a primeira oferta aberta', () => {
    const state = mk(5);
    expect(state.sprint.mvpAt).toBe(-1);
    shipCore(state);
    step(state, emptyCommand());
    expect(state.sprint.mvpAt).toBeGreaterThanOrEqual(0);
    expect(state.events.some((e) => e.kind === 'mvp-ready')).toBe(true);
    expect(state.sprint.offers[0]!.status).toBe('open');
    // Escopo TODO cortado nao e MVP: e preciso ter shipado algo.
    const empty = mk(5);
    for (const t of empty.tasks) if (!t.polish) t.cut = true;
    step(empty, emptyCommand());
    expect(empty.sprint.mvpAt).toBe(-1);
  });

  it('aceitar cria a tarefa no quadro; a amarra da patrocinada e real', () => {
    const state = mk(5);
    shipCore(state);
    step(state, emptyCommand());
    const offer = state.sprint.offers[0]!;
    step(state, { stretch: true });
    expect(offer.status).toBe('taken');
    const task = state.tasks.find((t) => t.id === offer.taskId)!;
    expect(task.track).toBe(STRETCH_TRACK[offer.kind]);
    expect(task.done).toBe(false);
    expect(task.deps.length).toBe(0);

    // A patrocinada amarra a demo no sponsor NO ACEITE (risco imediato).
    const tied = mk(5);
    shipCore(tied);
    step(tied, emptyCommand());
    tied.sprint.offers[0] = { kind: 'feature-patrocinada', taskId: 's1', label: 'sdk', status: 'open' };
    expect(tied.sponsorRisk).toBe(false);
    step(tied, { stretch: true });
    expect(tied.sponsorRisk).toBe(true);
  });

  it('shipar o stretch paga o bonus, sobe o multiplicador e abre a proxima porta', () => {
    const state = mk(5);
    shipCore(state);
    step(state, emptyCommand());
    state.sprint.offers[0] = { kind: 'feature-patrocinada', taskId: 's1', label: 'sdk', status: 'open' };
    step(state, { stretch: true });
    // So a tarefa de stretch resta na trilha dela: a mesa vai puxa-la.
    for (const t of state.tasks) if (t.id !== 's1') t.done = true;
    const track = state.tasks.find((t) => t.id === 's1')!.track;
    const desk = `desk-${track}`;
    const worker = state.cats.find((c) => c.specialty === track)!;
    seat(state, worker.id, desk);
    let guard = 0;
    while (!state.tasks.find((t) => t.id === 's1')!.done && guard++ < 6000) {
      worker.energy = 1;
      worker.hunger = 1;
      worker.stress = 0.2;
      step(state, emptyCommand());
    }
    expect(state.tasks.find((t) => t.id === 's1')!.done).toBe(true);
    expect(state.sprint.done).toBe(1);
    expect(state.prizeBonus).toBe(STRETCH_SPONSOR_PRIZE);
    expect(state.events.some((e) => e.kind === 'stretch-done')).toBe(true);
    expect(state.sprint.offers[1]!.status).toBe('open');
  });

  it('o multiplicador multiplica a nota inteira, exatamente', () => {
    const plain = mk(7);
    toDone(plain);
    const stretched = mk(7);
    stretched.sprint.done = 2;
    toDone(stretched);
    expect(stretched.result!.score).toBe(Math.round(plain.result!.score * (1 + 2 * STRETCH_MULT_STEP)));
    expect(stretched.result!.stretched).toBe(2);
  });
});

describe('stretch sprint: congelar a submissao', () => {
  it('congelar exige MVP; congelado, vai direto ao palco com estabilidade', () => {
    const locked = mk(5);
    step(locked, { freeze: true });
    expect(locked.phase).toBe('hack');
    expect(locked.sprint.frozenAt).toBe(-1);

    const state = mk(5);
    shipCore(state);
    step(state, emptyCommand());
    const stabBefore = state.stability;
    step(state, { freeze: true });
    expect(state.phase).toBe('pitch');
    expect(state.sprint.frozenAt).toBeGreaterThanOrEqual(0);
    expect(state.stability).toBe(stabBefore + FREEZE_STABILITY);
    expect(state.events.some((e) => e.kind === 'freeze')).toBe(true);
  });

  it('a entrega antecipada paga linear na folga — e aparece no resultado', () => {
    const state = mk(5);
    shipCore(state);
    step(state, emptyCommand());
    step(state, { freeze: true });
    const frozenAt = state.sprint.frozenAt;
    while (state.phase !== 'done') step(state, emptyCommand());
    const expected = Math.round((EARLY_SCORE_MAX * (HACK_TICKS - frozenAt)) / HACK_TICKS);
    expect(state.result!.early).toBe(expected);
    expect(state.result!.early).toBeGreaterThan(0);
    // Quem foi ate o fim nao ganha (nem perde) nada por aqui.
    const full = mk(7);
    toDone(full);
    expect(full.result!.early).toBe(0);
  });

  it('congelar corta de graca o stretch aceito e INTOCADO; o comecado vira ponta solta', () => {
    const state = mk(5);
    shipCore(state);
    step(state, emptyCommand());
    step(state, { stretch: true });
    const taskId = state.sprint.offers[0]!.taskId;
    step(state, { freeze: true });
    expect(state.tasks.find((t) => t.id === taskId)!.cut).toBe(true);

    const risky = mk(5);
    shipCore(risky);
    step(risky, emptyCommand());
    step(risky, { stretch: true });
    const rTaskId = risky.sprint.offers[0]!.taskId;
    risky.tasks.find((t) => t.id === rTaskId)!.progress = 10;
    step(risky, { freeze: true });
    expect(risky.tasks.find((t) => t.id === rTaskId)!.cut).toBe(false);
    while (risky.phase !== 'done') step(risky, emptyCommand());
    expect(risky.result!.looseEnds).toBeGreaterThanOrEqual(1);
  });
});

describe('catathon circuit: a identidade declarada do palco', () => {
  it('a reputacao abre a temporada na ordem: bairro, regional, ..., global', () => {
    expect(eventForRep(0).id).toBe('bairro');
    expect(eventForRep(3).id).toBe('regional');
    expect(eventForRep(9).id).toBe('convencao');
    expect(eventForRep(99).id).toBe('global');
    expect(nextLockedEvent(0)!.id).toBe('regional');
    expect(nextLockedEvent(14)!.id).toBe('global');
    expect(nextLockedEvent(15)).toBeNull();
    // Os gates sobem com as patas: a temporada e uma escada, nao um sorteio.
    for (let i = 1; i < CIRCUIT.length; i++) {
      expect(CIRCUIT[i]!.repGate).toBeGreaterThan(CIRCUIT[i - 1]!.repGate);
      expect(CIRCUIT[i]!.paws).toBe(CIRCUIT[i - 1]!.paws + 1);
      expect(CIRCUIT[i]!.prizeScale).toBeGreaterThan(CIRCUIT[i - 1]!.prizeScale);
    }
  });

  it('o palco encarece o escopo e multiplica o cheque — exatamente o anunciado', () => {
    const global = CIRCUIT[4]!;
    const base = mk(9);
    const staged = mk(9, { circuit: global });
    for (let i = 0; i < base.tasks.length; i++) {
      expect(staged.tasks[i]!.cost).toBe(Math.round(base.tasks[i]!.cost * global.taskCostScale));
    }
    toDone(base);
    toDone(staged);
    expect(staged.result!.prize).toBe(Math.round(base.result!.prize * global.prizeScale));
  });
});

describe('achados novos entram no hash (replay sagrado)', () => {
  it('sprint e circuito divergem o hash ja no estado', () => {
    const a = mk(5);
    const b = mk(5);
    b.sprint.mvpAt = 100;
    expect(hashState(a)).not.toBe(hashState(b));
    const c = mk(5);
    c.sprint.offers[0]!.status = 'open';
    expect(hashState(a)).not.toBe(hashState(c));
    const d = mk(5, { circuit: CIRCUIT[4] });
    expect(hashState(a)).not.toBe(hashState(d));
  });

  it('a mesma semente com os mesmos comandos de sprint reproduz o hash', () => {
    const runIt = (): string => {
      const s = mk(11);
      shipCore(s);
      step(s, emptyCommand());
      step(s, { stretch: true });
      for (let i = 0; i < 60; i++) step(s, emptyCommand());
      step(s, { freeze: true });
      return hashState(s);
    };
    expect(runIt()).toBe(runIt());
  });
});
