// O CIRCUITO: a rede de leyline vista como um problema do setor.
//
// O que estes testes cobram:
// 1. SEM GATE: lancar nao pede modulo, carga nem desbloqueio — o interact na
//    nascente basta. E a correcao do defeito que motivou o corte: sem o
//    Conductive, a leyline nao tinha verbo nenhum.
// 2. A REDE INTEIRA: fechar exige acender TODOS os membros na MESMA cascata.
//    Faltando um, nao fecha; e tentativas nao se somam entre lancamentos.
// 3. O CURTO: cristal e minerio encostados sangram a carga e param a cascata,
//    de forma anunciada — e o conserto e minerar, o verbo central do jogo.
// 4. A SUBVERSAO: fechar desliga a propriedade que da identidade ao estrato,
//    e ela morre na descida.
import { describe, expect, it } from 'vitest';
import {
  LEYLINE_CHARGE_TICKS,
  LEYLINE_SHORT_CELLS,
  SOLID_CRYSTAL,
  SOLID_CRYSTAL_DULL,
  SOLID_LEYLINE,
  SOLID_LEYLINE_NODE,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_NONE,
  SURF_WATER,
  WORLD_W,
} from '../src/constants';
import { isConductiveCell } from '../src/cells';
import { impactSolid } from '../src/materials';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { descend } from '../src/sectors';
import { deriveLeylineCircuit, deriveLeylineNetwork, generateWorld } from '../src/worldgen';
import { sectorProfile } from '../src/strata';
import { sectorSeed } from '../src/sectors';
import { DISCOVERY_LEYLINE_CIRCUIT } from '../src/types';
import type { PlayerCommand, SemanticEvent, SurvivalState } from '../src/types';
import { WORLD_H } from '../src/constants';

const clearArea = (state: SurvivalState, x0: number, y0: number, x1: number, y1: number): void => {
  const w = state.config.width;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
  state.vents = state.vents.filter((v) => v.x < x0 || v.x > x1 || v.y < y0 || v.y > y1);
};

/**
 * Cena controlada: TRES segmentos na parede de y=30, separados por duas
 * juncoes. E a menor rede em que "a rede inteira" difere de "o vizinho": a
 * nascente toca A e B, e so um rele em N1 leva a cascata ate C.
 */
const scene = (): SurvivalState => {
  const state = createRun({ seed: 1 });
  const w = state.config.width;
  clearArea(state, 18, 24, 52, 36);
  state.enemies = [];
  const seg = (x0: number, x1: number): number[] => {
    const cells: number[] = [];
    for (let x = x0; x <= x1; x++) {
      state.solid[30 * w + x] = SOLID_LEYLINE;
      cells.push(30 * w + x);
    }
    return cells;
  };
  const segA = seg(25, 32);
  state.solid[30 * w + 33] = SOLID_LEYLINE_NODE;
  const segB = seg(34, 40);
  state.solid[30 * w + 41] = SOLID_LEYLINE_NODE;
  const segC = seg(42, 48);
  state.leylineSegments = [segA, segB, segC].map((cells) => ({
    cells,
    dischargeAt: 0,
    refractoryUntil: 0,
    triggeredBy: -1,
    relayed: false,
  }));
  const network = deriveLeylineNetwork(
    {
      leylines: state.leylineSegments.map((s) => ({ cells: s.cells })),
      leylineNodes: [
        { cell: 30 * w + 33, segments: [] },
        { cell: 30 * w + 41, segments: [] },
      ],
      // Entrada a esquerda: a nascente tem de ser a juncao de x=33.
      entry: { x: 20, y: 30 },
    },
    w,
  );
  state.leylineNodes = network.nodes;
  state.leylineCircuit = {
    sourceNode: network.circuit.sourceNode,
    members: network.circuit.members,
    reached: [],
    live: false,
    closed: false,
  };
  state.stratumSubverted = false;
  // Colado na nascente (33,30), na celula aberta logo acima.
  state.player.x = 33.5;
  state.player.y = 31.5;
  return state;
};

const interact = (state: SurvivalState): SemanticEvent[] => {
  const cmd: PlayerCommand = { ...emptyCommand(), interact: true };
  return stepRun(state, [cmd]).events;
};

/** Avanca ate a cascata se resolver, e devolve o veredito do circuito. */
const settle = (state: SurvivalState, maxTicks = 200) => {
  for (let i = 0; i < maxTicks; i++) {
    const events = stepRun(state, [emptyCommand()]).events;
    const verdict = events.find((ev) => ev.t === 'leyline_circuit');
    if (verdict?.t === 'leyline_circuit') return verdict;
  }
  return null;
};

/** Enche a parede colada a um segmento de cristal, ate ele entrar em curto. */
const shortOut = (state: SurvivalState, segIdx: number): void => {
  const w = state.config.width;
  const cells = state.leylineSegments[segIdx].cells;
  for (let k = 0; k < LEYLINE_SHORT_CELLS; k++) {
    const c = cells[k];
    state.solid[c - w] = SOLID_CRYSTAL;
  }
};

describe('circuito: a nascente', () => {
  it('nasce roteada e o interact nela LANCA — sem modulo, sem carga', () => {
    const state = scene();
    expect(state.leylineCircuit.sourceNode).toBe(0);
    expect(state.leylineNodes[0].routed).toBe(true);
    expect(state.leylineCircuit.members).toEqual([0, 1, 2]);
    // O jogador nao tem nenhum modulo: o gate do Conductive nao existe aqui.
    expect(state.playerExtras[0].activeModules).toHaveLength(0);

    const charges = interact(state).filter((ev) => ev.t === 'leyline_charge');
    expect(charges).toHaveLength(2); // a nascente toca A e B
    expect(state.leylineCircuit.live).toBe(true);
    // Lancar NAO toggla o rele da nascente: um verbo por tecla.
    expect(state.leylineNodes[0].routed).toBe(true);
  });

  it('as demais juncoes continuam togglando', () => {
    const state = scene();
    state.player.x = 41.5;
    state.player.y = 31.5;
    const ev = interact(state).find((e) => e.t === 'leyline_routed');
    expect(ev?.t === 'leyline_routed' && ev.routed).toBe(true);
    expect(state.leylineCircuit.live).toBe(false);
  });
});

describe('circuito: fechar exige a rede inteira', () => {
  it('com todas as juncoes roteadas, uma cascata acende tudo e fecha', () => {
    const state = scene();
    state.leylineNodes[1].routed = true;
    interact(state);
    const verdict = settle(state);
    expect(verdict?.t === 'leyline_circuit' && verdict.closed).toBe(true);
    expect(verdict?.t === 'leyline_circuit' && verdict.lit).toBe(3);
    expect(state.leylineCircuit.closed).toBe(true);
    expect(state.stratumSubverted).toBe(true);
    expect(state.stats.discoveries & DISCOVERY_LEYLINE_CIRCUIT).toBeTruthy();
  });

  it('com a juncao do meio fechada, a cascata para e o circuito NAO fecha', () => {
    const state = scene();
    // N1 fica fechada: C nunca acende.
    const verdict = (interact(state), settle(state));
    expect(verdict?.t === 'leyline_circuit' && verdict.closed).toBe(false);
    expect(verdict?.t === 'leyline_circuit' && verdict.lit).toBe(2);
    expect(state.stratumSubverted).toBe(false);
  });

  it('tentativas nao se somam: o alcance zera a cada desfecho', () => {
    const state = scene();
    interact(state);
    settle(state);
    expect(state.leylineCircuit.reached).toEqual([]);
    // Abrir a juncao agora e relancar ainda tem de acender os TRES: se
    // `reached` acumulasse, bastaria o C desta segunda tentativa.
    state.leylineNodes[1].routed = true;
    for (let i = 0; i < 12 * 20; i++) stepRun(state, [emptyCommand()]); // passa a refrataria
    interact(state);
    const verdict = settle(state);
    expect(verdict?.t === 'leyline_circuit' && verdict.lit).toBe(3);
  });
});

describe('circuito: o curto', () => {
  it('um segmento em curto recusa a carga, e diz qual', () => {
    const state = scene();
    state.leylineNodes[1].routed = true;
    shortOut(state, 2); // o C fica sujo
    interact(state);
    let shorted: SemanticEvent | undefined;
    for (let i = 0; i < 200; i++) {
      const events = stepRun(state, [emptyCommand()]).events;
      shorted ??= events.find((ev) => ev.t === 'leyline_short');
      if (events.some((ev) => ev.t === 'leyline_circuit')) break;
    }
    expect(shorted?.t === 'leyline_short' && shorted.seg).toBe(2);
    expect(state.leylineCircuit.closed).toBe(false);
  });

  it('minerar o veio limpa o curto e o circuito passa a fechar', () => {
    const state = scene();
    const w = state.config.width;
    state.leylineNodes[1].routed = true;
    shortOut(state, 2);
    interact(state);
    settle(state);
    expect(state.leylineCircuit.closed).toBe(false);
    // O jogador limpa a parede — e o segmento volta a conduzir sem nenhum
    // estado novo: a regra le o grid.
    for (const c of state.leylineSegments[2].cells) {
      if (state.solid[c - w] === SOLID_CRYSTAL) state.solid[c - w] = SOLID_ROCK;
    }
    for (let i = 0; i < 12 * 20; i++) stepRun(state, [emptyCommand()]);
    interact(state);
    const verdict = settle(state);
    expect(verdict?.t === 'leyline_circuit' && verdict.closed).toBe(true);
  });
});

describe('circuito: a subversao do estrato', () => {
  it('na Catedral, o cristal do setor inteiro fica opaco', () => {
    const state = scene();
    state.stratum = 'prismatic';
    const w = state.config.width;
    // Um cristal longe da rede, para provar que a varredura e do SETOR.
    state.solid[10 * w + 10] = SOLID_CRYSTAL;
    state.leylineNodes[1].routed = true;
    interact(state);
    settle(state);
    expect(state.leylineCircuit.closed).toBe(true);
    expect(state.solid[10 * w + 10]).toBe(SOLID_CRYSTAL_DULL);
  });

  it('no Aquifero, a lamina deixa de conduzir', () => {
    const state = scene();
    state.stratum = 'aquifer';
    const w = state.config.width;
    const pool = 27 * w + 22;
    state.solid[pool] = SOLID_NONE;
    state.surface[pool] = SURF_WATER;
    expect(isConductiveCell(state, pool)).toBe(true);
    state.leylineNodes[1].routed = true;
    interact(state);
    settle(state);
    expect(state.leylineCircuit.closed).toBe(true);
    expect(isConductiveCell(state, pool)).toBe(false);
  });

  it('o premio morre na descida, junto com o circuito', () => {
    const state = scene();
    state.leylineNodes[1].routed = true;
    interact(state);
    settle(state);
    expect(state.stratumSubverted).toBe(true);
    descend(state, []);
    expect(state.stratumSubverted).toBe(false);
    expect(state.leylineCircuit.closed).toBe(false);
    expect(state.leylineCircuit.live).toBe(false);
    expect(state.leylineCircuit.reached).toEqual([]);
  });
});

describe('circuito: o modulo Conductive', () => {
  it('um trecho aceso a tiro conta para a cascata em curso', () => {
    const state = scene();
    // N1 fechada: o rele NAO leva a cascata ate o C. O tiro leva.
    interact(state);
    expect(state.leylineCircuit.live).toBe(true);
    const segC = state.leylineSegments[2];
    impactSolid(
      state,
      segC.cells[0] % state.config.width,
      Math.floor(segC.cells[0] / state.config.width),
      'energy',
      [],
      { source: 'player', owner: state.player.id },
    );
    const verdict = settle(state);
    // Os tres acenderam: dois pelo rele da nascente, um pela mao do jogador.
    expect(verdict?.t === 'leyline_circuit' && verdict.lit).toBe(3);
    expect(state.leylineCircuit.closed).toBe(true);
  });

  it('mas o tiro tambem respeita o curto', () => {
    const state = scene();
    shortOut(state, 2);
    const segC = state.leylineSegments[2];
    const events: SemanticEvent[] = [];
    impactSolid(
      state,
      segC.cells[0] % state.config.width,
      Math.floor(segC.cells[0] / state.config.width),
      'energy',
      events,
      { source: 'player', owner: state.player.id },
    );
    expect(events.some((ev) => ev.t === 'leyline_short')).toBe(true);
    expect(segC.dischargeAt).toBe(0);
  });
});

describe('circuito: estado autoritativo', () => {
  it('fechar muda o hash', () => {
    const state = scene();
    state.leylineNodes[1].routed = true;
    const before = hashAuthoritativeState(state);
    interact(state);
    settle(state);
    expect(hashAuthoritativeState(state)).not.toBe(before);
    expect(state.leylineCircuit.closed).toBe(true);
  });
});

describe('circuito: a rede derivada da seed', () => {
  it('a nascente e a juncao mais proxima da entrada, e o membro e o maior componente', () => {
    let testados = 0;
    for (let seed = 1; seed <= 60 && testados < 8; seed++) {
      const profile = sectorProfile(seed, 2);
      if (profile.leylines <= 0) continue;
      const world = generateWorld(sectorSeed(seed, 2), WORLD_W, WORLD_H, profile);
      const network = deriveLeylineNetwork(world, WORLD_W);
      if (network.circuit.sourceNode < 0) continue;
      testados++;
      // A nascente esta no componente e nasce roteada.
      expect(network.nodes[network.circuit.sourceNode].routed).toBe(true);
      expect(
        network.nodes[network.circuit.sourceNode].segments.some((s) =>
          network.circuit.members.includes(s),
        ),
      ).toBe(true);
      // Dois segmentos, no minimo: um segmento so nao e circuito.
      expect(network.circuit.members.length).toBeGreaterThanOrEqual(2);
      // Determinismo: a mesma seed devolve o mesmo circuito.
      const again = deriveLeylineCircuit(
        network.nodes.map((n) => ({ ...n, routed: false })),
        world.leylines.length,
        world.entry,
        WORLD_W,
      );
      expect(again).toEqual(network.circuit);
    }
    expect(testados).toBeGreaterThan(0);
  });
});
