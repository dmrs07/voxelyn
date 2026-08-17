// A contaminacao deixou de parar em 1,0.
//
// O bug que estes testes trancam nao era um crash: era uma AUSENCIA. A barra
// enchia, `Math.min(1, ...)` grampeava o valor, a escada de ondas ja tinha
// gasto o ultimo degrau em 0,85 — e dali em diante o relogio girava de graca.
// Saturar era o estado mais seguro da run, porque nada mais podia acontecer.
//
// O que cada teste protege, em ordem: que saturar CUSTA, que a conta CRESCE,
// que ela mata quem ignora, que descer ALIVIA, que abatido nao paga duas vezes,
// que a onda tardia nao para de vir, e que nada disso quebrou o determinismo.

import { describe, expect, it } from 'vitest';
import {
  CONTAMINATION_SATURATION_BASE_DAMAGE,
  CONTAMINATION_SATURATION_MAX_DAMAGE,
  CONTAMINATION_SATURATION_PULSE_TICKS,
  CONTAMINATION_SURGE_INTERVAL_TICKS,
  CONTAMINATION_WAVES,
  PLAYER_HP,
} from '../src/constants';
import { DEFAULT_PLAYER_TUNING } from '../src/progression';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import type { SurvivalState } from '../src/types';

/** Poe a run saturada sem esperar os catorze minutos que ela levaria de verdade. */
const saturate = (state: SurvivalState): void => {
  state.enemies = [];
  state.contamination = 1;
};

const idle = (state: SurvivalState, ticks: number): void => {
  for (let t = 0; t < ticks; t++) stepRun(state, [emptyCommand()]);
};

describe('saturacao: o ar cobra quando a barra enche', () => {
  it('anuncia UMA vez e so cobra a partir do pulso seguinte', () => {
    const state = createRun({ seed: 7, playerCount: 1 });
    saturate(state);
    const hpAntes = state.player.hp;

    // O tick do aviso nao machuca: o jogador ganha um pulso inteiro para ler a
    // tela e escolher o rumo antes de pagar por estar ali.
    const primeiro = stepRun(state, [emptyCommand()]);
    const avisos = primeiro.events.filter(
      (e) => e.t === 'message' && e.key === 'sim.contaminationCritical',
    );
    expect(avisos.length).toBe(1);
    expect(state.player.hp).toBe(hpAntes);

    // ...e a partir do pulso, cobra.
    idle(state, CONTAMINATION_SATURATION_PULSE_TICKS);
    expect(state.player.hp).toBeLessThan(hpAntes);
  });

  it('o aviso nao repete a cada tick enquanto o ar continua saturado', () => {
    const state = createRun({ seed: 7, playerCount: 1 });
    saturate(state);
    let avisos = 0;
    for (let t = 0; t < CONTAMINATION_SATURATION_PULSE_TICKS * 6; t++) {
      avisos += stepRun(state, [emptyCommand()]).events.filter(
        (e) => e.t === 'message' && e.key === 'sim.contaminationCritical',
      ).length;
    }
    expect(avisos).toBe(1);
  });

  it('a mordida ESCALA: a decima pancada doi mais que a primeira', () => {
    const state = createRun({ seed: 11, playerCount: 1 });
    saturate(state);
    stepRun(state, [emptyCommand()]); // consome o tick do aviso

    const mordida = (): number => {
      const antes = state.player.hp;
      idle(state, CONTAMINATION_SATURATION_PULSE_TICKS);
      return antes - state.player.hp;
    };

    const primeira = mordida();
    let ultima = primeira;
    for (let n = 0; n < 8; n++) ultima = mordida();

    expect(primeira).toBeCloseTo(CONTAMINATION_SATURATION_BASE_DAMAGE, 5);
    expect(ultima).toBeGreaterThan(primeira);
    expect(ultima).toBeLessThanOrEqual(CONTAMINATION_SATURATION_MAX_DAMAGE);
  });

  it('ignorada por completo, ela MATA — e a causa da morte e a propria saturacao', () => {
    const state = createRun({ seed: 13, playerCount: 1 });
    saturate(state);

    // Dois minutos de teto sao muito mais do que ela precisa; o teste falha por
    // "nao matou", nunca por "demorou um pulso a mais que eu chutei".
    for (let t = 0; t < 20 * 120 && state.phase === 'running'; t++) {
      stepRun(state, [emptyCommand()]);
      state.contamination = 1; // o ar nao melhora sozinho
    }

    expect(state.phase).toBe('dead');
    expect(state.summary?.deathCause).toEqual({ kind: 'contamination' });
  });

  it('mas deixa uma janela para correr: os dez primeiros segundos nao matam ninguem', () => {
    const state = createRun({ seed: 17, playerCount: 1 });
    saturate(state);
    idle(state, CONTAMINATION_SATURATION_PULSE_TICKS * 10 + 1);

    // A promessa de design, em numero: saturar significa "saia agora", nunca
    // "voce ja morreu". Se esta margem sumir, a corrida ate a extracao — a
    // parte interessante — sumiu junto.
    expect(state.phase).toBe('running');
    expect(state.player.hp).toBeGreaterThan(PLAYER_HP * 0.5);
  });

  it('a selagem ambiental comprada VALE contra o ar', () => {
    const cru = createRun({ seed: 23, playerCount: 1 });
    saturate(cru);

    // Pelo `createRun`, e nao por atribuicao: `tuning` e congelado de proposito
    // (uma run precisa poder dizer, meses depois, com que numeros ela rodou).
    const selado = createRun({
      seed: 23,
      playerCount: 1,
      tuning: { ...DEFAULT_PLAYER_TUNING, environmentalDamageScale: 0.5 },
    });
    saturate(selado);

    const sofrido = (s: SurvivalState): number => {
      const antes = s.player.hp;
      idle(s, CONTAMINATION_SATURATION_PULSE_TICKS * 4 + 1);
      return antes - s.player.hp;
    };

    expect(sofrido(selado)).toBeLessThan(sofrido(cru));
  });
});

describe('saturacao: o que ela NAO faz', () => {
  it('descer ALIVIA — o carryover tira o jogador da saturacao e zera a escalada', () => {
    const state = createRun({ seed: 29, playerCount: 1 });
    saturate(state);
    idle(state, CONTAMINATION_SATURATION_PULSE_TICKS * 3);
    expect(state.contaminationSaturatedAt).toBeGreaterThan(0);

    const hpAoDescer = state.player.hp;
    state.sector += 1;
    state.contamination = Math.min(1, state.contamination * 0.6);
    state.contaminationSaturatedAt = 0;
    state.contaminationNextPulseAt = 0;
    state.contaminationNextSurgeAt = 0;

    idle(state, CONTAMINATION_SATURATION_PULSE_TICKS * 3);
    // O setor novo herda pressao, nunca a cobranca: o alivio e o que paga o
    // risco de descer mais fundo.
    expect(state.contamination).toBeLessThan(1);
    expect(state.player.hp).toBe(hpAoDescer);
  });

  it('abatido no co-op nao paga: ele ja esta no relogio do bleedout', () => {
    const state = createRun({ seed: 31, playerCount: 2 });
    saturate(state);
    state.playerExtras[1].downed = true;
    const hpAbatido = state.players[1].hp;

    idle(state, CONTAMINATION_SATURATION_PULSE_TICKS * 3 + 1);

    expect(state.players[0].hp).toBeLessThan(PLAYER_HP);
    expect(state.players[1].hp).toBe(hpAbatido);
  });
});

describe('onda tardia: a pressao nao acaba no ultimo degrau', () => {
  it('passado 0,85 a leva REPETE no intervalo, em vez de silenciar de vez', () => {
    const state = createRun({ seed: 37, playerCount: 1 });
    state.enemies = [];
    // Logo acima do ultimo degrau, e longe da saturacao: o que este teste mede
    // e a onda, nao a mordida.
    state.contamination = CONTAMINATION_WAVES[CONTAMINATION_WAVES.length - 1][0] + 0.01;
    state.contaminationWaves = CONTAMINATION_WAVES.length;

    stepRun(state, [emptyCommand()]); // arma o relogio da onda tardia
    const antes = state.enemies.length;

    let repeticoes = 0;
    for (let t = 0; t < CONTAMINATION_SURGE_INTERVAL_TICKS * 2 + 5; t++) {
      repeticoes += stepRun(state, [emptyCommand()]).events.filter(
        (e) => e.t === 'message' && e.key === 'sim.contaminationRising',
      ).length;
      state.contamination = Math.min(0.99, state.contamination); // sem saturar
    }

    expect(repeticoes).toBe(2);
    expect(state.enemies.length).toBeGreaterThan(antes);
  });

  it('abaixo do ultimo degrau a onda tardia NAO existe', () => {
    const state = createRun({ seed: 41, playerCount: 1 });
    state.enemies = [];
    state.contamination = 0.4; // cruza so o primeiro degrau
    state.contaminationWaves = 1;

    let mensagens = 0;
    for (let t = 0; t < CONTAMINATION_SURGE_INTERVAL_TICKS + 50; t++) {
      mensagens += stepRun(state, [emptyCommand()]).events.filter(
        (e) => e.t === 'message' && e.key === 'sim.contaminationRising',
      ).length;
      state.contamination = 0.4;
    }
    expect(mensagens).toBe(0);
  });
});

describe('saturacao: determinismo', () => {
  it('duas simulacoes saturadas com a mesma seed continuam identicas', () => {
    const a = createRun({ seed: 43, playerCount: 1 });
    const b = createRun({ seed: 43, playerCount: 1 });
    saturate(a);
    saturate(b);
    idle(a, CONTAMINATION_SATURATION_PULSE_TICKS * 5 + 3);
    idle(b, CONTAMINATION_SATURATION_PULSE_TICKS * 5 + 3);

    expect(a.player.hp).toBe(b.player.hp);
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
  });

  it('os relogios da saturacao entram no hash autoritativo', () => {
    const a = createRun({ seed: 47, playerCount: 1 });
    const b = createRun({ seed: 47, playerCount: 1 });
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));

    // Uma maquina que discorde de QUANDO o ar saturou cobra o proximo pulso
    // diferente. O hash tem de enxergar isso.
    b.contaminationSaturatedAt = 123;
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
  });
});
