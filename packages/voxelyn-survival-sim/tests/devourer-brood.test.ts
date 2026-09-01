// A ninhada e a unica coisa do bestiario cuja promessa e NAO FAZER NADA. Uma
// promessa dessas se quebra sozinha: basta alguem dar a ela uma acao de
// contato, um ponto de dano ou uma linha no placar, e ninguem repara — o bicho
// continua parecendo um filhote inofensivo enquanto cobra.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { spawnEnemy } from '../src/entities';
import {
  DEVOURER_BROOD_COUNT,
  DEVOURER_BROOD_RING,
  DEVOURER_BROOD_SHY,
  DEVOURER_BROOD_SPREAD,
  SOLID_NONE,
  SURF_NONE,
} from '../src/constants';
import type { SurvivalState } from '../src/types';

/** Uma camara limpa com a mae no centro e a ninhada em volta. */
const nest = (seed: number) => {
  const state = createRun({ seed });
  const w = state.config.width;
  const px = Math.floor(w / 2);
  const py = Math.floor(state.config.height / 2);
  for (let y = py - 22; y <= py + 22; y++) {
    for (let x = px - 22; x <= px + 22; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
    }
  }
  state.enemies = [];
  const mother = spawnEnemy(state, 'white_devourer', px + 0.5, py + 0.5, false);
  for (let i = 0; i < DEVOURER_BROOD_COUNT; i++) {
    const a = i * 2.39996;
    const r = 2 + Math.sqrt((i + 1) / DEVOURER_BROOD_COUNT) * DEVOURER_BROOD_RING;
    spawnEnemy(state, 'devourer_brood', px + 0.5 + Math.cos(a) * r, py + 0.5 + Math.sin(a) * r, false);
  }
  state.player.x = px + 0.5;
  state.player.y = py - 18.5;
  return { state, mother, px, py };
};

/**
 * Os filhotes VIVOS.
 *
 * O filtro de `alive` nao e detalhe: os mortos continuam em `state.enemies` com
 * a bandeira baixada, e sem ele a primeira versao deste ajudante contava
 * cadaveres — o teste de esmagamento media "quantos sumiram da lista" e a
 * lista nunca encolhia, entao ele reportava zero pisadas num ninho que estava
 * sendo pisoteado.
 */
const brood = (state: SurvivalState) =>
  state.enemies.filter((e) => e.alive && e.archetype === 'devourer_brood');

describe('a ninhada — ela nao pode machucar ninguem', () => {
  it('o jogador atravessa o ninho inteiro sem perder um ponto de vida', () => {
    // A promessa central, e a unica que nao pode ser negociada nunca: eles sao
    // INOFENSIVOS. Um filhote que cobrasse um ponto de dano por encostar
    // transformaria "encher o chao de bichinhos" numa taxa invisivel.
    const { state, px, py } = nest(31);
    for (let t = 0; t < 240; t++) {
      // O jogador varre a camara de ponta a ponta, por cima deles.
      state.player.x = px + 0.5 + Math.sin(t * 0.06) * 6;
      state.player.y = py + 0.5 + Math.cos(t * 0.06) * 6;
      stepRun(state, [emptyCommand()]);
    }
    expect(state.player.hp, 'a ninhada cobrou vida').toBe(state.player.maxHp);
    expect(state.stats.damageTakenTenths).toBe(0);
  });

  it('nenhum deles chega a ter uma ACAO: o repertorio e vazio', () => {
    // A porta por onde o dano entraria. Todo dano de contato deste jogo sai de
    // uma acao `contact` que a IA comum inicia; a ninhada tem fluxo proprio
    // justamente para nunca passar por la. Este teste guarda a porta, e nao a
    // consequencia — se um dia alguem a devolver ao fluxo comum, o teste acima
    // ainda poderia passar por acaso (o jogador pode nao estar no alcance).
    const { state, px, py } = nest(77);
    for (let t = 0; t < 200; t++) {
      state.player.x = px + 0.5 + Math.sin(t * 0.1) * 3;
      state.player.y = py + 0.5 + Math.cos(t * 0.1) * 3;
      stepRun(state, [emptyCommand()]);
      for (const b of brood(state)) {
        expect(b.action, `filhote ${b.id} ganhou a acao ${b.action?.kind}`).toBeUndefined();
      }
    }
  });
});

describe('a ninhada — o bando', () => {
  it('nao se sobrepoem: cada um tem o seu lugar', () => {
    // "Sem overlap" era o pedido, e um anel comum nao basta — catorze corpos
    // mirando o mesmo circulo se amontoam num arco so. E a separacao que
    // transforma um cordao de contas num bando.
    const { state } = nest(52);
    for (let t = 0; t < 300; t++) stepRun(state, [emptyCommand()]);
    const live = brood(state);
    expect(live.length).toBeGreaterThan(4);
    let worst = Infinity;
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        worst = Math.min(worst, Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y));
      }
    }
    // A separacao e uma FORCA e nao uma trava, entao dois filhotes empurrados
    // pela mesma parede podem passar do limite por uma fracao. O que ela
    // garante e que ninguem fica DENTRO de ninguem: dois raios.
    expect(worst, `dois filhotes a ${worst.toFixed(2)} tiles`).toBeGreaterThan(
      state.enemies[1].radius * 2
    );
  });

  it('seguem a MAE: soltos longe dela, voltam', () => {
    // A leitura inteira deles. Um enxame que ignorasse o chefe seria fauna
    // decorativa que por acaso nasceu ali; o que faz deles uma NINHADA e o
    // vinculo, e ele tem de ser visivel sem uma linha de texto.
    const { state, mother, px, py } = nest(64);
    for (const b of brood(state)) {
      b.x = px + 0.5 + 16;
      b.y = py + 0.5;
    }
    const before = brood(state).map((b) => Math.hypot(b.x - mother.x, b.y - mother.y));
    for (let t = 0; t < 200; t++) stepRun(state, [emptyCommand()]);
    const after = brood(state).map((b) => Math.hypot(b.x - mother.x, b.y - mother.y));
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    expect(mean(after), 'a ninhada nao voltou para a mae').toBeLessThan(mean(before));
  });

  it('FOGEM de quem chega perto: e a unica coisa que um inofensivo pode fazer', () => {
    const { state, px, py } = nest(88);
    for (let t = 0; t < 60; t++) stepRun(state, [emptyCommand()]);
    const target = brood(state)[0];
    // O jogador encosta no filhote, mas sem esmaga-lo: dentro do raio de susto,
    // fora do de contato.
    const d0 = DEVOURER_BROOD_SHY * 0.6;
    state.player.x = target.x + d0;
    state.player.y = target.y;
    const id = target.id;
    for (let t = 0; t < 10; t++) stepRun(state, [emptyCommand()]);
    const now = state.enemies.find((e) => e.id === id);
    expect(now?.alive, 'o filhote foi esmagado em vez de fugir').toBe(true);
    expect(
      Math.hypot(now!.x - state.player.x, now!.y - state.player.y),
      'ele nao recuou'
    ).toBeGreaterThan(d0);
  });
});

describe('a ninhada — pisar neles', () => {
  it('morrem sob o pe, e sem levar dano nenhum no caminho', () => {
    const { state } = nest(99);
    for (let t = 0; t < 30; t++) stepRun(state, [emptyCommand()]);
    const target = brood(state)[0];
    state.player.x = target.x;
    state.player.y = target.y;
    const id = target.id;
    stepRun(state, [emptyCommand()]);
    expect(state.enemies.find((e) => e.id === id)?.alive, 'o filhote sobreviveu ao pe').toBe(false);
  });

  it('NAO contam no placar: esmagar filhote nao e um abate', () => {
    // O total de abates alimenta o leaderboard. Catorze bichinhos inofensivos
    // por camara seriam pontos de graca para quem pisasse neles, e um placar em
    // que esmagar filhote rende mais que enfrentar o chefe esta medindo a coisa
    // errada.
    const { state } = nest(21);
    for (let t = 0; t < 30; t++) stepRun(state, [emptyCommand()]);
    let squashed = 0;
    for (let t = 0; t < 200; t++) {
      const alvo = brood(state)[0];
      if (alvo) {
        state.player.x = alvo.x;
        state.player.y = alvo.y;
      }
      const antes = brood(state).length;
      stepRun(state, [emptyCommand()]);
      squashed += antes - brood(state).length;
    }
    expect(squashed, 'nao deu para pisar em nenhum').toBeGreaterThan(3);
    expect(state.stats.kills.devourer_brood, 'o placar contou os filhotes').toBe(0);
  });
});
