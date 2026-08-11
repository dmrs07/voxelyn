// O CICLO da leyline: dormente → carregando → descarga → refrataria.
//
// O que estes testes cobram:
// 1. SINAL ANTES DO DANO: o tiro energy ARMA (leyline_charge) e nao machuca
//    ninguem no impacto; a descarga so existe LEYLINE_CHARGE_TICKS depois.
// 2. SEGMENTO, nao linha: a juncao fecha a propagacao por construcao — o
//    trecho vizinho nao acorda.
// 3. CADENCIA: refrataria ignora novas ativacoes; depois dela o segmento
//    rearma. Um hit por entidade por ativacao, com o desconto de fogo amigo.
// 4. RESSONANCIA: uma ativacao = +1 `current` — frequencia, nunca area.
// 5. PERMANENCIA: nenhuma classe de projetil morde a leyline; a juncao e
//    inerte a tudo neste corte.
import { describe, expect, it } from 'vitest';
import {
  DISCHARGE_DAMAGE,
  LEYLINE_CHARGE_TICKS,
  LEYLINE_NODE_INTERACT_RADIUS,
  LEYLINE_REFRACTORY_TICKS,
  PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE,
  SOLID_LEYLINE,
  SOLID_LEYLINE_NODE,
  SOLID_NONE,
  SURF_NONE,
} from '../src/constants';
import { impactSolid } from '../src/materials';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { deriveLeylineNodes } from '../src/worldgen';
import { DISCOVERY_LEYLINE_ROUTED } from '../src/types';
import type { PlayerCommand, SemanticEvent, SurvivalState } from '../src/types';

const clearArea = (state: SurvivalState, x0: number, y0: number, x1: number, y1: number): void => {
  const w = state.config.width;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
  state.vents = state.vents.filter((vent) => vent.x < x0 || vent.x > x1 || vent.y < y0 || vent.y > y1);
};

/**
 * Cena controlada: um corredor limpo com DOIS segmentos de leyline na parede
 * da linha y=30, separados por uma juncao — exatamente o que o worldgen
 * produz, so que em posicao conhecida.
 */
const scene = (): SurvivalState => {
  const state = createRun({ seed: 1 });
  const w = state.config.width;
  clearArea(state, 20, 24, 44, 36);
  state.enemies = [];
  const segA: number[] = [];
  const segB: number[] = [];
  for (let x = 25; x <= 32; x++) {
    state.solid[30 * w + x] = SOLID_LEYLINE;
    segA.push(30 * w + x);
  }
  state.solid[30 * w + 33] = SOLID_LEYLINE_NODE;
  for (let x = 34; x <= 40; x++) {
    state.solid[30 * w + x] = SOLID_LEYLINE;
    segB.push(30 * w + x);
  }
  state.leylineSegments = [
    { cells: segA, dischargeAt: 0, refractoryUntil: 0, triggeredBy: -1, relayed: false },
    { cells: segB, dischargeAt: 0, refractoryUntil: 0, triggeredBy: -1, relayed: false },
  ];
  // A adjacencia sai da MESMA derivacao da run de verdade — aqui sem elos de
  // construcao, entao a cena prova o ramo de PROXIMIDADE (Chebyshev <= 3)
  // junto com o comportamento que depende dele.
  state.leylineNodes = deriveLeylineNodes(
    [{ cell: 30 * w + 33, segments: [] }],
    state.leylineSegments,
    w,
  );
  // Longe da linha por padrao; cada teste posiciona quem deve levar o choque.
  state.player.x = 22.5;
  state.player.y = 26.5;
  return state;
};

const stepIdle = (state: SurvivalState): SemanticEvent[] => stepRun(state, [emptyCommand()]).events;

const playerOrigin = (state: SurvivalState) =>
  ({ source: 'player', owner: state.player.id }) as const;

describe('ciclo da leyline', () => {
  it('energy arma com aviso, sem dano no impacto; a descarga sai no tick anunciado', () => {
    const state = scene();
    const events: SemanticEvent[] = [];
    // Jogador colado na linha: o pior caso — e mesmo assim o aviso vem antes.
    state.player.x = 28.5;
    state.player.y = 31.5;
    const hp0 = state.player.hp;

    const r = impactSolid(state, 28, 30, 'energy', events, playerOrigin(state));
    expect(r).toEqual({ stop: true, broke: false });
    const charge = events.find((ev) => ev.t === 'leyline_charge');
    expect(charge).toBeDefined();
    if (charge?.t !== 'leyline_charge') throw new Error('unreachable');
    expect(charge.dischargeTick).toBe(state.tick + LEYLINE_CHARGE_TICKS);
    expect(charge.cells).toEqual(state.leylineSegments[0].cells);
    expect(events.some((ev) => ev.t === 'discharge')).toBe(false);
    expect(state.player.hp).toBe(hp0);

    // O relogio cumpre o anuncio: a descarga sai exatamente no tick prometido.
    let discharge: SemanticEvent | undefined;
    while (state.tick < charge.dischargeTick) {
      discharge = stepIdle(state).find((ev) => ev.t === 'discharge') ?? discharge;
    }
    expect(discharge).toBeDefined();
    if (discharge?.t !== 'discharge') throw new Error('unreachable');
    expect(discharge.source).toBe('player');

    // Um hit, com o desconto de fogo amigo do proprio dono.
    expect(state.player.hp).toBe(hp0 - DISCHARGE_DAMAGE * PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE);

    // A juncao fechou a propagacao: o segmento vizinho nunca acordou.
    expect(state.leylineSegments[1].dischargeAt).toBe(0);
    // E o que descarregou entrou em refrataria.
    expect(state.leylineSegments[0].refractoryUntil).toBeGreaterThan(state.tick);
  });

  it('refrataria ignora nova ativacao; depois dela o segmento rearma', () => {
    const state = scene();
    const events: SemanticEvent[] = [];
    impactSolid(state, 28, 30, 'energy', events, playerOrigin(state));
    while (state.leylineSegments[0].refractoryUntil === 0) stepIdle(state);

    const during: SemanticEvent[] = [];
    impactSolid(state, 28, 30, 'energy', during, playerOrigin(state));
    expect(during.some((ev) => ev.t === 'leyline_charge')).toBe(false);
    expect(state.leylineSegments[0].dischargeAt).toBe(0);

    state.tick = state.leylineSegments[0].refractoryUntil;
    const after: SemanticEvent[] = [];
    impactSolid(state, 28, 30, 'energy', after, playerOrigin(state));
    expect(after.some((ev) => ev.t === 'leyline_charge')).toBe(true);
    expect(state.leylineSegments[0].dischargeAt).toBe(state.tick + LEYLINE_CHARGE_TICKS);
    // A refrataria e cadencia, nao penalidade acumulada.
    expect(LEYLINE_REFRACTORY_TICKS).toBeGreaterThan(LEYLINE_CHARGE_TICKS);
  });

  it('uma ativacao = +1 current, e nao uma unidade por celula eletrificada', () => {
    const state = scene();
    const events: SemanticEvent[] = [];
    const before = state.playerExtras[0].resonance.current;
    impactSolid(state, 28, 30, 'energy', events, playerOrigin(state));
    for (let i = 0; i < LEYLINE_CHARGE_TICKS + 2 && state.leylineSegments[0].refractoryUntil === 0; i++) {
      stepIdle(state);
    }
    expect(state.leylineSegments[0].refractoryUntil).toBeGreaterThan(0);
    expect(state.playerExtras[0].resonance.current).toBe(before + 1);
  });

  it('a leyline e permanente e a juncao e inerte: nenhuma classe morde', () => {
    const state = scene();
    const w = state.config.width;
    for (const cls of ['kinetic', 'thermal', 'bio'] as const) {
      const events: SemanticEvent[] = [];
      const r = impactSolid(state, 28, 30, cls, events, playerOrigin(state));
      expect(r).toEqual({ stop: true, broke: false });
      expect(events.length).toBe(0);
      expect(state.solid[30 * w + 28]).toBe(SOLID_LEYLINE);
    }
    for (const cls of ['kinetic', 'thermal', 'bio', 'energy'] as const) {
      const events: SemanticEvent[] = [];
      const r = impactSolid(state, 33, 30, cls, events, playerOrigin(state));
      expect(r).toEqual({ stop: true, broke: false });
      expect(events.length).toBe(0);
      expect(state.solid[30 * w + 33]).toBe(SOLID_LEYLINE_NODE);
    }
    // Sem ativacao nenhuma: os relogios continuam dormentes.
    expect(state.leylineSegments.every((s) => s.dischargeAt === 0)).toBe(true);
  });

  it('os relogios do segmento entram no hash autoritativo', () => {
    const a = scene();
    const b = scene();
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    b.leylineSegments[0].refractoryUntil = 100;
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
  });
});

describe('roteamento nas juncoes', () => {
  it('a adjacencia por proximidade liga a juncao aos dois segmentos que a tocam', () => {
    const state = scene();
    expect(state.leylineNodes.length).toBe(1);
    // O no em x=33 toca segA (termina em 32) e segB (comeca em 34).
    expect([...state.leylineNodes[0].segments].sort()).toEqual([0, 1]);
  });

  it('juncao roteada repassa: a descarga de A arma B como nova ativacao telegrafada', () => {
    const state = scene();
    state.leylineNodes[0].routed = true;
    const events: SemanticEvent[] = [];
    impactSolid(state, 28, 30, 'energy', events, playerOrigin(state));
    const firstDischargeAt = state.leylineSegments[0].dischargeAt;

    // Ate a descarga de A: B tem de acordar no MESMO tick, com aviso proprio.
    let relayCharge: SemanticEvent | undefined;
    while (state.tick < firstDischargeAt) {
      relayCharge = stepIdle(state).find((ev) => ev.t === 'leyline_charge') ?? relayCharge;
    }
    expect(relayCharge).toBeDefined();
    if (relayCharge?.t !== 'leyline_charge') throw new Error('unreachable');
    expect(relayCharge.seg).toBe(1);
    expect(state.leylineSegments[1].dischargeAt).toBe(state.tick + LEYLINE_CHARGE_TICKS);
    expect(state.leylineSegments[1].relayed).toBe(true);
    // Autoria propagada: a cascata continua sendo do jogador.
    expect(state.leylineSegments[1].triggeredBy).toBe(state.player.id);

    // A descarga repassada sai com relayed:true e source player.
    let relayed: SemanticEvent | undefined;
    while (state.tick < state.leylineSegments[1].dischargeAt) {
      relayed = stepIdle(state).find((ev) => ev.t === 'discharge') ?? relayed;
    }
    expect(relayed).toBeDefined();
    if (relayed?.t !== 'discharge') throw new Error('unreachable');
    expect(relayed.source).toBe('player');
    expect(relayed.relayed).toBe(true);

    // Anti-loop por construcao: A esta refratario, o rele nao volta por ele.
    expect(state.tick).toBeLessThan(state.leylineSegments[0].refractoryUntil);
    expect(state.leylineSegments[0].dischargeAt).toBe(0);
  });

  it('juncao fechada nao repassa nada', () => {
    const state = scene();
    const events: SemanticEvent[] = [];
    impactSolid(state, 28, 30, 'energy', events, playerOrigin(state));
    for (let i = 0; i < LEYLINE_CHARGE_TICKS + 2; i++) stepIdle(state);
    expect(state.leylineSegments[0].refractoryUntil).toBeGreaterThan(0);
    expect(state.leylineSegments[1].dischargeAt).toBe(0);
    expect(state.leylineSegments[1].relayed).toBe(false);
  });

  it('a cascata inteira credita +1 current — e a descoberta e do rele efetivo', () => {
    const state = scene();
    state.leylineNodes[0].routed = true;
    const before = state.playerExtras[0].resonance.current;
    expect(state.stats.discoveries & DISCOVERY_LEYLINE_ROUTED).toBe(0);
    const events: SemanticEvent[] = [];
    impactSolid(state, 28, 30, 'energy', events, playerOrigin(state));
    // Ate B (o repassado) descarregar: duas descargas no total.
    for (let i = 0; i < 2 * LEYLINE_CHARGE_TICKS + 4; i++) stepIdle(state);
    expect(state.leylineSegments[1].refractoryUntil).toBeGreaterThan(0);
    expect(state.playerExtras[0].resonance.current).toBe(before + 1);
    expect(state.stats.discoveries & DISCOVERY_LEYLINE_ROUTED).toBe(DISCOVERY_LEYLINE_ROUTED);
  });

  it('interact adjacente toggla a juncao; longe demais, nao', () => {
    const state = scene();
    const w = state.config.width;
    const interact = (): SemanticEvent[] => {
      const cmd: PlayerCommand = { ...emptyCommand(), interact: true };
      return stepRun(state, [cmd]).events;
    };
    // Colado na juncao (33,30): celula aberta logo acima.
    state.player.x = 33.5;
    state.player.y = 31.5;
    const on = interact().find((ev) => ev.t === 'leyline_routed');
    expect(on).toBeDefined();
    if (on?.t !== 'leyline_routed') throw new Error('unreachable');
    expect(on.routed).toBe(true);
    expect(state.leylineNodes[0].routed).toBe(true);
    // Toggle de volta.
    const off = interact().find((ev) => ev.t === 'leyline_routed');
    if (off?.t !== 'leyline_routed') throw new Error('sem evento de toggle');
    expect(off.routed).toBe(false);
    expect(state.leylineNodes[0].routed).toBe(false);
    // Fora do alcance: nada acontece.
    state.player.x = 33.5 + LEYLINE_NODE_INTERACT_RADIUS + 1;
    state.player.y = 31.5;
    expect(interact().some((ev) => ev.t === 'leyline_routed')).toBe(false);
    expect(state.solid[30 * w + 33]).toBe(SOLID_LEYLINE_NODE);
  });

  it('o toggle sozinho nao marca a descoberta', () => {
    const state = scene();
    state.player.x = 33.5;
    state.player.y = 31.5;
    const cmd: PlayerCommand = { ...emptyCommand(), interact: true };
    stepRun(state, [cmd]);
    expect(state.leylineNodes[0].routed).toBe(true);
    expect(state.stats.discoveries & DISCOVERY_LEYLINE_ROUTED).toBe(0);
  });

  it('routed e relayed entram no hash autoritativo', () => {
    const a = scene();
    const b = scene();
    b.leylineNodes[0].routed = true;
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
    const c = scene();
    c.leylineSegments[0].relayed = true;
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(c));
  });
});
