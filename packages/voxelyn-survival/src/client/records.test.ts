import { describe, expect, it } from 'vitest';
import type { EnemyArchetype } from '@voxelyn/survival-sim';
import { DISCOVERY_FIRE_SPREAD, DISCOVERY_GAS_IGNITION } from '@voxelyn/survival-sim';
import type { RunPhase, RunSummary } from '@voxelyn/survival-sim';
import {
  BESTIARY_FILES,
  BESTIARY_NAMES,
  BESTIARY_ORDER,
  HISTORY_LIMIT,
  applyRun,
  applyRunOnce,
  emptyRecords,
  hasDiscovery,
} from './records';

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  seed: 1,
  phase: 'dead' as RunPhase,
  ticks: 1000,
  contamination: 0.3,
  deathCause: { kind: 'fire' },
  stats: {
    shotsFired: 10,
    kills: { stalker: 0, bruiser: 0, spitter: 0, bomber: 0, guardian: 0, bishop: 0, fungal_horse: 0, miner: 0 },
    damageTakenTenths: 100,
    damageDealtTenths: 200,
    solidsDestroyed: 3,
    salvageCompleted: 1,
    modulesAcquired: 1,
    purgeCellsUsed: 0,
    timesDowned: 0,
    revivesGiven: 0,
    oreCollected: 0,
    innocentsKilled: 0,
    discoveries: 0,
  },
  stars: 0,
  targetTicks: 9600,
  ...over,
});

describe('registro entre runs', () => {
  it('conta morte e extracao em baldes separados', () => {
    let rec = emptyRecords();
    rec = applyRun(rec, summary({ phase: 'dead' }));
    rec = applyRun(rec, summary({ phase: 'extracted', stars: 1 }));
    rec = applyRun(rec, summary({ phase: 'extracted_with_core', stars: 2 }));
    expect(rec.totals.runs).toBe(3);
    expect(rec.totals.deaths).toBe(1);
    expect(rec.totals.extractions).toBe(2);
    expect(rec.totals.extractionsWithCore).toBe(1);
  });

  it('guarda o MENOR tempo de extracao com nucleo', () => {
    let rec = emptyRecords();
    rec = applyRun(rec, summary({ phase: 'extracted_with_core', ticks: 9000, stars: 2 }));
    expect(rec.best.fastestCoreTicks).toBe(9000);
    rec = applyRun(rec, summary({ phase: 'extracted_with_core', ticks: 12000, stars: 2 }));
    expect(rec.best.fastestCoreTicks).toBe(9000); // pior nao substitui
    rec = applyRun(rec, summary({ phase: 'extracted_with_core', ticks: 7000, stars: 3 }));
    expect(rec.best.fastestCoreTicks).toBe(7000);
  });

  // Sobrevivencia so conta em run que terminou em MORTE: uma extracao de 20 min
  // nao e um recorde de resistencia, e deixar as duas no mesmo balde faria o
  // numero premiar quem enrolou antes de sair.
  it('so registra sobrevivencia em runs que terminaram em morte', () => {
    let rec = emptyRecords();
    rec = applyRun(rec, summary({ phase: 'extracted', ticks: 99999, stars: 1 }));
    expect(rec.best.longestSurvivalTicks).toBe(0);
    rec = applyRun(rec, summary({ phase: 'dead', ticks: 500 }));
    expect(rec.best.longestSurvivalTicks).toBe(500);
  });

  it('a melhor nota nunca regride', () => {
    let rec = emptyRecords();
    rec = applyRun(rec, summary({ phase: 'extracted_with_core', stars: 3 }));
    rec = applyRun(rec, summary({ phase: 'dead', stars: 0 }));
    expect(rec.best.stars).toBe(3);
  });

  it('acumula abates por arquetipo no bestiario', () => {
    let rec = emptyRecords();
    const kills = { stalker: 3, bruiser: 1, spitter: 0, bomber: 0, guardian: 0, bishop: 0, fungal_horse: 0, miner: 0 };
    rec = applyRun(rec, summary({ stats: { ...summary().stats, kills } }));
    rec = applyRun(rec, summary({ stats: { ...summary().stats, kills } }));
    expect(rec.bestiary.stalker?.killed).toBe(6);
    expect(rec.bestiary.bruiser?.killed).toBe(2);
    // Arquetipo nunca abatido continua ausente: o bestiario e o que voce
    // enfrentou, nao a lista completa do jogo.
    expect(rec.bestiary.guardian).toBeUndefined();
    expect(rec.totals.kills).toBe(8);
  });

  it('descobertas sao acumulativas e nunca se perdem', () => {
    let rec = emptyRecords();
    rec = applyRun(
      rec,
      summary({ stats: { ...summary().stats, discoveries: DISCOVERY_FIRE_SPREAD } }),
    );
    rec = applyRun(
      rec,
      summary({ stats: { ...summary().stats, discoveries: DISCOVERY_GAS_IGNITION } }),
    );
    expect(hasDiscovery(rec, DISCOVERY_FIRE_SPREAD)).toBe(true);
    expect(hasDiscovery(rec, DISCOVERY_GAS_IGNITION)).toBe(true);
    // Uma run sem descoberta nenhuma nao apaga as anteriores.
    rec = applyRun(rec, summary());
    expect(hasDiscovery(rec, DISCOVERY_FIRE_SPREAD)).toBe(true);
  });

  it('registra seed dominada apenas com tres estrelas, sem repetir', () => {
    let rec = emptyRecords();
    rec = applyRun(rec, summary({ seed: 42, stars: 2, phase: 'extracted_with_core' }));
    expect(rec.masteredSeeds).toEqual([]);
    rec = applyRun(rec, summary({ seed: 42, stars: 3, phase: 'extracted_with_core' }));
    rec = applyRun(rec, summary({ seed: 42, stars: 3, phase: 'extracted_with_core' }));
    expect(rec.masteredSeeds).toEqual([42]);
  });

  it('mantem o historico no teto, mais novo primeiro', () => {
    let rec = emptyRecords();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) rec = applyRun(rec, summary({ seed: i }));
    expect(rec.history).toHaveLength(HISTORY_LIMIT);
    expect(rec.history[0].seed).toBe(HISTORY_LIMIT + 4);
  });

  it('deduplica copias JSON da mesma run, mas aceita uma nova run apos reset', () => {
    const original = summary({ seed: 42, phase: 'extracted', ticks: 777, stars: 1 });
    const copy = JSON.parse(JSON.stringify(original)) as RunSummary;
    const first = applyRunOnce(emptyRecords(), original, null);
    const duplicate = applyRunOnce(first.records, copy, first.identity);
    expect(duplicate.applied).toBe(false);
    expect(duplicate.records.totals.runs).toBe(1);

    // Reiniciar limpa a identidade da tela; a mesma seed/resultado pode ser jogada de novo.
    const nextRun = applyRunOnce(duplicate.records, copy, null);
    expect(nextRun.applied).toBe(true);
    expect(nextRun.records.totals.runs).toBe(2);
  });

  // applyRun e pura porque este e o unico lugar do cliente em que um bug
  // silencioso custaria dado do jogador.
  it('nao muta o registro recebido', () => {
    const rec = emptyRecords();
    const snapshot = JSON.stringify(rec);
    applyRun(rec, summary({ stars: 3, phase: 'extracted_with_core', seed: 7 }));
    expect(JSON.stringify(rec)).toBe(snapshot);
  });
});

describe('registro de ativos', () => {
  // Mesma guarda de `todo arquetipo tem definicao e contador` no lado da sim:
  // um arquetipo novo sem ficha nao quebra o typecheck do Record — quebra a
  // pagina, em runtime, so para quem ja matou aquele bicho.
  it('todo arquetipo tem ficha, e a ordem do painel cobre todos', () => {
    for (const archetype of Object.keys(BESTIARY_NAMES) as EnemyArchetype[]) {
      expect(BESTIARY_FILES[archetype], archetype).toBeDefined();
      expect(BESTIARY_FILES[archetype].code.length).toBeGreaterThan(0);
      expect(BESTIARY_FILES[archetype].note.length).toBeGreaterThan(0);
    }
    expect([...BESTIARY_ORDER].sort()).toEqual(Object.keys(BESTIARY_NAMES).sort());
  });

  // A voz e a da EMPRESA, e a empresa nao chama ninguem de povo. Se um dia
  // alguem suavizar isso, o texto deixa de fazer o trabalho que faz.
  it('a ficha do mineiro nega que ele seja alguem', () => {
    expect(BESTIARY_FILES.miner.code).toBe('PESSOAL NÃO AUTORIZADO');
    expect(BESTIARY_FILES.miner.note).toContain('Sem valor de recuperação');
    // E o nome que o JOGADOR aprendeu continua existindo, em outro campo: e a
    // distancia entre os dois que faz a pagina significar alguma coisa.
    expect(BESTIARY_NAMES.miner).toBe('Minerador Empobrecido');
  });
});
