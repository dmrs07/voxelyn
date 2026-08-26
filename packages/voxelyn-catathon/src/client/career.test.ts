import { beforeEach, describe, expect, it } from 'vitest';
import { CIRCUIT, CLASSIC_TEAM, HACK_TICKS, createHackathon, emptyCommand, step } from '../sim/index.js';
import type { HackState, Outcome } from '../sim/types.js';
import { ACHIEVEMENTS_ALL, applyRun, circuitLadder, loadCareer } from './career.js';

/**
 * Slice E, lado do cliente: a carreira agora CONTA a jornada — historico,
 * recordes, datas de conquista, classificacao no circuito e a temporada.
 */

const doneState = (seed = 5, outcome?: Outcome): HackState => {
  const s = createHackathon(seed, CLASSIC_TEAM, { classic: true });
  s.tick = HACK_TICKS - 1;
  while (s.phase !== 'done') step(s, emptyCommand());
  if (outcome) s.result!.outcome = outcome;
  return s;
};

beforeEach(() => {
  localStorage.clear();
});

describe('a carreira conta a jornada', () => {
  it('toda run entra no historico, com recorde e melhor colocacao', () => {
    const career = loadCareer();
    const state = doneState();
    const close = applyRun(career, state, { mode: 'quick', spent: 0, hired: CLASSIC_TEAM, rivalScore: null });
    expect(career.history.length).toBe(1);
    expect(career.history[0]!.mode).toBe('quick');
    expect(career.history[0]!.eventId).toBeNull();
    expect(career.history[0]!.score).toBe(state.result!.score);
    expect(career.bestScore).toBe(state.result!.score);
    expect(close.newBest).toBe(state.result!.score > 0);
    expect(career.bestOutcome).toBe(state.result!.outcome);
  });

  it('conquista nova ganha DATA — e a galeria conhece todas', () => {
    const career = loadCareer();
    const state = doneState();
    applyRun(career, state, { mode: 'quick', spent: 0, hired: CLASSIC_TEAM, rivalScore: null });
    for (const a of career.achievements) {
      expect(career.achievedAt[a]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // A galeria lista todas as conquistas do jogo, sem repeticao.
    const ids = ACHIEVEMENTS_ALL.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('early-bird');
    expect(ids).toContain('overclock');
  });

  it('cruzar um gate de reputacao CLASSIFICA — e o podio no palco fica na conta', () => {
    const career = loadCareer();
    career.rep = 2;
    const state = doneState(5, 'podio');
    const close = applyRun(career, state, {
      mode: 'career',
      spent: 0,
      hired: CLASSIC_TEAM,
      rivalScore: null,
      event: CIRCUIT[1],
    });
    // podio = +2: rep 2 -> 4, cruzou o gate 3 do regional.
    expect(close.qualified).toBe('regional');
    expect(career.circuitWins.regional).toBe(1);
    expect(career.history[0]!.eventId).toBe('regional');

    const ladder = circuitLadder(career);
    expect(ladder.find((r) => r.current)!.spec.id).toBe('regional');
    expect(ladder.filter((r) => r.unlocked).length).toBe(2);
    expect(ladder.find((r) => r.spec.id === 'global')!.unlocked).toBe(false);
  });

  it('uma run gloriosa que cruza DOIS gates anuncia o MAIOR — o mesmo que a Central seleciona', () => {
    // rep 2 + grand prize (+3) + rival batido (+1) = 6: cruza o gate 3 do
    // Regional E o gate 6 da Convencao — o convite anunciado e o da Convencao
    // (achado de review: anunciar o menor descasava mensagem e palco).
    const career = loadCareer();
    career.rep = 2;
    career.rival = { name: 'Team Fetch', skill: 0, wins: 0, losses: 0, roster: [] };
    const state = doneState(5, 'grand-prize');
    const close = applyRun(career, state, {
      mode: 'career',
      spent: 0,
      hired: CLASSIC_TEAM,
      rivalScore: 1,
      event: CIRCUIT[0],
    });
    expect(career.rep).toBe(6);
    expect(close.qualified).toBe('convencao');
    expect(circuitLadder(career).find((r) => r.current)!.spec.id).toBe('convencao');
  });

  it('a temporada fecha no Global, com o rival batido — uma vez so', () => {
    const career = loadCareer();
    career.rep = 20;
    career.rival = { name: 'The Golden Retrievers', skill: 1, wins: 0, losses: 0, roster: [] };
    const state = doneState(5, 'podio');
    const close = applyRun(career, state, {
      mode: 'career',
      spent: 0,
      hired: CLASSIC_TEAM,
      rivalScore: 1,
      event: CIRCUIT[4],
    });
    expect(close.rival!.beat).toBe(true);
    expect(close.seasonWonNow).toBe(true);
    expect(career.seasonWon).toBe(true);
    // Vencer de novo nao "refecha" a temporada.
    const again = applyRun(career, doneState(7, 'podio'), {
      mode: 'career',
      spent: 0,
      hired: CLASSIC_TEAM,
      rivalScore: 1,
      event: CIRCUIT[4],
    });
    expect(again.seasonWonNow).toBe(false);
    expect(career.seasonWon).toBe(true);
  });

  it('a carreira antiga carrega sem perder nada (campos novos ganham defaults)', () => {
    localStorage.setItem(
      'catathon-career',
      JSON.stringify({ wallet: 500, achievements: ['grand'], runs: 3, rep: 4, rival: null, alumni: [] })
    );
    const career = loadCareer();
    expect(career.wallet).toBe(500);
    expect(career.achievements).toEqual(['grand']);
    expect(career.history).toEqual([]);
    expect(career.bestOutcome).toBeNull();
    expect(career.circuitWins).toEqual({});
    expect(career.seasonWon).toBe(false);
  });
});
