// O SOPRO TERMICO, medido contra o que ele CUSTA.
//
// O custo da habilidade nao e o cooldown: o canal BLOQUEIA o disparo comum (ver
// `!channeling` em `stepPlayer`), entao usar o sopro e abrir mao de 2,5 s de
// parafuso. Qualquer ajuste de dano que ignore isso esta ajustando metade da
// conta — foi assim que a versao anterior chegou a 30 de dano por canal contra
// 140 de parafuso no mesmo tempo, uma decisao de MENOS 110.
//
// A regra que estes testes trancam esta escrita em constants.ts, no bloco das
// habilidades: nenhuma pode ser melhor que o tiro comum em DPS sustentado; elas
// resolvem SITUACOES. Traduzido em numeros: perde num alvo, ganha num grupo.
import { describe, expect, it } from 'vitest';
import {
  FLAMETHROWER_CHANNEL_TICKS,
  FLAMETHROWER_RANGE,
  SOLID_NONE,
  SURF_NONE,
} from '../src/constants';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { spawnEnemy } from '../src/entities';
import type { Entity, SurvivalState } from '../src/types';

/** Sala limpa, mira a leste, sopro equipado e pronto. */
const arena = (count: number, gap: number) => {
  const state = createRun({ seed: 909 });
  const w = state.config.width;
  const px = Math.floor(w / 2);
  const py = Math.floor(state.config.height / 2);
  state.player.x = px + 0.5;
  state.player.y = py + 0.5;
  for (let y = py - 20; y <= py + 20; y++) {
    for (let x = px - 20; x <= px + 20; x++) {
      const i = y * w + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
    }
  }
  state.enemies = [];
  state.salvageSites = [];
  state.playerExtras[0].aim = { x: 1, y: 0 };
  state.playerExtras[0].ability = 'flamethrower';
  state.playerExtras[0].abilityCooldownUntil = 0;
  const dummies: Entity[] = [];
  for (let i = 0; i < count; i++) {
    const e = spawnEnemy(state, 'stalker', px + gap + i, py, false);
    // Vida alta e velocidade zero: o que se mede e a SAIDA da habilidade, e um
    // boneco que morre no meio ou anda para fora do cone mede outra coisa.
    e.hp = 100000;
    e.maxHp = 100000;
    e.speed = 0;
    dummies.push(e);
  }
  return { state, dummies, gap };
};

/** Prende os bonecos onde nasceram — eles nao sao o assunto da medicao. */
const pin = (state: SurvivalState, dummies: Entity[], gap: number): void => {
  dummies.forEach((d, i) => {
    d.x = state.player.x + gap + i;
    d.y = state.player.y;
    d.speed = 0;
  });
};

const channelDamage = (count: number, gap: number): number[] => {
  const { state, dummies } = arena(count, gap);
  const before = dummies.map((d) => d.hp);
  for (let t = 0; t < FLAMETHROWER_CHANNEL_TICKS; t++) {
    const cmd = { ...emptyCommand(), aim: { x: 1, y: 0 }, ability: t === 0 };
    stepRun(state, [cmd]);
    pin(state, dummies, gap);
  }
  return dummies.map((d, i) => before[i] - d.hp);
};

/** O que o parafuso teria feito nos MESMOS ticks — o custo de canalizar. */
const boltDamage = (): number => {
  const { state, dummies } = arena(1, 3);
  const before = dummies[0].hp;
  for (let t = 0; t < FLAMETHROWER_CHANNEL_TICKS; t++) {
    stepRun(state, [{ ...emptyCommand(), aim: { x: 1, y: 0 }, fire: true }]);
    pin(state, dummies, 3);
  }
  return before - dummies[0].hp;
};

describe('o sopro termico contra o custo dele', () => {
  it('PERDE para o parafuso num alvo so — a habilidade nao e uma arma melhor', () => {
    const [single] = channelDamage(1, 2);
    expect(single).toBeGreaterThan(0);
    expect(single).toBeLessThan(boltDamage());
  });

  it('GANHA do parafuso a partir de tres alvos no cone — e a situacao que ele resolve', () => {
    const three = channelDamage(3, 1).reduce((a, b) => a + b, 0);
    expect(three).toBeGreaterThan(boltDamage());
  });

  it('dois alvos ficam PERTO do empate: a virada e em tres, e nao em cinco', () => {
    // O numero velho (1,2 por emissao) so empatava com CINCO enfileirados, o que
    // fazia a habilidade responder a uma situacao que o jogo quase nao serve.
    const two = channelDamage(2, 1).reduce((a, b) => a + b, 0);
    const bolt = boltDamage();
    expect(two).toBeGreaterThan(bolt * 0.7);
    expect(two).toBeLessThanOrEqual(bolt);
  });

  it('o jato alcanca o que a ficha promete, e para depois disso', () => {
    // Dentro do alcance cobra; um tile alem da ponta, nada. E o teste que pega
    // um `FLAMETHROWER_RANGE` mudado sem a geometria acompanhar.
    const reach = Math.floor(FLAMETHROWER_RANGE);
    expect(channelDamage(1, reach)[0]).toBeGreaterThan(0);
    expect(channelDamage(1, Math.ceil(FLAMETHROWER_RANGE) + 1)[0]).toBe(0);
  });
});
