import { describe, expect, it } from 'vitest';
import {
  CONTAMINATION_WAVES,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_NONE,
  coreUnlocked,
  emptyCommand,
  floodOpen,
  hasCoreHere,
  hashAuthoritativeState,
  sectorBiome,
  stepRun,
} from '@voxelyn/survival-sim';
import {
  TRAINING_DEPTH,
  TRAINING_SEED,
  carveTrainingCourse,
  createTrainingRun,
} from '../client/training-setup';

/**
 * O setor de treinamento e um contrato: uma seed fixa tem de continuar
 * produzindo o MESMO exercicio depois de qualquer mudanca no worldgen ou nas
 * estratas. Estes testes sao o que denuncia a quebra no vitest, e nao na
 * primeira descida de um novato.
 */
describe('createTrainingRun — o contrato do exercicio', () => {
  it('nasce como uma run real de um setor, com o Nucleo funcional', () => {
    const state = createTrainingRun();
    expect(state.phase).toBe('running');
    expect(state.sector).toBe(1);
    expect(state.config.depth).toEqual(TRAINING_DEPTH);
    // Pedestal presente e destravado desde o tick 0: setor 1 nunca tem chefe.
    expect(hasCoreHere(state)).toBe(true);
    expect(coreUnlocked(state)).toBe(true);
    expect(state.sectorBoss.archetype).toBeNull();
  });

  it('o elenco e exatamente os dois stalkers da camara de tiro', () => {
    const state = createTrainingRun();
    const alive = state.enemies.filter((e) => e.alive);
    expect(alive).toHaveLength(2);
    for (const enemy of alive) expect(enemy.archetype).toBe('stalker');
    // E nada fora do curriculo.
    expect(state.salvageSites).toHaveLength(0);
    expect(state.wellOffers).toHaveLength(0);
    expect(state.vents).toHaveLength(0);
    expect(state.railTracks).toHaveLength(0);
    expect(state.leylineSegments).toHaveLength(0);
    expect(state.leylineNodes).toHaveLength(0);
    expect(state.contaminationWaves).toBe(CONTAMINATION_WAVES.length);
  });

  it('a seed continua entregando o que o carimbo espera dela', () => {
    // Documentacao viva: hoje TODO setor 1 e basalto sem ocupacao. Se as
    // estratas mudarem isso, o visual do treinamento muda junto — e alguem
    // precisa decidir de novo, em vez de descobrir na tela.
    const biome = sectorBiome(TRAINING_SEED, 1);
    expect(biome.stratum).toBe('basalt');
    expect(biome.occupation).toBe('none');
  });

  it('o percurso cabe inteiro no mapa, sem grampeamento', () => {
    const state = createTrainingRun();
    // Recarimba um estado identico so para ler a geometria devolvida.
    const course = carveTrainingCourse(createTrainingRun());
    expect(course.truncated).toBe(false);
    // E o pedestal esta onde o percurso mandou.
    expect(state.corePos).toEqual(course.coreCell);
  });

  it('tudo se alcanca a pe: pedestal, stalkers, e nada de sala ilhada', () => {
    const state = createTrainingRun();
    const w = state.config.width;
    const reach = floodOpen(state.solid, w, state.config.height, state.entry.x, state.entry.y);
    expect(reach.has(state.corePos.y * w + state.corePos.x)).toBe(true);
    for (const enemy of state.enemies) {
      expect(reach.has(Math.floor(enemy.y) * w + Math.floor(enemy.x))).toBe(true);
    }
    // Todo chao aberto do mapa pertence ao percurso alcancavel.
    let open = 0;
    for (let i = 0; i < state.solid.length; i++) if (state.solid[i] === SOLID_NONE) open++;
    expect(reach.size).toBe(open);
    // E o percurso e mais longo que a zona de entrada (4 tiles), senao a
    // licao de mover nunca teria como completar.
    const dist = Math.hypot(state.corePos.x - state.entry.x, state.corePos.y - state.entry.y);
    expect(dist).toBeGreaterThan(20);
  });

  it('NADA existe fora do percurso: rocha lisa, superficie limpa', () => {
    // A propriedade mais importante do mapa, como invariante explicito: um
    // worldgen futuro nao pode vazar cristal, leyline ou duto atras da parede.
    const state = createTrainingRun();
    const course = carveTrainingCourse(createTrainingRun());
    for (let i = 0; i < state.solid.length; i++) {
      if (course.cells.has(i)) continue;
      expect(state.solid[i]).toBe(SOLID_ROCK);
      expect(state.surface[i]).toBe(SURF_NONE);
    }
  });

  it('os stalkers nascem claramente fora do aggro de quem para para ler', () => {
    const state = createTrainingRun();
    const player = state.player;
    for (const enemy of state.enemies) {
      const gap = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      // Aggro do stalker e 9; a folga e deliberada, nao um teste do limite.
      expect(gap).toBeGreaterThan(11);
    }
  });

  it('e deterministico: duas construcoes, o mesmo hash', () => {
    expect(hashAuthoritativeState(createTrainingRun())).toBe(
      hashAuthoritativeState(createTrainingRun()),
    );
  });

  it('parado, nada acontece: 3 minutos de tick sem dano nem spawn', () => {
    // O tempo que o proprio exercicio promete durar. Quem largar o teclado na
    // plataforma tem de encontrar o mundo exatamente como deixou.
    const state = createTrainingRun();
    const hp = state.player.hp;
    for (let t = 0; t < 3600; t++) stepRun(state, [emptyCommand()]);
    expect(state.phase).toBe('running');
    expect(state.player.hp).toBe(hp);
    expect(state.enemies.filter((e) => e.alive)).toHaveLength(2);
  });
});
