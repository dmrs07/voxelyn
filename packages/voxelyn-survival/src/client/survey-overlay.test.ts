// A geometria do Levantamento. O que estes testes protegem nao e o desenho — e
// a promessa de cada ficha de protocolo: "atraves de 1 parede", "a 18 tiles",
// "quando o nucleo for coletado". Alcance e oclusao errados sao bug de
// balanceamento que nenhuma inspecao visual pega.

import { describe, expect, it } from 'vitest';
import { CONTAMINATION_WAVES, createRun, derivePlayerTuning } from '@voxelyn/survival-sim';
import { SOLID_NONE, SOLID_ORE } from '@voxelyn/survival-sim';
import type { SurvivalState } from '@voxelyn/survival-sim';
import {
  RouteMemory,
  WAVE_THRESHOLDS,
  bearingTo,
  beaconAlpha,
  forecastWave,
  hasSurvey,
  nearestSalvage,
  objectiveOf,
  returnVectorVisible,
  scannedOre,
  wallsBetween,
} from './survey-overlay';

/** Arena limpa em volta do jogador, para isolar o que esta sendo medido. */
const arena = (seed = 99): SurvivalState => {
  const state = createRun({ seed });
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - 20; y <= py + 20; y++) {
    for (let x = px - 20; x <= px + 20; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
    }
  }
  state.enemies.length = 0;
  return state;
};

const put = (state: SurvivalState, dx: number, dy: number, value: number): number => {
  const x = Math.floor(state.player.x) + dx;
  const y = Math.floor(state.player.y) + dy;
  const i = y * state.config.width + x;
  state.solid[i] = value;
  return i;
};

describe('rumo', () => {
  it('normaliza e mede a distancia', () => {
    const bearing = bearingTo(0, 0, 3, 4);
    expect(bearing?.distance).toBeCloseTo(5, 6);
    expect(Math.hypot(bearing?.dx ?? 0, bearing?.dy ?? 0)).toBeCloseTo(1, 6);
  });

  it('devolve null quando os pontos coincidem, em vez de dividir por zero', () => {
    expect(bearingTo(4, 4, 4, 4)).toBeNull();
  });
});

describe('SV-01 · beacon de objetivo', () => {
  // Um pulso que continuasse apontando para o pedestal vazio seria pior que
  // nenhum pulso: ele mandaria o jogador de volta para onde ele ja esteve.
  it('aponta o nucleo antes, e a saida depois de toma-lo', () => {
    const state = arena();
    const before = objectiveOf(state);
    expect(before).toEqual({ x: (state.corePos?.x ?? 0) + 0.5, y: (state.corePos?.y ?? 0) + 0.5 });

    state.coreTaken = true;
    expect(objectiveOf(state)).toEqual({ x: state.entry.x + 0.5, y: state.entry.y + 0.5 });
  });

  it('sobe rapido, desce devagar e some no fim', () => {
    expect(beaconAlpha(-1)).toBe(0);
    expect(beaconAlpha(0)).toBe(0);
    expect(beaconAlpha(200)).toBeGreaterThan(0.5);
    expect(beaconAlpha(2600)).toBeCloseTo(0, 5);
    expect(beaconAlpha(9999)).toBe(0);
  });
});

describe('SV-02 · traco de salvage', () => {
  it('aponta o terminal mais proximo dentro do alcance', () => {
    const state = arena();
    if (state.salvageSites.length === 0) return;
    const site = state.salvageSites[0];
    site.terminalState = 'inactive';
    state.player.x = site.terminal.x + 3;
    state.player.y = site.terminal.y;
    const bearing = nearestSalvage(state, state.player.x, state.player.y, 18);
    expect(bearing?.distance).toBeLessThan(18);
  });

  it('ignora terminal ja concluido: andar ate um cofre vazio e o oposto da promessa', () => {
    const state = arena();
    if (state.salvageSites.length === 0) return;
    for (const site of state.salvageSites) site.terminalState = 'complete';
    expect(nearestSalvage(state, state.player.x, state.player.y, 999)).toBeNull();
  });

  it('respeita o alcance', () => {
    const state = arena();
    expect(nearestSalvage(state, state.player.x, state.player.y, 0)).toBeNull();
  });
});

describe('SV-03 · espectrometro', () => {
  it('conta camadas de parede, e nao celulas solidas', () => {
    const state = arena();
    const px = state.player.x;
    const py = state.player.y;
    expect(wallsBetween(state, px, py, px + 6, py)).toBe(0);

    // Uma parede de TRES celulas de espessura continua sendo UMA camada.
    for (const dx of [2, 3, 4]) put(state, dx, 0, 1);
    expect(wallsBetween(state, px, py, px + 6, py)).toBe(1);

    // Duas paredes separadas por um vao sao duas camadas.
    put(state, 6, 0, 1);
    expect(wallsBetween(state, px, py, px + 8, py)).toBe(2);
  });

  it('enxerga o veio atras de UMA parede e nao atras de duas', () => {
    const state = arena();
    const px = state.player.x;
    const py = state.player.y;

    const near = put(state, 5, 0, SOLID_ORE);
    put(state, 3, 0, 1); // uma parede no caminho
    expect(scannedOre(state, px, py, 11, 1)).toContain(near);

    const far = put(state, 9, 0, SOLID_ORE);
    put(state, 7, 0, 1); // segunda parede
    expect(scannedOre(state, px, py, 11, 1)).not.toContain(far);
  });

  it('respeita o alcance e nao devolve nada sem o protocolo', () => {
    const state = arena();
    const distant = put(state, 15, 0, SOLID_ORE);
    expect(scannedOre(state, state.player.x, state.player.y, 11, 1)).not.toContain(distant);
    expect(scannedOre(state, state.player.x, state.player.y, 0, 0)).toEqual([]);
  });

  it('tem teto por quadro: "tudo brilha" informa tanto quanto "nada brilha"', () => {
    const state = arena();
    const w = state.config.width;
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    for (let y = py - 8; y <= py + 8; y++) {
      for (let x = px - 8; x <= px + 8; x++) state.solid[y * w + x] = SOLID_ORE;
    }
    expect(scannedOre(state, state.player.x, state.player.y, 11, 1).length).toBeLessThanOrEqual(48);
  });
});

describe('SV-04 · memoria de rota', () => {
  it('lembra os saloes atravessados, e nao as celulas', () => {
    const state = arena();
    const route = new RouteMemory();
    route.observe(state);
    expect(route.size).toBe(1);

    // Andar meio chunk nao acrescenta salao novo.
    state.player.x += 4;
    route.observe(state);
    expect(route.size).toBe(1);

    state.player.x += 20;
    route.observe(state);
    expect(route.size).toBe(2);
  });

  it('esquece ao trocar de setor: o mapa e do setor em que se esta', () => {
    const state = arena();
    const route = new RouteMemory();
    route.observe(state);
    expect(route.size).toBe(1);
    state.sector = 2;
    route.observe(state);
    expect(route.size).toBe(1);
  });

  // Nunca marca onde o jogador NAO foi: o protocolo lembra, nao revela.
  it('so registra chunk visitado', () => {
    const state = arena();
    const route = new RouteMemory();
    route.observe(state);
    const columns = route.columns;
    const visited = Math.floor(state.player.y / 16) * columns + Math.floor(state.player.x / 16);
    expect(route.has(visited)).toBe(true);
    expect(route.has(visited + 1)).toBe(false);
  });
});

describe('SV-X · previsao de contaminacao', () => {
  it('mede o progresso ate a proxima onda', () => {
    expect(forecastWave(0, 0)).toMatchObject({ next: 1, progress: 0 });
    expect(forecastWave(0.175, 0)?.progress).toBeCloseTo(0.5, 2);
    expect(forecastWave(0.35, 0)?.progress).toBeCloseTo(1, 5);
    // Depois da primeira onda, a escala e do proximo degrau.
    expect(forecastWave(0.35, 1)?.progress).toBeCloseTo(0, 5);
    expect(forecastWave(0.475, 1)?.progress).toBeCloseTo(0.5, 2);
  });

  it('avisa a iminencia perto do limiar', () => {
    expect(forecastWave(0.1, 0)?.imminent).toBe(false);
    expect(forecastWave(0.33, 0)?.imminent).toBe(true);
  });

  it('some depois da ultima onda em vez de mostrar barra parada', () => {
    expect(forecastWave(0.99, WAVE_THRESHOLDS.length)).toBeNull();
  });

  // A versao anterior deste teste comparava a copia local com um literal DELA
  // MESMA — e a copia estava errada, entao ele passava enquanto a barra ficava
  // uma onda atrasada. Agora a escada VEM da simulacao, e o que resta afirmar e
  // a ligacao, nao os numeros.
  it('a escada vem da simulacao, e nao de uma copia', () => {
    expect([...WAVE_THRESHOLDS]).toEqual(CONTAMINATION_WAVES.map(([level]) => level));
    expect(WAVE_THRESHOLDS).toHaveLength(3);
  });
});

describe('SV-05 · vetor de retorno', () => {
  // Uma seta permanente vira piloto automatico: o jogador para de navegar e
  // passa a seguir. Piscando, ela CORRIGE quem ja esta se orientando.
  it('pisca em vez de ficar aceso', () => {
    expect(returnVectorVisible(0)).toBe(true);
    expect(returnVectorVisible(500)).toBe(true);
    expect(returnVectorVisible(1500)).toBe(false);
    expect(returnVectorVisible(3000)).toBe(true);
  });
});

describe('atalho de trabalho por quadro', () => {
  it('sem nenhum protocolo SV, o overlay inteiro e pulado', () => {
    expect(hasSurvey(derivePlayerTuning([]).navigation)).toBe(false);
  });

  it('qualquer protocolo SV liga o overlay', () => {
    for (const id of ['SV-01', 'SV-02', 'SV-03', 'SV-04', 'SV-05', 'SV-X']) {
      const owned = ['SV-01', 'SV-02', 'SV-03', 'SV-04', 'SV-05', 'SV-X'].slice(
        0,
        ['SV-01', 'SV-02', 'SV-03', 'SV-04', 'SV-05', 'SV-X'].indexOf(id) + 1,
      );
      expect(hasSurvey(derivePlayerTuning(owned).navigation), id).toBe(true);
    }
  });
});
