// Regressoes vindas da revisao automatica das PRs 30, 56, 63 e 67.
//
// Cada bloco aqui existe porque um comportamento errado passou por todos os
// outros testes: eles cobriam o resultado final ("o cavalo investe", "o miner
// paga cota") e nao o instante em que a coisa acontece, que era exatamente onde
// o erro morava. Os nomes descrevem o INSTANTE de proposito.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { damageEntity, spawnEnemy } from '../src/entities';
import {
  HORSE_TRAIL_DELAY_TICKS,
  HORSE_TURN_RATE,
  MAX_ENEMIES,
  DEFAULT_SECTOR_COUNT,
  SOLID_NONE,
  SURF_FIRE,
  SURF_NONE,
} from '../src/constants';
import { MINER_MOOD_ENRAGED, MINER_MOOD_PASSIVE, type SurvivalState } from '../src/types';

const stepIdle = (state: SurvivalState, ticks: number): void => {
  for (let t = 0; t < ticks; t++) stepRun(state, [emptyCommand()]);
};

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

describe('investida do Guardian — o impulso anda no release', () => {
  // O telegrafo prometia a investida e o corpo so saia do lugar oito ticks
  // depois, porque `advanceAction` devolvia `true` durante toda a recuperacao e
  // o `continue` pulava o unico bloco que consumia `vx/vy`. Quem esquivava no
  // tempo certo era acertado assim mesmo; quem esperava o golpe passar levava
  // dano de um corpo que ainda nem tinha saido.
  it('o Guardian sai do lugar no tick do release, e nao no fim da recuperacao', () => {
    const state = createRun({ seed: 71, sector: DEFAULT_SECTOR_COUNT });
    clearArena(state, 20);
    state.enemies.length = 0;
    const guardian = spawnEnemy(
      state,
      'guardian',
      Math.floor(state.player.x) + 7,
      Math.floor(state.player.y),
      false,
    );
    // O Guardian so entra no fluxo de IA depois de acordar; aqui interessa a
    // investida dele, e nao o gatilho que a antecede.
    state.bossRuntime.awake = true;

    let released = false;
    let posAtRelease = { x: guardian.x, y: guardian.y };
    for (let t = 0; t < 200 && !released; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === guardian.id && ev.action === 'charge') {
          // Roda ate o release e mede a partir de la.
          const windup = ev.releaseTick - ev.startTick;
          stepIdle(state, windup);
          posAtRelease = { x: guardian.x, y: guardian.y };
          released = true;
          break;
        }
      }
    }
    expect(released, 'o Guardian nunca investiu').toBe(true);

    // UM tick depois do release ja tem de haver deslocamento. Com o impulso
    // preso, este numero era exatamente zero.
    stepIdle(state, 1);
    const movedInOneTick = Math.hypot(guardian.x - posAtRelease.x, guardian.y - posAtRelease.y);
    expect(movedInOneTick).toBeGreaterThan(0.05);
  });
});

describe('rastro do Cavalo — nao acende atras da origem', () => {
  // Subtrair a distancia cheia do atraso supoe que ela ja foi percorrida. Nas
  // primeiras passadas ela nao foi, entao a conta mirava chao do outro lado do
  // ponto de partida — fogo em celulas que o cavalo nunca pisou.
  it('nenhuma celula queimada fica atras de onde a investida comecou', () => {
    const state = createRun({ seed: 72 });
    clearArena(state, 24);
    state.enemies.length = 0;
    const w = state.config.width;
    const horse = spawnEnemy(
      state,
      'fungal_horse',
      Math.floor(state.player.x) + 10,
      Math.floor(state.player.y),
      false,
    );

    let origin: { x: number; y: number } | null = null;
    let dir: { x: number; y: number } | null = null;
    for (let t = 0; t < 120 && !origin; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === horse.id && ev.action === 'charge') {
          stepIdle(state, ev.releaseTick - ev.startTick);
          origin = { x: horse.x, y: horse.y };
          dir = { ...horse.facing };
          break;
        }
      }
    }
    expect(origin, 'o Cavalo nunca investiu').not.toBeNull();
    if (!origin || !dir) return;

    // Zera o fogo herdado do mundo: aqui so interessa o que a investida acende.
    for (let y = 1; y < state.config.height - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (state.surface[y * w + x] === SURF_FIRE) state.surface[y * w + x] = SURF_NONE;
      }
    }

    stepIdle(state, HORSE_TRAIL_DELAY_TICKS * 4);

    // Projeta cada celula em chamas no eixo da investida. Tudo o que o rastro
    // acende esta ATRAS do cavalo mas A FRENTE da origem — projecao negativa
    // significa fogo antes do ponto de partida, que e o bug.
    let worst = 0;
    for (let y = 1; y < state.config.height - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (state.surface[y * w + x] !== SURF_FIRE) continue;
        const along = (x + 0.5 - origin.x) * dir.x + (y + 0.5 - origin.y) * dir.y;
        worst = Math.min(worst, along);
      }
    }
    // Meia celula de folga: o rastro e arredondado para a celula, e a celula que
    // contem a propria origem projeta um pouco negativo por construcao.
    expect(worst).toBeGreaterThan(-1);
  });
});

describe('Cavalo em perseguicao — a curva acumula', () => {
  // O rumo do cavalo e um acumulador: a curva soma um passo por tick em cima de
  // `facing`. Enquanto sobrava velocidade de perambular, o bloco de movimento por
  // velocidade reescrevia `facing` todo tick e jogava o acumulador de volta ao
  // ponto de partida — o cavalo repetia o primeiro passo de curva para sempre.
  it('fecha a curva mesmo com velocidade residual no corpo', () => {
    const state = createRun({ seed: 73 });
    clearArena(state, 24);
    state.enemies.length = 0;
    const horse = spawnEnemy(
      state,
      'fungal_horse',
      Math.floor(state.player.x) + 6,
      Math.floor(state.player.y),
      false,
    );

    // A investida congela a direcao de proposito; aqui interessa a curva de
    // perseguicao, entao ela fica fora de alcance pelo tempo do teste.
    horse.rangedReadyAt = state.tick + 10_000;

    const angleTo = (v: { x: number; y: number }): number => Math.atan2(v.y, v.x);
    const errorNow = (): number => {
      const target = angleTo({ x: state.player.x - horse.x, y: state.player.y - horse.y });
      let d = angleTo(horse.facing) - target;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return Math.abs(d);
    };

    const TICKS = 5;
    // Aponta o cavalo para longe do jogador e injeta velocidade residual naquela
    // mesma direcao — que e o cenario do empurrao ou do fim de um perambular. A
    // residual decai 18% por tick, entao ela cobre a janela inteira do teste.
    horse.facing = { x: 0, y: 1 };
    horse.vx = 0;
    horse.vy = 2.4;
    const before = errorNow();
    stepIdle(state, TICKS);
    const closed = before - errorNow();

    // O ponto NAO e que a curva ande — e que ela ACUMULE. Com o rumo reescrito
    // pela velocidade a cada tick, o cavalo refazia eternamente o mesmo primeiro
    // passo e fechava exatamente `HORSE_TURN_RATE`, quantos ticks se desse a ele.
    expect(closed).toBeGreaterThan(HORSE_TURN_RATE * 2);
  });
});

describe('mineradores — uma celula, um corpo', () => {
  // Duas janelas de busca vizinhas achavam o mesmo veio e, varrendo na mesma
  // ordem fixa, escolhiam a mesma celula ao lado dele. Empilhados, os dois
  // desenhavam e andavam como um so.
  it('nenhum setor gerado empilha dois mineradores na mesma celula', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (let sector = 1; sector <= DEFAULT_SECTOR_COUNT; sector++) {
        const state = createRun({ seed, sector });
        const cells = new Map<string, number>();
        for (const enemy of state.enemies) {
          if (enemy.archetype !== 'miner') continue;
          const key = `${enemy.x},${enemy.y}`;
          cells.set(key, (cells.get(key) ?? 0) + 1);
        }
        for (const [key, count] of cells) {
          expect(count, `seed ${seed} setor ${sector}: ${count} mineradores em ${key}`).toBe(1);
        }
      }
    }
  });

  it('continua respeitando o teto global de inimigos', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = createRun({ seed, sector: 1 });
      expect(state.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
    }
  });
});

describe('morte de minerador — so conta com autoria do jogador', () => {
  const loneMiner = (seed: number, heat: number) => {
    const state = createRun({ seed });
    clearArena(state, 16);
    state.enemies.length = 0;
    const miner = spawnEnemy(
      state,
      'miner',
      Math.floor(state.player.x) + 4,
      Math.floor(state.player.y),
      false,
    );
    state.playerExtra.heat = heat;
    stepIdle(state, 2); // deixa o humor assentar a partir do calor
    return { state, miner };
  };

  it('fogo ambiente matando um passivo NAO anota civil abatido', () => {
    const { state, miner } = loneMiner(81, 0);
    expect(miner.mood).toBe(MINER_MOOD_PASSIVE);
    expect(state.stats.innocentsKilled).toBe(0);
    damageEntity(state, miner, miner.hp, [], { kind: 'fire' });
    expect(miner.alive).toBe(false);
    expect(state.stats.innocentsKilled).toBe(0);
  });

  it('explosao de bomber inimigo matando um passivo NAO anota civil abatido', () => {
    const { state, miner } = loneMiner(82, 0);
    expect(miner.mood).toBe(MINER_MOOD_PASSIVE);
    damageEntity(state, miner, miner.hp, [], { kind: 'explosion', source: 'enemy' });
    expect(state.stats.innocentsKilled).toBe(0);
  });

  it('o tiro do jogador continua anotando o civil', () => {
    const { state, miner } = loneMiner(83, 0);
    expect(miner.mood).toBe(MINER_MOOD_PASSIVE);
    damageEntity(state, miner, miner.hp, [], { kind: 'player_shot' });
    expect(state.stats.innocentsKilled).toBe(1);
  });

  it('minerador hostil consumido pelo ambiente NAO paga minerio', () => {
    const { state, miner } = loneMiner(84, 100);
    expect(miner.mood).not.toBe(MINER_MOOD_PASSIVE);
    const before = state.stats.oreCollected;
    damageEntity(state, miner, miner.hp, [], { kind: 'fire' });
    expect(miner.alive).toBe(false);
    expect(state.stats.oreCollected).toBe(before);
  });

  it('minerador hostil morto pelo jogador continua pagando minerio', () => {
    const { state, miner } = loneMiner(85, 100);
    miner.mood = MINER_MOOD_ENRAGED;
    const before = state.stats.oreCollected;
    damageEntity(state, miner, miner.hp, [], { kind: 'player_shot' });
    expect(state.stats.oreCollected).toBeGreaterThan(before);
  });
});
