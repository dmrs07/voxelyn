// A ninhada e a unica coisa do bestiario cuja promessa e NAO FAZER NADA. Uma
// promessa dessas se quebra sozinha: basta alguem dar a ela uma acao de
// contato, um ponto de dano ou uma linha no placar, e ninguem repara — o bicho
// continua parecendo um filhote inofensivo enquanto cobra.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { circleBlocked, damageEntity, spawnEnemy } from '../src/entities';
import {
  DEVOURER_BROOD_COUNT,
  DEVOURER_MAW_BITE_RADIUS,
  DEVOURER_BROOD_RING,
  DEVOURER_BROOD_SHY,
  DEVOURER_BROOD_SPREAD,
  SOLID_NONE,
  SOLID_ROCK,
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
/**
 * Mata o chefe de verdade.
 *
 * Um golpe de `hp + 1` NAO basta e a primeira versao destes testes caiu nisso:
 * enterrado, o Devorador reduz todo dano a 12% (`DEVOURER_BURROWED_ARMOR`), e a
 * mae sobrevivia — o que fazia o teste do placar passar por vacuidade, sem
 * ninguem morrer.
 */
const kill = (state: SurvivalState, ent: SurvivalState['enemies'][number]) => {
  for (let i = 0; i < 200 && ent.alive; i++) {
    damageEntity(state, ent, 1000, [], {
      kind: 'enemy_contact',
      archetype: 'white_devourer',
      elite: false,
    });
  }
};

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
  it('nenhum TICK termina com dois filhotes dentro um do outro', () => {
    // A versao forte de "sem sobreposicao": nao "o ninho fica arrumado depois de
    // um tempo", mas "nenhum quadro do jogo mostra dois corpos ocupando o mesmo
    // lugar". A mae puxa o bando para o anel dela sem parar, entao penetracao
    // nova aparece a todo tick e a checagem tem valor a todo tick.
    //
    // O que sustenta isto e a resolucao de posicao ser feita UMA VEZ POR PAR com
    // os dois corpos se movendo. A versao anterior movia so o filhote da vez,
    // meia penetracao, contando com a visita reciproca para a outra metade — e a
    // conta nao fecha: quando o irmao chega, a penetracao ja encolheu para p/2 e
    // ele move p/4, sobrando p/4. A promessa valia por CONVERGENCIA (o residuo
    // cai a cada tick ate sumir), que e exatamente o que ela existia para nao
    // ser.
    const { state } = nest(13);
    const min = brood(state)[0].radius * 2;
    for (let t = 0; t < 200; t++) {
      stepRun(state, [emptyCommand()]);
      const live = brood(state);
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const gap = Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y);
          expect(
            gap,
            `tick ${t}: dois filhotes a ${gap.toFixed(4)} de ${min}`
          ).toBeGreaterThanOrEqual(min - 1e-6);
        }
      }
    }
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

describe('a ninhada — ela nao sobrevive a mae', () => {
  it('a mae cai e a ninhada vai junto', () => {
    // O codigo dizia isto e nao fazia. O comentario do nascimento afirma que
    // ela "nasce com a mae, existe so onde ela existe e some do mapa junto com
    // ela" — e a segunda metade era falsa: morto o chefe, catorze filhotes
    // ficavam orfaos numa camara limpa, ocupando vaga do teto de inimigos e
    // parando bala, sem nada para seguir.
    const { state, mother } = nest(41);
    for (let t = 0; t < 30; t++) stepRun(state, [emptyCommand()]);
    expect(brood(state).length, 'o ninho nem chegou a existir').toBeGreaterThan(4);
    kill(state, mother);
    expect(mother.alive).toBe(false);
    expect(brood(state).length, 'sobraram filhotes orfaos na camara').toBe(0);
  });

  it('e o fim delas tambem nao conta no placar', () => {
    // Morrer com a mae nao e mais um abate do que morrer pisada. A regra e a
    // mesma nos dois caminhos, e vale a pena guardar nos dois: sao dois lugares
    // diferentes do codigo criando corpos mortos.
    const { state, mother } = nest(42);
    for (let t = 0; t < 30; t++) stepRun(state, [emptyCommand()]);
    const antes = brood(state).length;
    kill(state, mother);
    expect(antes, 'nao havia ninhada para morrer').toBeGreaterThan(4);
    expect(brood(state).length).toBe(0);
    expect(state.stats.kills.devourer_brood).toBe(0);
  });
});

describe('a ninhada — ela nunca acaba dentro da pedra', () => {
  it('nem quando o empurrao da separacao aponta para uma parede', () => {
    // As atribuicoes de `separateBrood` sao diretas — nao passam por
    // `moveEntity` —, entao sem checagem elas desfaziam a garantia que o passo
    // tinha acabado de dar: encostado numa quina, um filhote separado do irmao
    // ia parar DENTRO da parede, onde ninguem pode pisar nele.
    //
    // O ninho e empurrado contra a rocha de proposito: todos amontoados a um
    // passo da parede, que e a situacao que produz o empurrao para dentro dela.
    const { state, px, py } = nest(55);
    const w = state.config.width;
    // Uma parede solida rente ao ninho.
    for (let y = py - 6; y <= py + 6; y++) state.solid[y * w + (px + 4)] = SOLID_ROCK;
    for (const b of brood(state)) {
      b.x = px + 3.6;
      b.y = py + 0.5;
    }
    for (let t = 0; t < 120; t++) {
      stepRun(state, [emptyCommand()]);
      for (const b of brood(state)) {
        const cx = Math.floor(b.x);
        const cy = Math.floor(b.y);
        expect(
          state.solid[cy * w + cx],
          `tick ${t}: filhote ${b.id} dentro da pedra em ${cx},${cy}`
        ).toBe(SOLID_NONE);
      }
    }
  });
  // As sete camaras de Devorador que as sementes 1..60 geram. Ficam escritas
  // porque varrer sessenta sementes x tres setores custa oito segundos e o que
  // importa aqui nao e a varredura: e que camara GERADA de verdade, com a
  // parede onde o gerador a pos, nasca com o enxame inteiro.
  const DEVOURER_SEEDS = [8, 12, 24, 29, 34, 39, 60, 95, 153, 710];

  it('camara gerada nasce com o enxame INTEIRO, e nenhum corpo encostado na pedra', () => {
    // O ANGULO AUREO e ideal e a camara e escavada: o anel de fora encosta na
    // parede quase sempre. A primeira versao desistia do filhote que caia na
    // pedra e o resultado medido era um enxame que nunca existia — media 5,5 de
    // catorze, e a semente 60 nascia com UM. Catorze e o numero que faz a succao
    // valer: sao eles sumindo garganta abaixo que ensinam o raio da boca.
    //
    // A conta e CATORZE e nao "catorze menos dois". A primeira versao desta
    // prova aceitava a folga que a implementacao daquele momento precisava —
    // regua escolhida depois de ver o resultado, que e exatamente como um
    // numero de configuracao vira decoracao.
    for (const seed of DEVOURER_SEEDS) {
      const state = createRun({ seed, sector: 3 });
      const mother = state.enemies.find((e) => e.archetype === 'white_devourer');
      expect(mother, `semente ${seed} deveria ter Devorador`).toBeDefined();
      const litter = brood(state);

      expect(
        litter.length,
        `semente ${seed}: ${litter.length} filhotes de ${DEVOURER_BROOD_COUNT}`
      ).toBe(DEVOURER_BROOD_COUNT);

      for (const b of litter) {
        // O CIRCULO INTEIRO, e nao a celula do centro. A primeira versao desta
        // prova olhava so o centro e passava com 87 filhotes de 18 camaras
        // nascidos com um canto dentro da pedra — de onde `moveEntity` nao tira
        // ninguem, porque todo passo que sairia ja comeca bloqueado.
        expect(
          circleBlocked(state, b.x, b.y, b.radius),
          `semente ${seed}: filhote ${b.id} nasceu com o corpo na pedra em ${b.x},${b.y}`
        ).toBe(false);
        // Ninguem nasce dentro da garganta: quem desce o raio para no raio da
        // mordida e nao um passo alem dele.
        expect(
          Math.hypot(b.x - mother!.x, b.y - mother!.y),
          `semente ${seed}: filhote ${b.id} nasceu dentro da boca`
        ).toBeGreaterThanOrEqual(DEVOURER_MAW_BITE_RADIUS - 1e-6);
      }
    }
  });

  it('quem desce o raio cede o raio, e o raio de emergencia continua sendo aureo', () => {
    // O que o angulo aureo compra e a ausencia de pente. Procurar a celula livre
    // mais proxima devolveria o pente pela porta dos fundos: dois filhotes
    // empurrados para o mesmo lado da parede saem alinhados. Descer o proprio
    // raio nao mexe no angulo, e o raio de emergencia (`i + k*n`) e a
    // CONTINUACAO da mesma espiral — nao um angulo qualquer. Esta prova cobra as
    // duas coisas de uma vez: todo filhote esta num angulo da sequencia.
    for (const seed of DEVOURER_SEEDS) {
      const state = createRun({ seed, sector: 3 });
      const mother = state.enemies.find((e) => e.archetype === 'white_devourer')!;
      const ideais = Array.from(
        { length: DEVOURER_BROOD_COUNT * 8 },
        (_, i) => i * 2.39996
      );
      for (const b of brood(state)) {
        const a = Math.atan2(b.y - mother.y, b.x - mother.x);
        const perto = ideais.some((ideal) => {
          // Diferenca angular mais curta, com as voltas do angulo aureo (ele
          // passa de 2pi a partir do terceiro filhote) dobradas de volta.
          const d = (((a - ideal + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
          return Math.abs(d) < 1e-6;
        });
        expect(perto, `semente ${seed}: filhote ${b.id} saiu do proprio raio`).toBe(true);
      }
    }
  });
});
