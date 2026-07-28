import { describe, expect, it } from 'vitest';
import {
  BLEEDOUT_TICKS,
  PLAYER_HP,
  TARGET_EXTRACTION_TICKS,
  buildSummary,
  createRun,
  damageEntity,
  emptyCommand,
  hashAuthoritativeState,
  starsFor,
  stepRun,
} from '../src/index.js';
import type { DamageCause, SurvivalState } from '../src/index.js';

const idle = () => [emptyCommand()];

/**
 * Espelha `runEndingCause`, que e interno a run.ts de proposito: nada fora da
 * simulacao deveria escolher a causa, e exportar so para o teste convidaria o
 * cliente a chamar.
 */
const runEndingCauseForTest = (state: SurvivalState): DamageCause | null => {
  if (state.phase !== 'dead') return null;
  let latest: { cause: DamageCause; tick: number } | null = null;
  for (const extra of state.playerExtras) {
    if (!extra.joined || !extra.lastDamage) continue;
    if (!latest || extra.lastDamage.tick > latest.tick) latest = extra.lastDamage;
  }
  return latest?.cause ?? { kind: 'unknown' };
};

/** Avanca a run ate ela terminar, com teto para nao pendurar a suite. */
const runUntilOver = (state: SurvivalState, maxTicks = 200): SurvivalState => {
  for (let i = 0; i < maxTicks && state.phase === 'running'; i++) stepRun(state, idle());
  return state;
};

/** Mata o jogador com uma causa especifica e deixa a run concluir. */
const killWith = (cause: DamageCause, seed = 7): SurvivalState => {
  const state = createRun({ seed });
  const events: never[] = [];
  damageEntity(state, state.player, PLAYER_HP * 2, events, cause);
  return runUntilOver(state, 5);
};

describe('as tres estrelas', () => {
  // A escada e de INTENCAO: morrer nao e um resultado parcial de extrair.
  it('nao concede estrela a quem morre, por mais rapido que seja', () => {
    expect(starsFor('dead', 1, TARGET_EXTRACTION_TICKS)).toBe(0);
    expect(starsFor('dead', TARGET_EXTRACTION_TICKS * 10, TARGET_EXTRACTION_TICKS)).toBe(0);
  });

  it('da uma estrela a quem sai vivo de maos vazias, independente do tempo', () => {
    expect(starsFor('extracted', 1, TARGET_EXTRACTION_TICKS)).toBe(1);
    expect(starsFor('extracted', TARGET_EXTRACTION_TICKS * 10, TARGET_EXTRACTION_TICKS)).toBe(1);
  });

  // A terceira nao adiciona objetivo novo: cobra o MESMO objetivo com pressa. E
  // o que mantem viva a decisao "extrair agora ou arriscar" depois que o jogador
  // ja aprendeu o mapa.
  it('a terceira estrela e a segunda cobrada no tempo', () => {
    expect(starsFor('extracted_with_core', TARGET_EXTRACTION_TICKS - 1, TARGET_EXTRACTION_TICKS)).toBe(3);
    expect(starsFor('extracted_with_core', TARGET_EXTRACTION_TICKS, TARGET_EXTRACTION_TICKS)).toBe(3);
    expect(starsFor('extracted_with_core', TARGET_EXTRACTION_TICKS + 1, TARGET_EXTRACTION_TICKS)).toBe(2);
  });

  it('e monotonica no tempo: demorar nunca sobe a nota', () => {
    let previous = 4;
    for (let t = 0; t <= TARGET_EXTRACTION_TICKS * 2; t += TARGET_EXTRACTION_TICKS / 8) {
      const stars = starsFor('extracted_with_core', t, TARGET_EXTRACTION_TICKS);
      expect(stars).toBeLessThanOrEqual(previous);
      previous = stars;
    }
  });
});

describe('causa de morte', () => {
  // O caso que justifica o sistema inteiro: estas tres mortes eram
  // indistinguiveis na tela de fim, e sao licoes completamente diferentes.
  it('distingue o gas do inimigo e da propria explosao', () => {
    expect(killWith({ kind: 'gas' }).summary?.deathCause).toEqual({ kind: 'gas' });
    expect(killWith({ kind: 'explosion', source: 'player' }).summary?.deathCause).toEqual({
      kind: 'explosion',
      source: 'player',
    });
    expect(
      killWith({ kind: 'enemy_contact', archetype: 'bruiser', elite: false }).summary?.deathCause
    ).toEqual({ kind: 'enemy_contact', archetype: 'bruiser', elite: false });
  });

  it('preserva de qual criatura veio o projetil', () => {
    const cause: DamageCause = {
      kind: 'enemy_projectile',
      archetype: 'spitter',
      elite: true,
      projectile: 'spit',
    };
    expect(killWith(cause).summary?.deathCause).toEqual(cause);
  });

  // O ultimo golpe nao e o culpado: o fogo de 2,2 por tick costuma ser a ultima
  // coisa a acertar quem ja levou 22 de pedrada. O campo responde "o que te
  // matou", e a resposta e o dano que zerou a vida.
  it('guarda a causa do dano que efetivamente matou', () => {
    const state = createRun({ seed: 11 });
    const events: never[] = [];
    damageEntity(state, state.player, 10, events, { kind: 'fire' });
    damageEntity(state, state.player, PLAYER_HP, events, {
      kind: 'enemy_projectile', archetype: 'bruiser', elite: false, projectile: 'rock',
    });
    runUntilOver(state, 5);
    expect(state.summary?.deathCause?.kind).toBe('enemy_projectile');
  });

  // Sangrar ate o fim e uma licao DIFERENTE do golpe que derrubou: a primeira
  // culpa o combate, a segunda culpa o parceiro que nao chegou a tempo.
  it('sangramento sobrescreve a causa do golpe que derrubou', () => {
    const state = createRun({ seed: 3, playerCount: 2 });
    const events: never[] = [];
    damageEntity(state, state.players[0], PLAYER_HP * 2, events, {
      kind: 'enemy_contact', archetype: 'stalker', elite: false,
    });
    stepRun(state, [emptyCommand(), emptyCommand()]);
    expect(state.playerExtras[0].downed).toBe(true);
    expect(state.playerExtras[0].lastDamage?.cause.kind).toBe('enemy_contact');

    for (let i = 0; i < BLEEDOUT_TICKS + 5; i++) stepRun(state, [emptyCommand(), emptyCommand()]);
    expect(state.players[0].alive).toBe(false);
    expect(state.playerExtras[0].lastDamage?.cause).toEqual({ kind: 'bleedout' });
  });

  /**
   * O SEGUNDO a cair nunca sangra: sem aliado de pe, `resolveDownedAndDeaths`
   * mata na hora em vez de abater. A consequencia — que o teste fixa — e que a
   * causa que encerra a run e sempre a do ultimo a cair, e nunca 'bleedout'
   * enquanto os dois slots estiverem ocupados.
   */
  it('a causa que encerra a run e a do ultimo a cair', () => {
    const state = createRun({ seed: 3, playerCount: 2 });
    const events: never[] = [];
    damageEntity(state, state.players[0], PLAYER_HP * 2, events, {
      kind: 'enemy_contact', archetype: 'stalker', elite: false,
    });
    stepRun(state, [emptyCommand(), emptyCommand()]);

    damageEntity(state, state.players[1], PLAYER_HP * 2, events, {
      kind: 'explosion', source: 'player',
    });
    stepRun(state, [emptyCommand(), emptyCommand()]);

    expect(state.phase).toBe('dead');
    expect(state.summary?.deathCause).toEqual({ kind: 'explosion', source: 'player' });
  });

  it('extracao nao tem causa de morte, mesmo tendo levado dano no caminho', () => {
    const state = createRun({ seed: 5 });
    const events: never[] = [];
    damageEntity(state, state.player, 10, events, { kind: 'fire' });
    state.phase = 'extracted_with_core';
    // buildSummary direto: alcancar a extracao de verdade exigiria dirigir uma
    // run inteira, e o que esta sob teste e a regra do campo, nao o trajeto.
    const summary = buildSummary(state, runEndingCauseForTest(state));
    expect(summary.deathCause).toBeNull();
    expect(summary.stars).toBeGreaterThanOrEqual(2);
  });
});

describe('sumario da run', () => {
  it('e congelado uma vez e nao muda depois', () => {
    const state = killWith({ kind: 'fire' });
    const first = state.summary;
    expect(first).not.toBeNull();
    for (let i = 0; i < 20; i++) stepRun(state, idle());
    // Mesma REFERENCIA: reconstruir daria numeros mudando enquanto o jogador le.
    expect(state.summary).toBe(first);
  });

  it('carrega a seed, para a run poder ser compartilhada e repetida', () => {
    const state = killWith({ kind: 'fire' }, 4242);
    expect(state.summary?.seed).toBe(4242);
  });

  it('conta os tiros disparados', () => {
    const state = createRun({ seed: 9 });
    const cmd = { ...emptyCommand(), fire: true };
    for (let i = 0; i < 40; i++) stepRun(state, [cmd]);
    expect(state.stats.shotsFired).toBeGreaterThan(0);
    // Cadencia de 5 ticks: 40 ticks nao podem produzir 40 tiros.
    expect(state.stats.shotsFired).toBeLessThanOrEqual(9);
  });

  it('acumula dano recebido em decimos inteiros', () => {
    const state = createRun({ seed: 13 });
    const events: never[] = [];
    // 2,2 e o dano de fogo por tick: em float puro, somar dez vezes nao da 22.
    for (let i = 0; i < 10; i++) {
      state.playerExtras[0].iframesUntil = 0;
      damageEntity(state, state.player, 2.2, events, { kind: 'fire' });
    }
    expect(state.stats.damageTakenTenths).toBe(220);
    expect(Number.isInteger(state.stats.damageTakenTenths)).toBe(true);
  });

  // Contar tudo que nao veio de inimigo inflava o numero em silencio: fogo
  // ambiente consumindo um bicho num canto do mapa somaria como feito do jogador.
  it('so credita dano atribuivel ao jogador', () => {
    const state = createRun({ seed: 17 });
    const events: never[] = [];
    const enemy = state.enemies[0];

    damageEntity(state, enemy, 5, events, { kind: 'fire' });
    expect(state.stats.damageDealtTenths).toBe(0);

    damageEntity(state, enemy, 5, events, { kind: 'explosion', source: 'enemy' });
    expect(state.stats.damageDealtTenths).toBe(0);

    damageEntity(state, enemy, 5, events, { kind: 'player_shot' });
    expect(state.stats.damageDealtTenths).toBe(50);

    damageEntity(state, enemy, 5, events, { kind: 'explosion', source: 'player' });
    expect(state.stats.damageDealtTenths).toBe(100);
  });

  it('nao credita o excedente do golpe fatal', () => {
    const state = createRun({ seed: 19 });
    const events: never[] = [];
    const enemy = state.enemies[0];
    enemy.hp = 3;
    damageEntity(state, enemy, 40, events, { kind: 'player_shot' });
    expect(state.stats.damageDealtTenths).toBe(30); // 3 de vida, nao 40 de golpe
  });

  it('registra o abate por arquetipo', () => {
    const state = createRun({ seed: 23 });
    const events: never[] = [];
    const enemy = state.enemies.find((e) => e.archetype === 'stalker');
    expect(enemy).toBeDefined();
    damageEntity(state, enemy!, 9999, events, { kind: 'player_shot' });
    expect(state.stats.kills.stalker).toBe(1);
  });
});

describe('determinismo com os contadores', () => {
  // Contadores entram no hash porque o leaderboard verifica runs re-simulando o
  // log de comandos. Fora do hash, um resultado com os mesmos movimentos e
  // contagens diferentes passaria pela verificacao.
  it('mesma seed e mesmos comandos produzem o mesmo hash', () => {
    const play = (): string => {
      const state = createRun({ seed: 31337 });
      for (let i = 0; i < 120; i++) {
        stepRun(state, [{ ...emptyCommand(), fire: i % 3 === 0, move: { x: 1, y: 0 } }]);
      }
      return hashAuthoritativeState(state);
    };
    expect(play()).toBe(play());
  });

  it('um contador diferente muda o hash', () => {
    const state = createRun({ seed: 555 });
    const before = hashAuthoritativeState(state);
    state.stats.shotsFired += 1;
    expect(hashAuthoritativeState(state)).not.toBe(before);
  });

  // Object.keys funcionaria por acidente e quebraria em silencio se alguem
  // reordenasse o literal de emptyStats.
  it('a ordem dos arquetipos no hash nao depende da ordem de insercao', () => {
    const a = createRun({ seed: 777 });
    const b = createRun({ seed: 777 });
    b.stats.kills = { guardian: 0, bomber: 0, spitter: 0, bruiser: 0, stalker: 0 };
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
  });
});
