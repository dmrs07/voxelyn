import { describe, expect, it } from 'vitest';
import { createRun, stepRun, emptyCommand, hashAuthoritativeState } from '../src/run';
import {
  bodyBlocked,
  damageEntity,
  spawnEnemy,
  startAction,
  stunEntity,
  updateEnemies,
} from '../src/entities';
import {
  createSutures,
  cutSuture,
  cutsTether,
  hitSutures,
  loadedSutureAnchor,
  SILK_CUT_EXPOSED_FROM,
  stepSutures,
  stitcherStep,
  sutureObjective,
  suturePoint,
  tetherEndpoint,
} from '../src/sutures';
import {
  dropSeamstress,
  SEAMSTRESS_ASCEND_TICKS,
  SEAMSTRESS_COCOON_TICKS,
  SEAMSTRESS_CONTACT_GRACE,
  SEAMSTRESS_DESCEND_TICKS,
  SEAMSTRESS_WEBBED_TICKS,
  SEAMSTRESS_DROP_TICKS,
  SEAMSTRESS_STAGE_ALOFT,
  SEAMSTRESS_STAGE_ASCENDING,
  SEAMSTRESS_STAGE_DESCENDING,
  SEAMSTRESS_STAGE_FRENZY,
  SILK_FRENZY_HELPER_CAP,
  SILK_FRENZY_STITCHERS,
  seamstressTargetable,
  silkLift,
  silkCanLand,
  silkLanding,
  silkStrike,
  SILK_NEEDLE_REACH,
  SILK_STRIKE_RADIUS,
  summonSilkBrood,
} from '../src/seamstress';
import { SOLID_NONE, SOLID_ROCK, SOLID_SUTURE_ANCHOR } from '../src/constants';
import {
  isWebStrand,
  webAnchors,
  webCovers,
  webIntegrity,
  webSpeedMul,
  WEB_ARMOR,
  WEB_ARMOR_THRESHOLD,
  WEB_SLOW,
} from '../src/web';
import type { Entity, SemanticEvent, SurvivalState } from '../src/types';

const fixture = (players = 1) => {
  const state = createRun({ seed: 1, playerCount: players });
  state.solid.fill(SOLID_NONE);
  state.surface.fill(0);
  state.enemies = [];
  state.tick = 100;
  const w = state.config.width;
  const cells = [13, 14, 15, 16, 17, 18].map((x) => 20 * w + x);
  state.sutures = createSutures([
    {
      id: 0,
      a: cells[0] - 1,
      b: cells[5] + 1,
      cells,
      slabCells: cells.slice(2, 4),
      kind: 'roof',
      objective: true,
    },
  ]);
  state.solid[state.sutures[0].a] = state.solid[state.sutures[0].b] = SOLID_SUTURE_ANCHOR;
  const queen = spawnEnemy(state, 'seamstress', 10, 20, false);
  state.bossRuntime.awake = true;
  state.players.forEach((p, slot) => {
    p.x = 16.3;
    p.y = 20.5 + slot * 0.2;
    state.playerExtras[slot].iframesUntil = 0;
  });
  return { state, queen };
};
const arm = (state: SurvivalState, queen: Entity) => {
  startAction(state, queen, 'tether', { x: 1, y: 0 }, 4, 30, [], state.player.id);
  queen.action!.silkFlight = {
    fromX: queen.x,
    fromY: queen.y,
    toX: 15.5,
    toY: 20.5,
    landAt: state.tick + 14,
    impactAt: state.tick + 18,
    anchor: state.sutures[0].b,
  };
  queen.nextActionAt = state.tick + 100;
};
const until = (state: SurvivalState, tick: number): SemanticEvent[] => {
  const events: SemanticEvent[] = [];
  while (state.tick < tick) {
    state.tick++;
    updateEnemies(state, events);
  }
  return events;
};

describe('Cerzideira: single support, arrival strike and jumping brood', () => {
  it.each([66, 177])(
    'seed %i generates enough supports to attack twice and summon helpers',
    (seed) => {
      const state = createRun({ seed, sector: 3 });
      const queen = state.enemies.find((e) => e.archetype === 'seamstress')!;
      expect(queen).toBeDefined();
      const anchors = [
        ...new Set(state.sutures.filter((s) => s.encounter).flatMap((s) => [s.a, s.b])),
      ].filter((i) => {
        const p = suturePoint(state, i);
        const distance = Math.hypot(p.x - queen.x, p.y - queen.y);
        return state.solid[i] === SOLID_SUTURE_ANCHOR && distance >= 3 && distance <= 24;
      });
      expect(anchors.length).toBeGreaterThanOrEqual(2);
      expect(hashAuthoritativeState(createRun({ seed, sector: 3 }))).toBe(
        hashAuthoritativeState(state),
      );
      expect(silkCanLand(state, queen, queen.x, queen.y)).toBe(true);

      // Use the generated terrain and the real AI, without arming a tether or injecting helpers.
      state.playerExtra.iframesUntil = 10000;
      state.enemies = [queen];
      const origin = { x: queen.x, y: queen.y };
      const events: SemanticEvent[] = [];
      for (let n = 0; n < 8; n++) {
        const target = silkLanding(state, state.player, {
          x: origin.x + Math.cos((n * Math.PI) / 4) * 6,
          y: origin.y + Math.sin((n * Math.PI) / 4) * 6,
        });
        if (!target) continue;
        state.player.x = target.x;
        state.player.y = target.y;
        events.push(...until(state, state.tick + 80));
        if (state.enemies.some((e) => e.summonerId === queen.id)) break;
      }
      expect(queen.silk!.lunges).toBeGreaterThanOrEqual(2);
      expect(
        events.filter((e) => e.t === 'boss_attack' && e.ability === 'tether').length,
      ).toBeGreaterThanOrEqual(2);
      const helpers = state.enemies.filter((e) => e.alive && e.summonerId === queen.id);
      expect(helpers.some((e) => e.archetype === 'seamstress_brood')).toBe(true);
      expect(helpers.length).toBeLessThanOrEqual(4);
    },
  );
  it('removes chamber hazards while preserving independent colony sutures', () => {
    const { state } = fixture();
    const chamber = state.sutures[0];
    expect(chamber.encounter).toBe(true);
    expect(cutSuture(state, chamber, [])).toBe(false);
    expect(sutureObjective(state).total).toBe(0);
    chamber.closeAt = chamber.whipAt = chamber.fallAt = 100;
    const hp = state.player.hp;
    stepSutures(state, []);
    expect(state.player.hp).toBe(hp);
    expect(state.solid[chamber.cells[2]]).toBe(SOLID_NONE);
  });
  it('keeps the selected anchor and landing even after direction or position changes', () => {
    const { state, queen } = fixture();
    arm(state, queen);
    queen.action!.direction = { x: -1, y: 0 };
    queen.x = 17;
    expect(loadedSutureAnchor(state, queen, state.sutures[0])).toEqual({ x: 19.5, y: 20.5 });
    expect(tetherEndpoint(state, queen, state.sutures[0])).toEqual({ x: 15.5, y: 20.5 });
  });
  it('flies through internal rock, does not hit bodies in transit, and strikes on exactly one tick', () => {
    const { state, queen } = fixture();
    arm(state, queen);
    for (const y of [19, 20, 21]) state.solid[y * state.config.width + 13] = SOLID_ROCK;
    state.player.x = 11.5;
    until(state, 109);
    expect(queen.x).toBeGreaterThan(12.5);
    expect(silkLift(queen, state.tick)).toBeGreaterThan(30);
    expect(state.player.hp).toBe(state.player.maxHp);
    state.player.x = 16.3;
    const before = until(state, 117);
    expect(before.some((e) => e.t === 'boss_attack')).toBe(false);
    expect(state.player.hp).toBe(state.player.maxHp);
    const impact = until(state, 118);
    expect(impact.filter((e) => e.t === 'boss_attack')).toHaveLength(1);
    expect(impact.filter((e) => e.t === 'hit')).toHaveLength(1);
    expect(state.player.hp).toBe(state.player.maxHp - 24);
    until(state, 132);
    expect(state.player.hp).toBe(state.player.maxHp - 24);
    expect(bodyBlocked(state, queen, queen.x, queen.y)).toBe(false);
  });
  it('resolves every live partner once and consumes a dodged impact', () => {
    const { state, queen } = fixture(2);
    arm(state, queen);
    state.playerExtras[0].iframesUntil = 119;
    until(state, 132);
    expect(state.players[0].hp).toBe(state.players[0].maxHp);
    expect(state.players[1].hp).toBe(state.players[1].maxHp - 24);
  });
  it('cutting the exposed cable cancels the strike, lands safely, and exposes 36 ticks', () => {
    const { state, queen } = fixture();
    arm(state, queen);
    until(state, 109);
    for (const y of [19, 20, 21])
      state.solid[y * state.config.width + Math.floor(queen.x)] = SOLID_ROCK;
    const armored = queen.hp;
    damageEntity(state, queen, 20, []);
    expect(armored - queen.hp).toBe(11);
    const events: SemanticEvent[] = [];
    hitSutures(state, { x: 17.5, y: 19.5 }, { x: 17.5, y: 21.5 }, events, 0);
    expect(queen.action).toBeUndefined();
    expect(queen.stunnedUntil).toBe(109 + SEAMSTRESS_DROP_TICKS);
    expect(bodyBlocked(state, queen, queen.x, queen.y)).toBe(false);
    expect(state.sutures[0].phase).toBe('taut');
    expect(state.sutures[0].whipAt).toBe(-1);
    const hp = queen.hp;
    damageEntity(state, queen, 20, []);
    expect(hp - queen.hp).toBe(30);
    expect(until(state, 132).some((e) => e.t === 'hit' || e.t === 'boss_attack')).toBe(false);
  });
  it('only a transversal shot across the exposed stretch cuts the active tether', () => {
    const body = { x: 10, y: 20 },
      anchor = { x: 20, y: 20 };
    // De baixo do fio, mirando no corpo: colinear, nao conta.
    expect(cutsTether({ x: 16, y: 20.05 }, { x: 15, y: 20.02 }, body, anchor)).toBe(false);
    // Rasante a 15 graus, tambem nao.
    expect(cutsTether({ x: 16, y: 20.5 }, { x: 14, y: 19.96 }, body, anchor)).toBe(false);
    // Cruzando de lado, mas colado ao corpo: protegido.
    expect(cutsTether({ x: 11, y: 19 }, { x: 11, y: 21 }, body, anchor)).toBe(false);
    // Cruzando de lado no trecho exposto: corta.
    expect(
      cutsTether(
        { x: 10 + SILK_CUT_EXPOSED_FROM, y: 19 },
        { x: 10 + SILK_CUT_EXPOSED_FROM, y: 21 },
        body,
        anchor,
      ),
    ).toBe(true);
    expect(cutsTether({ x: 15, y: 22 }, { x: 16, y: 18 }, body, anchor)).toBe(true);
    // Na simulacao: o tiro de quem esta debaixo do fio, no corpo dela, nao a derruba.
    const { state, queen } = fixture();
    arm(state, queen);
    until(state, 109);
    const under = { x: queen.x + 4, y: queen.y + 0.1 };
    hitSutures(state, under, { x: queen.x + 3.2, y: queen.y + 0.08 }, [], 0);
    expect(queen.action).toBeDefined();
    hitSutures(
      state,
      { x: queen.x + 3, y: queen.y - 1 },
      { x: queen.x + 3, y: queen.y + 1 },
      [],
      0,
    );
    expect(queen.action).toBeUndefined();
  });
  it('lands so the needle falls on the locked mark, and refuses supports that cannot reach it', () => {
    const { state, queen } = fixture();
    // Alvo parado fora da linha do fio, dentro do alcance da agulha.
    state.player.x = 16.3;
    state.player.y = 21.7;
    stitcherStep(state, queen, state.player, 0.05, []);
    expect(queen.action?.kind).toBe('tether');
    const hit = silkStrike(queen);
    expect(Math.hypot(hit.x - state.player.x, hit.y - state.player.y)).toBeLessThan(
      SILK_STRIKE_RADIUS - 0.1,
    );
    const f = queen.action!.silkFlight!;
    expect(Math.hypot(f.toX - state.player.x, f.toY - state.player.y)).toBeCloseTo(
      SILK_NEEDLE_REACH,
      1,
    );
    // Alvo mais longe da linha do que a agulha alcanca: nenhum apoio serve, ela caca a pe.
    const again = fixture();
    again.state.player.x = 16.3;
    again.state.player.y = 23.5;
    stitcherStep(again.state, again.queen, again.state.player, 0.05, []);
    expect(again.queen.action).toBeUndefined();
  });
  it('gives no contact strike right after a landing: leaving the mark is a full answer', () => {
    const { state, queen } = fixture();
    state.player.x = 17.5;
    state.player.y = 20.5;
    stitcherStep(state, queen, state.player, 0.05, []);
    expect(queen.action?.kind).toBe('tether');
    const f = queen.action!.silkFlight!;
    expect(queen.contactReadyAt).toBe(f.impactAt + SEAMSTRESS_CONTACT_GRACE);
    // O jogador sai da marca (de lado) e fica a menos de 2 tiles do pouso.
    state.player.x = f.toX + 0.5;
    state.player.y = f.toY + 1.8;
    state.sutures = [];
    until(state, f.impactAt + SEAMSTRESS_CONTACT_GRACE - 1);
    expect(state.player.hp).toBe(state.player.maxHp);
    expect(queen.action?.kind ?? 'none').not.toBe('contact');
  });
  it.each(['support breaks', 'stun', 'landing blocked'])(
    'settles safely if %s changes in flight',
    (reason) => {
      const { state, queen } = fixture();
      arm(state, queen);
      until(state, 109);
      if (reason === 'support breaks') state.solid[state.sutures[0].b] = SOLID_NONE;
      else if (reason === 'stun') {
        state.solid[Math.floor(queen.y) * state.config.width + Math.floor(queen.x)] = SOLID_ROCK;
        stunEntity(state, queen, 12);
      } else for (const y of [19, 20, 21]) state.solid[y * state.config.width + 15] = SOLID_ROCK;
      const hp = state.player.hp;
      until(state, 119);
      expect(bodyBlocked(state, queen, queen.x, queen.y)).toBe(false);
      expect(state.player.hp).toBe(hp);
    },
  );
  it('teaches two lunges alone, then spawns at most three brood and one stitcher', () => {
    const { state, queen } = fixture();
    queen.silk!.lunges = 1;
    summonSilkBrood(state, queen, []);
    expect(state.enemies.filter((e) => e.summonerId)).toHaveLength(0);
    queen.silk!.lunges = 2;
    summonSilkBrood(state, queen, []);
    summonSilkBrood(state, queen, []);
    const helpers = state.enemies.filter((e) => e.summonerId === queen.id);
    expect(helpers).toHaveLength(4);
    expect(helpers.filter((e) => e.archetype === 'stitcher')).toHaveLength(1);
    expect(helpers.filter((e) => e.archetype === 'seamstress_brood')).toHaveLength(3);
    expect(new Set(helpers.map((e) => `${e.x},${e.y}`)).size).toBe(4);
    damageEntity(state, queen, 10000, []);
    expect(state.stats.kills.seamstress_brood).toBe(0);
    expect(helpers.every((e) => !e.alive && !e.action)).toBe(true);
  });
  it.each(['seamstress_brood', 'stitcher'] as const)(
    '%s locks the jump mark and allows dodging the landing',
    (kind) => {
      const { state, queen } = fixture();
      queen.nextActionAt = 10000;
      const helper = spawnEnemy(state, kind, 13, 20, false);
      helper.summonerId = queen.id;
      stitcherStep(state, helper, state.player, 0.05, []);
      const flight = { ...helper.action!.silkFlight! };
      expect(helper.action!.releaseAt - state.tick).toBe(kind === 'stitcher' ? 22 : 14);
      state.player.y += 4;
      until(state, flight.impactAt + 1);
      expect(helper.action!.silkFlight).toEqual(flight);
      expect(helper.x).toBeCloseTo(flight.toX);
      expect(helper.y).toBeCloseTo(flight.toY);
      expect(state.player.hp).toBe(state.player.maxHp);
    },
  );
  it('chains different supports in frenzy and repositions after a drop', () => {
    const { state, queen } = fixture();
    queen.hp = queen.maxHp * 0.45;
    queen.silk!.stage = SEAMSTRESS_STAGE_FRENZY;
    queen.silk!.broodAt = state.tick + 1000;
    stitcherStep(state, queen, state.player, 0.05, []);
    const first = queen.action!.silkFlight!.anchor;
    expect(queen.silk!.comboLeft).toBe(1);
    queen.action = undefined;
    queen.nextActionAt = state.tick;
    queen.x = 17;
    state.player.x = 14;
    stitcherStep(state, queen, state.player, 0.05, []);
    expect(queen.action!.silkFlight!.anchor).not.toBe(first);
    expect(queen.action!.releaseAt - state.tick).toBe(10);
    dropSeamstress(state, queen, []);
    expect(queen.silk!.comboLeft).toBe(0);
    state.tick = queen.stunnedUntil;
    const at = { x: queen.x, y: queen.y };
    stitcherStep(state, queen, state.player, 0.05, []);
    expect(queen.action).toBeUndefined();
    expect(Math.hypot(queen.x - at.x, queen.y - at.y)).toBeGreaterThan(0);
  });
  it('walks around isolated pillars after a drop without clipping the body', () => {
    const { state, queen } = fixture();
    state.sutures = [];
    state.solid.fill(0);
    state.solid[20 * state.config.width + 13] = SOLID_ROCK;
    state.player.x = 17.5;
    for (let i = 0; i < 100; i++) {
      state.tick++;
      updateEnemies(state, []);
      expect(silkCanLand(state, queen, queen.x, queen.y)).toBe(true);
    }
    expect(queen.x).toBeGreaterThan(14);
  });
  it.each(['zero hp', 'dead', 'downed', 'not joined'])(
    'does not strike a player who is %s',
    (condition) => {
      const { state, queen } = fixture();
      arm(state, queen);
      if (condition === 'zero hp') state.player.hp = 0;
      if (condition === 'dead') state.player.alive = false;
      if (condition === 'downed') state.playerExtra.downed = true;
      if (condition === 'not joined') state.playerExtra.joined = false;
      expect(until(state, 119).filter((e) => e.t === 'hit')).toHaveLength(0);
    },
  );
  /** Leva o encontro ate o frenesi pelo fluxo real, com o jogador longe da rainha. */
  const toFrenzy = (state: SurvivalState, queen: Entity): SemanticEvent[] => {
    state.player.x = 30.5;
    state.player.y = 30.5;
    state.playerExtra.iframesUntil = 100000;
    queen.hp = queen.maxHp * 0.45;
    const events: SemanticEvent[] = [];
    for (let n = 0; n < 600 && queen.silk!.stage !== SEAMSTRESS_STAGE_FRENZY; n++) {
      state.tick++;
      updateEnemies(state, events);
    }
    return events;
  };

  it('sobe uma unica vez na metade da vida, tece a teia fora da tela e volta no tick marcado', () => {
    const { state, queen } = fixture();
    state.player.x = 30.5;
    state.player.y = 30.5;
    state.playerExtra.iframesUntil = 100000;
    arm(state, queen);
    queen.hp = queen.maxHp * 0.45;
    const events: SemanticEvent[] = [];
    state.tick++;
    updateEnemies(state, events);
    // Interrompe a puxada e sobe: um unico aviso proprio.
    expect(queen.action).toBeUndefined();
    expect(queen.silk!.stage).toBe(SEAMSTRESS_STAGE_ASCENDING);
    expect(events.filter((e) => e.t === 'boss_state' && e.state === 'ascend')).toHaveLength(1);
    expect(silkLift(queen, state.tick)).toBeGreaterThanOrEqual(38);
    const ascendAt = queen.silk!.stageAt;
    until(state, ascendAt + SEAMSTRESS_ASCEND_TICKS);
    expect(queen.silk!.stage).toBe(SEAMSTRESS_STAGE_ALOFT);
    expect(seamstressTargetable(queen)).toBe(false);
    const hp = queen.hp;
    damageEntity(state, queen, 200, []);
    expect(queen.hp).toBe(hp);
    const web = state.sutures.filter(isWebStrand);
    expect(web.length).toBeGreaterThan(12);
    expect(web.every((s) => s.phase === 'spent')).toBe(true);
    const returnAt = queen.silk!.returnAt;
    expect(returnAt).toBeGreaterThan(state.tick + 100);
    // A teia cresce fio a fio, com o som de cada um.
    const half = until(state, Math.floor((state.tick + returnAt) / 2));
    const woven = web.filter((s) => s.phase === 'taut').length;
    expect(woven).toBeGreaterThan(0);
    expect(woven).toBeLessThan(web.length);
    expect(half.filter((e) => e.t === 'suture' && e.phase === 'taut').length).toBe(woven);
    // Cortar tudo o que ja existe nao adia a volta.
    for (const s of web) if (s.phase === 'taut') cutSuture(state, s, [], 0);
    expect(web.filter((s) => s.phase === 'loose')).toHaveLength(woven);
    const back = until(state, returnAt);
    expect(queen.silk!.stage).toBe(SEAMSTRESS_STAGE_DESCENDING);
    expect(back.some((e) => e.t === 'boss_state' && e.state === 'descend')).toBe(true);
    expect(silkCanLand(state, queen, queen.x, queen.y)).toBe(true);
    const landed = until(state, queen.silk!.stageAt + SEAMSTRESS_DESCEND_TICKS);
    expect(queen.silk!.stage).toBe(SEAMSTRESS_STAGE_FRENZY);
    expect(landed.filter((e) => e.t === 'boss_state' && e.state === 'frenzy')).toHaveLength(1);
    expect(seamstressTargetable(queen)).toBe(true);
    // A leva da descida: crias e Costureiros, dentro do teto.
    const helpers = state.enemies.filter((e) => e.alive && e.summonerId === queen.id);
    expect(helpers.length).toBeGreaterThan(4);
    expect(helpers.length).toBeLessThanOrEqual(SILK_FRENZY_HELPER_CAP);
    expect(helpers.filter((e) => e.archetype === 'stitcher').length).toBeGreaterThanOrEqual(1);
    expect(helpers.filter((e) => e.archetype === 'stitcher').length).toBeLessThanOrEqual(
      SILK_FRENZY_STITCHERS,
    );
    expect(helpers.filter((e) => e.archetype === 'seamstress_brood').length).toBeGreaterThan(3);
    // Uma vez por encontro: cair mais ainda nao a manda de volta para cima.
    queen.hp = queen.maxHp * 0.2;
    const again = until(state, state.tick + 60);
    expect(queen.silk!.stage).toBe(SEAMSTRESS_STAGE_FRENZY);
    expect(again.some((e) => e.t === 'boss_state' && e.state === 'ascend')).toBe(false);
  });

  it('a teia pega o Prospector sobre fios inteiros; cortar abre a passagem e um Costureiro a refaz', () => {
    const { state, queen } = fixture();
    toFrenzy(state, queen);
    expect(queen.silk!.stage).toBe(SEAMSTRESS_STAGE_FRENZY);
    const web = state.sutures.filter(isWebStrand);
    // Um fio cuja faixa cobre alguma celula que nenhum outro fio inteiro cobre.
    const alone = (s: Suture): number | undefined =>
      s.slabCells.find(
        (c) =>
          !web.some((o) => o !== s && o.phase === 'taut' && o.slabCells.includes(c)) &&
          state.solid[c] === SOLID_NONE,
      );
    const strand = web.find((s) => s.phase === 'taut' && alone(s) !== undefined)!;
    expect(strand).toBeDefined();
    const cell = alone(strand)!;
    const p = suturePoint(state, cell);
    state.player.x = p.x;
    state.player.y = p.y;
    expect(webCovers(state, cell)).toBe(true);
    expect(webSpeedMul(state, state.player)).toBe(WEB_SLOW);
    // Inimigos andam normalmente por cima.
    expect(webSpeedMul(state, queen)).toBe(1);
    // O tiro corta: sem chicote, sem queda, e a passagem abre no mesmo tick.
    const a = suturePoint(state, strand.cells[0]),
      b = suturePoint(state, strand.cells[strand.cells.length - 1]);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy) || 1;
    const cutEvents: SemanticEvent[] = [];
    hitSutures(
      state,
      { x: mid.x - dy / len, y: mid.y + dx / len },
      { x: mid.x + dy / len, y: mid.y - dx / len },
      cutEvents,
      0,
    );
    expect(strand.phase).toBe('loose');
    expect(strand.whipAt).toBe(-1);
    expect(cutEvents.some((e) => e.t === 'suture' && e.phase === 'snap')).toBe(true);
    expect(webSpeedMul(state, state.player)).toBe(1);
    // Um Costureiro convocado vai refazer: chega, costura visivelmente e o fio volta.
    for (const e of state.enemies) if (e.summonerId === queen.id) e.alive = false;
    queen.silk!.broodAt = state.tick + 100000;
    queen.nextActionAt = state.tick + 100000;
    const near = silkLanding(state, { ...queen, radius: 0.36 }, { x: a.x + 2.5, y: a.y }, 3)!;
    const worker = spawnEnemy(state, 'stitcher', near.x - 0.5, near.y - 0.5, false);
    worker.summonerId = queen.id;
    worker.alertedUntil = state.tick + 100000;
    state.player.x = 40.5;
    state.player.y = 40.5;
    let sewing = 0;
    for (let n = 0; n < 200 && strand.phase !== 'taut'; n++) {
      state.tick++;
      updateEnemies(state, []);
      if (worker.action?.kind === 'stitch' && worker.action.target === strand.id) sewing++;
    }
    expect(sewing).toBeGreaterThan(40);
    expect(strand.phase).toBe('taut');
    expect(strand.tension).toBe(100);
    state.player.x = p.x;
    state.player.y = p.y;
    expect(webSpeedMul(state, state.player)).toBe(WEB_SLOW);
  });

  it('matar o Costureiro interrompe a costura; outro prioriza o reparo mesmo perto do jogador', () => {
    const { state, queen } = fixture();
    toFrenzy(state, queen);
    const strand = state.sutures.find((s) => isWebStrand(s) && s.phase === 'taut')!;
    cutSuture(state, strand, [], 0);
    for (const e of state.enemies) if (e.summonerId === queen.id) e.alive = false;
    queen.silk!.broodAt = state.tick + 100000;
    queen.nextActionAt = state.tick + 100000;
    const a = suturePoint(state, strand.cells[0]);
    const near = silkLanding(state, { ...queen, radius: 0.36 }, { x: a.x + 2.5, y: a.y }, 3)!;
    const worker = spawnEnemy(state, 'stitcher', near.x - 0.5, near.y - 0.5, false);
    worker.summonerId = queen.id;
    worker.alertedUntil = state.tick + 100000;
    state.player.x = 40.5;
    state.player.y = 40.5;
    for (
      let n = 0;
      n < 200 && !(worker.action?.kind === 'stitch' && worker.action.target === strand.id);
      n++
    ) {
      state.tick++;
      updateEnemies(state, []);
    }
    expect(worker.action?.kind).toBe('stitch');
    damageEntity(state, worker, 10000, []);
    expect(worker.alive).toBe(false);
    until(state, state.tick + 60);
    expect(strand.phase).toBe('loose');
    expect(strand.tension).toBeLessThan(100);
    // Aproximar-se nao distrai o substituto: e preciso interromper a costura.
    const second = spawnEnemy(state, 'stitcher', near.x - 0.5, near.y - 0.5, false);
    second.summonerId = queen.id;
    second.alertedUntil = state.tick + 100000;
    state.player.x = second.x + 2;
    state.player.y = second.y;
    until(state, state.tick + 40);
    expect(second.action?.kind === 'stitch' && second.action.target === strand.id).toBe(true);
  });

  it('no frenesi a teia a blinda ate ser cortada abaixo do limiar; a camara garante apoios em volta', () => {
    const { state, queen } = fixture();
    toFrenzy(state, queen);
    const web = state.sutures.filter(isWebStrand);
    expect(webAnchors(state, queen.silk!).length).toBeGreaterThanOrEqual(8);
    expect(webIntegrity(state)).toBe(1);
    const full = queen.hp;
    damageEntity(state, queen, 100, []);
    expect(full - queen.hp).toBeCloseTo(100 * WEB_ARMOR, 5);
    for (const s of web) {
      if (webIntegrity(state) < WEB_ARMOR_THRESHOLD) break;
      if (s.phase === 'taut') cutSuture(state, s, [], 0);
    }
    const exposed = queen.hp;
    damageEntity(state, queen, 100, []);
    expect(exposed - queen.hp).toBeCloseTo(100, 5);
  });

  it('a morte da Cerzideira encerra os auxiliares e dissolve a teia', () => {
    const { state, queen } = fixture();
    toFrenzy(state, queen);
    const strand = state.sutures.find((s) => isWebStrand(s) && s.phase === 'taut')!;
    const p = suturePoint(state, strand.cells[1] ?? strand.cells[0]);
    state.player.x = p.x;
    state.player.y = p.y;
    expect(webSpeedMul(state, state.player)).toBe(WEB_SLOW);
    expect(state.enemies.some((e) => e.alive && e.summonerId === queen.id)).toBe(true);
    damageEntity(state, queen, 100000, []);
    expect(queen.alive).toBe(false);
    expect(state.enemies.some((e) => e.alive && e.summonerId === queen.id)).toBe(false);
    expect(state.sutures.filter(isWebStrand).every((s) => s.phase === 'spent')).toBe(true);
    expect(webSpeedMul(state, state.player)).toBe(1);
  });

  it('hashes locked targets, anchor, deadlines, ownership and encounter cadence', () => {
    const a = fixture(),
      b = fixture();
    arm(a.state, a.queen);
    arm(b.state, b.queen);
    const baseline = hashAuthoritativeState(a.state);
    expect(baseline).toBe(hashAuthoritativeState(b.state));
    for (const key of ['toX', 'toY', 'fromX', 'fromY', 'landAt', 'impactAt', 'anchor'] as const) {
      b.queen.action!.silkFlight![key]!++;
      expect(hashAuthoritativeState(b.state), key).not.toBe(baseline);
      b.queen.action!.silkFlight![key]!--;
    }
    b.queen.silk!.lunges++;
    expect(hashAuthoritativeState(b.state)).not.toBe(baseline);
    b.queen.silk!.lunges--;
    for (const key of ['stage', 'stageAt', 'returnAt'] as const) {
      b.queen.silk![key]++;
      expect(hashAuthoritativeState(b.state), key).not.toBe(baseline);
      b.queen.silk![key]--;
    }
  });
});
