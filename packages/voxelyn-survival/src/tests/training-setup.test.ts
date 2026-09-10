import { describe, expect, it } from 'vitest';
import {
  CONTAMINATION_WAVES,
  SOLID_FRAGILE,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ROCK,
  SURF_NONE,
  coreUnlocked,
  descentUnlocked,
  emptyCommand,
  floodOpen,
  hasCoreHere,
  hashAuthoritativeState,
  hashStaticWorld,
  isCoreTaken,
  sectorBiome,
  stepRun,
  DISCOVERY_FRAGILE_BREACH,
} from '@voxelyn/survival-sim';
import { applyDiscoveries, emptyRecords, hasDiscovery } from '../client/records';
import {
  TRAINING_DEPTH,
  TRAINING_SEED,
  carveTrainingCourse,
  createTrainingRun,
  stampTrainingSector,
} from '../client/training-setup';

/**
 * Os setores de treinamento sao um contrato: uma seed fixa tem de continuar
 * produzindo o MESMO exercicio depois de qualquer mudanca no worldgen ou nas
 * estratas. Estes testes sao o que denuncia a quebra no vitest, e nao na
 * primeira descida de um novato.
 */
describe('createTrainingRun — o contrato do exercicio', () => {
  it('nasce como uma run real de DOIS setores, com o Nucleo no fundo', () => {
    const state = createTrainingRun();
    expect(state.phase).toBe('running');
    expect(state.sector).toBe(1);
    expect(state.config.depth).toEqual(TRAINING_DEPTH);
    // O setor 1 e um POCO: sem pedestal, e por isso capaz de oferecer Ecos.
    expect(hasCoreHere(state)).toBe(false);
    expect(descentUnlocked(state)).toBe(true);
  });

  it('o setor 2 tem o pedestal, e nenhum chefe o sela', () => {
    const state = createTrainingRun({ sector: 2, withCore: false });
    expect(state.sector).toBe(2);
    expect(hasCoreHere(state)).toBe(true);
    // A regra de posicao daria um chefe ao setor mais fundo da run; o carimbo
    // o remove de proposito, e sem isso o pedestal nasceria selado.
    expect(state.sectorBoss.archetype).toBeNull();
    expect(coreUnlocked(state)).toBe(true);
  });

  it('o checkpoint de VOLTA nasce com o Nucleo na mao, no ponto especial', () => {
    const state = createTrainingRun({ sector: 1, withCore: true });
    expect(isCoreTaken(state, 2)).toBe(true);
    expect(state.playerExtra.hasCore).toBe(true);
    // Emerge no poco carimbado (nao no que o worldgen inventou), e com a
    // saida ja armada: a plataforma aceita a extracao assim que ele chegar.
    expect(Math.floor(state.player.x)).toBe(state.corePos.x);
    expect(Math.floor(state.player.y)).toBe(state.corePos.y);
    expect(state.leftEntryZone).toBe(true);
  });

  it('o elenco e exatamente o que cada setor pede, e nada fora do curriculo', () => {
    const first = createTrainingRun();
    expect(first.enemies.filter((e) => e.alive).map((e) => e.archetype)).toEqual([
      'stalker',
      'stalker',
    ]);
    // UM sitio de salvage, que e a licao do terminal e do localizador.
    expect(first.salvageSites).toHaveLength(1);
    expect(first.salvageSites[0].terminalState).toBe('inactive');
    expect(first.vents).toHaveLength(0);
    expect(first.railTracks).toHaveLength(0);
    expect(first.leylineSegments).toHaveLength(0);
    expect(first.leylineNodes).toHaveLength(0);
    expect(first.wellOffers).toHaveLength(0);
    expect(first.contaminationWaves).toBe(CONTAMINATION_WAVES.length);

    const second = createTrainingRun({ sector: 2, withCore: false });
    expect(second.enemies.filter((e) => e.alive)).toHaveLength(3);
    // O fundo nao tem salvage: a licao dele e o Nucleo e a volta.
    expect(second.salvageSites).toHaveLength(0);
  });

  it('o cofre fica FORA da linha de visao do terminal — senao o anel nao serve', () => {
    const state = createTrainingRun();
    const site = state.salvageSites[0];
    const gap = Math.hypot(site.cache.x - site.terminal.x, site.cache.y - site.terminal.y);
    expect(gap).toBeGreaterThan(6);
  });

  it('a seed continua entregando o que o carimbo espera dela', () => {
    // Documentacao viva: hoje TODO setor 1 e basalto sem ocupacao. Se as
    // estratas mudarem isso, o visual do treinamento muda junto — e alguem
    // precisa decidir de novo, em vez de descobrir na tela.
    const biome = sectorBiome(TRAINING_SEED, 1);
    expect(biome.stratum).toBe('basalt');
    expect(biome.occupation).toBe('none');
  });

  it('os dois percursos cabem inteiros no mapa, sem grampeamento', () => {
    for (const sector of [1, 2] as const) {
      const course = carveTrainingCourse(createTrainingRun({ sector, withCore: false }));
      expect(course.truncated).toBe(false);
      expect(createTrainingRun({ sector, withCore: false }).corePos).toEqual(course.objectiveCell);
    }
  });

  it('setor 1: tudo se alcanca a pe, e nada de sala ilhada', () => {
    const state = createTrainingRun();
    const w = state.config.width;
    const reach = floodOpen(state.solid, w, state.config.height, state.entry.x, state.entry.y);
    expect(reach.has(state.corePos.y * w + state.corePos.x)).toBe(true);
    const site = state.salvageSites[0];
    expect(reach.has(site.terminal.y * w + site.terminal.x)).toBe(true);
    expect(reach.has(site.cache.y * w + site.cache.x)).toBe(true);
    for (const enemy of state.enemies) {
      expect(reach.has(Math.floor(enemy.y) * w + Math.floor(enemy.x))).toBe(true);
    }
    // Todo chao aberto do mapa pertence ao percurso alcancavel.
    let open = 0;
    for (let i = 0; i < state.solid.length; i++) if (state.solid[i] === SOLID_NONE) open++;
    expect(reach.size).toBe(open);
    // E o percurso e muito mais longo que a zona de entrada (4 tiles), senao a
    // licao de mover nunca teria como completar.
    const dist = Math.hypot(state.corePos.x - state.entry.x, state.corePos.y - state.entry.y);
    expect(dist).toBeGreaterThan(20);
  });

  it('o veio fica ao alcance de quem passa: toda celula encosta no percurso', () => {
    // A licao de minerar e um desvio de dois segundos, e nao uma escavacao: um
    // veio embutido no macico exigiria abrir caminho ate ele com a mesma arma
    // que ainda nao foi ensinada.
    const state = createTrainingRun();
    const course = carveTrainingCourse(createTrainingRun());
    const w = state.config.width;
    let ore = 0;
    for (let i = 0; i < state.solid.length; i++) {
      if (state.solid[i] !== SOLID_ORE) continue;
      ore++;
      const touches = [i - 1, i + 1, i - w, i + w].some((n) => course.cells.has(n));
      expect(touches).toBe(true);
    }
    expect(ore).toBe(6);
  });

  it('minerar nao e atacado: o veio fica fora do aggro dos espreitadores', () => {
    // A regra que a primeira versao do percurso quebrou: parar para minerar e
    // parar de andar, e um veio dentro do aggro fazia quem obedecia a
    // instrucao levar uma mordida por obedecer.
    const state = createTrainingRun();
    for (let i = 0; i < state.solid.length; i++) {
      if (state.solid[i] !== SOLID_ORE) continue;
      const x = i % state.config.width;
      const y = Math.floor(i / state.config.width);
      for (const enemy of state.enemies) {
        expect(Math.hypot(enemy.x - x, enemy.y - y)).toBeGreaterThan(11);
      }
    }
  });

  it('setor 2: o pedestal so existe do outro lado do tampao fragil', () => {
    const state = createTrainingRun({ sector: 2, withCore: false });
    const w = state.config.width;
    const core = state.corePos.y * w + state.corePos.x;

    // Antes do tiro, a camara do pedestal e inalcancavel: e essa parede que
    // torna a licao da brecha impossivel de pular.
    const sealed = floodOpen(state.solid, w, state.config.height, state.entry.x, state.entry.y);
    expect(sealed.has(core)).toBe(false);

    // Com o tampao aberto — que e o que o primeiro tiro faz —, o caminho existe.
    const breached = Uint8Array.from(state.solid);
    const course = carveTrainingCourse(createTrainingRun({ sector: 2, withCore: false }));
    expect(course.fragileCells.length).toBeGreaterThan(0);
    for (const cell of course.fragileCells) breached[cell.y * w + cell.x] = SOLID_NONE;
    const after = floodOpen(breached, w, state.config.height, state.entry.x, state.entry.y);
    expect(after.has(core)).toBe(true);
  });

  it('NADA existe fora do percurso alem do que o curriculo pediu', () => {
    // A propriedade mais importante do mapa, como invariante explicito: um
    // worldgen futuro nao pode vazar cristal, leyline ou duto atras da parede.
    // As duas excecoes sao NOMEADAS — o veio que rende carga e o tampao que
    // cede ao tiro —, e o teste conta as duas.
    for (const sector of [1, 2] as const) {
      const state = createTrainingRun({ sector, withCore: false });
      const course = carveTrainingCourse(createTrainingRun({ sector, withCore: false }));
      let ore = 0;
      let fragile = 0;
      for (let i = 0; i < state.solid.length; i++) {
        if (course.cells.has(i)) continue;
        if (state.solid[i] === SOLID_ORE) ore++;
        else if (state.solid[i] === SOLID_FRAGILE) fragile++;
        else expect(state.solid[i]).toBe(SOLID_ROCK);
        expect(state.surface[i]).toBe(SURF_NONE);
      }
      expect(ore).toBe(sector === 1 ? 6 : 0);
      expect(fragile).toBe(sector === 1 ? 0 : 3);
    }
  });

  it('os espreitadores nascem claramente fora do aggro de quem para para ler', () => {
    for (const sector of [1, 2] as const) {
      const state = createTrainingRun({ sector, withCore: false });
      for (const enemy of state.enemies) {
        const gap = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
        // Aggro do stalker e 9; a folga e deliberada, nao um teste do limite.
        expect(gap).toBeGreaterThan(11);
      }
    }
  });

  it('e deterministico: duas construcoes, o mesmo hash', () => {
    expect(hashAuthoritativeState(createTrainingRun())).toBe(
      hashAuthoritativeState(createTrainingRun()),
    );
  });

  it('recarimbar devolve o MESMO mundo: a subida atravessa o mapa da descida', () => {
    // O que o laco faz depois de `descend`/`ascend`. O invariante e sobre a
    // GEOGRAFIA, e nao sobre o estado inteiro: recarimbar respawna o elenco, e
    // corpos novos carregam ids novos. O que nao pode mudar e o mapa — se
    // mudasse, o jogador voltaria por um setor que ele nunca atravessou.
    const state = createTrainingRun();
    const before = hashStaticWorld(state);
    const entry = { ...state.entry };
    stampTrainingSector(state);
    expect(hashStaticWorld(state)).toBe(before);
    expect(state.entry).toEqual(entry);
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

describe('applyDiscoveries — o unico rastro que o exercicio deixa', () => {
  it('acende bits novos sem tocar em mais nada do registro', () => {
    const before = emptyRecords();
    before.totals.runs = 7;
    const after = applyDiscoveries(before, DISCOVERY_FRAGILE_BREACH);
    expect(hasDiscovery(after, DISCOVERY_FRAGILE_BREACH)).toBe(true);
    // Nem descida, nem abate, nem nota: o treinamento continua nao rendendo.
    expect(after.totals).toEqual(before.totals);
    expect(after.best).toEqual(before.best);
    expect(after.history).toEqual(before.history);
    expect(after.bestiary).toEqual(before.bestiary);
  });

  it('devolve o MESMO objeto quando nao ha bit novo, para nao gravar a toa', () => {
    const records = applyDiscoveries(emptyRecords(), DISCOVERY_FRAGILE_BREACH);
    expect(applyDiscoveries(records, DISCOVERY_FRAGILE_BREACH)).toBe(records);
    expect(applyDiscoveries(records, 0)).toBe(records);
  });
});
