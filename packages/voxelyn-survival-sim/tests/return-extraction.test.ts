// A extracao de RETORNO: pegar o Nucleo e so metade do contrato.
//
// O que estes testes cobram:
// 1. INVERSAO: com o Nucleo, o poco SELA (descer de novo nao existe) e a
//    ENTRADA de um setor profundo vira o portal de SUBIDA — chega-se pelo
//    poco do setor de cima e atravessa-se tudo de novo, ao contrario.
// 2. VITORIA: extracao com o Nucleo so fecha o contrato na plataforma do
//    SETOR 1. Sem o Nucleo, abandonar em qualquer profundidade segue valendo.
// 3. PRESSAO: a contaminacao NAO alivia na subida (descer alivia; subir e a
//    conta chegando) — e o mundo repovoa: o caminho de volta e contestado.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import type { SurvivalState } from '../src/types';

/** Teleporta o jogador (teste) e interage uma vez. */
const interactAt = (state: SurvivalState, x: number, y: number) => {
  state.player.x = x + 0.5;
  state.player.y = y + 0.5;
  const cmd = emptyCommand();
  cmd.interact = true;
  return stepRun(state, [cmd]).events;
};

/** Pega o Nucleo no setor final (limpa a fauna para a cena ser controlada). */
const takeCore = (state: SurvivalState): void => {
  state.enemies = [];
  state.leftEntryZone = true;
  const events = interactAt(state, state.corePos.x, state.corePos.y);
  expect(events.some((ev) => ev.t === 'pickup_core')).toBe(true);
  expect(state.coreTaken).toBe(true);
};

describe('extracao de retorno', () => {
  it('com o Nucleo: entrada sobe, poco sela, e a vitoria e SO no setor 1', () => {
    const state = createRun({ seed: 7, sector: 3 });
    takeCore(state);

    // A entrada do setor final nao extrai: SOBE para o setor 2, e o grupo
    // emerge no POCO de la (por onde desceu), com a saida ja armada.
    let events = interactAt(state, state.entry.x, state.entry.y);
    expect(state.sector).toBe(2);
    expect(state.phase).toBe('running');
    const arrived = events.find((ev) => ev.t === 'sector_entered');
    expect(arrived && 'ascending' in arrived && arrived.ascending).toBe(true);
    expect(Math.floor(state.player.x)).toBe(state.corePos.x);
    expect(state.leftEntryZone).toBe(true);
    // O mundo repovoou: o caminho de volta e contestado.
    expect(state.enemies.length).toBeGreaterThan(0);

    // O poco do setor 2 esta SELADO com o Nucleo na mao.
    state.enemies = [];
    events = interactAt(state, state.corePos.x, state.corePos.y);
    expect(state.sector).toBe(2);
    expect(events.some((ev) => ev.t === 'message' && ev.key === 'sim.wellSealedReturn')).toBe(true);

    // Sobe para o setor 1...
    events = interactAt(state, state.entry.x, state.entry.y);
    expect(state.sector).toBe(1);
    expect(state.phase).toBe('running');

    // ...e SO aqui a plataforma fecha o contrato.
    state.enemies = [];
    interactAt(state, state.entry.x, state.entry.y);
    expect(state.phase).toBe('extracted_with_core');
  });

  it('sem o Nucleo, abandonar o contrato em qualquer setor segue valendo', () => {
    const state = createRun({ seed: 7, sector: 2 });
    state.enemies = [];
    state.leftEntryZone = true;
    interactAt(state, state.entry.x, state.entry.y);
    expect(state.phase).toBe('extracted');
  });

  it('a contaminacao nao alivia na subida — e o ritmo dobrado continua', () => {
    const state = createRun({ seed: 7, sector: 3 });
    takeCore(state);
    state.contamination = 0.4;
    interactAt(state, state.entry.x, state.entry.y);
    expect(state.sector).toBe(2);
    // Nada de carryover na subida: só o crescimento do proprio tick.
    expect(state.contamination).toBeGreaterThanOrEqual(0.4);
  });
});
