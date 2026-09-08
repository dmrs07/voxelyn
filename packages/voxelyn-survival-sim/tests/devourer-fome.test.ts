// A FOME — a segunda fase do Devorador Branco.
//
// O que estes testes protegem, em ordem de gravidade:
// 1. A FOME E UMA VEZ, NA METADE. Uma escada que descesse, ou que disparasse
//    duas vezes, apagaria a leitura de "agora e outra luta".
// 2. OS SUMIDOUROS NUNCA PRENDEM SOZINHOS. Eles somam a boca e a rajada; um
//    sumidouro que vencesse a caminhada seria uma segunda garganta sem aviso.
// 3. A BOCA SO ANDA DEPOIS DA RAMPA, e so na Fome: tudo o que o jogador
//    aprendeu na primeira metade tem de continuar verdadeiro.
// 4. TUDO ENTRA NO HASH: duas maquinas que discordem de um sumidouro divergem
//    na posicao de todo corpo do disco dele.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { damageEntity, spawnEnemy } from '../src/entities';
import { sinkholePull, sinkholeReach } from '../src/maw';
import {
  DEVOURER_HP,
  DEVOURER_HUNGER_HP_FRACTION,
  DEVOURER_MAW_CREEP,
  DEVOURER_MAW_GLASS_GRIP,
  DEVOURER_MAW_RADIUS,
  DEVOURER_MAW_SPOOL_TICKS,
  DEVOURER_MAW_TICKS,
  DEVOURER_SINKHOLE_MAX,
  DEVOURER_SINKHOLE_PULL_CORE,
  DEVOURER_SINKHOLE_RADIUS,
  DEVOURER_SINKHOLE_SPOOL_TICKS,
  DEVOURER_SINKHOLE_TICKS,
  PLAYER_SPEED,
  SOLID_NONE,
  SURF_GLASS,
  SURF_NONE,
  SURF_SILT,
  TICK_HZ,
} from '../src/constants';
import {
  BOSS_PHASE_HUNGER,
  DEVOURER_AIRBORNE,
  DEVOURER_BURROWED,
  DEVOURER_MAW,
  type SurvivalState,
} from '../src/types';

const arena = (seed: number) => {
  const state = createRun({ seed });
  state.player.x = Math.floor(state.config.width / 2) + 0.5;
  state.player.y = Math.floor(state.config.height / 2) + 0.5;
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - 20; y <= py + 20; y++) {
    for (let x = px - 20; x <= px + 20; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
  state.enemies = [];
  const worm = spawnEnemy(state, 'white_devourer', px + 10, py, false);
  // Acordado e sem pressa: o que se mede aqui nao e o ciclo, e a virada.
  state.bossRuntime.awake = true;
  worm.nextActionAt = state.tick + 100000;
  return { state, worm, px, py };
};

type Worm = SurvivalState['enemies'][number];

/** Leva a vida para uma fracao, sem passar pelo funil de dano. */
const setHp = (worm: Worm, fraction: number) => {
  worm.hp = Math.floor(worm.maxHp * fraction);
};

/** Faz o corpo POUSAR agora em (x, y), pelo caminho do voo que perdeu a acao. */
const landAt = (state: SurvivalState, worm: Worm, x: number, y: number) => {
  worm.mood = DEVOURER_AIRBORNE;
  worm.action = undefined;
  worm.x = x;
  worm.y = y;
  state.bossRuntime.leapToX = x;
  state.bossRuntime.leapToY = y;
  state.bossRuntime.leapsLeft = 3;
  // Longe do pouso: a cratera e a onda nao podem confundir a medida.
  state.player.x = x + 12;
  state.player.y = y;
  return stepRun(state, [emptyCommand()]).events;
};

const openMaw = (state: SurvivalState, worm: Worm, x: number, y: number, spooled: boolean) => {
  if (spooled) state.tick += DEVOURER_MAW_SPOOL_TICKS;
  worm.x = x;
  worm.y = y;
  worm.mood = DEVOURER_MAW;
  worm.action = undefined;
  worm.nextActionAt = state.tick + DEVOURER_MAW_TICKS;
  state.bossRuntime.mawOpenedAt = spooled ? state.tick - DEVOURER_MAW_SPOOL_TICKS : state.tick;
};

const paint = (state: SurvivalState, kind: number, cx: number, cy: number, r: number) => {
  const w = state.config.width;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      state.surface[y * w + x] = kind;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
};

const count = (state: SurvivalState, kind: number, cx: number, cy: number, r: number) => {
  const w = state.config.width;
  let n = 0;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) if (state.surface[y * w + x] === kind) n++;
  }
  return n;
};

describe('A Fome — a virada', () => {
  it('a vida subiu para caber uma virada: metade e mais que uma janela de bolt', () => {
    const { worm } = arena(1);
    expect(DEVOURER_HP).toBe(1500);
    expect(worm.maxHp).toBe(DEVOURER_HP);
    // 7,5 s de bolt basico (14 a cada 5 ticks) sao 420: a metade tem de pedir
    // mais que uma janela, senao a Fome chega e vai embora na mesma abertura.
    const windowDamage = (DEVOURER_MAW_TICKS / 5) * 14;
    expect(DEVOURER_HP * DEVOURER_HUNGER_HP_FRACTION).toBeGreaterThan(windowDamage);
  });

  it('comeca na METADE, e uma vez so', () => {
    const { state, worm } = arena(2);
    setHp(worm, DEVOURER_HUNGER_HP_FRACTION + 0.02);
    let events = stepRun(state, [emptyCommand()]).events;
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_HUNGER).toBe(0);
    expect(events.some((e) => e.t === 'boss_phase')).toBe(false);

    setHp(worm, DEVOURER_HUNGER_HP_FRACTION - 0.01);
    events = stepRun(state, [emptyCommand()]).events;
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_HUNGER).toBe(BOSS_PHASE_HUNGER);
    const phase = events.find((e) => e.t === 'boss_phase');
    expect(phase && phase.archetype === 'white_devourer' && phase.phase === BOSS_PHASE_HUNGER).toBe(
      true,
    );
    expect(events.some((e) => e.t === 'message' && e.key === 'sim.devourerHunger')).toBe(true);

    // Curado de volta ou nao, ela nao volta atras nem dispara de novo.
    worm.hp = worm.maxHp;
    events = stepRun(state, [emptyCommand()]).events;
    expect(events.some((e) => e.t === 'boss_phase')).toBe(false);
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_HUNGER).toBe(BOSS_PHASE_HUNGER);
  });

  it('e lida DE BOCA ABERTA: a vida cai na janela, e a virada nao espera ela fechar', () => {
    const { state, worm, px, py } = arena(3);
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    state.player.x = worm.x + DEVOURER_MAW_RADIUS + 3;
    setHp(worm, 0.3);
    const events = stepRun(state, [emptyCommand()]).events;
    expect(events.some((e) => e.t === 'boss_phase')).toBe(true);
    expect(worm.mood).toBe(DEVOURER_MAW);
  });
});

describe('A Fome — os sumidouros', () => {
  it('antes dela a cratera fecha: o pouso nao deixa nada', () => {
    const { state, worm, px, py } = arena(4);
    landAt(state, worm, px + 0.5, py + 0.5);
    expect(state.bossRuntime.sinkholes).toHaveLength(0);
  });

  it('na Fome cada pouso deixa um, no lugar e no tick do pouso, ate o teto', () => {
    const { state, worm, px, py } = arena(5);
    state.bossRuntime.phasesFired |= BOSS_PHASE_HUNGER;
    landAt(state, worm, px + 0.5, py + 0.5);
    // O tick do POUSO — o tick em que o passo rodou, e nao o de antes dele.
    const first = state.tick;
    expect(state.bossRuntime.sinkholes).toEqual([{ x: px + 0.5, y: py + 0.5, at: first }]);
    for (let n = 1; n <= DEVOURER_SINKHOLE_MAX; n++) {
      landAt(state, worm, px + 0.5 + n * 5, py + 0.5);
    }
    // O teto e por contagem, e o mais VELHO cede a vaga.
    expect(state.bossRuntime.sinkholes).toHaveLength(DEVOURER_SINKHOLE_MAX);
    expect(state.bossRuntime.sinkholes.some((h) => h.x === px + 0.5 && h.at === first)).toBe(false);
  });

  it('nasce fechado, abre, fica, e fecha antes de morrer', () => {
    expect(sinkholeReach(100, 100)).toBe(0);
    expect(sinkholeReach(100 + DEVOURER_SINKHOLE_SPOOL_TICKS / 2, 100)).toBeCloseTo(
      DEVOURER_SINKHOLE_RADIUS / 2,
    );
    expect(sinkholeReach(100 + DEVOURER_SINKHOLE_SPOOL_TICKS, 100)).toBe(DEVOURER_SINKHOLE_RADIUS);
    expect(sinkholeReach(100 + DEVOURER_SINKHOLE_TICKS / 2, 100)).toBe(DEVOURER_SINKHOLE_RADIUS);
    expect(sinkholeReach(100 + DEVOURER_SINKHOLE_TICKS - 1, 100)).toBeLessThan(
      DEVOURER_SINKHOLE_RADIUS * 0.1,
    );
    expect(sinkholeReach(100 + DEVOURER_SINKHOLE_TICKS, 100)).toBe(0);
    expect(sinkholeReach(50, 100)).toBe(0);
  });

  it('NUNCA vence a caminhada, em raio nenhum: sozinho ele nao prende', () => {
    const at = 0;
    const tick = DEVOURER_SINKHOLE_TICKS / 2;
    expect(DEVOURER_SINKHOLE_PULL_CORE).toBeLessThan(PLAYER_SPEED);
    for (let d = 0; d <= DEVOURER_SINKHOLE_RADIUS; d += 0.05) {
      expect(sinkholePull(d, tick, at, false), `a ${d.toFixed(2)} ele prendeu`).toBeLessThan(
        PLAYER_SPEED,
      );
    }
    // E ainda assim puxa: e uma ladeira, nao um enfeite.
    expect(sinkholePull(1, tick, at, false)).toBeGreaterThan(1);
    // Cresce para dentro, como a boca.
    expect(sinkholePull(0.5, tick, at, false)).toBeGreaterThan(sinkholePull(3, tick, at, false));
    // Fora do alcance, nada; sobre vidro, a mesma fracao da boca.
    expect(sinkholePull(DEVOURER_SINKHOLE_RADIUS + 0.01, tick, at, false)).toBe(0);
    expect(sinkholePull(1, tick, at, true)).toBeCloseTo(
      sinkholePull(1, tick, at, false) * DEVOURER_MAW_GLASS_GRIP,
    );
    // E enquanto abre, o alcance recorta: a dois tiles ele ainda nao chega.
    expect(sinkholePull(2, at + 5, at, false)).toBe(0);
  });

  it('puxa o Prospector para o centro, e o vidro segura', () => {
    const { state, px, py } = arena(6);
    const hole = { x: px + 0.5, y: py + 0.5, at: state.tick - DEVOURER_SINKHOLE_SPOOL_TICKS };
    state.bossRuntime.sinkholes.push(hole);
    state.player.x = hole.x + 2.5;
    state.player.y = hole.y;
    stepRun(state, [emptyCommand()]);
    const pulled = 2.5 - (state.player.x - hole.x);
    expect(pulled).toBeGreaterThan(0);
    expect(pulled).toBeLessThanOrEqual(DEVOURER_SINKHOLE_PULL_CORE / TICK_HZ + 1e-6);

    // Sobre vidro, o mesmo tick puxa menos — a mesma regra de chao da boca.
    const glass = arena(6);
    glass.state.bossRuntime.sinkholes.push({
      ...hole,
      at: glass.state.tick - DEVOURER_SINKHOLE_SPOOL_TICKS,
    });
    glass.state.player.x = hole.x + 2.5;
    glass.state.player.y = hole.y;
    paint(
      glass.state,
      SURF_GLASS,
      Math.floor(glass.state.player.x),
      Math.floor(glass.state.player.y),
      0,
    );
    stepRun(glass.state, [emptyCommand()]);
    const onGlass = 2.5 - (glass.state.player.x - hole.x);
    expect(onGlass).toBeGreaterThan(0);
    expect(onGlass).toBeLessThan(pulled);
  });

  it('come a areia do disco, e nunca o vidro', () => {
    const { state, px, py } = arena(7);
    paint(state, SURF_SILT, px, py, 6);
    // Um anel de vidro dentro do alcance: tem de sobreviver.
    const w = state.config.width;
    state.surface[py * w + px + 2] = SURF_GLASS;
    state.surface[py * w + px - 2] = SURF_GLASS;
    state.bossRuntime.sinkholes.push({
      x: px + 0.5,
      y: py + 0.5,
      at: state.tick - DEVOURER_SINKHOLE_SPOOL_TICKS,
    });
    state.player.x = px + 12.5;
    const silt = count(state, SURF_SILT, px, py, 6);
    stepRun(state, [emptyCommand()]);
    const after = count(state, SURF_SILT, px, py, 6);
    expect(after).toBeLessThan(silt);
    // Dentro do raio nao sobra areia; fora dele ela continua la.
    expect(count(state, SURF_SILT, px, py, 2)).toBe(0);
    expect(state.surface[(py + 6) * w + px + 6]).toBe(SURF_SILT);
    expect(state.surface[py * w + px + 2]).toBe(SURF_GLASS);
    expect(state.surface[py * w + px - 2]).toBe(SURF_GLASS);
  });

  it('morre sozinho, e a lista nao acumula', () => {
    const { state, px, py } = arena(8);
    state.bossRuntime.sinkholes.push({ x: px + 0.5, y: py + 0.5, at: state.tick });
    state.player.x = px + 12.5;
    for (let t = 0; t < DEVOURER_SINKHOLE_TICKS - 1; t++) stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.sinkholes).toHaveLength(1);
    stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.sinkholes).toHaveLength(0);
  });

  it('a mae cai e o chao para de ceder', () => {
    const { state, worm, px, py } = arena(9);
    state.bossRuntime.phasesFired |= BOSS_PHASE_HUNGER;
    state.bossRuntime.sinkholes.push({ x: px + 0.5, y: py + 0.5, at: state.tick });
    // De boca aberta: submerso a areia absorveria 88% do golpe.
    worm.mood = DEVOURER_MAW;
    damageEntity(state, worm, worm.hp + 1, [], { kind: 'unknown' });
    expect(worm.alive).toBe(false);
    expect(state.bossRuntime.sinkholes).toHaveLength(0);
  });

  it('entra no HASH: duas simulacoes que discordem de um sumidouro nao sao iguais', () => {
    const a = arena(10);
    const b = arena(10);
    expect(hashAuthoritativeState(a.state)).toBe(hashAuthoritativeState(b.state));
    b.state.bossRuntime.sinkholes.push({ x: 10.5, y: 10.5, at: 0 });
    expect(hashAuthoritativeState(a.state)).not.toBe(hashAuthoritativeState(b.state));
  });
});

describe('A Fome — a boca anda', () => {
  const creepFor = (hungry: boolean, spooled: boolean, ticks = 10) => {
    const { state, worm, px, py } = arena(11);
    if (hungry) state.bossRuntime.phasesFired |= BOSS_PHASE_HUNGER;
    openMaw(state, worm, px + 0.5, py + 0.5, spooled);
    // Fora do disco, para a sucao nao mover o jogador e sujar a medida.
    state.player.x = worm.x + DEVOURER_MAW_RADIUS + 4;
    state.player.y = worm.y;
    const x0 = worm.x;
    for (let t = 0; t < ticks; t++) stepRun(state, [emptyCommand()]);
    return { moved: worm.x - x0, sideways: Math.abs(worm.y - (py + 0.5)), worm, state };
  };

  it('antes da Fome a boca fica onde nasceu', () => {
    expect(creepFor(false, true).moved).toBe(0);
  });

  it('na Fome ela so anda depois da rampa: a linha do sem-volta e lida parada', () => {
    const early = creepFor(true, false);
    expect(early.moved).toBe(0);
    expect(early.worm.mood).toBe(DEVOURER_MAW);
  });

  it('e anda DEVAGAR para o jogador, muito abaixo da caminhada', () => {
    const late = creepFor(true, true, 20);
    expect(late.moved).toBeGreaterThan(0);
    expect(late.moved).toBeCloseTo((DEVOURER_MAW_CREEP / TICK_HZ) * 20, 5);
    expect(late.sideways).toBeLessThan(1e-6);
    expect(DEVOURER_MAW_CREEP).toBeLessThan(PLAYER_SPEED * 0.3);
    // Ela continua sendo a boca: nao fechou, nao atacou.
    expect(late.worm.mood).toBe(DEVOURER_MAW);
  });

  it('quem fica no lugar e alcancado: a distancia cai tick a tick', () => {
    const { state, worm, px, py } = arena(12);
    state.bossRuntime.phasesFired |= BOSS_PHASE_HUNGER;
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    state.player.x = worm.x + DEVOURER_MAW_RADIUS + 2;
    state.player.y = worm.y;
    const before = state.player.x - worm.x;
    for (let t = 0; t < 40; t++) stepRun(state, [emptyCommand()]);
    expect(state.player.x - worm.x).toBeLessThan(before - 1.5);
    expect(worm.mood).toBe(DEVOURER_MAW);
  });

  it('a boca fecha e ele volta para baixo como sempre — a Fome nao muda o ciclo', () => {
    const { state, worm, px, py } = arena(13);
    state.bossRuntime.phasesFired |= BOSS_PHASE_HUNGER;
    openMaw(state, worm, px + 0.5, py + 0.5, false);
    state.player.x = worm.x + DEVOURER_MAW_RADIUS + 6;
    for (let t = 0; t <= DEVOURER_MAW_TICKS; t++) stepRun(state, [emptyCommand()]);
    expect(worm.mood).toBe(DEVOURER_BURROWED);
    expect(state.bossRuntime.mawOpenedAt).toBe(-1);
  });
});
