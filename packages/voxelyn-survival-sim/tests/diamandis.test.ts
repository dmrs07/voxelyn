// DIAMANDIS — o chefe da Cicatriz Aurix.
//
// O que estes testes protegem, em ordem de gravidade:
// 1. ELE NAO E UM ROBO QUE ATIRA. As tres armas dele sao FERRAMENTAS, e cada
//    uma tem de fazer a coisa industrial que a promete: a broca ABRE galeria
//    (e deixa minerio de pe), a demolicao marca o chao ANTES de implodir, e o
//    feixe varre inofensivo antes de queimar.
// 2. TELEGRAFO SEMPRE. Nenhum dano do encontro pode chegar sem sinal — e a
//    marca da demolicao nao pode perseguir, senao sair dela deixa de ser
//    resposta.
// 3. O COLAPSO muda a luta, e nao so os numeros: uma arma DESLIGA.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { spawnEnemy } from '../src/entities';
import { bossArchetypeForBiome } from '../src/bosses';
import { sectorBiome } from '../src/strata';
import {
  DIAMANDIS_BEAM_WINDUP_TICKS,
  DIAMANDIS_DEMOLISH_CHARGES,
  DIAMANDIS_DEMOLISH_WINDUP_TICKS,
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_WINDUP_TICKS,
  DIAMANDIS_REACTOR_HP_FRACTION,
  SECTOR_COUNT,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ROCK,
  SURF_EMBER,
  SURF_NONE,
} from '../src/constants';
import {
  BOSS_PHASE_REACTOR,
  DISCOVERY_DIAMANDIS_CORRIDOR,
  type SemanticEvent,
  type SurvivalState,
} from '../src/types';

const clearArena = (state: SurvivalState, radius: number): void => {
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - radius; y <= py + radius; y++) {
    for (let x = px - radius; x <= px + radius; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
};

/** Arena limpa com o Diamandis a `gap` tiles a leste do jogador. */
const duel = (seed: number, gap: number) => {
  const state = createRun({ seed });
  // O jogador vai para o MEIO do mapa antes de tudo: a entrada da run cai onde
  // a seed mandar, e perto da borda as cargas laterais da salva caem fora do
  // mundo — o teste passaria a medir a moldura em vez do golpe.
  state.player.x = Math.floor(state.config.width / 2) + 0.5;
  state.player.y = Math.floor(state.config.height / 2) + 0.5;
  clearArena(state, 24);
  state.enemies = [];
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  const boss = spawnEnemy(state, 'diamandis', px + gap, py, false);
  // ACORDADO. Como o Guardiao, ele dorme ate ser notado (`guardsTheCore`) e
  // so decide alguma coisa depois disso — sem isto, todo teste a mais de 7
  // tiles mediria uma maquina parada.
  state.bossRuntime.awake = true;
  return { state, boss, px, py };
};

/** Roda ate ver `action_start` da acao pedida, e devolve o evento. */
const awaitAction = (
  state: SurvivalState,
  entity: number,
  action: string,
  ticks: number,
): SemanticEvent | null => {
  for (let t = 0; t < ticks; t++) {
    for (const ev of stepRun(state, [emptyCommand()]).events) {
      if (ev.t === 'action_start' && ev.entity === entity && ev.action === action) return ev;
    }
  }
  return null;
};

describe('Diamandis — onde ele mora', () => {
  it('e o chefe do mapa final marcado pela Cicatriz Aurix', () => {
    expect(bossArchetypeForBiome({ stratum: 'ferric', occupation: 'aurix', lineage: 'industrial' }))
      .toBe('diamandis');
    // E aparece de verdade numa run: a linhagem industrial termina em Aurix.
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      if (bossArchetypeForBiome(sectorBiome(seed, SECTOR_COUNT)) !== 'diamandis') continue;
      const state = createRun({ seed, sector: SECTOR_COUNT });
      found = state.enemies.some((e) => e.archetype === 'diamandis');
      expect(found, `seed ${seed}: bioma Aurix sem Diamandis na camara`).toBe(true);
    }
    expect(found, 'nenhuma seed da amostra terminou em Cicatriz Aurix').toBe(true);
  });
});

describe('Diamandis — broca de avanco', () => {
  it('telegrafa parado e so entao atravessa', () => {
    const { state, boss } = duel(301, 11);
    const startX = boss.x;
    const ev = awaitAction(state, boss.id, 'drill', 90);
    expect(ev, 'nunca acionou a broca').not.toBeNull();
    if (!ev || ev.t !== 'action_start') return;
    expect(ev.releaseTick - ev.startTick).toBe(DIAMANDIS_DRILL_WINDUP_TICKS);
    expect(Math.abs(boss.x - startX), 'moveu durante o proprio aviso').toBeLessThan(1.5);
  });

  it('ABRE galeria pela rocha — e a pedra nao encerra a acao', () => {
    // O contraste com o Corcel: ele PARA na pedra (ler o telegrafo e por uma
    // parede e o contra-jogo dele). A broca atravessa, e o corredor fica.
    const { state, boss, px, py } = duel(302, 11);
    const w = state.config.width;
    const ev = awaitAction(state, boss.id, 'drill', 90);
    expect(ev).not.toBeNull();

    // Parede cheia entre os dois, levantada depois do telegrafo.
    const wallX = px + 6;
    for (let dy = -5; dy <= 5; dy++) state.solid[(py + dy) * w + wallX] = SOLID_ROCK;
    const before = boss.x;

    for (let t = 0; t < DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS; t++) {
      stepRun(state, [emptyCommand()]);
    }

    let opened = 0;
    for (let dy = -2; dy <= 2; dy++) {
      if (state.solid[(py + dy) * w + wallX] === SOLID_NONE) opened++;
    }
    expect(opened, 'a broca nao abriu vao na parede').toBeGreaterThanOrEqual(3);
    expect(boss.x, 'a broca nao avancou').toBeLessThan(before);
  });

  it('deixa MINERIO de pe: a passagem dele expoe veio, nao o consome', () => {
    const { state, px, py } = duel(303, 11);
    const w = state.config.width;
    const oreX = px + 6;
    for (let dy = -3; dy <= 3; dy++) state.solid[(py + dy) * w + oreX] = SOLID_ORE;
    // Rocha em volta, para haver o que derrubar em torno do veio.
    for (let dy = -3; dy <= 3; dy++) state.solid[(py + dy) * w + oreX + 1] = SOLID_ROCK;

    for (let t = 0; t < 90 + DIAMANDIS_DRILL_TICKS; t++) stepRun(state, [emptyCommand()]);

    let ore = 0;
    for (let dy = -3; dy <= 3; dy++) if (state.solid[(py + dy) * w + oreX] === SOLID_ORE) ore++;
    expect(ore, 'a broca comeu o minerio em vez de expo-lo').toBeGreaterThan(0);
  });

  it('ver a galeria abrir marca a Descoberta do corredor', () => {
    const { state, boss, px, py } = duel(304, 11);
    const w = state.config.width;
    for (let dy = -4; dy <= 4; dy++) state.solid[(py + dy) * w + px + 5] = SOLID_ROCK;
    for (let t = 0; t < 90 + DIAMANDIS_DRILL_TICKS; t++) stepRun(state, [emptyCommand()]);
    expect(state.stats.discoveries & DISCOVERY_DIAMANDIS_CORRIDOR).not.toBe(0);
    expect(boss.alive).toBe(true);
  });
});

describe('Diamandis — salva de demolicao', () => {
  it('marca o chao antes de implodir, e a marca NAO persegue', () => {
    // A resposta inteira do golpe e sair do circulo, e ela so existe porque o
    // circulo fica onde nasceu. Uma marca que seguisse seria dano sem
    // contra-jogo com um telegrafo bonito por cima.
    const { state, boss } = duel(311, 7);
    const markers: Array<{ x: number; y: number; fireTick: number }> = [];
    for (let t = 0; t < 120 && markers.length === 0; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'blast_marker') markers.push({ x: ev.x, y: ev.y, fireTick: ev.fireTick });
      }
    }
    expect(markers.length, 'nenhuma carga marcada').toBe(DIAMANDIS_DEMOLISH_CHARGES);
    expect(markers[0].fireTick).toBeGreaterThan(state.tick);
    expect(boss.action?.kind).toBe('demolish');

    // O jogador anda; as celulas marcadas continuam onde estavam.
    const frozen = [...state.bossRuntime.blastCells];
    const move = emptyCommand();
    move.move = { x: -1, y: 0 };
    for (let t = 0; t < 8; t++) stepRun(state, [move]);
    expect(state.bossRuntime.blastCells).toEqual(frozen);
  });

  it('a carga explode NA marca, e o telegrafo inteiro corre antes', () => {
    const { state, boss } = duel(312, 7);
    let fireTick = 0;
    for (let t = 0; t < 120 && fireTick === 0; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'blast_marker') fireTick = ev.fireTick;
      }
    }
    expect(fireTick).toBeGreaterThan(0);
    expect(boss.action?.kind).toBe('demolish');

    let exploded = false;
    for (let t = 0; t < DIAMANDIS_DEMOLISH_WINDUP_TICKS + 12 && !exploded; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'explosion' && ev.owner === boss.id) exploded = true;
      }
    }
    expect(exploded, 'a salva marcou e nunca caiu').toBe(true);
    expect(state.bossRuntime.blastCells, 'as marcas ficaram penduradas').toHaveLength(0);
  });
});

describe('Diamandis — feixe de prospeccao', () => {
  it('a varredura vem ANTES e nao machuca; a potencia vem depois', () => {
    const { state, boss } = duel(321, 3);
    // A 3 tiles ele esta abaixo do minimo da broca (9) e do da demolicao (4):
    // a faixa e do feixe, que e a ferramenta de perto.
    let survey = 0;
    let powered = 0;
    for (let t = 0; t < DIAMANDIS_BEAM_WINDUP_TICKS * 4; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t !== 'beam_line') continue;
        if (ev.powered) powered++;
        else survey++;
      }
      if (powered > 0) break;
    }
    expect(survey, 'o feixe disparou sem varrer antes').toBeGreaterThan(0);
    expect(powered, 'a varredura nunca ganhou potencia').toBeGreaterThan(0);
    expect(boss.alive).toBe(true);
  });

  it('a linha PARA na parede: nao mede nem queima do outro lado', () => {
    const { state, boss, px, py } = duel(322, 3);
    const w = state.config.width;
    for (let dy = -4; dy <= 4; dy++) state.solid[(py + dy) * w + px + 2] = SOLID_ROCK;

    let longest = 0;
    for (let t = 0; t < DIAMANDIS_BEAM_WINDUP_TICKS * 3; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'beam_line') longest = Math.max(longest, ev.length);
      }
    }
    // O chefe esta a 4 tiles e a parede a 2 do jogador: a linha dele para bem
    // antes do comprimento nominal.
    if (longest > 0) expect(longest).toBeLessThan(8);
    expect(boss.alive).toBe(true);
  });
});

describe('Diamandis — colapso do reator', () => {
  it('abaixo da metade o reator vaza brasa, uma unica vez', () => {
    const { state, boss } = duel(331, 8);
    boss.hp = boss.maxHp * (DIAMANDIS_REACTOR_HP_FRACTION - 0.1);
    stepRun(state, [emptyCommand()]);

    expect(state.bossRuntime.phasesFired & BOSS_PHASE_REACTOR).not.toBe(0);
    const w = state.config.width;
    let ember = 0;
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const x = Math.floor(boss.x) + dx;
        const y = Math.floor(boss.y) + dy;
        if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
        if (state.surface[y * w + x] === SURF_EMBER) ember++;
      }
    }
    expect(ember, 'o reator nao vazou nada').toBeGreaterThan(8);

    // E nao dispara de novo: e uma fase de UMA vez.
    const before = state.bossRuntime.phasesFired;
    for (let t = 0; t < 20; t++) stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.phasesFired).toBe(before);
  });

  it('o feixe DESLIGA no colapso: a segunda fase e outra luta', () => {
    const { state, boss } = duel(332, 3);
    boss.hp = boss.maxHp * (DIAMANDIS_REACTOR_HP_FRACTION - 0.1);
    stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_REACTOR).not.toBe(0);

    // Conta DECISOES de feixe, e nao emissoes: uma varredura que ja estava em
    // curso quando o reator caiu termina — o que o colapso desliga e a
    // capacidade de comecar outra.
    let started = 0;
    for (let t = 0; t < DIAMANDIS_BEAM_WINDUP_TICKS * 6; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'beam') started++;
      }
      // O jogador nao pode morrer no meio da medicao e falsear o resultado.
      state.player.hp = state.player.maxHp;
    }
    expect(started, 'o scanner continuou operando com o reator em colapso').toBe(0);
  });
});
