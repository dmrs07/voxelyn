import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { damageEntity, spawnEnemy } from '../src/entities';
import {
  MINER_CLEAVE_RADIUS,
  MINER_CLEAVE_WINDUP_TICKS,
  MINER_FEAR_HEAT,
  MINER_ORE_DROP,
  MINER_RAGE_HEAT,
  ORE_PER_MODULE,
  SOLID_NONE,
  SOLID_ORE,
  SURF_NONE,
} from '../src/constants';
import {
  MINER_MOOD_ENRAGED,
  MINER_MOOD_FLEEING,
  MINER_MOOD_PASSIVE,
  type SurvivalState,
} from '../src/types';

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

/** Um miner a `gap` tiles do jogador, numa arena limpa, com o calor dado. */
const encounter = (seed: number, heat: number, gap = 4) => {
  const state = createRun({ seed });
  clearArena(state, 16);
  // Remove o resto do bestiario: aqui so interessa o encontro.
  state.enemies.length = 0;
  const miner = spawnEnemy(state, 'miner', Math.floor(state.player.x) + gap, Math.floor(state.player.y), false);
  state.playerExtra.heat = heat;
  return { state, miner };
};

describe('Miner — a postura sai do CALOR, e nao de sorteio', () => {
  // O invariante que o sorteio violava: o jogador nunca leva dano sem sinal. Um
  // humano parado que as vezes ataca sem nada mudar no mundo e exatamente isso.
  it('arma fria: ele nao faz nada', () => {
    const { state, miner } = encounter(1, 0);
    const before = { x: miner.x, y: miner.y };
    stepIdle(state, 60);
    expect(miner.mood).toBe(MINER_MOOD_PASSIVE);
    expect(Math.hypot(miner.x - before.x, miner.y - before.y)).toBeLessThan(0.2);
    expect(state.player.hp).toBe(state.player.maxHp);
  });

  it('arma morna: ele foge', () => {
    const { state, miner } = encounter(2, MINER_FEAR_HEAT + 5);
    const before = Math.hypot(miner.x - state.player.x, miner.y - state.player.y);
    stepIdle(state, 40);
    expect(miner.mood).toBe(MINER_MOOD_FLEEING);
    expect(Math.hypot(miner.x - state.player.x, miner.y - state.player.y)).toBeGreaterThan(before + 2);
  });

  it('arma quente: ele ataca', () => {
    const { state, miner } = encounter(3, MINER_RAGE_HEAT + 5);
    stepIdle(state, 60);
    expect(miner.mood).toBe(MINER_MOOD_ENRAGED);
    expect(state.player.hp).toBeLessThan(state.player.maxHp);
  });

  // Se a postura seguisse o calor tick a tick, o miner oscilaria entre fugir e
  // atacar enquanto a arma esfria — um NPC epiletico em vez de uma reacao.
  it('a decisao CONGELA: esfriar depois nao acalma quem ja se enfureceu', () => {
    const { state, miner } = encounter(4, MINER_RAGE_HEAT + 5);
    stepIdle(state, 6);
    expect(miner.mood).toBe(MINER_MOOD_ENRAGED);
    state.playerExtra.heat = 0;
    stepIdle(state, 40);
    expect(miner.mood).toBe(MINER_MOOD_ENRAGED);
  });

  it('anuncia a decisao no barramento, uma vez so', () => {
    const { state, miner } = encounter(5, MINER_RAGE_HEAT + 5);
    let moods = 0;
    for (let t = 0; t < 60; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'miner_mood' && ev.entity === miner.id) moods++;
      }
    }
    expect(moods).toBe(1);
  });

  it('longe demais, ele nem levanta a cabeca', () => {
    const { state, miner } = encounter(6, MINER_RAGE_HEAT + 20, 14);
    stepIdle(state, 40);
    expect(miner.mood).toBe(MINER_MOOD_PASSIVE);
  });
});

describe('Miner — o que a morte dele rende', () => {
  it('passivo morto nao dropa nada, e fica anotado', () => {
    const { state, miner } = encounter(7, 0);
    damageEntity(state, miner, miner.maxHp, [], { kind: 'player_shot' });
    expect(state.stats.oreCollected).toBe(0);
    expect(state.stats.innocentsKilled).toBe(1);
  });

  // O drop existe para que a violencia CONTRA QUEM REAGIU tenha resultado. Sem
  // ele, matar todo mundo por precaucao seria a jogada otima e o encontro
  // inteiro desapareceria: por que arriscar chegar frio se a bala rende o mesmo?
  it('hostil morto dropa minerio e nao mancha nada', () => {
    const { state, miner } = encounter(8, MINER_RAGE_HEAT + 5);
    stepIdle(state, 10);
    expect(miner.mood).toBe(MINER_MOOD_ENRAGED);
    damageEntity(state, miner, miner.maxHp, [], { kind: 'player_shot' });
    expect(state.stats.oreCollected).toBe(MINER_ORE_DROP);
    expect(state.stats.innocentsKilled).toBe(0);
  });

  // O jogador tem de estar atras NO INSTANTE DO RELEASE, e nao antes.
  //
  // A primeira versao deste teste so reposicionava o jogador e deixava rodar — e
  // passava mesmo com o cleave frontal, porque o miner reaponta para o jogador a
  // cada tick fora de acao: "atras" virava "na frente" no tick seguinte. O que
  // separa circular de frontal e a direcao CONGELADA no windup, entao a troca de
  // lado tem de acontecer depois de a acao comecar.
  it('o cleave e circular: acerta quem esta atras dele tambem', () => {
    const { state, miner } = encounter(9, MINER_RAGE_HEAT + 5, 3);

    let swinging = false;
    for (let t = 0; t < 60 && !swinging; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === miner.id && ev.action === 'slam') swinging = true;
      }
    }
    expect(swinging, 'nunca golpeou').toBe(true);
    // A picareta ja esta levantada e a direcao dela nao muda mais. Passa para o
    // lado oposto ao que ele mirou, ainda dentro do raio.
    state.player.x = miner.x - miner.facing.x * (MINER_CLEAVE_RADIUS - 0.5);
    state.player.y = miner.y - miner.facing.y * (MINER_CLEAVE_RADIUS - 0.5);
    state.playerExtra.iframesUntil = 0;
    const hpBefore = state.player.hp;

    stepIdle(state, MINER_CLEAVE_WINDUP_TICKS + 4);
    expect(state.player.hp, 'o golpe passou por cima de quem estava atras').toBeLessThan(hpBefore);
  });
});

describe('cota de minerio', () => {
  it('lascar veio soma a cota e anuncia o total', () => {
    const state = createRun({ seed: 11 });
    clearArena(state, 10);
    const w = state.config.width;
    const target = Math.floor(state.player.y) * w + Math.floor(state.player.x) + 3;
    state.solid[target] = SOLID_ORE;
    expect(state.stats.oreCollected).toBe(0);

    // Atira ate lascar: dois estagios (ORE -> CHIPPED -> SPENT).
    let gained: number[] = [];
    for (let t = 0; t < 120 && gained.length < 2; t++) {
      const cmd = { ...emptyCommand(), aim: { x: 1, y: 0 }, fire: true };
      for (const ev of stepRun(state, [cmd]).events) {
        if (ev.t === 'ore_gained') gained.push(ev.total);
      }
    }
    expect(gained.length).toBeGreaterThan(0);
    expect(state.stats.oreCollected).toBe(gained[gained.length - 1]);
  });

  // A cota precisava de um BENEFICIO concreto, e nao de um numero bonito no fim.
  it('paga escolha de modulo ao cruzar o limiar', () => {
    const { state } = encounter(12, 0);
    expect(state.playerExtra.pendingModuleChoice).toBeNull();
    state.stats.oreCollected = ORE_PER_MODULE;
    stepIdle(state, 1);
    expect(state.playerExtra.pendingModuleChoice).not.toBeNull();
  });

  // Sem o contador de pagamentos, o limiar dispararia a cada tick enquanto o
  // jogador nao escolhesse, e um veio grande viraria modulo infinito.
  it('paga UMA vez por limiar, nao a cada tick', () => {
    const { state } = encounter(13, 0);
    state.stats.oreCollected = ORE_PER_MODULE;
    stepIdle(state, 1);
    expect(state.oreModulesPaid).toBe(1);
    stepIdle(state, 30);
    expect(state.oreModulesPaid).toBe(1);
    state.stats.oreCollected = ORE_PER_MODULE * 2;
    stepIdle(state, 1);
    expect(state.oreModulesPaid).toBe(2);
  });
});

describe('onde os mineradores nascem', () => {
  it('nascem em chao livre, colados a um veio, e sao reproduziveis pela seed', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const state = createRun({ seed, sector: 1 });
      const w = state.config.width;
      const miners = state.enemies.filter((e) => e.archetype === 'miner');
      for (const m of miners) {
        const mx = Math.floor(m.x);
        const my = Math.floor(m.y);
        expect(state.solid[my * w + mx], `seed ${seed}: nasceu dentro de solido`).toBe(SOLID_NONE);
        const nextToOre = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(
          ([dx, dy]) => state.solid[(my + dy) * w + (mx + dx)] === SOLID_ORE,
        );
        expect(nextToOre, `seed ${seed}: nasceu longe de minerio`).toBe(true);
      }
      const again = createRun({ seed, sector: 1 });
      expect(again.enemies.map((e) => `${e.archetype}@${e.x},${e.y}`)).toEqual(
        state.enemies.map((e) => `${e.archetype}@${e.x},${e.y}`),
      );
    }
  });
});
