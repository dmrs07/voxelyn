import { SOLID_NONE, SOLID_STITCHED_ROCK, TICK_HZ, MAX_ENEMIES } from './constants.js';
import { markDirty } from './cells.js';
import { bodyBlocked, damageEntity, spawnEnemy, startAction } from './entities.js';
import { approach, sewJob, suturePoint } from './sutures.js';
import {
  chamberAnchors,
  spinWeb,
  supportHolds,
  weaveWeb,
  webJunctions,
  webRepairJobs,
} from './web.js';
import {
  SEAMSTRESS_CHAMBER_RADIUS as CHAMBER_RADIUS,
  sutureInSeamstressChamber,
  seamstressAnchorInRange,
} from './suture-layout.js';
import type { Entity, SemanticEvent, SilkFlight, SurvivalState, Vec2 } from './types.js';

export const SEAMSTRESS_GROUND_SPEED = 4;
export const SEAMSTRESS_FLIGHT_SPEED = 12;
export const SEAMSTRESS_DROP_TICKS = 36;
/** Third frame of attack, authored at 10 fps in a 20 Hz simulation. */
export const SILK_STRIKE_OFFSET = 4;
export const SILK_HELPER_CAP = 4;
export const SILK_STRIKE_RADIUS = 1.1;
/**
 * Ate onde a AGULHADA alcanca a partir do centro do corpo, em tiles.
 *
 * A puxada desliza pelo fio e para ao lado do alvo; o golpe e a agulha, nao o
 * corpo. Com o alcance de 0,8 e o pouso preso a linha do fio, a agulha so
 * acertava quem estivesse quase em cima da linha — nos ensaios, metade dos
 * golpes errava um alvo PARADO por 0,5 a 0,7 tile. Agora o pouso e escolhido
 * para que a agulha caia exatamente na marca travada (ver `pull`).
 */
export const SILK_NEEDLE_REACH = 1.6;
/**
 * Ticks sem golpe de contato depois do impacto de uma puxada (1,2 s).
 *
 * Sem a folga, "sair da marca" nao era uma resposta: ela pousava ao lado, a
 * menos de 2 tiles, e emendava a agulhada de contato. O bot que esquivou de
 * todas as puxadas terminava com 19 de vida por causa desse contato.
 */
export const SEAMSTRESS_CONTACT_GRACE = 24;

// ---------------------------------------------------------------------------
// A SEGUNDA FASE: sobe, tece, desce em frenesi.
//
// Na metade da vida ela larga o que estiver fazendo, prende-se a um fio
// vertical e sobe ate sair da tela. Fora de vista, tece a teia (web.ts) fio a
// fio; quando a tecelagem inicial termina, desce no centro da teia com os
// olhos vermelhos, mais rapida, e traz uma leva de crias e Costureiros. A
// volta e marcada na subida (`returnAt`): cortar fios nao a segura la em cima.
// Acontece uma vez por encontro — `stage` so anda para a frente.
// ---------------------------------------------------------------------------
export const SEAMSTRESS_STAGE_GROUND = 0;
export const SEAMSTRESS_STAGE_ASCENDING = 1;
export const SEAMSTRESS_STAGE_ALOFT = 2;
export const SEAMSTRESS_STAGE_DESCENDING = 3;
export const SEAMSTRESS_STAGE_FRENZY = 4;
/** A subida ate sumir (1,5 s) e a descida ate pousar (1,2 s). */
export const SEAMSTRESS_ASCEND_TICKS = 30;
export const SEAMSTRESS_DESCEND_TICKS = 24;
/** Frenesi: perseguicao mais rapida, puxadas mais curtas, mais auxiliares. */
export const SEAMSTRESS_FRENZY_SPEED = 5.2;
export const SILK_FRENZY_HELPER_CAP = 10;
export const SILK_FRENZY_STITCHERS = 3;
export const SILK_FRENZY_WAVE_INTERVAL = 90;
/** Altura, em pixels de zoom 1, a partir da qual o corpo esta fora da tela. */
export const SEAMSTRESS_OFFSCREEN_LIFT = 320;

export const seamstressStage = (queen: Entity): number => queen.silk?.stage ?? 0;
export const seamstressFrenzied = (queen: Entity): boolean =>
  seamstressStage(queen) === SEAMSTRESS_STAGE_FRENZY;
/** Fora da tela nao ha corpo para acertar: nem tiro, nem missil, nem fogo. */
export const seamstressTargetable = (queen: Entity): boolean => {
  const stage = seamstressStage(queen);
  return stage !== SEAMSTRESS_STAGE_ALOFT && stage !== SEAMSTRESS_STAGE_DESCENDING;
};
/** Nem desenhada: o que fica dela e o fio e a teia crescendo. */
export const seamstressHidden = (queen: Entity): boolean =>
  seamstressStage(queen) === SEAMSTRESS_STAGE_ALOFT;
/** The same footprint is used by the authoritative hit and the ground marker. */
export const silkStrike = (enemy: Entity): Vec2 & { radius: number } => {
  const queen = enemy.archetype === 'seamstress',
    f = enemy.action?.silkFlight;
  const direction = enemy.action?.direction ?? enemy.facing;
  return {
    x: (f?.toX ?? enemy.x) + (queen ? direction.x * SILK_NEEDLE_REACH : 0),
    y: (f?.toY ?? enemy.y) + (queen ? direction.y * SILK_NEEDLE_REACH : 0),
    radius: queen ? SILK_STRIKE_RADIUS : enemy.archetype === 'seamstress_brood' ? 0.7 : 0.85,
  };
};
const unit = (x: number, y: number): Vec2 => {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d };
};
/** A short, bounded lead is locked with the marker; neither flight tracks afterwards. */
const silkAim = (player: Entity, seconds: number): Vec2 => {
  const scale = Math.min(seconds, 3 / (Math.hypot(player.vx, player.vy) || 1));
  return { x: player.x + player.vx * scale, y: player.y + player.vy * scale };
};
const activePlayers = (state: SurvivalState): Entity[] =>
  state.players.filter(
    (p) =>
      p.alive &&
      p.hp > 0 &&
      state.playerExtras[p.slot ?? 0].joined &&
      !state.playerExtras[p.slot ?? 0].downed,
  );

export const silkContact = (state: SurvivalState, queen: Entity, events: SemanticEvent[]): void => {
  const hit = silkStrike(queen);
  for (const player of activePlayers(state))
    if (Math.hypot(player.x - hit.x, player.y - hit.y) <= hit.radius + player.radius)
      damageEntity(state, player, 24, events, {
        kind: 'enemy_contact',
        archetype: 'seamstress',
        elite: false,
      });
};

/** Circle against every overlapped cell, including rocks between the four corner samples. */
export const silkCanLand = (state: SurvivalState, body: Entity, x: number, y: number): boolean => {
  if (bodyBlocked(state, body, x, y)) return false;
  for (let cy = Math.floor(y - body.radius); cy <= Math.floor(y + body.radius); cy++)
    for (let cx = Math.floor(x - body.radius); cx <= Math.floor(x + body.radius); cx++) {
      if (cx < 1 || cy < 1 || cx >= state.config.width - 1 || cy >= state.config.height - 1)
        return false;
      const dx = Math.max(cx - x, 0, x - cx - 1),
        dy = Math.max(cy - y, 0, y - cy - 1);
      if (
        state.solid[cy * state.config.width + cx] !== SOLID_NONE &&
        dx * dx + dy * dy < body.radius * body.radius
      )
        return false;
    }
  return true;
};

/** Deterministic landing search with full body clearance; never lands inside terrain. */
export const silkLanding = (
  state: SurvivalState,
  body: Entity,
  at: Vec2,
  reach = 3,
): Vec2 | null => {
  if (silkCanLand(state, body, at.x, at.y)) return { x: at.x, y: at.y };
  let best: Vec2 | null = null,
    score = Infinity;
  const w = state.config.width;
  for (
    let y = Math.max(1, Math.floor(at.y - reach));
    y <= Math.min(state.config.height - 2, Math.ceil(at.y + reach));
    y++
  ) {
    for (
      let x = Math.max(1, Math.floor(at.x - reach));
      x <= Math.min(w - 2, Math.ceil(at.x + reach));
      x++
    ) {
      const d = Math.hypot(x + 0.5 - at.x, y + 0.5 - at.y);
      if (d <= reach && d < score && silkCanLand(state, body, x + 0.5, y + 0.5)) {
        best = { x: x + 0.5, y: y + 0.5 };
        score = d;
      }
    }
  }
  return best;
};

export const initSeamstress = (state: SurvivalState, queen: Entity): void => {
  if (queen.silk) return;
  queen.silk = {
    x: queen.x,
    y: queen.y,
    lunges: 0,
    lastAnchor: -1,
    broodAt: 0,
    repositionUntil: 0,
    comboLeft: 0,
    stage: SEAMSTRESS_STAGE_GROUND,
    stageAt: 0,
    returnAt: -1,
  };
  for (const s of state.sutures) {
    if (!sutureInSeamstressChamber(s, state.config.width, queen)) continue;
    s.encounter = true;
    s.closeAt = s.whipAt = s.fallAt = -1;
    for (const i of s.cells)
      if (state.solid[i] === SOLID_STITCHED_ROCK) {
        state.solid[i] = SOLID_NONE;
        markDirty(state, i % state.config.width, Math.floor(i / state.config.width));
      }
  }
  for (const worker of state.enemies) {
    if (
      worker.archetype !== 'stitcher' ||
      worker.summonerId !== undefined ||
      Math.hypot(worker.x - queen.x, worker.y - queen.y) >= CHAMBER_RADIUS
    )
      continue;
    const site = state.sutures.find((s) => !s.encounter);
    const at = site ? silkLanding(state, worker, suturePoint(state, site.cells[0]), 3) : null;
    if (at) {
      worker.x = at.x;
      worker.y = at.y;
    } else worker.alive = false;
  }
};

export const silkSupported = (enemy: Entity, tick: number): boolean =>
  enemy.action?.silkFlight?.anchor !== undefined && tick < enemy.action.silkFlight.impactAt;

/** Height in renderer pixels at zoom 1; flight and its ground shadow share one clock. */
export const silkLift = (enemy: Entity, tick: number): number => {
  // A subida e a descida da segunda fase: o corpo no fio vertical, do chao
  // ate fora da tela e de volta. O mesmo relogio serve ao sprite e a sombra.
  const silk = enemy.silk;
  if (silk && silk.stage === SEAMSTRESS_STAGE_ASCENDING) {
    const p = Math.min(1, Math.max(0, (tick - silk.stageAt) / SEAMSTRESS_ASCEND_TICKS));
    return 38 + p * p * (SEAMSTRESS_OFFSCREEN_LIFT - 38);
  }
  if (silk && silk.stage === SEAMSTRESS_STAGE_ALOFT) return SEAMSTRESS_OFFSCREEN_LIFT;
  if (silk && silk.stage === SEAMSTRESS_STAGE_DESCENDING) {
    const p = Math.min(1, Math.max(0, (tick - silk.stageAt) / SEAMSTRESS_DESCEND_TICKS));
    return (1 - p) * (1 - p) * SEAMSTRESS_OFFSCREEN_LIFT;
  }
  const a = enemy.action,
    f = a?.silkFlight;
  if (!a || !f || tick < a.releaseAt || tick >= f.landAt) return 0;
  const p = (tick - a.releaseAt) / Math.max(1, f.landAt - a.releaseAt);
  return Math.sin(Math.PI * p) * (f.anchor === undefined ? 20 : 38);
};

export const dropSeamstress = (
  state: SurvivalState,
  queen: Entity,
  events: SemanticEvent[],
): void => {
  const f = queen.action?.silkFlight;
  if (!f || !silkSupported(queen, state.tick)) return;
  const at =
    silkLanding(state, queen, queen, 6) ??
    silkLanding(
      state,
      queen,
      { x: f.fromX, y: f.fromY },
      Math.max(state.config.width, state.config.height),
    );
  if (at) {
    queen.x = at.x;
    queen.y = at.y;
  }
  queen.action = undefined;
  queen.mood = 0;
  queen.vx = queen.vy = 0;
  queen.stunnedUntil = state.tick + SEAMSTRESS_DROP_TICKS;
  queen.nextActionAt = queen.stunnedUntil;
  if (queen.silk) {
    queen.silk.repositionUntil = queen.stunnedUntil + (seamstressFrenzied(queen) ? 6 : 14);
    queen.silk.comboLeft = 0;
  }
  events.push({ t: 'action_end', entity: queen.id });
  events.push({
    t: 'boss_vulnerable',
    archetype: 'seamstress',
    x: queen.x,
    y: queen.y,
    open: true,
  });
};

const armFlight = (
  state: SurvivalState,
  enemy: Entity,
  to: Vec2,
  windup: number,
  speed: number,
  recovery: number,
  events: SemanticEvent[],
  target: number,
  anchor?: number,
  aim?: Vec2,
): void => {
  const dir = unit(to.x - enemy.x, to.y - enemy.y);
  const travel = Math.max(
    6,
    Math.ceil((Math.hypot(to.x - enemy.x, to.y - enemy.y) / speed) * TICK_HZ),
  );
  const landAt = state.tick + windup + travel;
  const impactAt = landAt + (anchor === undefined ? 0 : SILK_STRIKE_OFFSET);
  startAction(
    state,
    enemy,
    anchor === undefined ? 'leap' : 'tether',
    aim ?? dir,
    windup,
    impactAt - state.tick - windup + recovery,
    events,
    target,
  );
  enemy.action!.silkFlight = {
    fromX: enemy.x,
    fromY: enemy.y,
    toX: to.x,
    toY: to.y,
    landAt,
    impactAt,
    anchor,
  };
  enemy.nextActionAt = enemy.action!.endsAt;
};

const pull = (
  state: SurvivalState,
  queen: Entity,
  player: Entity,
  events: SemanticEvent[],
): boolean => {
  const encounter = queen.silk!;
  const aim = silkAim(player, 0.7);
  // Os APOIOS: toda ancora da camara (as das suturas e as garantidas em volta
  // dela) e, no frenesi, as juncoes inteiras da teia — a teia e a locomocao
  // dela, e cortar os fios de uma juncao a derruba no meio da puxada.
  const anchors = [
    ...new Set([
      ...chamberAnchors(state, { x: encounter.x, y: encounter.y }),
      ...(seamstressFrenzied(queen) ? webJunctions(state) : []),
    ]),
  ];
  const choices: Array<{ anchor: number; to: Vec2; score: number }> = [];
  for (const anchor of anchors) {
    if (
      anchor === encounter.lastAnchor ||
      !seamstressAnchorInRange(anchor, state.config.width, queen) ||
      !supportHolds(state, anchor)
    )
      continue;
    const p = suturePoint(state, anchor),
      dx = p.x - queen.x,
      dy = p.y - queen.y;
    const d = Math.hypot(dx, dy);
    // Pull towards the selected support, stopping on the thread at the point
    // from which the needle reaches the locked mark: the landing is the point
    // of the line at exactly SILK_NEEDLE_REACH from the aim, on the near side.
    // A mark farther from the thread than the needle reaches is not a shot
    // this support can make.
    const proj = ((aim.x - queen.x) * dx + (aim.y - queen.y) * dy) / d;
    const perp = Math.abs((aim.x - queen.x) * dy - (aim.y - queen.y) * dx) / d;
    if (perp > SILK_NEEDLE_REACH) continue;
    const back = Math.sqrt(SILK_NEEDLE_REACH * SILK_NEEDLE_REACH - perp * perp);
    const along = Math.max(2, Math.min(d - 1.6, proj - back));
    const to = silkLanding(
      state,
      queen,
      { x: queen.x + (dx / d) * along, y: queen.y + (dy / d) * along },
      2,
    );
    if (!to || Math.hypot(to.x - queen.x, to.y - queen.y) < 2) continue;
    // How far the needle lands from the mark after clamping and landing search.
    choices.push({
      anchor,
      to,
      score: Math.abs(Math.hypot(to.x - aim.x, to.y - aim.y) - SILK_NEEDLE_REACH),
    });
  }
  choices.sort((a, b) => a.score - b.score || a.anchor - b.anchor);
  const choice = choices[0];
  // The mark must sit inside the strike disc: a lunge that would miss a
  // standing target is not offered — she hunts on foot instead.
  if (!choice || choice.score > SILK_STRIKE_RADIUS - 0.1) return false;
  // A segunda fase E o frenesi: as puxadas encadeiam dois apoios e o preparo
  // encurta (20 -> 12 -> 10 ticks), mas nunca abaixo do que da para ler.
  const second = seamstressFrenzied(queen);
  const chained = second && encounter.comboLeft > 0;
  encounter.comboLeft = chained ? 0 : second ? 1 : 0;
  encounter.lastAnchor = choice.anchor;
  encounter.lunges++;
  armFlight(
    state,
    queen,
    choice.to,
    chained ? 10 : second ? 12 : 20,
    SEAMSTRESS_FLIGHT_SPEED,
    second && !chained ? 4 : second ? 8 : 14,
    events,
    player.id,
    choice.anchor,
    unit(aim.x - choice.to.x, aim.y - choice.to.y),
  );
  queen.contactReadyAt = queen.action!.silkFlight!.impactAt + SEAMSTRESS_CONTACT_GRACE;
  return true;
};

export const summonSilkBrood = (
  state: SurvivalState,
  queen: Entity,
  events: SemanticEvent[],
): void => {
  const encounter = queen.silk;
  if (!encounter || (encounter.lunges < 2 && !seamstressFrenzied(queen))) return;
  const frenzy = seamstressFrenzied(queen);
  const living = state.enemies.filter((e) => e.alive && e.summonerId === queen.id);
  const kinds: Array<'stitcher' | 'seamstress_brood'> = [];
  // No frenesi a leva e maior (oito no total, dois Costureiros para refazer a
  // teia); a reposicao continua espacada, para a luta continuar legivel.
  const cap = frenzy ? SILK_FRENZY_HELPER_CAP : SILK_HELPER_CAP;
  const workers = frenzy ? SILK_FRENZY_STITCHERS : 1;
  for (let n = living.filter((e) => e.archetype === 'stitcher').length; n < workers; n++)
    kinds.push('stitcher');
  while (kinds.length + living.length < cap) kinds.push('seamstress_brood');
  for (const [n, kind] of kinds.entries()) {
    if (state.enemies.filter((e) => e.alive).length >= MAX_ENEMIES) break;
    const a = (queen.id + encounter.lunges + n * 2) * 2.399963229728653;
    const body = { ...queen, radius: kind === 'stitcher' ? 0.36 : 0.25 };
    const origin =
      kind === 'stitcher'
        ? { x: encounter.x + Math.cos(a) * 9, y: encounter.y + Math.sin(a) * 9 }
        : {
            x: queen.x - queen.facing.x * 0.8 + Math.cos(a) * 0.6,
            y: queen.y - queen.facing.y * 0.8 + Math.sin(a) * 0.6,
          };
    const at = silkLanding(state, body, origin, 5);
    if (!at) continue;
    const helper = spawnEnemy(state, kind, at.x - 0.5, at.y - 0.5, false);
    helper.summonerId = queen.id;
    helper.nextActionAt = state.tick + 22 + n * 8;
    helper.alertedUntil = state.tick + 100000;
    // Hatching/arrival is visible and harmless; the first pounce gets its own warning.
    startAction(state, helper, 'stitch', queen.facing, 12 + n * 3, 8, events);
  }
  encounter.broodAt = state.tick + (frenzy ? SILK_FRENZY_WAVE_INTERVAL : 160);
};

/**
 * A SUBIDA: larga o que estiver fazendo e prende-se ao fio vertical. Roda
 * de `silkMaintenance`, antes das acoes, porque a IA nao decide nada durante
 * uma puxada — e a transicao tem de interromper a puxada, nao esperar por ela.
 */
const beginAscent = (state: SurvivalState, queen: Entity, events: SemanticEvent[]): void => {
  const encounter = queen.silk!;
  if (encounter.stage !== SEAMSTRESS_STAGE_GROUND) return;
  // INTERROMPE o ataque: uma puxada no ar pousa onde couber; a amarra solta.
  if (queen.action?.silkFlight) {
    const f = queen.action.silkFlight;
    const at =
      silkLanding(state, queen, queen, 6) ??
      silkLanding(state, queen, { x: f.fromX, y: f.fromY }, 12);
    if (at) {
      queen.x = at.x;
      queen.y = at.y;
    }
  }
  if (queen.action) events.push({ t: 'action_end', entity: queen.id });
  queen.action = undefined;
  queen.mood = 0;
  queen.vx = queen.vy = 0;
  queen.stunnedUntil = 0;
  encounter.comboLeft = 0;
  encounter.repositionUntil = 0;
  encounter.stage = SEAMSTRESS_STAGE_ASCENDING;
  encounter.stageAt = state.tick;
  queen.nextActionAt = state.tick + SEAMSTRESS_ASCEND_TICKS;
  events.push({
    t: 'boss_state',
    archetype: 'seamstress',
    state: 'ascend',
    x: queen.x,
    y: queen.y,
  });
};

/**
 * A maquina da segunda fase. Devolve `true` enquanto ela e quem manda no
 * corpo (subindo, fora, descendo); no chao e no frenesi devolve `false` e o
 * fluxo de caca segue.
 */
const seamstressPhaseStep = (
  state: SurvivalState,
  queen: Entity,
  events: SemanticEvent[],
): boolean => {
  const encounter = queen.silk!;
  if (encounter.stage === SEAMSTRESS_STAGE_GROUND) {
    if (queen.hp >= queen.maxHp / 2) return false;
    beginAscent(state, queen, events);
    return true;
  }
  if (encounter.stage === SEAMSTRESS_STAGE_ASCENDING) {
    if (state.tick < encounter.stageAt + SEAMSTRESS_ASCEND_TICKS) return true;
    encounter.stage = SEAMSTRESS_STAGE_ALOFT;
    encounter.stageAt = state.tick;
    // A teia nasce agora, com a volta ja marcada no fim da tecelagem inicial.
    encounter.returnAt = spinWeb(state, { x: encounter.x, y: encounter.y }, state.tick) + 10;
    return true;
  }
  if (encounter.stage === SEAMSTRESS_STAGE_ALOFT) {
    weaveWeb(state, events);
    if (state.tick < encounter.returnAt) return true;
    const center = { x: encounter.x, y: encounter.y };
    const at =
      silkLanding(state, queen, center, 4) ??
      silkLanding(state, queen, center, Math.max(state.config.width, state.config.height));
    if (at) {
      queen.x = at.x;
      queen.y = at.y;
    }
    encounter.stage = SEAMSTRESS_STAGE_DESCENDING;
    encounter.stageAt = state.tick;
    events.push({
      t: 'boss_state',
      archetype: 'seamstress',
      state: 'descend',
      x: queen.x,
      y: queen.y,
    });
    return true;
  }
  if (encounter.stage === SEAMSTRESS_STAGE_DESCENDING) {
    // Fios que ficaram para tras na agenda (nunca acontece, mas e barato).
    weaveWeb(state, events);
    if (state.tick < encounter.stageAt + SEAMSTRESS_DESCEND_TICKS) return true;
    encounter.stage = SEAMSTRESS_STAGE_FRENZY;
    encounter.stageAt = state.tick;
    encounter.lastAnchor = -1;
    events.push({
      t: 'boss_state',
      archetype: 'seamstress',
      state: 'frenzy',
      x: queen.x,
      y: queen.y,
    });
    // A leva da descida: sai junto com ela, e a reposicao segue espacada.
    encounter.broodAt = state.tick;
    summonSilkBrood(state, queen, events);
    queen.nextActionAt = state.tick + 16;
    queen.contactReadyAt = state.tick + SEAMSTRESS_CONTACT_GRACE;
    return true;
  }
  return false;
};

export const seamstressStep = (
  state: SurvivalState,
  queen: Entity,
  player: Entity | null,
  dt: number,
  events: SemanticEvent[],
): void => {
  initSeamstress(state, queen);
  const encounter = queen.silk!;
  if (!state.bossRuntime.awake) {
    if (
      !player ||
      (Math.hypot(player.x - queen.x, player.y - queen.y) > 18 && queen.alertedUntil <= state.tick)
    )
      return;
    state.bossRuntime.awake = true;
    queen.nextActionAt = state.tick + 24;
    events.push({ t: 'boss_awake', archetype: 'seamstress', x: queen.x, y: queen.y });
  }
  if (!player) return;
  if (queen.hp < queen.maxHp / 2 && !(state.bossRuntime.phasesFired & 1)) {
    state.bossRuntime.phasesFired |= 1;
    events.push({ t: 'boss_phase', archetype: 'seamstress', phase: 1, x: queen.x, y: queen.y });
  }
  if (seamstressPhaseStep(state, queen, events)) return;
  if (state.tick < queen.nextActionAt) return;
  const speed = seamstressFrenzied(queen) ? SEAMSTRESS_FRENZY_SPEED : SEAMSTRESS_GROUND_SPEED;
  if (state.tick < encounter.repositionUntil) {
    const d = unit(player.x - queen.x, player.y - queen.y);
    approach(state, queen, { x: queen.x - d.y * 3, y: queen.y + d.x * 3 }, dt, speed);
    return;
  }
  const helperCap = seamstressFrenzied(queen) ? SILK_FRENZY_HELPER_CAP : SILK_HELPER_CAP;
  if (
    (encounter.lunges >= 2 || seamstressFrenzied(queen)) &&
    state.tick >= encounter.broodAt &&
    state.enemies.filter((e) => e.alive && e.summonerId === queen.id).length < helperCap &&
    encounter.comboLeft === 0
  ) {
    startAction(state, queen, 'stitch', queen.facing, 18, 12, events);
    queen.nextActionAt = queen.action!.endsAt;
    return;
  }
  if (pull(state, queen, player, events)) return;
  const d = Math.hypot(player.x - queen.x, player.y - queen.y);
  if (d < 2 && state.tick >= queen.contactReadyAt) {
    // Contact shares the same four-frame strike: release is the third frame.
    startAction(
      state,
      queen,
      'contact',
      unit(player.x - queen.x, player.y - queen.y),
      12,
      12,
      events,
      player.id,
    );
    queen.contactReadyAt = queen.action!.endsAt + 6;
  } else approach(state, queen, player, dt, speed);
};

export const silkHelperStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  dt: number,
  events: SemanticEvent[],
): void => {
  if (!player || state.tick < enemy.nextActionAt) return;
  const brood = enemy.archetype === 'seamstress_brood';
  const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  // COSTUREIROS NO FRENESI refazem a teia antes de brigar: o fio cortado mais
  // perto e o trabalho, a menos que o jogador esteja em cima deles. E a
  // decisao que a fase oferece — matar quem costura mantem a passagem aberta.
  if (!brood && d >= 3) {
    const mother = state.enemies.find((e) => e.alive && e.id === enemy.summonerId);
    if (mother && seamstressFrenzied(mother)) {
      const job = webRepairJobs(state, enemy)[0];
      if (job) {
        sewJob(state, enemy, job, dt, events);
        return;
      }
    }
  }
  if (d < 1.25) {
    const retreat =
      d > 0.01
        ? unit(enemy.x - player.x, enemy.y - player.y)
        : unit(Math.cos(enemy.id), Math.sin(enemy.id));
    approach(
      state,
      enemy,
      { x: enemy.x + retreat.x * 2, y: enemy.y + retreat.y * 2 },
      dt,
      brood ? 3.8 : 3.2,
    );
    return;
  }
  if (d <= (brood ? 4.5 : 7)) {
    const aim = silkAim(player, brood ? 0.55 : 0.85);
    const reach = brood ? 4.5 : 7;
    const distance = Math.hypot(aim.x - enemy.x, aim.y - enemy.y);
    const scale = Math.min(1, reach / (distance || 1));
    const to = silkLanding(
      state,
      enemy,
      { x: enemy.x + (aim.x - enemy.x) * scale, y: enemy.y + (aim.y - enemy.y) * scale },
      1.5,
    );
    if (to) {
      armFlight(
        state,
        enemy,
        to,
        brood ? 14 : 22,
        brood ? 7 : 9,
        brood ? 18 : 26,
        events,
        player.id,
      );
      return;
    }
  }
  approach(state, enemy, player, dt, brood ? 3.8 : 3.2);
};

/** Called before actions, so a destroyed support or dead mother cannot leave an invisible attack. */
export const silkMaintenance = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): boolean => {
  if (
    enemy.summonerId !== undefined &&
    !state.enemies.some((e) => e.alive && e.id === enemy.summonerId)
  ) {
    const at = silkLanding(state, enemy, enemy, 6);
    if (at) {
      enemy.x = at.x;
      enemy.y = at.y;
    }
    enemy.hp = 0;
    enemy.alive = false;
    enemy.action = undefined;
    events.push({ t: 'action_end', entity: enemy.id });
    events.push({
      t: 'death',
      entity: enemy.id,
      archetype: enemy.archetype,
      x: enemy.x,
      y: enemy.y,
      facingX: enemy.facing.x,
      facingY: enemy.facing.y,
      tick: state.tick,
    });
    return true;
  }
  // A METADE DA VIDA interrompe ate uma puxada em voo: a subida e decidida
  // aqui, antes das acoes, e nao no passo de IA que uma acao suspende.
  if (
    enemy.archetype === 'seamstress' &&
    enemy.silk &&
    state.bossRuntime.awake &&
    enemy.silk.stage === SEAMSTRESS_STAGE_GROUND &&
    enemy.hp < enemy.maxHp / 2
  )
    beginAscent(state, enemy, events);
  if (
    enemy.archetype === 'seamstress' &&
    state.tick === enemy.stunnedUntil &&
    (enemy.silk?.repositionUntil ?? 0) > state.tick
  )
    events.push({
      t: 'boss_vulnerable',
      archetype: 'seamstress',
      x: enemy.x,
      y: enemy.y,
      open: false,
    });
  const anchor = enemy.action?.silkFlight?.anchor;
  if (anchor !== undefined && !supportHolds(state, anchor)) dropSeamstress(state, enemy, events);
  return false;
};

/** No contact during travel. One authoritative impact, also the sound/VFX tick. */
export const silkStride = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const action = enemy.action,
    f: SilkFlight | undefined = action?.silkFlight;
  if (!action || !f || state.tick < action.releaseAt) return;
  if (state.tick <= f.landAt) {
    const p = Math.min(
      1,
      (state.tick - action.releaseAt) / Math.max(1, f.landAt - action.releaseAt),
    );
    enemy.x = f.fromX + (f.toX - f.fromX) * p;
    enemy.y = f.fromY + (f.toY - f.fromY) * p;
  }
  if (state.tick >= f.landAt && !action.landed) {
    const to = silkLanding(
      state,
      enemy,
      { x: f.toX, y: f.toY },
      Math.max(state.config.width, state.config.height),
    );
    if (!to) return;
    enemy.x = to.x;
    enemy.y = to.y;
    if (Math.hypot(to.x - f.toX, to.y - f.toY) > 0.01) {
      // Terrain changed under the locked mark: land safely and cancel its damage.
      action.contactedSlots = 15;
    }
    action.landed = true;
  }
  if (state.tick !== f.impactAt) return;
  const queen = enemy.archetype === 'seamstress';
  const hit = silkStrike(enemy);
  if (queen)
    events.push({
      t: 'boss_attack',
      archetype: 'seamstress',
      ability: 'tether',
      ...hit,
      dx: action.direction.x,
      dy: action.direction.y,
    });
  else events.push({ t: 'suture', phase: 'snap', id: -enemy.id, ...hit });
  if (action.contactedSlots === 15) return;
  for (const p of activePlayers(state)) {
    if (Math.hypot(p.x - hit.x, p.y - hit.y) > hit.radius + p.radius) continue;
    action.contactedSlots = (action.contactedSlots ?? 0) | (1 << (p.slot ?? 0));
    damageEntity(state, p, queen ? 24 : enemy.archetype === 'seamstress_brood' ? 10 : 12, events, {
      kind: 'enemy_contact',
      archetype: enemy.archetype as 'seamstress' | 'seamstress_brood' | 'stitcher',
      elite: false,
    });
  }
};
