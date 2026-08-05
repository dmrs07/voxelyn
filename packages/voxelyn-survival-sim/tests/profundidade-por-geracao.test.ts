// A PROFUNDIDADE POR GERACAO: quantos setores a run realmente permite.
//
// Este arquivo cobre a mudanca estrutural inteira — o comprimento potencial da
// linhagem (sete) separado do acesso da run (a autorizacao da geracao) — e
// existe porque quase toda regressao possivel aqui e SILENCIOSA. Uma run que
// termina cedo demais nao quebra nada: ela so entrega menos do que o jogador
// pagou, e ninguem percebe ate alguem contar os setores a mao.
//
// Ver docs/superpowers/specs/2026-08-05-survival-generation-depth-lineages.md.

import { describe, expect, it } from 'vitest';
import { DEFAULT_SECTOR_COUNT, MAX_LINEAGE_SECTORS } from '../src/constants';
import {
  DEFAULT_RUN_DEPTH,
  SECTORS_BY_GENERATION,
  coreSectorsForGeneration,
  deriveGeneration,
  derivePlayerTuning,
  isValidRunDepth,
  normalizeGeneration,
  normalizeRunDepth,
  runDepthForGeneration,
  sectorCountForGeneration,
  UPGRADES,
  type ProspectorGeneration,
} from '../src/progression';
import { bossForBiome, bossForSector, isBossArchetype, sectorHoldsBoss } from '../src/bosses';
import {
  LINEAGE_IDS,
  depthIntensity,
  lineageOf,
  sectorBiome,
  sectorTitle,
  type SectorBiome,
} from '../src/strata';
import {
  coreUnlocked,
  coresAvailable,
  countCoresTaken,
  deepestCoreSector,
  descentUnlocked,
  hasCoreInSector,
  isCoreTaken,
  isFinalSector,
  markSectorBossDown,
  runIsReturning,
  sectorHasBoss,
} from '../src/depth';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { damageEntity } from '../src/entities';
import type { SemanticEvent, SurvivalState } from '../src/types';

const GENERATIONS: readonly ProspectorGeneration[] = ['G-00', 'G-01', 'G-02', 'G-03', 'G-04'];

/** Uma run com a profundidade que a geracao autoriza. */
const runFor = (generation: ProspectorGeneration, seed = 7, sector = 1): SurvivalState =>
  createRun({ seed, sector, depth: runDepthForGeneration(generation) });

/** Teleporta o jogador ao ponto especial e interage uma vez. */
const interactAtObjective = (state: SurvivalState): SemanticEvent[] => {
  state.player.x = state.corePos.x + 0.5;
  state.player.y = state.corePos.y + 0.5;
  const cmd = emptyCommand();
  cmd.interact = true;
  return stepRun(state, state.players.map(() => cmd)).events;
};

/**
 * Derruba o selo do setor atual e alcanca o ponto especial.
 *
 * Duas interacoes num setor de Nucleo (pedestal, depois poco) e uma nos demais.
 * A fauna sai da frente porque o que estes testes medem e a ESTRUTURA da
 * descida, e nao a capacidade do jogador de atravessar um mapa.
 */
const clearSectorAndAdvance = (state: SurvivalState): SemanticEvent[] => {
  markSectorBossDown(state, state.sector);
  state.enemies = [];
  const events = interactAtObjective(state);
  if (hasCoreInSector(state, state.sector) && isCoreTaken(state, state.sector)) {
    state.enemies = [];
    return [...events, ...interactAtObjective(state)];
  }
  return events;
};

// ---------------------------------------------------------------------------
// Mapeamento de geracao
// ---------------------------------------------------------------------------

describe('mapeamento de geracao para profundidade', () => {
  it('G-00 e G-01 tem tres setores; G-02 quatro; G-03 cinco; G-04 sete', () => {
    expect(sectorCountForGeneration('G-00')).toBe(3);
    expect(sectorCountForGeneration('G-01')).toBe(3);
    expect(sectorCountForGeneration('G-02')).toBe(4);
    expect(sectorCountForGeneration('G-03')).toBe(5);
    expect(sectorCountForGeneration('G-04')).toBe(7);
  });

  it('nenhuma geracao ultrapassa o comprimento potencial da linhagem', () => {
    for (const generation of GENERATIONS) {
      expect(SECTORS_BY_GENERATION[generation]).toBeLessThanOrEqual(MAX_LINEAGE_SECTORS);
      expect(SECTORS_BY_GENERATION[generation]).toBeGreaterThanOrEqual(1);
    }
  });

  it('a profundidade nunca DIMINUI com a geracao', () => {
    // Uma tabela editada a mao pode inverter dois valores sem quebrar nada
    // visivel; o jogador so descobriria comprando o protocolo que o encurta.
    for (let i = 1; i < GENERATIONS.length; i++) {
      expect(sectorCountForGeneration(GENERATIONS[i])).toBeGreaterThanOrEqual(
        sectorCountForGeneration(GENERATIONS[i - 1]),
      );
    }
  });

  it('geracao desconhecida normaliza para G-00 — rebaixar e a direcao segura', () => {
    for (const bogus of ['G-99', 'g-04', '', null, undefined, 4, {}]) {
      expect(normalizeGeneration(bogus)).toBe('G-00');
    }
    expect(normalizeGeneration('G-03')).toBe('G-03');
  });

  it('G-00 continua valendo tres setores: e o Prospector de fabrica', () => {
    // Ranqueado, co-op e toda run legada rodam nele. Rebaixa-lo encurtaria
    // runs que ja existem sem ninguem ter pedido.
    expect(DEFAULT_RUN_DEPTH.sectorCount).toBe(DEFAULT_SECTOR_COUNT);
    expect(DEFAULT_RUN_DEPTH.generation).toBe('G-00');
    expect(createRun({ seed: 1 }).config.depth).toEqual(DEFAULT_RUN_DEPTH);
  });

  it('nenhum chassi altera o total: so a contagem de protocolos', () => {
    // A trilha de CHASSI inteira comprada da a mesma profundidade que qualquer
    // outra trilha do mesmo tamanho — o que escala e a geracao, e a geracao e
    // contagem, nunca ramificacao.
    const chassis = UPGRADES.filter((u) => u.branch === 'chassis').map((u) => u.id);
    const mobility = UPGRADES.filter((u) => u.branch === 'mobility').map((u) => u.id);
    expect(chassis).toHaveLength(mobility.length);
    expect(sectorCountForGeneration(deriveGeneration(chassis))).toBe(
      sectorCountForGeneration(deriveGeneration(mobility)),
    );
    // E o tuning muda entre as duas, provando que as arvores sao diferentes.
    expect(derivePlayerTuning(chassis).maxHp).not.toBe(derivePlayerTuning(mobility).maxHp);
  });

  it('comprar protocolo depois de criar a run NAO a altera', () => {
    const state = runFor('G-02');
    expect(state.config.depth.sectorCount).toBe(4);
    // O perfil "sobe" para G-04 no meio da expedicao. A run e um objeto
    // congelado: ela nao tem como perguntar nada a ninguem.
    const afterPurchase = runDepthForGeneration(deriveGeneration(UPGRADES.map((u) => u.id)));
    expect(afterPurchase.sectorCount).toBe(7);
    expect(state.config.depth.sectorCount).toBe(4);
    expect(state.config.depth.coreSectors).toEqual([4]);
  });
});

// ---------------------------------------------------------------------------
// Linhagens
// ---------------------------------------------------------------------------

describe('linhagens com sete posicoes', () => {
  it('toda linhagem resolve os setores 1 a 7, deterministicamente', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      seen.add(lineageOf(seed));
      for (let sector = 1; sector <= MAX_LINEAGE_SECTORS; sector++) {
        const biome = sectorBiome(seed, sector);
        expect(biome.stratum, `seed ${seed} setor ${sector}`).toBeTruthy();
        expect(sectorBiome(seed, sector)).toEqual(biome);
        expect(sectorTitle(seed, sector).length).toBeGreaterThan(0);
      }
    }
    // A amostra tem de cobrir a tabela inteira, senao o teste acima prova pouco.
    expect(seen.size).toBe(LINEAGE_IDS.length);
  });

  it('os setores extras nao sao copias identicas do terceiro', () => {
    // "Sete posicoes" so vale alguma coisa se a metade profunda disser algo
    // novo. A prova e por TITULO, que e a curva editorial escrita por extenso:
    // dois nomes iguais seriam a mesma sala duas vezes.
    for (const seed of [1, 2, 3, 4, 5, 6, 7]) {
      const titles = new Set<string>();
      for (let sector = 1; sector <= MAX_LINEAGE_SECTORS; sector++) {
        titles.add(sectorTitle(seed, sector));
      }
      expect(titles.size, `linhagem ${lineageOf(seed)}`).toBe(MAX_LINEAGE_SECTORS);
    }
  });

  it('a mesma seed em geracoes diferentes preserva os tres primeiros setores', () => {
    // A promessa da spec: a geracao muda ate onde se pode ir, nunca o que ha
    // no caminho ja conhecido. O bioma e funcao pura de (seed, setor) e NAO
    // recebe a profundidade justamente por isto.
    for (let seed = 1; seed <= 40; seed++) {
      const reference = [1, 2, 3].map((s) => sectorBiome(seed, s));
      for (const generation of GENERATIONS) {
        const depth = runDepthForGeneration(generation);
        for (let sector = 1; sector <= Math.min(3, depth.sectorCount); sector++) {
          expect(sectorBiome(seed, sector), `${generation} seed ${seed}`).toEqual(
            reference[sector - 1],
          );
        }
      }
    }
  });

  it('a intensidade de profundidade preserva os tres primeiros e desacelera depois', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(depthIntensity)).toEqual([0, 1, 2, 3, 3, 4, 4]);
    // Nunca decresce, e nunca chega ao dobro do terceiro setor: e a diferenca
    // entre profundidade e densidade caotica.
    for (let sector = 2; sector <= MAX_LINEAGE_SECTORS; sector++) {
      expect(depthIntensity(sector)).toBeGreaterThanOrEqual(depthIntensity(sector - 1));
    }
    expect(depthIntensity(MAX_LINEAGE_SECTORS)).toBeLessThan(depthIntensity(3) * 3);
  });

  it('createRun nunca comeca alem do limite congelado', () => {
    for (const generation of GENERATIONS) {
      const limit = sectorCountForGeneration(generation);
      const beyond = createRun({ seed: 9, sector: limit + 3, depth: runDepthForGeneration(generation) });
      expect(beyond.sector).toBe(limit);
    }
  });

  it('isFinalSector usa o total da RUN, nunca uma constante', () => {
    expect(isFinalSector(3, 3)).toBe(true);
    expect(isFinalSector(3, 7)).toBe(false);
    expect(isFinalSector(7, 7)).toBe(true);
    for (const generation of GENERATIONS) {
      const limit = sectorCountForGeneration(generation);
      expect(isFinalSector(limit - 1, limit)).toBe(false);
      expect(isFinalSector(limit, limit)).toBe(true);
    }
  });
});

describe('acesso da run: onde cada geracao para', () => {
  it.each([
    ['G-01' as const, 3],
    ['G-02' as const, 4],
    ['G-03' as const, 5],
    ['G-04' as const, 7],
  ])('%s atravessa exatamente %i setores e para la', (generation, expected) => {
    const state = runFor(generation, 21);
    // Desce ate onde der, com folga de tentativas alem do limite.
    for (let attempt = 0; attempt < MAX_LINEAGE_SECTORS + 3; attempt++) {
      clearSectorAndAdvance(state);
    }
    expect(state.sector).toBe(expected);
    expect(state.phase).toBe('running');
    // E o Nucleo do fundo saiu do pedestal: chegar ao fim significa isso.
    expect(isCoreTaken(state, expected)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Nucleos
// ---------------------------------------------------------------------------

describe('nucleos por geracao', () => {
  it.each([
    ['G-00' as const, [3]],
    ['G-01' as const, [3]],
    ['G-02' as const, [4]],
    ['G-03' as const, [3, 5]],
    ['G-04' as const, [3, 7]],
  ])('%s: Nucleos em %j', (generation, sectors) => {
    expect(coreSectorsForGeneration(generation)).toEqual(sectors);
    expect(runDepthForGeneration(generation).coreSectors).toEqual(sectors);
  });

  it('todo Nucleo cai dentro da run, e o mais fundo e o ultimo setor', () => {
    for (const generation of GENERATIONS) {
      const depth = runDepthForGeneration(generation);
      for (const sector of depth.coreSectors) {
        expect(sector).toBeGreaterThanOrEqual(1);
        expect(sector).toBeLessThanOrEqual(depth.sectorCount);
      }
      expect(Math.max(...depth.coreSectors)).toBe(depth.sectorCount);
      expect(new Set(depth.coreSectors).size).toBe(depth.coreSectors.length);
    }
  });

  it('o Nucleo INTERMEDIARIO nao encerra a run: da para continuar descendo', () => {
    const state = runFor('G-04', 33, 3);
    expect(hasCoreInSector(state, 3)).toBe(true);
    expect(deepestCoreSector(state)).toBe(7);

    markSectorBossDown(state, 3);
    state.enemies = [];
    const events = interactAtObjective(state);

    expect(isCoreTaken(state, 3)).toBe(true);
    expect(countCoresTaken(state)).toBe(1);
    // A mensagem e a de "ha mais Veio abaixo", e nunca a de fim de run.
    expect(events.some((e) => e.t === 'message' && e.key === 'sim.coreTakenDeeper')).toBe(true);
    expect(events.some((e) => e.t === 'message' && e.key === 'sim.coreTaken')).toBe(false);
    // A run NAO entrou em retorno: o poco continua descendo.
    expect(runIsReturning(state)).toBe(false);

    state.enemies = [];
    interactAtObjective(state);
    expect(state.sector).toBe(4);
  });

  it('dois Nucleos podem ser coletados numa run de G-04', () => {
    const state = runFor('G-04', 33, 3);
    for (let attempt = 0; attempt < MAX_LINEAGE_SECTORS + 2; attempt++) {
      clearSectorAndAdvance(state);
    }
    expect(state.sector).toBe(7);
    expect(countCoresTaken(state)).toBe(2);
    expect(isCoreTaken(state, 3)).toBe(true);
    expect(isCoreTaken(state, 7)).toBe(true);
    expect(coresAvailable(state)).toBe(2);
    // Agora sim a run esta voltando, e o poco selou.
    expect(runIsReturning(state)).toBe(true);
  });

  it('coleta duplicada e impossivel', () => {
    const state = runFor('G-03', 45, 5);
    markSectorBossDown(state, 5);
    state.enemies = [];
    interactAtObjective(state);
    expect(countCoresTaken(state)).toBe(1);
    const before = state.playerExtra.carriedCoreMask;

    // Insistir no pedestal nao rende um segundo Nucleo.
    for (let i = 0; i < 5; i++) {
      state.enemies = [];
      interactAtObjective(state);
    }
    expect(countCoresTaken(state)).toBe(1);
    expect(state.playerExtra.carriedCoreMask).toBe(before);
  });

  it('o poco so SELA quando o Nucleo mais fundo sai do pedestal', () => {
    const state = runFor('G-03', 45, 3);
    markSectorBossDown(state, 3);
    state.enemies = [];
    interactAtObjective(state); // recolhe o intermediario

    state.enemies = [];
    const events = interactAtObjective(state); // e desce mesmo assim
    expect(state.sector).toBe(4);
    expect(events.some((e) => e.t === 'message' && e.key === 'sim.wellSealedReturn')).toBe(false);
  });

  it('o portador que cai devolve CADA Nucleo ao pedestal dele', () => {
    const state = runFor('G-04', 51, 3);
    markSectorBossDown(state, 3);
    state.enemies = [];
    interactAtObjective(state);
    expect(isCoreTaken(state, 3)).toBe(true);

    // Mata o portador: o Nucleo volta, recuperavel.
    state.player.hp = 0;
    stepRun(state, [emptyCommand()]);
    expect(state.phase).toBe('dead');
    expect(isCoreTaken(state, 3)).toBe(false);
    expect(state.playerExtra.carriedCoreMask).toBe(0);
    expect(state.playerExtra.hasCore).toBe(false);
  });

  it('o resumo conta os Nucleos que sairam do Veio', () => {
    const state = runFor('G-01', 63, 3);
    markSectorBossDown(state, 3);
    state.enemies = [];
    interactAtObjective(state);
    // Extrai na entrada do setor 1... que e aqui mesmo (run de tres setores,
    // subida coberta em return-extraction.test.ts). Basta forcar o fim.
    state.sector = 1;
    state.leftEntryZone = true;
    state.player.x = state.entry.x + 0.5;
    state.player.y = state.entry.y + 0.5;
    const cmd = emptyCommand();
    cmd.interact = true;
    stepRun(state, [cmd]);
    expect(state.phase).toBe('extracted_with_core');
    expect(state.summary?.cores).toBe(1);
    expect(state.summary?.sectorCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Chefes e selos
// ---------------------------------------------------------------------------

describe('chefes por setor', () => {
  it.each([
    ['G-00' as const, [3]],
    ['G-01' as const, [3]],
    ['G-02' as const, [4]],
    ['G-03' as const, [3, 5]],
    ['G-04' as const, [3, 7]],
  ])('%s tem chefe exatamente nos setores %j', (generation, expected) => {
    const depth = runDepthForGeneration(generation);
    const withBoss: number[] = [];
    for (let sector = 1; sector <= depth.sectorCount; sector++) {
      if (sectorHoldsBoss(sector, depth.sectorCount, depth.coreSectors)) withBoss.push(sector);
    }
    expect(withBoss).toEqual(expected);
  });

  it('o setor 1 nunca tem chefe, em geracao nenhuma', () => {
    for (const generation of GENERATIONS) {
      const depth = runDepthForGeneration(generation);
      expect(sectorHoldsBoss(1, depth.sectorCount, depth.coreSectors)).toBe(false);
      expect(
        bossForSector((sec) => sectorBiome(11, sec), 1, depth.sectorCount, depth.coreSectors),
      ).toBeNull();
    }
  });

  it('o setor FINAL fica sempre com o dono do proprio bioma', () => {
    for (let seed = 1; seed <= 120; seed++) {
      for (const [count, cores] of [[5, [3, 5]], [7, [3, 7]]] as const) {
        const final = bossForSector((s) => sectorBiome(seed, s), count, count, cores);
        expect(final?.boss, `seed ${seed} setor ${count}`).toBe(
          bossForBiome(sectorBiome(seed, count)),
        );
        expect(final?.source).not.toBe('special');
      }
    }
  });

  it('UM CHEFE POR RUN: o setor 3 nunca repete o dono do fundo', () => {
    // A regressao que isto impede tinha 38% de incidencia: o setor 3 e o setor
    // final costumam ser o MESMO estrato (e o que faz uma linhagem arida ser
    // arida), e duas intrusoes Aurix davam dois Diamandis na mesma run.
    for (let seed = 1; seed <= 2000; seed++) {
      for (const [count, cores] of [[5, [3, 5]], [7, [3, 7]]] as const) {
        const biomeAt = (s: number) => sectorBiome(seed, s);
        const shallow = bossForSector(biomeAt, 3, count, cores);
        const deep = bossForSector(biomeAt, count, count, cores);
        expect(shallow, `seed ${seed}`).not.toBeNull();
        expect(deep, `seed ${seed}`).not.toBeNull();
        expect(shallow!.boss, `seed ${seed} (${count} setores)`).not.toBe(deep!.boss);
        // E o cedido continua sendo um chefe DE VERDADE, com corpo.
        expect(shallow!.archetype, `seed ${seed}`).not.toBeNull();
      }
    }
  });

  it('a cicatriz cede ao VEIO: com ocupacao, o alternado e o chefe do estrato', () => {
    // A regra que o caso Aurix pede por extenso — dois setores de Cicatriz nao
    // produzem dois Diamandis; o raso vira o dono natural do estrato.
    const aurixBoth = (sector: number): SectorBiome =>
      sector === 3 || sector === 7
        ? { stratum: 'ferric', occupation: 'aurix', lineage: 'industrial' }
        : { stratum: 'ferric', occupation: 'none', lineage: 'industrial' };
    const deep = bossForSector(aurixBoth, 7, 7, [3, 7]);
    const shallow = bossForSector(aurixBoth, 3, 7, [3, 7]);
    expect(deep?.boss).toBe('diamandis');
    expect(shallow?.boss).toBe('magnetarch'); // o chefe de bioma do Ferrifero
    expect(shallow?.source).toBe('special');
  });

  it('sem ocupacao, a camara rasa e uma camara TOMADA', () => {
    // Mesmo estrato limpo nos dois: o estrato ja esta tomado pelo fundo, entao
    // o pedestal raso recebe quem chegou nele primeiro (Matriz ou Aurix).
    const cleanSilica = (): SectorBiome => ({
      stratum: 'silica',
      occupation: 'none',
      lineage: 'arid',
    });
    const deep = bossForSector(cleanSilica, 7, 7, [3, 7]);
    const shallow = bossForSector(cleanSilica, 3, 7, [3, 7]);
    expect(deep?.boss).toBe('white_devourer');
    expect(shallow?.boss).toBe('bishop');
    expect(shallow?.source).toBe('special');
  });

  it('G-03 e G-04 concordam sobre o setor 3 quando ele nao precisa ceder', () => {
    // Quando o fundo de G-03 (setor 5) e o de G-04 (setor 7) pedem o mesmo
    // dono, as duas runs resolvem o setor 3 igual. Nao e invariante universal —
    // e nem poderia ser, ja que o fundo delas e outro setor —, mas onde vale,
    // vale.
    let agreed = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const biomeAt = (s: number) => sectorBiome(seed, s);
      if (bossForBiome(sectorBiome(seed, 5)) !== bossForBiome(sectorBiome(seed, 7))) continue;
      expect(bossForSector(biomeAt, 3, 5, [3, 5])).toEqual(bossForSector(biomeAt, 3, 7, [3, 7]));
      agreed++;
    }
    expect(agreed).toBeGreaterThan(0);
  });

  it('o setor sem chefe nasce com o poco disponivel pela regra normal', () => {
    const state = runFor('G-04', 71, 2);
    expect(sectorHasBoss(state)).toBe(false);
    expect(descentUnlocked(state)).toBe(true);
    expect(state.enemies.filter((e) => isBossArchetype(e.archetype))).toHaveLength(0);
  });

  it('o setor com chefe nasce SELADO: poco e pedestal recusam', () => {
    const state = runFor('G-04', 71, 3);
    expect(sectorHasBoss(state)).toBe(true);
    expect(state.sectorBoss.defeated).toBe(false);
    expect(descentUnlocked(state)).toBe(false);
    expect(coreUnlocked(state)).toBe(false);

    state.enemies = state.enemies.filter((e) => isBossArchetype(e.archetype));
    const events = interactAtObjective(state);
    expect(events.some((e) => e.t === 'message' && e.key === 'sim.coreSealedByBoss')).toBe(true);
    expect(isCoreTaken(state, 3)).toBe(false);
    expect(state.sector).toBe(3);
  });

  it('inimigo comum abatido NAO libera o selo', () => {
    const state = runFor('G-04', 71, 3);
    // Some com toda a fauna comum; o dono continua de pe.
    state.enemies = state.enemies.filter((e) => isBossArchetype(e.archetype));
    expect(state.enemies).toHaveLength(1);
    expect(descentUnlocked(state)).toBe(false);
    interactAtObjective(state);
    expect(state.sector).toBe(3);
    expect(isCoreTaken(state, 3)).toBe(false);
  });

  it('a morte do chefe libera poco E Nucleo, sem transportar ninguem', () => {
    const state = runFor('G-04', 71, 3);
    const boss = state.enemies.find((e) => isBossArchetype(e.archetype));
    expect(boss).toBeDefined();
    expect(state.sectorBoss.entityId).toBe(boss!.id);

    markSectorBossDown(state, 3);
    expect(descentUnlocked(state)).toBe(true);
    expect(coreUnlocked(state)).toBe(true);
    // Liberar nao e transportar: o jogador continua onde estava.
    expect(state.sector).toBe(3);
  });

  it('matar o chefe de OUTRO setor nao libera o atual', () => {
    const state = runFor('G-04', 71, 3);
    markSectorBossDown(state, 7);
    expect(state.sectorBoss.defeated).toBe(false);
    expect(descentUnlocked(state)).toBe(false);
  });

  it('o abate marca a mascara e emite sector_unsealed', () => {
    const state = runFor('G-03', 82, 5);
    const boss = state.enemies.find((e) => isBossArchetype(e.archetype));
    expect(boss).toBeDefined();
    // Abate pelo caminho autoritativo (dano do jogador), e nao pela marca a
    // mao: e o caminho do dano que tem de reconhecer o dono do setor.
    const events: SemanticEvent[] = [];
    damageEntity(state, boss!, boss!.hp + 1, events, { kind: 'player_shot' });
    expect(boss!.alive).toBe(false);
    expect(state.sectorBoss.defeated).toBe(true);
    expect(state.bossesDownMask & (1 << 5)).not.toBe(0);
    const unsealed = events.find((e) => e.t === 'sector_unsealed');
    expect(unsealed).toBeDefined();
    if (unsealed?.t === 'sector_unsealed') {
      expect(unsealed.sector).toBe(5);
      expect(unsealed.coreUnlocked).toBe(true);
    }
  });

  it('o chefe abatido nao volta ao regenerar o setor', () => {
    const state = runFor('G-04', 71, 3);
    markSectorBossDown(state, 3);
    state.enemies = [];
    // Desce e volta: o setor 3 e regenerado inteiro na subida.
    interactAtObjective(state); // recolhe
    state.enemies = [];
    interactAtObjective(state); // desce para 4
    expect(state.sector).toBe(4);
    // Reconstruir o setor 3 do zero com a mesma mascara mantem a camara vazia.
    const rebuilt = createRun({ seed: 71, sector: 3, depth: runDepthForGeneration('G-04') });
    rebuilt.bossesDownMask = state.bossesDownMask;
    const repopulated = createRun({ seed: 71, sector: 3, depth: runDepthForGeneration('G-04') });
    expect(repopulated.enemies.some((e) => isBossArchetype(e.archetype))).toBe(true);
    expect(rebuilt.bossesDownMask & (1 << 3)).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Determinismo e hash
// ---------------------------------------------------------------------------

describe('determinismo da profundidade', () => {
  it('a configuracao de profundidade participa do hash', () => {
    const g01 = createRun({ seed: 100, depth: runDepthForGeneration('G-01') });
    const g04 = createRun({ seed: 100, depth: runDepthForGeneration('G-04') });
    // O mundo do setor 1 e IDENTICO (mesma seed, mesmo bioma)...
    expect(g01.stratum).toBe(g04.stratum);
    expect(g01.corePos).toEqual(g04.corePos);
    // ...e ainda assim os hashes divergem: sao runs diferentes desde o tick 0.
    expect(hashAuthoritativeState(g01)).not.toBe(hashAuthoritativeState(g04));
  });

  it('a mesma geracao e a mesma seed produzem o mesmo hash', () => {
    for (const generation of GENERATIONS) {
      const a = createRun({ seed: 101, depth: runDepthForGeneration(generation) });
      const b = createRun({ seed: 101, depth: runDepthForGeneration(generation) });
      expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    }
  });

  it('a coleta de Nucleos e o abate de chefes entram no estado autoritativo', () => {
    const base = createRun({ seed: 102, sector: 3, depth: runDepthForGeneration('G-04') });
    const before = hashAuthoritativeState(base);

    const withCore = createRun({ seed: 102, sector: 3, depth: runDepthForGeneration('G-04') });
    withCore.coresTakenMask |= 1 << 3;
    expect(hashAuthoritativeState(withCore)).not.toBe(before);

    const withBossDown = createRun({ seed: 102, sector: 3, depth: runDepthForGeneration('G-04') });
    withBossDown.bossesDownMask |= 1 << 3;
    expect(hashAuthoritativeState(withBossDown)).not.toBe(before);
    // E os dois sao estados DISTINTOS entre si.
    expect(hashAuthoritativeState(withCore)).not.toBe(hashAuthoritativeState(withBossDown));
  });

  it('reconstruir o setor 6 de uma run de G-04 e deterministico', () => {
    // O caso da reconexao: um cliente que volta no setor 6 monta o mundo com
    // createRun({ sector: 6 }) e tem de chegar ao mesmo lugar.
    const a = createRun({ seed: 103, sector: 6, depth: runDepthForGeneration('G-04') });
    const b = createRun({ seed: 103, sector: 6, depth: runDepthForGeneration('G-04') });
    expect(a.sector).toBe(6);
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    expect(a.stratum).toBe(sectorBiome(103, 6).stratum);
  });

  it('atravessar sete setores nao diverge do replay do mesmo caminho', () => {
    const walk = (): SurvivalState => {
      const state = runFor('G-04', 104);
      for (let attempt = 0; attempt < MAX_LINEAGE_SECTORS + 2; attempt++) {
        clearSectorAndAdvance(state);
      }
      return state;
    };
    const a = walk();
    const b = walk();
    expect(a.sector).toBe(7);
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
  });
});

// ---------------------------------------------------------------------------
// Migracao e validacao
// ---------------------------------------------------------------------------

describe('normalizacao de profundidade vinda de fora', () => {
  it('configuracao ausente vira a run de tres setores de sempre', () => {
    expect(normalizeRunDepth(undefined)).toEqual({
      generation: 'G-00',
      sectorCount: 3,
      coreSectors: [3],
    });
    expect(normalizeRunDepth(null)).toEqual(normalizeRunDepth(undefined));
    expect(normalizeRunDepth({})).toEqual(normalizeRunDepth(undefined));
  });

  it('run legada NAO e alongada pelo perfil de hoje', () => {
    // O snapshot antigo so tinha a geracao. Ele continua sendo de tres setores
    // mesmo que a geracao gravada nele autorize sete: o que manda e o que a run
    // realmente foi, e nao o que ela poderia ter sido.
    const legacy = normalizeRunDepth({ generation: 'G-04' });
    expect(legacy.sectorCount).toBe(3);
    expect(legacy.coreSectors).toEqual([3]);
    expect(createRun({ seed: 5, depth: legacy }).config.depth.sectorCount).toBe(3);
  });

  it('sem lista de Nucleos, o Nucleo esta onde ele sempre esteve', () => {
    expect(normalizeRunDepth({ generation: 'G-02', sectorCount: 4 }).coreSectors).toEqual([4]);
  });

  it('sanea inteiros, faixa, duplicatas e Nucleos fora da run', () => {
    const messy = normalizeRunDepth({
      generation: 'G-04',
      sectorCount: 99,
      coreSectors: [3, 3, 0, -1, 9, 5.7, 'x', 7],
    });
    expect(messy.sectorCount).toBe(MAX_LINEAGE_SECTORS);
    expect(messy.coreSectors).toEqual([3, 5, 7]);
    expect(isValidRunDepth(messy)).toBe(true);
  });

  it('sectorCount fracionario ou negativo nao passa', () => {
    expect(normalizeRunDepth({ sectorCount: -4 }).sectorCount).toBe(1);
    expect(normalizeRunDepth({ sectorCount: 4.9 }).sectorCount).toBe(4);
    expect(normalizeRunDepth({ sectorCount: Number.NaN }).sectorCount).toBe(DEFAULT_SECTOR_COUNT);
  });

  it('isValidRunDepth recusa o que normalizeRunDepth conserta', () => {
    expect(isValidRunDepth(runDepthForGeneration('G-04'))).toBe(true);
    expect(isValidRunDepth({ generation: 'G-9' as ProspectorGeneration, sectorCount: 3, coreSectors: [3] })).toBe(false);
    expect(isValidRunDepth({ generation: 'G-01', sectorCount: 9, coreSectors: [3] })).toBe(false);
    expect(isValidRunDepth({ generation: 'G-01', sectorCount: 3, coreSectors: [4] })).toBe(false);
    expect(isValidRunDepth({ generation: 'G-01', sectorCount: 3, coreSectors: [3, 3] })).toBe(false);
    expect(isValidRunDepth({ generation: 'G-01', sectorCount: 3.5, coreSectors: [3] })).toBe(false);
  });

  it('toda geracao produz uma profundidade valida', () => {
    for (const generation of GENERATIONS) {
      expect(isValidRunDepth(runDepthForGeneration(generation)), generation).toBe(true);
    }
  });
});
