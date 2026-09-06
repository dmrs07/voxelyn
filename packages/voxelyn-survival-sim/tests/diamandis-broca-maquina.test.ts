// A BROCA DO DIAMANDIS COMO MAQUINA (diamandis-drill.ts).
//
// O que esta suite protege: o perfil de velocidade tem a forma prometida
// (solavanco, aceleracao forte no primeiro terco, maximo no meio, derrapagem
// no fim) e o alcance total nao mudou; o chassi GIRA ate o rumo e trava, com
// um clique por oitante e um `drill_lock` por aviso; a correcao no arranque e
// de poucos graus e nunca vira perseguicao; o dano segue a PONTA — nunca a
// frente dela, nunca de lado; bater em minerio e IMPACTO (recuo, recuperacao
// longa) e passar reto e DERRAPAGEM (recuperacao curta), e as duas sao
// diferentes; os oito rumos correm a mesma distancia; e tudo e determinista.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { spawnEnemy, startAction } from '../src/entities';
import {
  DIAMANDIS_DRILL_ALIGN_RATE,
  DIAMANDIS_DRILL_ALIGN_TICKS,
  DIAMANDIS_DRILL_CORRECT_RAD,
  DIAMANDIS_DRILL_CORRECT_TICKS,
  DIAMANDIS_DRILL_PEAK_SPEED,
  DIAMANDIS_DRILL_RECOIL_TICKS,
  DIAMANDIS_DRILL_RECOIL_TILES,
  DIAMANDIS_DRILL_RUN_TILES,
  DIAMANDIS_DRILL_SKID_RECOVERY_TICKS,
  DIAMANDIS_DRILL_TIP_AHEAD,
  DIAMANDIS_DRILL_TIP_RADIUS,
  DIAMANDIS_DRILL_WALL_RECOVERY_TICKS,
  angleBetween,
  drillCapsuleHits,
  drillRecoilStepAt,
  drillSpeedFractionAt,
  drillSpeedProfile,
  drillSpinAt,
  drillSpinDown,
  drillStageAt,
  drillStepAt,
  drillTipAt,
  octantOf,
  turnToward,
} from '../src/diamandis-drill';
import {
  DIAMANDIS_DRILL_DAMAGE,
  DIAMANDIS_DRILL_SPEED,
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_WINDUP_TICKS,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ROCK,
  SURF_NONE,
  TICK_HZ,
} from '../src/constants';
import type { Entity, EntityAction, SemanticEvent, SurvivalState, Vec2 } from '../src/types';

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

/** Arena limpa (raio 30) com o chefe em `offset` do jogador, DORMINDO. */
const stage = (seed: number, offset: Vec2) => {
  const state = createRun({ seed });
  state.player.x = Math.floor(state.config.width / 2) + 0.5;
  state.player.y = Math.floor(state.config.height / 2) + 0.5;
  state.player.hp = 1000;
  state.player.maxHp = 1000;
  clearArena(state, 30);
  state.enemies = [];
  const boss = spawnEnemy(
    state,
    'diamandis',
    Math.floor(state.player.x + offset.x),
    Math.floor(state.player.y + offset.y),
    false,
  );
  // Sem ferramentas e sem perseguicao propria: so a broca que o teste arma.
  boss.nextActionAt = Infinity;
  boss.rangedReadyAt = Infinity;
  return { state, boss };
};

const arm = (state: SurvivalState, boss: Entity, dir: Vec2, target?: number): SemanticEvent[] => {
  const events: SemanticEvent[] = [];
  const len = Math.hypot(dir.x, dir.y);
  startAction(
    state,
    boss,
    'drill',
    { x: dir.x / len, y: dir.y / len },
    DIAMANDIS_DRILL_WINDUP_TICKS,
    DIAMANDIS_DRILL_TICKS,
    events,
    target,
  );
  return events;
};

const run = (state: SurvivalState, ticks: number): SemanticEvent[] => {
  const out: SemanticEvent[] = [];
  for (let i = 0; i < ticks; i++) out.push(...stepRun(state, [emptyCommand()]).events);
  return out;
};

const moments = (events: SemanticEvent[], state: string) =>
  events.filter((e) => e.t === 'boss_state' && e.archetype === 'diamandis' && e.state === state);

describe('o perfil de velocidade', () => {
  it('solavanco, aceleracao forte no primeiro terco, maximo no meio, derrapagem no fim', () => {
    expect(drillSpeedProfile(0)).toBeGreaterThan(0.2);
    expect(drillSpeedProfile(0)).toBeLessThan(0.4);
    // Sobe monotonicamente ate o maximo...
    let last = drillSpeedProfile(0);
    for (let u = 0.01; u <= 0.34; u += 0.01) {
      const v = drillSpeedProfile(u);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      last = v;
    }
    expect(drillSpeedProfile(0.34)).toBeCloseTo(1, 6);
    expect(drillSpeedProfile(0.5)).toBe(1);
    // ...e cai na derrapagem ate quase parar, sem nunca parar.
    last = 1;
    for (let u = 0.69; u < 1; u += 0.01) {
      const v = drillSpeedProfile(u);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      last = v;
    }
    expect(drillSpeedProfile(0.999)).toBeGreaterThan(0.1);
    expect(drillSpeedProfile(0.999)).toBeLessThan(0.2);
  });

  it('a soma dos passos e o alcance de sempre; o pico e bem maior que a media', () => {
    let sum = 0;
    for (let k = 0; k < DIAMANDIS_DRILL_TICKS; k++) sum += drillStepAt(k);
    expect(sum).toBeCloseTo(DIAMANDIS_DRILL_RUN_TILES, 9);
    expect(DIAMANDIS_DRILL_RUN_TILES).toBeCloseTo(
      (DIAMANDIS_DRILL_SPEED * DIAMANDIS_DRILL_TICKS) / TICK_HZ,
    );
    expect(DIAMANDIS_DRILL_PEAK_SPEED).toBeGreaterThan(DIAMANDIS_DRILL_SPEED * 1.25);
    expect(drillStepAt(-1)).toBe(0);
    expect(drillStepAt(DIAMANDIS_DRILL_TICKS)).toBe(0);
    expect(drillSpeedFractionAt(20)).toBe(1);
  });

  it('o recuo e um tranco que morre, e soma o recuo inteiro', () => {
    let sum = 0;
    let last = Infinity;
    for (let j = 0; j < DIAMANDIS_DRILL_RECOIL_TICKS; j++) {
      const s = drillRecoilStepAt(j);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThan(last);
      last = s;
      sum += s;
    }
    expect(sum).toBeCloseTo(DIAMANDIS_DRILL_RECOIL_TILES, 9);
    expect(drillRecoilStepAt(DIAMANDIS_DRILL_RECOIL_TICKS)).toBe(0);
  });
});

describe('o giro compartilhado', () => {
  const action: EntityAction = {
    kind: 'drill',
    phase: 'windup',
    startedAt: 100,
    releaseAt: 100 + DIAMANDIS_DRILL_WINDUP_TICKS,
    endsAt: 100 + DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS,
    direction: { x: 1, y: 0 },
  };

  it('quase parado no alinhamento, acelerando visivelmente ate o release, maximo no meio', () => {
    expect(drillSpinAt(action, 100)).toBe(0);
    expect(drillSpinAt(action, 100 + DIAMANDIS_DRILL_ALIGN_TICKS)).toBeLessThanOrEqual(0.06);
    let last = drillSpinAt(action, 100 + DIAMANDIS_DRILL_ALIGN_TICKS);
    let lastDelta = 0;
    for (let t = DIAMANDIS_DRILL_ALIGN_TICKS + 1; t < DIAMANDIS_DRILL_WINDUP_TICKS; t++) {
      const v = drillSpinAt(action, 100 + t);
      expect(v).toBeGreaterThanOrEqual(last);
      // A curva e convexa: cada tick sobe mais que o anterior.
      expect(v - last).toBeGreaterThanOrEqual(lastDelta - 1e-9);
      lastDelta = v - last;
      last = v;
    }
    expect(drillSpinAt(action, action.releaseAt)).toBeCloseTo(0.8, 6);
    expect(drillSpinAt(action, action.releaseAt + 20)).toBe(1);
    expect(drillSpinAt(action, action.endsAt - 1)).toBeLessThan(1);
    expect(drillSpinAt(action, action.endsAt - 1)).toBeGreaterThan(0.8);
    // Tick fracionario: continua entre os vizinhos.
    const a = drillSpinAt(action, 120);
    const b = drillSpinAt(action, 121);
    const m = drillSpinAt(action, 120.5);
    expect(m).toBeGreaterThan(Math.min(a, b));
    expect(m).toBeLessThan(Math.max(a, b));
  });

  it('o impacto TRAVA a ferramenta em dois ticks; a recuperacao engasga ate zero', () => {
    const impactAt = action.releaseAt + 20;
    expect(drillSpinAt(action, impactAt, impactAt)).toBeCloseTo(0.8, 6);
    expect(drillSpinAt(action, impactAt + 2, impactAt)).toBeCloseTo(0.15, 6);
    expect(drillSpinAt(action, impactAt + 6, impactAt)).toBeCloseTo(0.15, 6);
    expect(drillSpinDown(0.85, 0, 14)).toBeGreaterThan(0.7);
    expect(drillSpinDown(0.85, 14, 14)).toBe(0);
    expect(drillSpinDown(0.15, 7, 30)).toBeLessThan(0.15);
    expect(drillSpinDown(0.15, 7, 30)).toBeGreaterThan(0);
  });

  it('os estagios tem nome', () => {
    expect(drillStageAt(action, 100)).toBe('align');
    expect(drillStageAt(action, 100 + DIAMANDIS_DRILL_ALIGN_TICKS)).toBe('spool');
    expect(drillStageAt(action, action.releaseAt)).toBe('lurch');
    expect(drillStageAt(action, action.releaseAt + 8)).toBe('accelerate');
    expect(drillStageAt(action, action.releaseAt + 20)).toBe('peak');
    expect(drillStageAt(action, action.endsAt - 1)).toBe('skid');
    expect(drillStageAt({ ...action, kind: 'beam' }, 100)).toBeNull();
  });
});

describe('a geometria', () => {
  it('turnToward gira no maximo a taxa e cai exato no alvo', () => {
    const from = { x: 1, y: 0 };
    const to = { x: 0, y: 1 };
    const one = turnToward(from, to, Math.PI / 8);
    expect(Math.abs(angleBetween(from, one))).toBeCloseTo(Math.PI / 8, 9);
    expect(turnToward(from, to, Math.PI)).toEqual(to);
    expect(turnToward(from, { x: -1, y: 0 }, 0.1)).not.toEqual({ x: -1, y: 0 });
    expect(octantOf({ x: 1, y: 0 })).toBe(0);
    expect(octantOf({ x: 0, y: 1 })).toBe(2);
    expect(octantOf({ x: -1, y: 0 })).toBe(4);
    expect(octantOf({ x: 0, y: -1 })).toBe(6);
  });

  it('a capsula fere ate a ponta e nao alem, e nao de lado', () => {
    const dir = { x: 1, y: 0 };
    const tip = drillTipAt(10, 10, dir);
    expect(tip.x).toBeCloseTo(10 + DIAMANDIS_DRILL_TIP_AHEAD);
    const r = 0.4;
    expect(drillCapsuleHits(10, 10, dir, tip.x, 10, r)).toBe(true);
    expect(
      drillCapsuleHits(10, 10, dir, tip.x + DIAMANDIS_DRILL_TIP_RADIUS + r + 0.05, 10, r),
    ).toBe(false);
    expect(drillCapsuleHits(10, 10, dir, 11, 10 + DIAMANDIS_DRILL_TIP_RADIUS + r + 0.05, r)).toBe(
      false,
    );
    expect(drillCapsuleHits(10, 10, dir, 11, 10 + DIAMANDIS_DRILL_TIP_RADIUS + r - 0.05, r)).toBe(
      true,
    );
    // Atras do chassi: nao.
    expect(drillCapsuleHits(10, 10, dir, 8.6, 10, r)).toBe(false);
  });
});

describe('o alinhamento', () => {
  it('o chassi gira ate o rumo a taxa fixa, clica por oitante e trava uma vez', () => {
    const { state, boss } = stage(701, { x: 12, y: 0 });
    boss.facing = { x: 0, y: -1 }; // olhando para o norte; o corredor vai para oeste
    const start = arm(state, boss, { x: -1, y: 0 });
    expect(boss.facing).toEqual({ x: 0, y: -1 });
    expect(start.some((e) => e.t === 'boss_windup' && e.ability === 'drill')).toBe(true);
    const events: SemanticEvent[] = [];
    const facings: Vec2[] = [];
    for (let i = 0; i < DIAMANDIS_DRILL_WINDUP_TICKS - 1; i++) {
      events.push(...stepRun(state, [emptyCommand()]).events);
      facings.push({ ...boss.facing });
    }
    // Um quarto de volta a PI/12 por tick: 6 ticks de giro, cada um do tamanho certo.
    for (let i = 0; i < 5; i++) {
      const step = Math.abs(angleBetween(facings[i], facings[i + 1]));
      expect(step).toBeCloseTo(DIAMANDIS_DRILL_ALIGN_RATE, 6);
    }
    expect(facings[5]).toEqual({ x: -1, y: 0 });
    expect(facings[6]).toEqual({ x: -1, y: 0 });
    const lock = moments(events, 'drill_lock');
    expect(lock.length).toBe(1);
    expect(lock[0].t === 'boss_state' && lock[0].dx).toBe(-1);
    // Norte (6) -> oeste (4): dois cliques do mancal (7 e depois 4... via 5).
    expect(moments(events, 'drill_bearing').length).toBe(2);
    expect(moments(events, 'drill_impact').length).toBe(0);
    // O chassi nao saiu do lugar.
    expect(Math.hypot(boss.x - (state.player.x + 12), boss.y - state.player.y)).toBeLessThan(1);
  });

  it('ja alinhado: trava no primeiro tick, sem clique nenhum', () => {
    const { state, boss } = stage(702, { x: 12, y: 0 });
    boss.facing = { x: -1, y: 0 };
    arm(state, boss, { x: -1, y: 0 });
    const events = run(state, 3);
    expect(moments(events, 'drill_lock').length).toBe(1);
    expect(moments(events, 'drill_bearing').length).toBe(0);
  });
});

describe('a corrida', () => {
  it('parado no aviso; depois solavanco, aceleracao, maximo, derrapagem — o alcance de sempre', () => {
    const { state, boss } = stage(703, { x: 12, y: 0 });
    boss.facing = { x: -1, y: 0 };
    arm(state, boss, { x: -1, y: 0 });
    const x0 = boss.x;
    run(state, DIAMANDIS_DRILL_WINDUP_TICKS - 1);
    expect(boss.x).toBe(x0);
    const steps: number[] = [];
    let last = boss.x;
    for (let k = 0; k < DIAMANDIS_DRILL_TICKS; k++) {
      stepRun(state, [emptyCommand()]);
      steps.push(last - boss.x);
      last = boss.x;
    }
    expect(steps[0]).toBeCloseTo(drillStepAt(0), 9);
    expect(steps[20]).toBeCloseTo(drillStepAt(20), 9);
    expect(steps[45]).toBeCloseTo(drillStepAt(45), 9);
    expect(Math.max(...steps)).toBeGreaterThan(steps[0] * 3);
    expect(steps[45]).toBeLessThan(steps[20] * 0.25);
    expect(x0 - boss.x).toBeCloseTo(DIAMANDIS_DRILL_RUN_TILES, 6);
    // A acao morre no tick `endsAt`, que e o proximo.
    stepRun(state, [emptyCommand()]);
    expect(boss.action).toBeUndefined();
    expect(x0 - boss.x).toBeCloseTo(DIAMANDIS_DRILL_RUN_TILES, 6);
  });

  it('passar reto e DERRAPAGEM: um `drill_skid` no ultimo tick e recuperacao curta', () => {
    const { state, boss } = stage(704, { x: 12, y: 0 });
    boss.facing = { x: -1, y: 0 };
    arm(state, boss, { x: -1, y: 0 });
    const events = run(state, DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS);
    const skid = moments(events, 'drill_skid');
    expect(skid.length).toBe(1);
    expect(moments(events, 'drill_impact').length).toBe(0);
    const endTick = state.tick;
    expect(state.bossRuntime.staggerUntil).toBe(endTick - 1 + DIAMANDIS_DRILL_SKID_RECOVERY_TICKS);
    // Parado durante a recuperacao...
    const x = boss.x;
    run(state, DIAMANDIS_DRILL_SKID_RECOVERY_TICKS - 1);
    expect(boss.x).toBe(x);
  });

  it('bater em MINERIO e IMPACTO: contato exato, recuo, recuperacao longa, minerio de pe', () => {
    const { state, boss } = stage(705, { x: 12, y: 0 });
    const w = state.config.width;
    boss.facing = { x: -1, y: 0 };
    const wallX = Math.floor(boss.x) - 5;
    for (let dy = -3; dy <= 3; dy++) state.solid[(Math.floor(boss.y) + dy) * w + wallX] = SOLID_ORE;
    arm(state, boss, { x: -1, y: 0 });
    const events = run(state, DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS);
    const impact = moments(events, 'drill_impact');
    expect(impact.length).toBe(1);
    expect(moments(events, 'drill_skid').length).toBe(0);
    const ev = impact[0];
    if (ev.t !== 'boss_state') return;
    expect(ev.x).toBeCloseTo(wallX + 0.5, 6);
    expect(ev.dx).toBe(-1);
    expect(ev.intensity).toBeGreaterThan(0.3);
    const impactAt = state.bossRuntime.drillImpactAt;
    expect(impactAt).toBeGreaterThan(0);
    // O corpo parou encostado no veio e depois RECUOU o recuo inteiro.
    const nearest = wallX + 1 + boss.radius;
    expect(boss.x).toBeGreaterThan(nearest + DIAMANDIS_DRILL_RECOIL_TILES - 0.3);
    expect(boss.action).toBeUndefined();
    expect(state.bossRuntime.staggerUntil).toBe(
      impactAt + 1 + DIAMANDIS_DRILL_RECOIL_TICKS + DIAMANDIS_DRILL_WALL_RECOVERY_TICKS,
    );
    expect(DIAMANDIS_DRILL_WALL_RECOVERY_TICKS).toBeGreaterThan(
      DIAMANDIS_DRILL_SKID_RECOVERY_TICKS * 2,
    );
    let ore = 0;
    for (let dy = -3; dy <= 3; dy++)
      if (state.solid[(Math.floor(boss.y) + dy) * w + wallX] === SOLID_ORE) ore++;
    expect(ore).toBe(7);
  });

  it('a borda do mapa tambem e parede: impacto, nunca um chefe raspando ate o fim', () => {
    const state = createRun({ seed: 706 });
    state.player.x = 4.5;
    state.player.y = Math.floor(state.config.height / 2) + 0.5;
    clearArena(state, 30);
    state.enemies = [];
    const boss = spawnEnemy(state, 'diamandis', 14, Math.floor(state.player.y), false);
    boss.nextActionAt = Infinity;
    boss.rangedReadyAt = Infinity;
    boss.facing = { x: -1, y: 0 };
    arm(state, boss, { x: -1, y: 0 });
    const events = run(state, DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS);
    expect(moments(events, 'drill_impact').length).toBe(1);
    expect(boss.x).toBeGreaterThan(1 + boss.radius);
  });
});

describe('a ponta que fere', () => {
  const armToward = (state: SurvivalState, boss: Entity) => {
    boss.facing = { x: -1, y: 0 };
    arm(state, boss, { x: -1, y: 0 }, state.player.id);
    run(state, DIAMANDIS_DRILL_WINDUP_TICKS - 1);
  };

  it('fere no tick em que a ponta chega, e nao antes', () => {
    const { state, boss } = stage(707, { x: 12, y: 0 });
    armToward(state, boss);
    const hp0 = state.player.hp;
    let hitTick = -1;
    for (let k = 0; k < DIAMANDIS_DRILL_TICKS; k++) {
      const before = boss.x;
      stepRun(state, [emptyCommand()]);
      if (state.player.hp < hp0) {
        hitTick = k;
        // No tick anterior a ponta ainda nao alcancava; agora alcanca.
        const tipBefore = before - DIAMANDIS_DRILL_TIP_AHEAD;
        const tipNow = boss.x - DIAMANDIS_DRILL_TIP_AHEAD;
        const reach = DIAMANDIS_DRILL_TIP_RADIUS + state.player.radius;
        expect(tipNow - state.player.x).toBeLessThan(reach);
        expect(tipBefore - state.player.x).toBeGreaterThanOrEqual(reach - 1e-9);
        break;
      }
    }
    expect(hitTick).toBeGreaterThan(0);
    expect(hp0 - state.player.hp).toBeCloseTo(DIAMANDIS_DRILL_DAMAGE, 6);
  });

  it('acertar o jogador e um `drill_strike` no jogador, com a velocidade do momento', () => {
    const { state, boss } = stage(708, { x: 12, y: 0 });
    armToward(state, boss);
    const events = run(state, DIAMANDIS_DRILL_TICKS);
    const strikes = moments(events, 'drill_strike');
    expect(strikes.length).toBeGreaterThanOrEqual(1);
    const s = strikes[0];
    if (s.t !== 'boss_state') return;
    expect(s.x).toBeCloseTo(state.player.x, 6);
    expect(s.intensity).toBeGreaterThan(0.5);
  });

  it('de lado da linha, a ponta passa sem ferir', () => {
    const { state, boss } = stage(709, { x: 12, y: 0 });
    state.player.y += 1.6;
    boss.facing = { x: -1, y: 0 };
    arm(state, boss, { x: -1, y: 0 });
    const hp0 = state.player.hp;
    run(state, DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS);
    expect(state.player.hp).toBe(hp0);
  });
});

describe('a correcao minima', () => {
  it('alguns graus nos primeiros ticks, e depois nada — mesmo com o alvo andando', () => {
    const { state, boss } = stage(710, { x: 14, y: 0 });
    boss.facing = { x: -1, y: 0 };
    arm(state, boss, { x: -1, y: 0 }, state.player.id);
    run(state, DIAMANDIS_DRILL_WINDUP_TICKS - 1);
    // O alvo saiu bem da linha durante o aviso.
    state.player.y += 5;
    const locked = { x: -1, y: 0 };
    run(state, DIAMANDIS_DRILL_CORRECT_TICKS);
    const corrected = Math.abs(angleBetween(locked, boss.action!.direction));
    expect(corrected).toBeGreaterThan(0);
    expect(corrected).toBeLessThanOrEqual(DIAMANDIS_DRILL_CORRECT_RAD + 1e-9);
    const after = { ...boss.action!.direction };
    run(state, 10);
    expect(boss.action!.direction).toEqual(after);
    // E o passo lateral acumulado e pequeno: ninguem foi perseguido.
    expect(Math.abs(boss.y - state.player.y)).toBeGreaterThan(3.5);
  });
});

describe('os oito rumos', () => {
  const dirs: Vec2[] = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
  ];
  it('correm a mesma distancia, no rumo travado, e derrapam no fim', () => {
    for (const dir of dirs) {
      const { state, boss } = stage(720, { x: -dir.x * 8, y: -dir.y * 8 });
      const len = Math.hypot(dir.x, dir.y);
      boss.facing = { x: dir.x / len, y: dir.y / len };
      arm(state, boss, dir);
      const x0 = boss.x;
      const y0 = boss.y;
      const events = run(state, DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS);
      const label = `rumo ${dir.x},${dir.y}`;
      expect(moments(events, 'drill_impact').length, label).toBe(0);
      expect(moments(events, 'drill_skid').length, label).toBe(1);
      const dx = boss.x - x0;
      const dy = boss.y - y0;
      expect(Math.hypot(dx, dy), label).toBeCloseTo(DIAMANDIS_DRILL_RUN_TILES, 4);
      expect(Math.abs(angleBetween({ x: dx, y: dy }, dir)), label).toBeLessThan(1e-6);
      expect(boss.facing.x, label).toBeCloseTo(dir.x / len, 9);
      expect(boss.facing.y, label).toBeCloseTo(dir.y / len, 9);
    }
  });
});

describe('determinismo', () => {
  it('duas maquinas, o mesmo impacto, o mesmo hash', () => {
    const build = () => {
      const { state, boss } = stage(730, { x: 12, y: 0 });
      const w = state.config.width;
      const wallX = Math.floor(boss.x) - 6;
      for (let dy = -3; dy <= 3; dy++)
        state.solid[(Math.floor(boss.y) + dy) * w + wallX] = SOLID_ORE;
      boss.facing = { x: 0, y: 1 };
      arm(state, boss, { x: -1, y: 0 }, state.player.id);
      return state;
    };
    const a = build();
    const b = build();
    for (let i = 0; i < 120; i++) {
      stepRun(a, [emptyCommand()]);
      stepRun(b, [emptyCommand()]);
      expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    }
    expect(a.bossRuntime.drillImpactAt).toBeGreaterThan(0);
  });
});

describe('a revisao', () => {
  it('a ponta fere quem esta DENTRO da capsula, nao quem esta mais perto do centro', () => {
    const { state, boss } = stage(740, { x: 12, y: 0 });
    // Um segundo jogador de pe ao lado do chassi, fora da capsula.
    const first = state.player;
    const second = { ...first, id: first.id + 1000, slot: 1, x: boss.x, y: boss.y + 1.0 };
    state.players.push(second);
    state.playerExtras[1] = { ...state.playerExtras[0], joined: true, downed: false };
    // O primeiro na PONTA, dentro da capsula, a 1,6 tiles a frente.
    first.x = boss.x - 1.6;
    first.y = boss.y;
    boss.facing = { x: -1, y: 0 };
    boss.action = {
      kind: 'drill',
      phase: 'release',
      startedAt: state.tick - 1,
      releaseAt: state.tick - 1,
      endsAt: state.tick + DIAMANDIS_DRILL_TICKS,
      direction: { x: -1, y: 0 },
    };
    boss.contactReadyAt = 0;
    const hp = first.hp;
    stepRun(state, [emptyCommand(), emptyCommand()]);
    expect(first.hp).toBeLessThan(hp);
    expect(second.hp).toBe(hp);
  });

  it('na diagonal, um canto que pega em rocha nao dobra o passo: o alcance continua exato', () => {
    const { state, boss } = stage(741, { x: 10, y: 10 });
    const w = state.config.width;
    // Rocha em TUDO fora de um corredor estreito na diagonal: as faixas comem
    // o que esta a frente, e os cantos do corpo pegam no que sobra ao lado.
    const bx = Math.floor(boss.x);
    const by = Math.floor(boss.y);
    for (let y = by - 24; y <= by + 3; y++) {
      for (let x = bx - 24; x <= bx + 3; x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
        const along = (bx - x + (by - y)) / 2;
        const lateral = Math.abs(bx - x - (by - y)) / 2;
        if (lateral <= 0.6 && along >= -2) continue;
        state.solid[y * w + x] = SOLID_ROCK;
      }
    }
    state.player.x = boss.x - 12;
    state.player.y = boss.y - 12;
    boss.facing = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
    arm(state, boss, { x: -1, y: -1 });
    const x0 = boss.x;
    const y0 = boss.y;
    const events = run(state, DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS);
    expect(moments(events, 'drill_impact').length).toBe(0);
    expect(Math.hypot(boss.x - x0, boss.y - y0)).toBeCloseTo(DIAMANDIS_DRILL_RUN_TILES, 3);
    expect(Math.abs(boss.x - x0 - (boss.y - y0))).toBeLessThan(1e-6);
  });
});
