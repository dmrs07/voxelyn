import { describe, expect, it } from 'vitest';
import {
  COOP_BOSS_HP_PER_EXTRA,
  COOP_HP_PER_EXTRA,
  MAX_ENEMIES,
  coopElites,
  coopPack,
  createRun,
  emptyCommand,
  hashAuthoritativeState,
  isCoop,
  partySize,
  stepRun,
} from '../src/index.js';
import { ARCHETYPES, circleBlocked } from '../src/entities';
import { isBossArchetype } from '../src/bosses';
import type { EnemyArchetype, SurvivalState } from '../src/index.js';

const live = (state: SurvivalState): number => state.enemies.filter((e) => e.alive).length;

/** Vida de tabela do arquetipo, sem elite e sem co-op. */
const tableHp = (archetype: EnemyArchetype): number => ARCHETYPES[archetype].hp;

/** Quantos corpos ocupam a MESMA celula (empilhamento = um sprite, duas hitboxes). */
const stacked = (state: SurvivalState): number => {
  const seen = new Set<number>();
  let dup = 0;
  for (const e of state.enemies) {
    const cell = Math.floor(e.y) * state.config.width + Math.floor(e.x);
    if (seen.has(cell)) dup++;
    seen.add(cell);
  }
  return dup;
};

/** Sobe a contaminacao ate o primeiro degrau e conta quantos corpos a leva trouxe. */
const contaminationWave = (state: SurvivalState): number => {
  state.enemies = [];
  state.contamination = 0.4;
  const cmds = state.players.map(() => emptyCommand());
  stepRun(state, cmds);
  return state.enemies.length;
};

describe('escala de co-op: o encontro cobra pelo time', () => {
  it('o time e quem ESTA em jogo, e nao quantos assentos a sala tem', () => {
    const solo = createRun({ seed: 1, playerCount: 1 });
    expect(partySize(solo)).toBe(1);
    expect(isCoop(solo)).toBe(false);

    const duo = createRun({ seed: 1, playerCount: 2 });
    expect(partySize(duo)).toBe(2);
    expect(isCoop(duo)).toBe(true);

    // Sala de dois com o parceiro ainda fora: quem esta la dentro joga a run de
    // um. E o caso REAL do servidor, que cria a sala com os dois assentos antes
    // de qualquer cliente reivindicar um deles.
    duo.playerExtras[1].joined = false;
    expect(partySize(duo)).toBe(1);
    expect(isCoop(duo)).toBe(false);
  });

  it('solo continua sendo solo: vida de tabela, um elite, mesma densidade', () => {
    const state = createRun({ seed: 42, playerCount: 1 });
    for (const enemy of state.enemies) {
      const base = tableHp(enemy.archetype as EnemyArchetype);
      expect(enemy.maxHp).toBe(enemy.elite ? Math.floor(base * 2.2) : base);
    }
    expect(state.enemies.filter((e) => e.elite).length).toBeLessThanOrEqual(1);
    expect(coopElites(state)).toBe(1);
    expect(coopPack(state, 3)).toBe(3);
  });

  it('em dupla, o bestiario comum nasce com mais vida (e o chefe com mais ainda)', () => {
    const solo = createRun({ seed: 3, playerCount: 1, sector: 3 });
    const duo = createRun({ seed: 3, playerCount: 2, sector: 3 });

    for (const enemy of duo.enemies) {
      const archetype = enemy.archetype as EnemyArchetype;
      const perExtra = isBossArchetype(archetype) ? COOP_BOSS_HP_PER_EXTRA : COOP_HP_PER_EXTRA;
      const base = enemy.elite ? Math.floor(tableHp(archetype) * 2.2) : tableHp(archetype);
      expect(enemy.maxHp).toBe(Math.round(base * (1 + perExtra)));
      expect(enemy.hp).toBe(enemy.maxHp);
    }

    const bossOf = (s: SurvivalState) =>
      s.enemies.find((e) => isBossArchetype(e.archetype as EnemyArchetype));
    const soloBoss = bossOf(solo);
    const duoBoss = bossOf(duo);
    expect(soloBoss).toBeDefined();
    expect(duoBoss?.archetype).toBe(soloBoss?.archetype);
    // O chefe engorda MAIS que a fauna: e o unico alvo em que os dois canos
    // convergem o tempo inteiro.
    expect(duoBoss!.maxHp / soloBoss!.maxHp).toBeCloseTo(1 + COOP_BOSS_HP_PER_EXTRA, 2);
    expect(COOP_BOSS_HP_PER_EXTRA).toBeGreaterThan(COOP_HP_PER_EXTRA);
  });

  it('em dupla, o setor recebe mais corpos e mais de um elite', () => {
    for (const seed of [1, 42, 777]) {
      const solo = createRun({ seed, playerCount: 1 });
      const duo = createRun({ seed, playerCount: 2 });
      expect(live(duo)).toBeGreaterThan(live(solo));
      // Densidade, e nao enxame: 1,45x por jogador extra.
      expect(live(duo)).toBeLessThan(live(solo) * 2);
      expect(coopElites(duo)).toBe(2);
      // O Cavalo Fungico OCUPA a vaga do primeiro elite, entao a contagem de
      // elites vivos e "um por jogador" menos o que o cavalo tomou.
      const horses = duo.enemies.filter((e) => e.archetype === 'fungal_horse').length;
      expect(duo.enemies.filter((e) => e.elite).length).toBe(2 - Math.min(1, horses));
    }
  });

  it('os corpos extras nascem em chao livre, sem empilhar e longe da entrada', () => {
    // Comparativo com o solo de proposito, e nao um zero absoluto: a povoacao
    // de um jogador ja empilha Costureiros quando o bioma sorteia mais deles
    // que suturas soltas, e dois pontos do worldgen em cem nascem apertados
    // demais para um corpo de raio 0,5. Nenhum dos dois e desta escala — o que
    // ela nao pode fazer e PIORAR a conta ao encher o setor.
    for (const seed of [1, 9, 42, 55, 777]) {
      for (const sector of [1, 2, 3]) {
        const solo = createRun({ seed, playerCount: 1, sector });
        const duo = createRun({ seed, playerCount: 2, sector });
        expect(duo.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
        expect(stacked(duo), `seed ${seed} setor ${sector}`).toBeLessThanOrEqual(stacked(solo));
        for (const enemy of duo.enemies) {
          // Ninguem nasce em cima do time no primeiro tick.
          expect(Math.hypot(enemy.x - duo.entry.x, enemy.y - duo.entry.y)).toBeGreaterThan(5);
        }
      }
    }
  });

  it('toda vaga DERIVADA cabe: o corpo extra nunca nasce dentro da pedra', () => {
    // As vagas do worldgen sao as mesmas do solo (e carregam os defeitos do
    // solo); as derivadas passam pelo `circleBlocked` do movimento, entao um
    // setor de dupla nunca pode ter mais corpos presos que o de um jogador.
    for (const seed of [1, 9, 42, 55, 777]) {
      for (const sector of [1, 2, 3]) {
        const solo = createRun({ seed, playerCount: 1, sector });
        const duo = createRun({ seed, playerCount: 2, sector });
        const stuck = (s: SurvivalState): number =>
          s.enemies.filter((e) => circleBlocked(s, e.x, e.y, e.radius)).length;
        expect(stuck(duo) - stuck(solo), `seed ${seed} setor ${sector}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a leva de contaminacao cresce com o time', () => {
    const solo = contaminationWave(createRun({ seed: 33, playerCount: 1 }));
    const duo = contaminationWave(createRun({ seed: 33, playerCount: 2 }));
    expect(solo).toBe(2); // primeiro degrau de CONTAMINATION_WAVES
    expect(duo).toBe(coopPack(createRun({ seed: 33, playerCount: 2 }), 2));
    expect(duo).toBeGreaterThan(solo);
  });

  it('o alarme do terminal cresce com o time, e o anel comporta a leva', () => {
    const alarm = (playerCount: 1 | 2): number => {
      const state = createRun({ seed: 21, playerCount });
      const site = state.salvageSites.find((s) => s.tier === 3) ?? state.salvageSites[0];
      state.enemies = [];
      state.players[0].x = site.terminal.x + 0.5;
      state.players[0].y = site.terminal.y + 0.5;
      const cmd = emptyCommand();
      cmd.interact = true;
      stepRun(state, [cmd, ...state.players.slice(1).map(() => emptyCommand())]);
      expect(site.terminalState).toBe('scanning');
      return state.enemies.length;
    };
    const solo = alarm(1);
    const duo = alarm(2);
    expect(duo).toBeGreaterThan(solo);
  });

  it('a sala de um assento ocupado joga a run de um, inclusive nas levas', () => {
    const waiting = createRun({ seed: 33, playerCount: 2 });
    waiting.playerExtras[1].joined = false;
    expect(contaminationWave(waiting)).toBe(2);
  });

  it('determinismo co-op sobrevive a escala: mesma seed, mesmo hash', () => {
    const drive = (state: SurvivalState): string => {
      for (let t = 0; t < 260; t++) {
        const cmds = state.players.map((_, slot) => {
          const c = emptyCommand();
          c.move = slot === 0 ? { x: 1, y: 0 } : { x: 0, y: 1 };
          c.fire = t % 3 === 0;
          return c;
        });
        stepRun(state, cmds);
      }
      return hashAuthoritativeState(state);
    };
    expect(drive(createRun({ seed: 4242, playerCount: 2 }))).toBe(
      drive(createRun({ seed: 4242, playerCount: 2 })),
    );
  });
});
