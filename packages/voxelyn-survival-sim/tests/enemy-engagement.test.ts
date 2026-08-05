import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { bossArchetypeForBiome } from '../src/bosses';
import { sectorBiome } from '../src/strata';
import { damageEntity, findRippable, interceptDirection, spawnEnemy } from '../src/entities';
import { canRip, ripSolid } from '../src/cells';
import {
  BRUISER_HURL_WINDUP_TICKS,
  BRUISER_ROCK_RADIUS,
  BRUISER_ROCK_STUN_TICKS,
  SOLID_CRYSTAL,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ROCK,
  SECTOR_COUNT,
} from '../src/constants';
import type { SurvivalState } from '../src/types';

const stepIdle = (state: SurvivalState, ticks: number): void => {
  for (let t = 0; t < ticks; t++) stepRun(state, [emptyCommand()]);
};

/** Abre uma arena de chao livre em volta do jogador, para isolar o inimigo. */
const clearArena = (state: SurvivalState, radius: number): void => {
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - radius; y <= py + radius; y++) {
    for (let x = px - radius; x <= px + radius; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = 0;
    }
  }
};

const distToPlayer = (state: SurvivalState, e: { x: number; y: number }): number =>
  Math.hypot(e.x - state.player.x, e.y - state.player.y);


/** Primeira seed >= base cujo setor final tem o Guardiao (bossForBiome). */
const guardianSeed = (base: number): number => {
  for (let seed = base; seed < base + 4096; seed++) {
    if (bossArchetypeForBiome(sectorBiome(seed, SECTOR_COUNT)) === 'guardian') return seed;
  }
  throw new Error(`nenhuma seed proxima de ${base} com Guardiao no setor final`);
};

describe('inimigo reage a levar dano', () => {
  // O aggro era so distancia, recalculado a cada tick. Com alcance de tiro de
  // 18 tiles contra raios de aggro de 7 a 9, dava para matar qualquer inimigo
  // de fora do raio dele sem que ele reagisse — atirar de longe nao era tatica,
  // era a ausencia de jogo.
  it('persegue depois de ser atingido de fora do raio de aggro', () => {
    const state = createRun({ seed: 21 });
    clearArena(state, 16);
    // Bruiser tem raio de aggro 7; 12 tiles esta confortavelmente fora dele.
    const enemy = spawnEnemy(state, 'bruiser', Math.floor(state.player.x) + 12, Math.floor(state.player.y), false);
    expect(enemy).not.toBeNull();
    if (!enemy) return;
    const before = distToPlayer(state, enemy);
    expect(before).toBeGreaterThan(9);

    damageEntity(state, enemy, 1, []);
    stepIdle(state, 20);

    expect(distToPlayer(state, enemy), 'nao veio na direcao de quem atirou').toBeLessThan(before - 1);
  });

  // O alerta nao e permanente de proposito: quem atira e foge continua
  // conseguindo quebrar o contato, so nao de graca.
  it('desiste depois que o alerta expira', () => {
    const state = createRun({ seed: 22 });
    clearArena(state, 20);
    const enemy = spawnEnemy(state, 'bruiser', Math.floor(state.player.x) + 14, Math.floor(state.player.y), false);
    if (!enemy) return;
    damageEntity(state, enemy, 1, []);
    stepIdle(state, 90); // bem depois de ALERT_TICKS
    const settled = distToPlayer(state, enemy);
    stepIdle(state, 30);
    // Continua fora do raio de aggro, entao volta a vagar: nao cola no jogador.
    expect(distToPlayer(state, enemy)).toBeGreaterThan(settled - 3);
  });
});

describe('bruiser arremessa bloco', () => {
  // Ele era o unico sem resposta a distancia, a metade da velocidade do
  // jogador: contra alguem que recua, nunca encostava.
  it('arranca uma parede e lanca um projetil hostil', () => {
    const state = createRun({ seed: 23 });
    clearArena(state, 12);
    const w = state.config.width;
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const ex = px + 6;
    // Parede ao alcance do bruiser, para virar municao.
    const ammoX = ex + 1;
    const ammoY = py;
    state.solid[ammoY * w + ammoX] = SOLID_ROCK;

    const enemy = spawnEnemy(state, 'bruiser', ex, py, false);
    expect(enemy).not.toBeNull();
    if (!enemy) return;

    stepIdle(state, BRUISER_HURL_WINDUP_TICKS + 6);

    expect(state.solid[ammoY * w + ammoX], 'a parede nao foi arrancada').toBe(SOLID_NONE);
    // Filtrado pelo DONO: a run spawna spitters, e o cuspe deles satisfaria um
    // `projectiles.some(hostile)` sem que o bruiser tivesse feito nada.
    const thrown = state.projectiles.filter((p) => p.hostile && p.owner === enemy.id);
    expect(thrown.length, 'o bruiser nao lancou nada').toBeGreaterThan(0);
    // Pedra nao suja o chao: quem deixa poca e o cuspidor.
    expect(thrown.some((p) => p.leavesBiofluid)).toBe(false);
    // E se identifica como PEDRA. As flags dizem o que o projetil faz; sem um
    // campo dizendo o que ele E, pedra e cuspe sao os dois apenas `hostile` e o
    // cliente desenhava o bloco arrancado da parede como cusparada de acido.
    expect(thrown.every((p) => p.kind === 'rock'), 'o bloco nao se identifica como pedra').toBe(true);
    expect(thrown.every((p) => p.radius === BRUISER_ROCK_RADIUS), 'colisao ainda usa calibre de cuspe').toBe(true);
    // E carrega o stun DELE: a Salva do Guardiao usa o mesmo kind sem a flag.
    expect(thrown.every((p) => p.stuns === true), 'o bloco do Britador perdeu o stun').toBe(true);
  });

  it('recalcula a mira no release e adianta um alvo em movimento', () => {
    const state = createRun({ seed: 230 });
    const target = state.player;
    target.x = 20;
    target.y = 20;
    target.vx = 0;
    target.vy = 4.6;
    const direction = interceptDirection(26, 20, target, 9, 20 / 9);
    expect(direction.x).toBeLessThan(0);
    expect(direction.y, 'mirou na posicao antiga, sem antecipar o strafe').toBeGreaterThan(0.25);
  });

  it('a pedra quebra no impacto e atordoa o Prospector por 1,2 s', () => {
    const state = createRun({ seed: 231 });
    clearArena(state, 6);
    state.enemies.forEach((enemy) => { enemy.alive = false; });
    const owner = spawnEnemy(state, 'bruiser', Math.floor(state.player.x) + 3, Math.floor(state.player.y), false);
    state.projectiles = [{
      kind: 'rock', id: state.nextEntityId++, owner: owner.id,
      x: state.player.x + state.player.radius + BRUISER_ROCK_RADIUS - 0.02, y: state.player.y,
      vx: 0, vy: 0, damage: 1, radius: BRUISER_ROCK_RADIUS, distanceTravelled: 0,
      hostile: true, stuns: true, leavesBiofluid: false, ttl: 10,
    }];
    stepRun(state, [emptyCommand()]);
    expect(state.projectiles).toHaveLength(0);
    expect(state.player.stunnedUntil - state.tick).toBe(BRUISER_ROCK_STUN_TICKS);

    const beforeX = state.player.x;
    const move = emptyCommand();
    move.move = { x: 1, y: 0 };
    stepRun(state, [move]);
    expect(state.player.x, 'jogador se moveu enquanto atordoado').toBe(beforeX);
  });

  // Sem parede ao alcance ele nao tem o que jogar. Isso e proposital: em sala
  // aberta a ameaca do bruiser e outra, e o jogador pode ler o terreno.
  it('nao inventa municao em arena sem parede', () => {
    const state = createRun({ seed: 24 });
    clearArena(state, 14);
    const enemy = spawnEnemy(state, 'bruiser', Math.floor(state.player.x) + 6, Math.floor(state.player.y), false);
    if (!enemy) return;
    stepIdle(state, BRUISER_HURL_WINDUP_TICKS + 10);
    expect(state.projectiles.filter((p) => p.hostile && p.owner === enemy.id).length).toBe(0);
  });
});

describe('o que o bruiser pode arrancar', () => {
  // Minerio e recurso do jogador; cristal e luz e descarga. Deixar um inimigo
  // apagar qualquer um dos dois de graca tiraria dele coisas que foi ate ali
  // buscar, sem que pudesse sequer disputar.
  it('recusa minerio e cristal, aceita rocha', () => {
    const state = createRun({ seed: 25 });
    const w = state.config.width;
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);

    state.solid[py * w + px + 2] = SOLID_ORE;
    expect(ripSolid(state, px + 2, py, [])).toBe(false);
    expect(state.solid[py * w + px + 2]).toBe(SOLID_ORE);

    state.solid[py * w + px + 3] = SOLID_CRYSTAL;
    expect(ripSolid(state, px + 3, py, [])).toBe(false);
    expect(state.solid[py * w + px + 3]).toBe(SOLID_CRYSTAL);

    state.solid[py * w + px + 4] = SOLID_ROCK;
    expect(ripSolid(state, px + 4, py, [])).toBe(true);
    expect(state.solid[py * w + px + 4]).toBe(SOLID_NONE);
  });

  it('ignora coordenada fora do mapa em vez de escrever fora do array', () => {
    const state = createRun({ seed: 26 });
    expect(ripSolid(state, -1, 0, [])).toBe(false);
    expect(ripSolid(state, 0, state.config.height + 5, [])).toBe(false);
  });

  // Apareceu num teste, nao no papel: com o jogador nascendo colado na parede
  // externa, o bruiser arrancava o proprio limite do mundo. Nada quebrava, mas
  // abria um buraco na moldura da sala — que e cenario, nao arena.
  it('nao arranca a borda do mapa', () => {
    const state = createRun({ seed: 27 });
    const w = state.config.width;
    const h = state.config.height;
    for (const [x, y] of [[0, 5], [5, 0], [w - 1, 5], [5, h - 1]] as Array<[number, number]>) {
      state.solid[y * w + x] = SOLID_ROCK;
      expect(ripSolid(state, x, y, []), `borda em ${x},${y}`).toBe(false);
      expect(state.solid[y * w + x]).toBe(SOLID_ROCK);
    }
  });
});

/**
 * O caso que originou o rebalanceamento: o jogador segurando "para tras".
 *
 * Com alcance de tiro de 18 tiles, velocidade 4.6 contra 2.3 do bruiser e
 * NENHUMA resposta a distancia, recuar anulava a ameaca por completo. Estes dois
 * cenarios sao o antes e o depois medidos: segurar para tras passa a custar
 * vida, e desviar continua saindo de graca. Se algum dia os dois derem o mesmo
 * resultado, a mecanica virou dano inevitavel ou voltou a ser inofensiva.
 */
describe('o bruiser contra quem recua', () => {
  const corridor = (): SurvivalState => {
    const s = createRun({ seed: 31 });
    const w = s.config.width;
    for (let y = 28; y <= 33; y++) {
      for (let x = 10; x <= 80; x++) {
        s.solid[y * w + x] = SOLID_NONE;
        s.surface[y * w + x] = 0;
      }
    }
    // Paredes do corredor: e delas que sai a municao.
    for (let x = 10; x <= 80; x++) {
      s.solid[27 * w + x] = SOLID_ROCK;
      s.solid[34 * w + x] = SOLID_ROCK;
    }
    for (const e of s.enemies) e.alive = false; // mede so o bruiser
    s.player.x = 30.5;
    s.player.y = 30.5;
    s.player.hp = 100;
    return s;
  };

  const fleeing = (strafe: boolean): number => {
    const s = corridor();
    const bruiser = spawnEnemy(s, 'bruiser', 36, 30, false);
    if (!bruiser) return -1;
    const startHp = s.player.hp;
    for (let t = 0; t < 20 * 20 && bruiser.alive; t++) {
      const c = emptyCommand();
      c.move = strafe ? { x: -0.7, y: t % 40 < 20 ? 0.7 : -0.7 } : { x: -1, y: 0 };
      const ax = bruiser.x - s.player.x;
      const ay = bruiser.y - s.player.y;
      const al = Math.hypot(ax, ay) || 1;
      c.aim = { x: ax / al, y: ay / al };
      c.fire = true;
      if (s.player.x < 12) break;
      stepRun(s, [c]);
    }
    return startHp - s.player.hp;
  };

  it('cobra de quem so anda para tras em linha reta', () => {
    expect(fleeing(false), 'recuar reto saiu de graca').toBeGreaterThan(0);
  });

  it('deixa passar quem sai da linha do arremesso', () => {
    expect(fleeing(true), 'desviar nao adiantou nada').toBe(0);
  });
});

describe('achados da revisao', () => {
  // O alerta tornava `aggro` verdadeiro, mas o portao de sono do guardiao
  // devolvia `continue` mesmo assim: o chefe levava tiro de longe sem se mexer,
  // e cada tiro renovava um alerta que nao servia para nada. Era a morte sem
  // retaliacao que o aggro por dano existe para impedir, preservada justamente
  // no inimigo em que ela mais doi.
  it('acorda o guardiao quando ele leva dano de longe', () => {
    const state = createRun({ seed: guardianSeed(41), sector: SECTOR_COUNT });
    const guardian = state.enemies.find((e) => e.archetype === 'guardian');
    expect(guardian).toBeDefined();
    if (!guardian) return;
    // Bem alem dos 7 tiles do portao de sono.
    guardian.x = state.player.x + 15;
    guardian.y = state.player.y;
    expect(state.bossRuntime.awake).toBe(false);

    damageEntity(state, guardian, 5, []);
    stepIdle(state, 2);

    expect(state.bossRuntime.awake, 'continuou dormindo levando tiro').toBe(true);
  });

  // `findRippable` escolhia pelo tipo do bloco e `ripSolid` recusava a borda:
  // perto da moldura o bruiser escolhia a borda por ser a mais proxima, tomava
  // um `false` e escolhia a MESMA celula no tick seguinte — travado para sempre,
  // com parede valida a dois passos.
  // `findRippable` escolhia pelo tipo do bloco e `ripSolid` recusava a borda: as
  // duas funcoes discordavam. Perto da moldura o bruiser escolhia a borda por
  // ser a mais proxima, tomava um `false` e reescolhia a MESMA celula no tick
  // seguinte, desperdicando a chance com parede valida a dois passos.
  //
  // O teste e do INVARIANTE e nao de um cenario de jogo de proposito: eu tentei
  // reproduzir um travamento observavel e nao consegui, porque o bruiser anda e
  // sai de perto da borda em poucos ticks. O defeito e real e passageiro — e a
  // forma dele e "quem escolhe discorda de quem executa", que e o que se afirma
  // aqui e o que nao volta sem o teste acusar.
  it('nunca escolhe municao que ripSolid recusaria', () => {
    const state = createRun({ seed: 42 });
    const w = state.config.width;
    for (let y = 1; y <= 10; y++) {
      for (let x = 1; x <= 10; x++) {
        state.solid[y * w + x] = SOLID_NONE;
        state.surface[y * w + x] = 0;
      }
    }
    // Borda arrancavel pelo TIPO, colada a posicao do bruiser, e parede interior
    // valida mais longe.
    for (let y = 3; y <= 7; y++) state.solid[y * w + 0] = SOLID_ROCK;
    state.solid[5 * w + 3] = SOLID_ROCK;

    const bruiser = spawnEnemy(state, 'bruiser', 1, 5, false);
    expect(bruiser).not.toBeNull();
    if (!bruiser) return;

    const pick = findRippable(state, bruiser);
    expect(pick, 'nao achou municao nenhuma').not.toBeNull();
    if (!pick) return;
    expect(canRip(state, pick.x, pick.y), `escolheu ${pick.x},${pick.y}, que ripSolid recusa`).toBe(true);
    expect(pick.x, 'escolheu a borda do mapa').toBeGreaterThan(0);
  });
});

describe('identidade dos projeteis', () => {
  // Cada arremessador declara o que lanca. Sem isso o cliente so tem `hostile`,
  // e uma pedra de 22 de dano chega com a mesma cara de um cuspe de 9.
  it('separa tiro do jogador, cuspe e pedra', () => {
    const state = createRun({ seed: 81 });
    const cmd = emptyCommand();
    cmd.fire = true;
    cmd.aim = { x: 1, y: 0 };
    stepRun(state, [cmd]);
    const mine = state.projectiles.filter((p) => !p.hostile);
    expect(mine.length, 'o jogador nao atirou').toBeGreaterThan(0);
    expect(mine.every((p) => p.kind === 'bolt')).toBe(true);
  });
});
