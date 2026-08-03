// O tuning atravessa a fronteira da simulacao — e o default nao muda NADA.
//
// O teste mais importante deste arquivo e o primeiro: uma run sem configuracao
// tem de continuar sendo, byte a byte, a run que sempre foi. Todo replay antigo
// e todo contrato ranqueado dependem disso.

import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { damageEntity, spawnEnemy, stunEntity } from '../src/entities';
import { DEFAULT_PLAYER_TUNING, derivePlayerTuning, type PlayerTuning } from '../src/progression';
import {
  DODGE_COOLDOWN_TICKS,
  DODGE_IFRAME_TICKS,
  HEAT_MAX,
  PLAYER_HP,
  SOLID_NONE,
  SURF_FIRE,
  SURF_NONE,
} from '../src/constants';
import type { PlayerCommand, SurvivalState } from '../src/types';

const SEED = 0x5eed_1234 >>> 0;

/** Uma sequencia de comandos identica para qualquer run. */
const scriptedCommands = (ticks: number): PlayerCommand[] =>
  Array.from({ length: ticks }, (_, t) => ({
    ...emptyCommand(),
    move: { x: Math.sin(t / 17), y: Math.cos(t / 23) },
    aim: { x: Math.cos(t / 7), y: Math.sin(t / 5) },
    fire: t % 5 === 0,
    dodge: t % 61 === 0,
  }));

const play = (tuning: PlayerTuning | undefined, ticks: number): SurvivalState => {
  const state = createRun({ seed: SEED, playerCount: 1, tuning });
  for (const cmd of scriptedCommands(ticks)) {
    if (state.phase !== 'running') break;
    stepRun(state, [cmd]);
  }
  return state;
};

/** Arena limpa em volta do jogador, para isolar o efeito medido. */
const clearArena = (state: SurvivalState, radius: number): void => {
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - radius; y <= py + radius; y++) {
    for (let x = px - radius; x <= px + radius; x++) {
      if (x < 1 || y < 1 || x >= state.config.width - 1 || y >= state.config.height - 1) continue;
      const i = y * state.config.width + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_NONE;
    }
  }
  state.enemies.length = 0;
};

describe('o Prospector de fabrica continua sendo o mesmo', () => {
  it('run sem tuning e run com o default produzem o MESMO hash', () => {
    const implicit = play(undefined, 400);
    const explicit = play(DEFAULT_PLAYER_TUNING, 400);
    expect(hashAuthoritativeState(explicit)).toBe(hashAuthoritativeState(implicit));
  });

  it('a arvore vazia tambem', () => {
    const empty = play(derivePlayerTuning([]), 400);
    expect(hashAuthoritativeState(empty)).toBe(hashAuthoritativeState(play(undefined, 400)));
  });

  it('o estado inicial le as mesmas constantes de sempre', () => {
    const state = createRun({ seed: SEED });
    expect(state.player.maxHp).toBe(PLAYER_HP);
    expect(state.playerExtra.purgeCells).toBe(1);
    expect(state.config.tuning).toEqual(DEFAULT_PLAYER_TUNING);
  });
});

describe('determinismo com tuning', () => {
  it('mesma seed, mesmos comandos e mesmo tuning ⇒ mesmo hash', () => {
    const tuning = derivePlayerTuning(['CA-01', 'CA-02', 'RX-01']);
    expect(hashAuthoritativeState(play(tuning, 300))).toBe(
      hashAuthoritativeState(play(tuning, 300)),
    );
  });

  // Sem isto, uma expedicao com +12% de vida verificaria contra o replay de uma
  // run de fabrica: o leaderboard confere re-simulando o log de comandos.
  it('tuning diferente ⇒ hash diferente, mesmo com comandos identicos', () => {
    const factory = hashAuthoritativeState(play(undefined, 300));
    for (const ids of [['CA-01'], ['MV-01'], ['RX-02'], ['CA-01', 'CA-02', 'CA-03']]) {
      expect(hashAuthoritativeState(play(derivePlayerTuning(ids), 300))).not.toBe(factory);
    }
  });

  // Levantamento e apresentacao pura. Se um dia um no dessa ramificacao passar a
  // mexer na simulacao, este teste falha — e a decisao volta a ser consciente.
  it('a ramificacao de Levantamento NAO altera a simulacao', () => {
    const survey = derivePlayerTuning(['SV-01', 'SV-02', 'SV-03', 'SV-04', 'SV-05', 'SV-X']);
    expect(hashAuthoritativeState(play(survey, 300))).toBe(
      hashAuthoritativeState(play(undefined, 300)),
    );
  });
});

describe('cada protocolo faz o que promete, dentro da run', () => {
  it('CA-01/03/05 sobem a vida inicial e o teto', () => {
    const state = createRun({ seed: SEED, tuning: derivePlayerTuning(['CA-01', 'CA-03', 'CA-05']) });
    expect(state.player.maxHp).toBe(PLAYER_HP + 12);
    expect(state.player.hp).toBe(PLAYER_HP + 12);
  });

  it('CA-X comeca com uma purga a mais', () => {
    const withCapstone = createRun({
      seed: SEED,
      tuning: derivePlayerTuning(['CA-01', 'CA-02', 'CA-03', 'CA-04', 'CA-05', 'CA-X']),
    });
    expect(withCapstone.playerExtra.purgeCells).toBe(2);
  });

  it('CA-02 encurta o stun DO JOGADOR e nao o do inimigo', () => {
    const state = createRun({ seed: SEED, tuning: derivePlayerTuning(['CA-01', 'CA-02']) });
    clearArena(state, 8);
    stunEntity(state, state.player, 20);
    expect(state.player.stunnedUntil - state.tick).toBe(18);

    const enemy = spawnEnemy(state, 'stalker', state.player.x + 3, state.player.y);
    stunEntity(state, enemy, 20);
    expect(enemy.stunnedUntil - state.tick).toBe(20);
  });

  it('CA-04 reduz dano ambiental e NAO reduz ataque de inimigo', () => {
    const ids = ['CA-01', 'CA-02', 'CA-03', 'CA-04'];
    const sealed = createRun({ seed: SEED, tuning: derivePlayerTuning(ids) });
    const plain = createRun({ seed: SEED });
    for (const state of [sealed, plain]) clearArena(state, 8);

    const burn = (state: SurvivalState): number => {
      const before = state.player.hp;
      damageEntity(state, state.player, 10, [], { kind: 'fire' });
      return before - state.player.hp;
    };
    expect(burn(sealed)).toBeCloseTo(9.2, 5);
    expect(burn(plain)).toBeCloseTo(10, 5);

    const hit = (state: SurvivalState): number => {
      state.playerExtra.iframesUntil = 0;
      const before = state.player.hp;
      damageEntity(state, state.player, 10, [], {
        kind: 'enemy_contact',
        archetype: 'stalker',
        elite: false,
      });
      return before - state.player.hp;
    };
    // A pedra do Britador nao vira ambiente por ter caido do teto.
    expect(hit(sealed)).toBeCloseTo(10, 5);
    expect(hit(plain)).toBeCloseTo(10, 5);
  });

  it('MV-02 e MV-X mexem no cooldown e no iframe da esquiva', () => {
    const all = ['MV-01', 'MV-02', 'MV-03', 'MV-04', 'MV-05', 'MV-X'];
    const state = createRun({ seed: SEED, tuning: derivePlayerTuning(all) });
    clearArena(state, 10);
    stepRun(state, [{ ...emptyCommand(), dodge: true, move: { x: 1, y: 0 } }]);
    expect(state.playerExtra.dodgeCooldownUntil - state.tick).toBe(DODGE_COOLDOWN_TICKS - 1);
    expect(state.playerExtra.iframesUntil - state.tick).toBe(DODGE_IFRAME_TICKS + 1);
  });

  it('RX-02 sobe o teto de calor: o mesmo disparo nao superaquece mais', () => {
    const hot = createRun({ seed: SEED, tuning: derivePlayerTuning(['RX-01', 'RX-02']) });
    expect(hot.config.tuning.heatMax).toBe(105);
    expect(DEFAULT_PLAYER_TUNING.heatMax).toBe(HEAT_MAX);
  });

  it('RX-X sobe o dano do bolt e nao o dano ambiental', () => {
    const ids = ['RX-01', 'RX-02', 'RX-03', 'RX-04', 'RX-05', 'RX-X'];
    const armed = createRun({ seed: SEED, tuning: derivePlayerTuning(ids) });
    const plain = createRun({ seed: SEED });
    for (const state of [armed, plain]) clearArena(state, 10);

    const boltDamage = (state: SurvivalState): number => {
      for (let t = 0; t < 20 && state.projectiles.length === 0; t++) {
        stepRun(state, [{ ...emptyCommand(), aim: { x: 1, y: 0 }, fire: true }]);
      }
      const proj = state.projectiles.find((p) => !p.hostile);
      expect(proj).toBeDefined();
      return proj?.damage ?? 0;
    };
    expect(boltDamage(armed) / boltDamage(plain)).toBeCloseTo(1.04, 5);

    // O fogo do mundo continua valendo o que valia: `playerDamageScale` so toca
    // no que o Prospector emite.
    const burnEnemy = (state: SurvivalState): number => {
      const enemy = spawnEnemy(state, 'stalker', state.player.x + 4, state.player.y);
      const before = enemy.hp;
      state.surface[Math.floor(enemy.y) * state.config.width + Math.floor(enemy.x)] = SURF_FIRE;
      damageEntity(state, enemy, 5, [], { kind: 'fire' });
      return before - enemy.hp;
    };
    expect(burnEnemy(armed)).toBeCloseTo(burnEnemy(plain), 5);
  });

  it('RX-04 acelera o projetil do Prospector', () => {
    const ids = ['RX-01', 'RX-02', 'RX-03', 'RX-04'];
    const fast = createRun({ seed: SEED, tuning: derivePlayerTuning(ids) });
    const plain = createRun({ seed: SEED });
    for (const state of [fast, plain]) clearArena(state, 10);
    const speed = (state: SurvivalState): number => {
      for (let t = 0; t < 20 && state.projectiles.length === 0; t++) {
        stepRun(state, [{ ...emptyCommand(), aim: { x: 1, y: 0 }, fire: true }]);
      }
      const proj = state.projectiles.find((p) => !p.hostile);
      return Math.hypot(proj?.vx ?? 0, proj?.vy ?? 0);
    };
    expect(speed(fast) / speed(plain)).toBeCloseTo(1.06, 3);
  });

  it('RX-05 encurta o lock de overheat e reduz o dano dele', () => {
    const ids = ['RX-01', 'RX-02', 'RX-03', 'RX-04', 'RX-05'];
    const governed = createRun({ seed: SEED, tuning: derivePlayerTuning(ids) });
    expect(DEFAULT_PLAYER_TUNING.overheatLockTicks - governed.config.tuning.overheatLockTicks).toBe(
      4,
    );
    expect(
      DEFAULT_PLAYER_TUNING.overheatSelfDamage - governed.config.tuning.overheatSelfDamage,
    ).toBe(1);
    // O overheat continua existindo: a arvore da margem, nao imunidade.
    expect(governed.config.tuning.overheatLockTicks).toBeGreaterThan(0);
    expect(governed.config.tuning.overheatSelfDamage).toBeGreaterThan(0);
  });
});
