import {
  ALERT_TICKS,
  SOLID_FRAGILE,
  SOLID_FRAGILE_WEAK,
  SOLID_ROCK,
  BIOFLUID_SLOW,
  BRUISER_HURL_COOLDOWN_TICKS,
  BRUISER_HURL_DAMAGE,
  BRUISER_HURL_FLIGHT_TILES,
  BRUISER_HURL_MAX_RANGE,
  BRUISER_HURL_MIN_RANGE,
  BRUISER_HURL_REACH,
  BRUISER_HURL_SPEED,
  BRUISER_HURL_WINDUP_TICKS,
  BRUISER_ROCK_RADIUS,
  MINER_CLEAVE_COOLDOWN_TICKS,
  MINER_CLEAVE_DAMAGE,
  MINER_CLEAVE_RADIUS,
  MINER_CLEAVE_WINDUP_TICKS,
  MINER_FEAR_HEAT,
  MINER_FLEE_SPEED,
  MINER_HP,
  MINER_NOTICE_RANGE,
  MINER_ORE_DROP,
  MINER_RAGE_HEAT,
  MINER_RAGE_SPEED,
  BISHOP_FUNGAL_SEARCH,
  BISHOP_HP,
  BISHOP_NOVA_COOLDOWN_TICKS,
  BISHOP_NOVA_DAMAGE,
  BISHOP_NOVA_FUNGAL_TICKS,
  BISHOP_NOVA_RADIUS,
  BISHOP_NOVA_WINDUP_TICKS,
  BISHOP_REGEN_PER_TICK,
  BISHOP_RETREAT_HP_FRACTION,
  HORSE_CHARGE_COOLDOWN_TICKS,
  HORSE_CHARGE_MAX_RANGE,
  HORSE_CHARGE_MIN_RANGE,
  HORSE_CHARGE_SPEED,
  HORSE_CHARGE_TICKS,
  HORSE_CHARGE_WINDUP_TICKS,
  HORSE_HP,
  HORSE_TRAIL_DELAY_TICKS,
  HORSE_TURN_RATE,
  HORSE_TRAIL_FUEL_TICKS,
  GUARDIAN_ARENA_EXITS,
  GUARDIAN_ARENA_RADIUS,
  GUARDIAN_PATH_INTERVAL_TICKS,
  GUARDIAN_SUMMON_COUNT,
  EXPLOSION_DAMAGE,
  SOLID_NONE,
  SPORE_LIFE_TICKS,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_NONE,
  SURF_SPORES,
  TICK_HZ,
} from './constants.js';
import { breakSolid, canRip, closeArena, explodeAt, igniteCell, openArena, ripSolid, setSurface } from './cells.js';
import { findPath, hasLineOfSight } from './pathing.js';
import { addDamageTenths, markDiscovery, recordKill } from './stats.js';
import {
  DISCOVERY_MINER_ENRAGED,
  DISCOVERY_MINER_FLED,
  MINER_MOOD_ENRAGED,
  MINER_MOOD_FLEEING,
  MINER_MOOD_PASSIVE,
} from './types.js';
import type {
  DamageCause,
  EffectOrigin,
  Entity,
  EntityActionKind,
  EnemyArchetype,
  SemanticEvent,
  SurvivalState,
  Vec2,
} from './types.js';

export type ArchetypeDef = {
  hp: number;
  speed: number;
  radius: number;
  contactDamage: number;
  contactCooldown: number;
  aggroRange: number;
};

export const ARCHETYPES: Record<EnemyArchetype, ArchetypeDef> = {
  stalker: { hp: 26, speed: 5.2, radius: 0.32, contactDamage: 8, contactCooldown: 10, aggroRange: 9 },
  // 160 e nao 95: com 95 ele morria em 1,7 s de fogo sustentado, o que dava
  // tempo para exatamente UM arremesso — a mecanica nova mal existia. Aqui vida
  // e o portao de quantas vezes ela acontece, e nao um jeito de alongar uma luta
  // inofensiva (que e por que o guardiao NAO ganha vida).
  bruiser: { hp: 160, speed: 2.3, radius: 0.46, contactDamage: 18, contactCooldown: 16, aggroRange: 7 },
  spitter: { hp: 30, speed: 2.8, radius: 0.34, contactDamage: 6, contactCooldown: 14, aggroRange: 9 },
  bomber: { hp: 18, speed: 3.7, radius: 0.3, contactDamage: 4, contactCooldown: 10, aggroRange: 9 },
  guardian: { hp: 420, speed: 2.1, radius: 0.68, contactDamage: 24, contactCooldown: 14, aggroRange: 7 },
  // Vida MENOR que a do guardiao de proposito. A dificuldade do bispo nao mora
  // na barra: em cima do fungo ele se cura mais rapido do que se leva dano, e
  // fora dele cai depressa. Somar vida grande a cura seria cobrar as duas coisas
  // pelo mesmo problema e transformar a luta em espera.
  bishop: { hp: BISHOP_HP, speed: 2.6, radius: 0.6, contactDamage: 20, contactCooldown: 14, aggroRange: 10 },
  // Alcance de aggro alto e velocidade alta porque a ameaca dele e CHEGAR: um
  // cavalo que espera o jogador entrar num raio pequeno nunca teria distancia
  // para investir, e a investida e o bicho inteiro.
  fungal_horse: { hp: HORSE_HP, speed: 4.4, radius: 0.44, contactDamage: 14, contactCooldown: 12, aggroRange: 13 },
  // Corpo GRANDE (raio 0,46, entre o bruiser e o guardiao) e vida BAIXA.
  //
  // A combinacao e deliberada e diz o que ele e: uma maquina de carga de 2,5 m
  // que nunca foi construida para lutar. Ele nao e um desafio de combate, e uma
  // DECISAO — quem decidir destrui-lo consegue, sempre, e o custo nunca foi a
  // luta. Subir a vida junto com o tamanho transformaria a decisao num
  // orcamento de municao, que e outra coisa.
  miner: { hp: MINER_HP, speed: MINER_RAGE_SPEED, radius: 0.46, contactDamage: 6, contactCooldown: 18, aggroRange: MINER_NOTICE_RANGE },
};

export const isSolidAt = (state: SurvivalState, x: number, y: number): boolean => {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= state.config.width || cy >= state.config.height) return true;
  return state.solid[cy * state.config.width + cx] !== SOLID_NONE;
};

const circleBlocked = (state: SurvivalState, x: number, y: number, r: number): boolean =>
  isSolidAt(state, x - r, y - r) ||
  isSolidAt(state, x + r, y - r) ||
  isSolidAt(state, x - r, y + r) ||
  isSolidAt(state, x + r, y + r);

export const moveEntity = (
  state: SurvivalState,
  ent: Entity,
  dx: number,
  dy: number
): { blockedX: boolean; blockedY: boolean; blockCell: { x: number; y: number } | null } => {
  let blockCell: { x: number; y: number } | null = null;
  let blockedX = false;
  let blockedY = false;
  if (dx !== 0) {
    const nx = ent.x + dx;
    if (!circleBlocked(state, nx, ent.y, ent.radius)) ent.x = nx;
    else {
      blockedX = true;
      blockCell = { x: Math.floor(nx + Math.sign(dx) * ent.radius), y: Math.floor(ent.y) };
    }
  }
  if (dy !== 0) {
    const ny = ent.y + dy;
    if (!circleBlocked(state, ent.x, ny, ent.radius)) ent.y = ny;
    else {
      blockedY = true;
      blockCell = { x: Math.floor(ent.x), y: Math.floor(ny + Math.sign(dy) * ent.radius) };
    }
  }
  return { blockedX, blockedY, blockCell };
};

export const cellUnder = (state: SurvivalState, ent: Entity): number =>
  Math.floor(ent.y) * state.config.width + Math.floor(ent.x);

export const surfaceSpeedMul = (state: SurvivalState, ent: Entity): number =>
  state.surface[cellUnder(state, ent)] === SURF_BIOFLUID ? BIOFLUID_SLOW : 1;

/** Nuvem organica localizada deixada pela ruptura do Spore Bomber. */
const addBomberSpores = (state: SurvivalState, ent: Entity): void => {
  const cx = Math.floor(ent.x);
  const cy = Math.floor(ent.y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= state.config.width || y >= state.config.height) continue;
      const i = y * state.config.width + x;
      if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
        setSurface(state, i, SURF_SPORES, SPORE_LIFE_TICKS);
      }
    }
  }
};

export const damageEntity = (
  state: SurvivalState,
  ent: Entity,
  amount: number,
  events: SemanticEvent[],
  /**
   * O que causou este dano.
   *
   * Opcional na assinatura e nunca opcional na pratica: o padrao `unknown`
   * existe para nao obrigar cada teste a inventar uma causa, e todo caminho de
   * dano de producao passa a sua. Uma morte que chegue ao jogador como
   * "unknown" e um bug de contabilidade, nao um estado esperado.
   */
  cause: DamageCause = { kind: 'unknown' }
): void => {
  if (!ent.alive) return;
  if (ent.kind === 'player') {
    const extra = state.playerExtras[ent.slot ?? 0];
    if (extra.iframesUntil > state.tick || extra.downed) return;
    ent.hp = Math.max(0, ent.hp - amount);
    // Registrado AQUI e nao na morte: quando `resolveDownedAndDeaths` roda, ele
    // so ve `hp <= 0` e nao tem como saber se foram os 22 da pedra ou os 2,2 do
    // fogo por baixo.
    extra.lastDamage = { cause, tick: state.tick };
    state.stats.damageTakenTenths = addDamageTenths(state.stats.damageTakenTenths, amount);
    events.push({ t: 'hit', x: ent.x, y: ent.y, amount, target: ent.id });
    return;
  }
  // Dano CAUSADO conta so o que e ATRIBUIVEL ao jogador, por lista fechada.
  //
  // A alternativa era contar tudo menos o que veio de inimigo, e ela inflava o
  // numero em silencio: fogo ambiente consumindo um bicho num canto do mapa, um
  // bomber explodindo em cima de um stalker, a descarga de um cristal que o
  // guardiao quebrou — nada disso e feito do jogador, e tudo isso somaria.
  // `Math.min(amount, ent.hp)` corta o excedente do golpe fatal: 14 de dano num
  // alvo com 3 de vida sao 3 de dano causado, nao 14.
  const attributable =
    cause.kind === 'player_shot' ||
    ((cause.kind === 'explosion' || cause.kind === 'discharge') && cause.source === 'player');
  if (attributable) {
    state.stats.damageDealtTenths = addDamageTenths(
      state.stats.damageDealtTenths,
      Math.min(amount, ent.hp)
    );
  }
  ent.hp -= amount;
  // Levar dano ACORDA. Antes o aggro era so distancia, recalculada a cada tick,
  // entao um inimigo baleado de fora do proprio raio continuava perambulando ao
  // acaso enquanto morria. Com alcance de tiro de 18 tiles contra raios de 7 a
  // 9, atirar de longe nao era uma tatica esperta: era a ausencia de jogo.
  ent.alertedUntil = state.tick + ALERT_TICKS;
  events.push({ t: 'hit', x: ent.x, y: ent.y, amount, target: ent.id });
  if (ent.hp > 0) return;
  ent.hp = 0;
  ent.alive = false;
  recordKill(state.stats, ent.archetype as EnemyArchetype);
  events.push({
    t: 'death',
    x: ent.x,
    y: ent.y,
    entity: ent.id,
    archetype: ent.archetype,
    facingX: ent.facing.x,
    facingY: ent.facing.y,
    tick: state.tick,
  });
  if (ent.archetype === 'bomber') {
    explodeAt(state, ent.x, ent.y, 1.8, events, { source: 'enemy', owner: ent.id });
    addBomberSpores(state, ent);
  }
  // O MINER e o unico corpo do bestiario cuja morte vira JULGAMENTO, e por isso
  // e o unico que precisa saber QUEM o matou.
  //
  // O humor sozinho nao basta. Um bomber explodindo em cima do veio, ou o fogo
  // que o proprio minerador acendeu ao raspar fungo, matam gente sem que o
  // jogador tenha apertado nada — e a tela de fim anotava aquilo como civil
  // abatido por ele. Pelo mesmo caminho, um minerado hostil consumido pelo
  // ambiente pagava minerio que ninguem foi buscar.
  //
  // `attributable` e a MESMA lista fechada que ja decide dano causado, algumas
  // linhas acima: nao existe motivo para "o que conta como acao do jogador" ter
  // duas definicoes no mesmo arquivo. Sem autoria, a morte simplesmente nao
  // rende nada — nem anotacao, nem carga.
  if (ent.archetype === 'miner' && attributable) {
    if (ent.mood === MINER_MOOD_PASSIVE) {
      // Passivo morto NAO dropa. Nao e punicao — e a ausencia de recompensa.
      //
      // Dropar seria transformar "matar todo mundo por precaucao" na jogada
      // otima e apagar o encontro inteiro: por que arriscar aproximar-se frio se
      // a bala rende o mesmo? Sem drop, a violencia gratuita custa municao,
      // calor e tempo, e devolve so a anotacao.
      state.stats.innocentsKilled += 1;
    } else {
      state.stats.oreCollected += MINER_ORE_DROP;
      events.push({
        t: 'ore_gained',
        x: ent.x,
        y: ent.y,
        amount: MINER_ORE_DROP,
        total: state.stats.oreCollected,
      });
    }
  }
  if (ent.archetype === 'guardian') {
    // A parede e uma fase da luta, nao uma alteracao permanente do mapa.
    // Derruba-la aqui garante acesso ao nucleo mesmo se o cerco fechou
    // com o Guardian ja afastado do pedestal.
    openArena(state, events);
  }
};

export const spawnEnemy = (
  state: SurvivalState,
  archetype: EnemyArchetype,
  x: number,
  y: number,
  elite: boolean
): Entity => {
  const def = ARCHETYPES[archetype];
  const enemy: Entity = {
    id: state.nextEntityId++,
    kind: 'enemy',
    archetype,
    x: x + 0.5,
    y: y + 0.5,
    vx: 0,
    vy: 0,
    hp: elite ? Math.floor(def.hp * 2.2) : def.hp,
    maxHp: elite ? Math.floor(def.hp * 2.2) : def.hp,
    radius: def.radius,
    alive: true,
    elite,
    nextActionAt: 0,
    contactReadyAt: 0,
    rangedReadyAt: 0,
    stunnedUntil: 0,
    alertedUntil: 0,
    facing: { x: 1, y: 0 },
    // Todo miner nasce PASSIVO. A postura nao e sorteada no spawn: ela e
    // decidida no instante em que ele te nota, pelo calor da sua arma.
    ...(archetype === 'miner' ? { mood: MINER_MOOD_PASSIVE } : {}),
  };
  state.enemies.push(enemy);
  return enemy;
};

const distTo = (a: Entity, b: Entity): number => Math.hypot(a.x - b.x, a.y - b.y);
const normalized = (x: number, y: number): Vec2 => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

/**
 * Corpos grandes o bastante para ABRIR caminho em vez de contornar.
 *
 * O bispo entra na lista sem ganhar a busca de rota do guardiao: chefe preso e
 * chefe morto, mas a rota do guardiao mora em `state.guardianPath`, um campo
 * unico. Compartilha-lo daria dois chefes disputando o mesmo array — inofensivo
 * hoje, porque um e do setor 2 e o outro do 3, e uma bomba armada no dia em que
 * isso deixar de ser verdade. Empurrar e quebrar resolve o mesmo problema sem
 * inventar um acoplamento com prazo de validade.
 */
const crushesWalls = (enemy: Entity): boolean =>
  enemy.archetype === 'bruiser' || enemy.archetype === 'guardian' || enemy.archetype === 'bishop';

/** Bruiser e Guardian sao corpos minerais; eletricidade causa dano, nao paralisia. */
export const isStoneEnemy = (enemy: Entity): boolean =>
  enemy.archetype === 'bruiser' || enemy.archetype === 'guardian';

/** Aplica controle autoritativo e interrompe a acao corrente do alvo. */
export const stunEntity = (state: SurvivalState, entity: Entity, durationTicks: number): void => {
  entity.stunnedUntil = Math.max(entity.stunnedUntil, state.tick + durationTicks);
  entity.vx = 0;
  entity.vy = 0;
  if (entity.kind === 'enemy') {
    entity.action = undefined;
  } else {
    const extra = state.playerExtras[entity.slot ?? 0];
    extra.dodgeUntil = Math.min(extra.dodgeUntil, state.tick);
  }
};

/**
 * Mira de interceptacao sem homing: resolve uma unica vez no release e depois a
 * pedra segue reta. Usa a velocidade REAL observada do alvo, limitada pelo tempo
 * maximo de voo, para continuar desviavel lateralmente.
 */
export const interceptDirection = (
  sourceX: number,
  sourceY: number,
  target: Entity,
  projectileSpeed: number,
  maxLeadSeconds: number
): Vec2 => {
  const rx = target.x - sourceX;
  const ry = target.y - sourceY;
  const vx = target.vx;
  const vy = target.vy;
  const a = vx * vx + vy * vy - projectileSpeed * projectileSpeed;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;
  let time = 0;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) time = -c / b;
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      const t1 = (-b - root) / (2 * a);
      const t2 = (-b + root) / (2 * a);
      const candidates = [t1, t2].filter((t) => t > 0);
      if (candidates.length > 0) time = Math.min(...candidates);
    }
  }
  const lead = Math.max(0, Math.min(maxLeadSeconds, time));
  return normalized(rx + vx * lead, ry + vy * lead);
};

const nearestTarget = (state: SurvivalState, x: number, y: number): Entity | null => {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const p of state.players) {
    const e = state.playerExtras[p.slot ?? 0];
    if (!e.joined || !p.alive || e.downed) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
};

const startAction = (
  state: SurvivalState,
  enemy: Entity,
  action: EntityActionKind,
  direction: Vec2,
  windupTicks: number,
  recoveryTicks: number,
  events: SemanticEvent[],
  target?: number
): void => {
  const releaseAt = state.tick + windupTicks;
  enemy.action = {
    kind: action,
    phase: 'windup',
    startedAt: state.tick,
    releaseAt,
    endsAt: releaseAt + recoveryTicks,
    direction: { ...direction },
    target,
  };
  enemy.facing = { ...direction };
  events.push({
    t: 'action_start',
    entity: enemy.id,
    action,
    x: enemy.x,
    y: enemy.y,
    dx: direction.x,
    dy: direction.y,
    startTick: state.tick,
    releaseTick: releaseAt,
    endTick: releaseAt + recoveryTicks,
  });
};

const releaseAction = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const action = enemy.action;
  if (!action || action.phase !== 'windup') return;
  action.phase = 'release';
  const target = action.target === undefined
    ? null
    : state.players.find((p) => p.id === action.target && p.alive && !state.playerExtras[p.slot ?? 0].downed) ?? null;

  if (action.kind === 'pulse') {
    bishopNova(state, enemy, events);
    return;
  }
  if (action.kind === 'detonate') {
    // O bomber se mata; a explosao que sai disso e que machuca o jogador, e ela
    // carrega a propria causa (`explosion`/`enemy`) em explodeAt.
    damageEntity(state, enemy, enemy.hp, events, { kind: 'explosion', source: 'enemy' });
    return;
  }
  if (action.kind === 'ranged') {
    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    state.projectiles.push({
      kind: 'spit',
      id: state.nextEntityId++,
      owner: enemy.id,
      x: enemy.x,
      y: enemy.y,
      vx: action.direction.x * 7,
      vy: action.direction.y * 7,
      damage: enemy.archetype === 'guardian' ? 14 : enemy.archetype === 'bishop' ? 12 : 9,
      distanceTravelled: 0,
      hostile: true,
      leavesBiofluid: true,
      ttl: Math.ceil(((def.aggroRange + 4) / 7) * TICK_HZ),
    });
    events.push({ t: 'shot', x: enemy.x, y: enemy.y, dx: action.direction.x, dy: action.direction.y, owner: enemy.id });
  } else if (action.kind === 'contact' && target) {
    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    if (distTo(enemy, target) < enemy.radius + target.radius + 0.45) {
      damageEntity(state, target, def.contactDamage * (enemy.elite ? 1.4 : 1), events, {
        kind: 'enemy_contact',
        archetype: enemy.archetype as EnemyArchetype,
        elite: enemy.elite,
      });
    }
  } else if (action.kind === 'hurl') {
    if (target) {
      action.direction = interceptDirection(
        enemy.x,
        enemy.y,
        target,
        BRUISER_HURL_SPEED,
        BRUISER_HURL_FLIGHT_TILES / BRUISER_HURL_SPEED
      );
      enemy.facing = { ...action.direction };
    }
    state.projectiles.push({
      kind: 'rock',
      id: state.nextEntityId++,
      owner: enemy.id,
      x: enemy.x,
      y: enemy.y,
      vx: action.direction.x * BRUISER_HURL_SPEED,
      vy: action.direction.y * BRUISER_HURL_SPEED,
      damage: BRUISER_HURL_DAMAGE,
      radius: BRUISER_ROCK_RADIUS,
      distanceTravelled: 0,
      hostile: true,
      // Pedra nao deixa poca: quem suja o chao e o cuspidor, e as duas ameacas
      // tem de continuar querendo dizer coisas diferentes.
      leavesBiofluid: false,
      ttl: Math.ceil((BRUISER_HURL_FLIGHT_TILES / BRUISER_HURL_SPEED) * TICK_HZ),
    });
    events.push({ t: 'shot', x: enemy.x, y: enemy.y, dx: action.direction.x, dy: action.direction.y, owner: enemy.id });
  } else if (action.kind === 'charge') {
    // O cavalo NAO recebe impulso aqui. A investida dele e conduzida tick a tick
    // por `horseChargeStride`, que precisa da posicao exata de cada passo para
    // acender o rastro; somar velocidade solta por cima daria dois movimentos no
    // mesmo tick e o fogo sairia desalinhado do caminho percorrido.
    if (enemy.archetype === 'fungal_horse') return;
    enemy.vx = action.direction.x * 7;
    enemy.vy = action.direction.y * 7;
  } else if (action.kind === 'slam' && enemy.archetype === 'miner') {
    // Cleave de picareta: CIRCULAR em volta dele, e nao um golpe direcional.
    //
    // Circular porque a resposta certa e RECUAR. Um golpe frontal ensinaria a
    // orbitar por tras, que e o que o jogador ja faz com todo o resto do
    // bestiario — o miner enfurecido existe justamente para punir quem entra em
    // cima confiando nisso.
    for (const victim of state.players) {
      if (!victim.alive || !state.playerExtras[victim.slot ?? 0].joined) continue;
      if (distTo(enemy, victim) > MINER_CLEAVE_RADIUS) continue;
      damageEntity(state, victim, MINER_CLEAVE_DAMAGE, events, {
        kind: 'enemy_contact',
        archetype: 'miner',
        elite: enemy.elite,
      });
    }
    events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: MINER_CLEAVE_RADIUS });
  } else if (action.kind === 'slam' && target) {
    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    if (distTo(enemy, target) < 2.1) {
      damageEntity(state, target, def.contactDamage * 1.2, events, {
        kind: 'enemy_contact',
        archetype: enemy.archetype as EnemyArchetype,
        elite: enemy.elite,
      });
    }
  }
};

/** Returns true while an authoritative action owns the enemy's pose/movement. */
const advanceAction = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): boolean => {
  const action = enemy.action;
  if (!action) return false;
  if (state.tick >= action.releaseAt && action.phase === 'windup') releaseAction(state, enemy, events);
  if (!enemy.alive) return true;
  if (state.tick >= action.endsAt) {
    enemy.action = undefined;
    return false;
  }
  if (action.phase === 'release') action.phase = 'recovery';
  return true;
};

/**
 * Celula de parede mais proxima que o bruiser consegue arrancar, ou null.
 *
 * A varredura e em ordem FIXA e escolhe pela menor distancia, com a ordem de
 * iteracao como desempate: a simulacao e deterministica e duas maquinas da
 * mesma sala precisam arrancar exatamente o mesmo bloco. Um sorteio aqui
 * divergiria o mundo entre os dois jogadores.
 */
export const findRippable = (state: SurvivalState, ent: Entity): { x: number; y: number } | null => {
  const ex = Math.floor(ent.x);
  const ey = Math.floor(ent.y);
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let dy = -BRUISER_HURL_REACH; dy <= BRUISER_HURL_REACH; dy++) {
    for (let dx = -BRUISER_HURL_REACH; dx <= BRUISER_HURL_REACH; dx++) {
      const x = ex + dx;
      const y = ey + dy;
      if (x < 0 || y < 0 || x >= state.config.width || y >= state.config.height) continue;
      // MESMO criterio de `ripSolid`, e nao uma copia dele.
      //
      // A copia existia e discordava do original em um detalhe: a borda do mapa
      // parece arrancavel pelo tipo do bloco, mas `ripSolid` a recusa. Perto da
      // moldura o bruiser escolhia a borda por ser a mais proxima, tomava um
      // `false`, e escolhia a MESMA celula no tick seguinte — travado para
      // sempre, com paredes validas a dois passos de distancia.
      if (!canRip(state, x, y)) continue;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
};

/**
 * Direcao de perseguicao do guardiao, contornando ou arrombando o que houver.
 *
 * Com linha de visao livre ele vai reto, e nem chega a pensar: buscar caminho a
 * cada tick para um alvo que esta a vista seria gasto puro, e a rota em grade
 * ainda daria um andar quadriculado onde o certo e a diagonal.
 *
 * Bloqueado, ele segue a rota de menor custo — que pode passar POR DENTRO de uma
 * parede quebravel quando o desvio livre e longo demais. A rota e recalculada em
 * intervalos e nao a cada tick: o alvo se move pouco entre um calculo e outro, e
 * a busca e a coisa mais cara que a simulacao faz por criatura.
 */
const guardianSteering = (
  state: SurvivalState,
  enemy: Entity,
  targetX: number,
  targetY: number,
  events: SemanticEvent[]
): Vec2 => {
  if (hasLineOfSight(state, enemy.x, enemy.y, targetX, targetY)) {
    state.guardianPath = [];
    return normalized(targetX - enemy.x, targetY - enemy.y);
  }

  const w = state.config.width;
  const ex = Math.floor(enemy.x);
  const ey = Math.floor(enemy.y);
  const stale = state.tick - state.guardianPathAt >= GUARDIAN_PATH_INTERVAL_TICKS;
  if (stale || state.guardianPath.length === 0) {
    state.guardianPath = findPath(state, ex, ey, Math.floor(targetX), Math.floor(targetY));
    state.guardianPathAt = state.tick;
  }

  // Consome os passos ja alcancados. Sem isto ele fica mirando a celula em que
  // ja esta e trava no lugar.
  while (state.guardianPath.length > 0 && state.guardianPath[0] === ey * w + ex) {
    state.guardianPath.shift();
  }
  if (state.guardianPath.length === 0) {
    // Sem rota dentro do orcamento: volta a empurrar na direcao do alvo. Pior,
    // mas nunca imovel — um chefe parado e o fim da luta.
    return normalized(targetX - enemy.x, targetY - enemy.y);
  }

  const next = state.guardianPath[0];
  const nx = next % w;
  const ny = (next / w) | 0;
  // Parede no proximo passo: a rota ja pagou o preco de atravessa-la, entao ele
  // ABRE em vez de tropecar. E o que transforma "preso atras de uma pedra" em
  // "vem vindo, e a pedra nao vai adiantar".
  //
  // E abre BRECHA, nao porta. O guardiao tem raio 0,68 — corpo de quase um tile
  // e meio — e a colisao amostra os quatro cantos dele: num vao de uma celula so
  // os cantos ainda caem na pedra dos lados, e ele fica encostado no buraco que
  // acabou de fazer. Medido, foi exatamente o que aconteceu: parede quebrada,
  // caminho vazio e o chefe parado a 1,7 tile dela pelo resto da luta. As
  // vizinhas PERPENDICULARES ao passo sao o que da largura ao vao.
  if (state.solid[ny * w + nx] !== SOLID_NONE) {
    const alongX = Math.abs(nx - ex) >= Math.abs(ny - ey);
    for (const [ox, oy] of alongX ? [[0, 0], [0, -1], [0, 1]] : [[0, 0], [-1, 0], [1, 0]]) {
      const bx = nx + ox;
      const by = ny + oy;
      if (state.solid[by * w + bx] === SOLID_NONE) continue;
      if (!breakSolid(state, bx, by, events)) ripSolid(state, bx, by, events);
    }
  }
  return normalized(nx + 0.5 - enemy.x, ny + 0.5 - enemy.y);
};

/**
 * O Bispo se cura do chao, e nao de si mesmo.
 *
 * Em cima de fungo VIVO ele regenera acima do que o tiro base sustenta, entao
 * atrito nao o mata: a luta e resolvida mudando o piso, nao a barra de vida.
 *
 * Fungo AQUECIDO (fumegando, antes de virar fogo) ja nao cura. O detalhe e o
 * ponto inteiro do encontro: o jogador ve a cura parar no instante em que
 * encosta calor, e nao quatro segundos depois quando a chama finalmente sobe.
 * Se a recompensa so viesse com o fogo, a licao chegaria tarde demais para ser
 * lida como consequencia da propria acao.
 */
const bishopRegen = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): boolean => {
  if (state.surface[cellUnder(state, enemy)] !== SURF_FUNGAL) return false;
  if (enemy.hp >= enemy.maxHp) return true;
  enemy.hp = Math.min(enemy.maxHp, enemy.hp + BISHOP_REGEN_PER_TICK);
  // Um evento a cada quatro ticks, e nao a cada tick: a 20 Hz o barramento
  // semantico levaria 20 curas por segundo so deste inimigo, e o mixer de audio
  // gastaria o orcamento de vozes inteiro num som que se le igual em 5 Hz.
  if (state.tick % 4 === 0) {
    events.push({ t: 'heal', x: enemy.x, y: enemy.y, entity: enemy.id, amount: BISHOP_REGEN_PER_TICK * 4 });
  }
  return true;
};

/**
 * Celula de fungo vivo mais proxima, ou null.
 *
 * Varredura em ordem fixa com a menor distancia vencendo e a ordem de iteracao
 * como desempate, pelo mesmo motivo de `findRippable`: duas maquinas da mesma
 * sala precisam mandar o bispo para o MESMO tapete.
 */
const nearestFungal = (state: SurvivalState, ent: Entity): { x: number; y: number } | null => {
  const w = state.config.width;
  const ex = Math.floor(ent.x);
  const ey = Math.floor(ent.y);
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let dy = -BISHOP_FUNGAL_SEARCH; dy <= BISHOP_FUNGAL_SEARCH; dy++) {
    for (let dx = -BISHOP_FUNGAL_SEARCH; dx <= BISHOP_FUNGAL_SEARCH; dx++) {
      const x = ex + dx;
      const y = ey + dy;
      if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
      if (state.surface[y * w + x] !== SURF_FUNGAL) continue;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
};

/**
 * O calor da arma do jogador mais proximo, ou -1 se ninguem esta perto.
 *
 * Do jogador de pe MAIS PROXIMO, e nao do maior calor da sala: quem se
 * aproxima e quem o miner esta olhando. No co-op isso significa que um parceiro
 * frio pode chegar perto enquanto o outro fica queimando la atras — e essa
 * divisao de tarefas e um plano legitimo, nao uma brecha.
 */
const approachingHeat = (state: SurvivalState, ent: Entity): number => {
  const player = nearestTarget(state, ent.x, ent.y);
  if (!player || distTo(ent, player) > MINER_NOTICE_RANGE) return -1;
  if (!hasLineOfSight(state, ent.x, ent.y, player.x, player.y)) return -1;
  return state.playerExtras[player.slot ?? 0].heat;
};

/**
 * Decide a postura do Miner quando ele te NOTA, e congela a decisao.
 *
 * Congelar importa: se a postura seguisse o calor tick a tick, o miner
 * oscilaria entre fugir e atacar enquanto a arma esfria, e o jogador veria um
 * NPC epiletico em vez de uma reacao. O calor decide UMA vez, no instante em que
 * ele levanta a cabeca — depois disso o encontro ja e o que e.
 */
const settleMinerMood = (state: SurvivalState, ent: Entity, events: SemanticEvent[]): void => {
  if (ent.mood !== MINER_MOOD_PASSIVE) return;
  const heat = approachingHeat(state, ent);
  if (heat < 0) return;
  if (heat >= MINER_RAGE_HEAT) {
    ent.mood = MINER_MOOD_ENRAGED;
    markDiscovery(state.stats, DISCOVERY_MINER_ENRAGED);
    events.push({ t: 'miner_mood', entity: ent.id, x: ent.x, y: ent.y, mood: MINER_MOOD_ENRAGED });
    return;
  }
  if (heat >= MINER_FEAR_HEAT) {
    ent.mood = MINER_MOOD_FLEEING;
    markDiscovery(state.stats, DISCOVERY_MINER_FLED);
    events.push({ t: 'miner_mood', entity: ent.id, x: ent.x, y: ent.y, mood: MINER_MOOD_FLEEING });
  }
  // Arma fria: ele nao faz nada, e continua nao fazendo nada. Este e o unico
  // inimigo do jogo que o jogador pode simplesmente deixar em paz.
};

/**
 * Supernova Fungica: dano em 360 graus e o tapete REPLANTADO em volta dele.
 *
 * A parte que importa e a segunda. Sem replantar, queimar a arena resolvia a
 * luta de uma vez — o jogador aprendia a resposta certa e o resto do encontro
 * virava formalidade. Com o replantio, a resposta certa continua certa e passa a
 * ter de ser REPETIDA, que e a diferenca entre um truque e uma luta.
 *
 * Nao planta sobre solido nem sobre fogo vivo: plantar dentro da chama apagaria
 * o incendio que o jogador acabou de acender, e transformaria a acao dele em
 * nada. O fungo cresce onde o fogo ja passou, e nao por cima dele.
 */
const bishopNova = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const w = state.config.width;
  const r = Math.ceil(BISHOP_NOVA_RADIUS);
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > BISHOP_NOVA_RADIUS * BISHOP_NOVA_RADIUS) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) continue;
      if (state.surface[i] === SURF_FIRE || state.surface[i] === SURF_FUNGAL) continue;
      setSurface(state, i, SURF_FUNGAL, BISHOP_NOVA_FUNGAL_TICKS);
    }
  }
  for (const player of state.players) {
    if (!player.alive || !state.playerExtras[player.slot ?? 0].joined) continue;
    if (distTo(enemy, player) > BISHOP_NOVA_RADIUS) continue;
    damageEntity(state, player, BISHOP_NOVA_DAMAGE, events, {
      kind: 'enemy_contact',
      archetype: 'bishop',
      elite: enemy.elite,
    });
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: BISHOP_NOVA_RADIUS });
};

/**
 * Uma passada da investida do Cavalo: move, atropela e deixa rastro.
 *
 * Mora fora de `releaseAction` porque a investida do cavalo dura DEZENAS de
 * ticks, e nao um instante. As outras acoes resolvem tudo no release — a pedra
 * sai, o golpe acerta ou nao — e por isso `advanceAction` pode devolver `true` e
 * a criatura ficar parada na recuperacao. Aqui a recuperacao E a acao.
 *
 * O rastro nasce ATRAS, e sem guardar historico: a posicao de onde o fogo sobe e
 * a posicao atual menos a direcao vezes o atraso. Guardar as celulas visitadas
 * daria o mesmo resultado e acrescentaria um campo por inimigo ao estado
 * autoritativo — que e sincronizado, hasheado e reenviado a cada resync.
 */
const horseChargeStride = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const action = enemy.action;
  if (!action || action.kind !== 'charge' || action.phase === 'windup') return;

  const dt = 1 / TICK_HZ;
  const step = HORSE_CHARGE_SPEED * dt;
  enemy.facing = { ...action.direction };
  const moved = moveEntity(state, enemy, action.direction.x * step, action.direction.y * step);

  // Bater na pedra ENCERRA a investida. E o unico contra-jogo posicional que o
  // cavalo oferece: quem entende o telegrafo poe uma parede no caminho e ganha o
  // cooldown inteiro de graca. Continuar raspando na parede ate o tempo acabar
  // tiraria a recompensa de ter lido a ameaca.
  if (moved.blockedX || moved.blockedY) {
    enemy.action = undefined;
    enemy.vx = 0;
    enemy.vy = 0;
    return;
  }

  const victim = nearestTarget(state, enemy.x, enemy.y);
  if (victim && state.tick >= enemy.contactReadyAt && distTo(enemy, victim) < enemy.radius + victim.radius + 0.35) {
    enemy.contactReadyAt = state.tick + ARCHETYPES.fungal_horse.contactCooldown;
    damageEntity(state, victim, ARCHETYPES.fungal_horse.contactDamage * (enemy.elite ? 1.4 : 1), events, {
      kind: 'enemy_contact',
      archetype: 'fungal_horse',
      elite: enemy.elite,
    });
  }

  // O rastro so comeca depois que a investida ANDOU o atraso inteiro.
  //
  // Subtrair sempre a distancia cheia supoe que ela ja foi percorrida, e nas
  // primeiras passadas ela nao foi: a primeira, de 0,525 tile, mira cerca de
  // 1,575 tile ATRAS do ponto de partida — chao do outro lado da origem, onde o
  // cavalo nunca esteve. Toda investida acendia fogo pelas costas de onde
  // comecou, o que apagava a leitura do rastro como caminho percorrido e podia
  // queimar o jogador que tinha recuado na direcao certa.
  const strides = state.tick - action.releaseAt;
  if (strides < HORSE_TRAIL_DELAY_TICKS) return;

  const trailX = Math.floor(enemy.x - action.direction.x * step * HORSE_TRAIL_DELAY_TICKS);
  const trailY = Math.floor(enemy.y - action.direction.y * step * HORSE_TRAIL_DELAY_TICKS);
  if (trailX < 0 || trailY < 0 || trailX >= state.config.width || trailY >= state.config.height) return;
  const i = trailY * state.config.width + trailX;
  if (state.solid[i] !== SOLID_NONE) return;
  // `igniteCell` primeiro: cada materia tem a propria resposta ao calor (o fungo
  // seca antes de pegar, o gas da flash, o esporo esteriliza), e o cavalo nao
  // tem por que ser a excecao que atropela essa tabela. So quando o chao nao tem
  // resposta propria — rocha nua — o rastro traz o proprio combustivel.
  if (!igniteCell(state, i, events)) {
    if (state.surface[i] === SURF_NONE) {
      setSurface(state, i, SURF_FIRE, HORSE_TRAIL_FUEL_TICKS);
      events.push({ t: 'ignite', x: trailX, y: trailY });
    }
  }
};

/**
 * Gasta a velocidade SOLTA de um inimigo — perambular, impulso de investida,
 * empurrao — e a amortece um pouco.
 *
 * Existe como funcao propria porque tem DOIS chamadores que nao se parecem: o
 * fluxo normal de IA e a janela de recuperacao de uma acao autoritativa. O
 * impulso da investida do guardian nasce no `release` e antes ficava preso ali,
 * porque `advanceAction` devolve `true` ate `endsAt` e o `continue` pulava o
 * unico lugar que consumia `vx/vy`. O telegrafo terminava com o bicho parado e a
 * investida so saia oito ticks depois — o jogador lia o aviso e era acertado
 * pelo golpe que ja tinha esquivado.
 *
 * `updateFacing` e false quando quem chama tem um rumo melhor que a velocidade:
 * durante uma acao o rumo esta congelado no telegrafo de proposito, e o cavalo em
 * perseguicao acumula a curva dele por angulo.
 */
const driftByVelocity = (
  state: SurvivalState,
  enemy: Entity,
  dt: number,
  events: SemanticEvent[],
  updateFacing: boolean,
): void => {
  if (Math.hypot(enemy.vx, enemy.vy) <= 0.05) return;
  // Movimento por VELOCIDADE tambem tem de atualizar o rumo.
  //
  // So o movimento por `dirX/dirY` atualizava, entao um inimigo perambulando
  // andava para um lado com o sprite virado para outro. O cliente compensava
  // isso adivinhando o rumo pelo deslocamento OBSERVADO — e a adivinhacao
  // quebra exatamente quando a colisao zera um dos eixos, porque ai o
  // deslocamento aponta para um quadrante que a criatura nunca escolheu.
  // Com o rumo correto na simulacao, o cliente nao precisa adivinhar.
  if (updateFacing) enemy.facing = normalized(enemy.vx, enemy.vy);
  const moved = moveEntity(state, enemy, enemy.vx * dt, enemy.vy * dt);
  if (moved.blockCell && crushesWalls(enemy)) {
    breakSolid(state, moved.blockCell.x, moved.blockCell.y, events);
  }
  const decay = enemy.archetype === 'guardian' ? 0.92 : 0.82;
  enemy.vx *= decay;
  enemy.vy *= decay;
};

export const updateEnemies = (state: SurvivalState, events: SemanticEvent[]): void => {
  const dt = 1 / TICK_HZ;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    // A cura do bispo roda ANTES do portao de acao, e nao dentro do ramo de IA.
    // Ela e uma propriedade do chao, nao uma decisao dele: suspende-la durante
    // cada golpe ou cada atordoamento ensinaria ao jogador uma janela que nao
    // existe — "acertei na hora certa" em vez de "ele estava no lugar errado".
    const onFungus = enemy.archetype === 'bishop' && bishopRegen(state, enemy, events);
    if (advanceAction(state, enemy, events)) {
      if (!enemy.alive) continue;
      // O cavalo e conduzido passo a passo por `horseChargeStride`; todo o resto
      // gasta aqui o impulso que o `release` deixou — ver `driftByVelocity`.
      if (enemy.archetype === 'fungal_horse') horseChargeStride(state, enemy, events);
      else driftByVelocity(state, enemy, dt, events, false);
      continue;
    }
    if (enemy.stunnedUntil > state.tick) continue;

    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    const player = nearestTarget(state, enemy.x, enemy.y);
    const dist = player ? distTo(enemy, player) : Infinity;

    // O MINER e o unico inimigo que decide o que fazer com voce a partir do que
    // VOCE trouxe, e nao da distancia. Sai do fluxo comum inteiro: passivo, ele
    // simplesmente nao participa da simulacao de combate.
    if (enemy.archetype === 'miner') {
      settleMinerMood(state, enemy, events);
      if (enemy.mood === MINER_MOOD_PASSIVE || !player) continue;

      if (enemy.mood === MINER_MOOD_FLEEING) {
        // Larga a carga e recua pelos tuneis, na velocidade do jogador:
        // perseguir custa tempo de verdade, que e o preco do minerio que ele
        // estava levando para uma grade que nao existe mais.
        const away = normalized(enemy.x - player.x, enemy.y - player.y);
        enemy.facing = { ...away };
        const fled = moveEntity(
          state,
          enemy,
          away.x * MINER_FLEE_SPEED * dt * surfaceSpeedMul(state, enemy),
          away.y * MINER_FLEE_SPEED * dt * surfaceSpeedMul(state, enemy)
        );
        // Encurralado, ele desliza pela parede em vez de travar de frente para
        // ela. Um NPC preso num canto vibrando le como bug, e nao como medo.
        if (fled.blockedX || fled.blockedY) {
          moveEntity(
            state,
            enemy,
            (fled.blockedX ? -away.y : 0) * MINER_FLEE_SPEED * dt,
            (fled.blockedY ? -away.x : 0) * MINER_FLEE_SPEED * dt
          );
        }
        continue;
      }

      // Enfurecido: vem para cima e golpeia em area. Sem ataque a distancia e
      // sem quebrar parede — ele e um humano com uma picareta, nao um chefe.
      const toward = normalized(player.x - enemy.x, player.y - enemy.y);
      enemy.facing = { ...toward };
      if (dist < MINER_CLEAVE_RADIUS && state.tick >= enemy.contactReadyAt) {
        enemy.contactReadyAt = state.tick + MINER_CLEAVE_COOLDOWN_TICKS;
        startAction(state, enemy, 'slam', toward, MINER_CLEAVE_WINDUP_TICKS, 8, events, player.id);
        continue;
      }
      moveEntity(
        state,
        enemy,
        toward.x * MINER_RAGE_SPEED * dt * surfaceSpeedMul(state, enemy),
        toward.y * MINER_RAGE_SPEED * dt * surfaceSpeedMul(state, enemy)
      );
      continue;
    }
    // Guardiao ACORDADO nunca perde o alvo. Ele e o clima da sala, nao um bicho
    // que patrulha: sair do raio dele nao pode ser uma forma de vencer.
    const guardianHunting = enemy.archetype === 'guardian' && state.guardianAwake;
    const aggro =
      player !== null &&
      (guardianHunting ||
        dist <= def.aggroRange + (enemy.elite ? 3 : 0) ||
        state.tick < enemy.alertedUntil);

    if (enemy.archetype === 'guardian' && !state.guardianAwake) {
      // O alerta TAMBEM acorda. Sem isto, `aggro` ficava verdadeiro por dano mas
      // o portao logo abaixo devolvia `continue`: o chefe levava tiro de 8 tiles
      // sem se mexer, cada tiro renovando um alerta que nao servia para nada.
      // Era exatamente a morte sem retaliacao que o aggro por dano existe para
      // impedir, preservada no unico inimigo em que ela mais doi.
      if (state.coreTaken || dist < 7 || state.tick < enemy.alertedUntil) {
        state.guardianAwake = true;
        events.push({ t: 'guardian_awake' });
      } else continue;
    }

    let dirX = 0;
    let dirY = 0;
    const speed = def.speed * (enemy.elite ? 1.12 : 1) * surfaceSpeedMul(state, enemy);

    if (aggro && player) {
      const toward = normalized(player.x - enemy.x, player.y - enemy.y);
      dirX = toward.x;
      dirY = toward.y;
      if (enemy.archetype === 'guardian') {
        const steer = guardianSteering(state, enemy, player.x, player.y, events);
        dirX = steer.x;
        dirY = steer.y;
      }

      // O TELL do bispo.
      //
      // Ferido, ele abandona a perseguicao e corre para o tapete de fungo mais
      // proximo — e la se cura mais rapido do que o tiro base tira. O contra-jogo
      // nao esta escrito em lugar nenhum: esta no fato de o proprio chefe apontar
      // para o que o mantem vivo toda vez que ele se machuca. Queimar a arena e a
      // conclusao que o jogador tira sozinho depois de ve-lo fugir duas vezes.
      //
      // Sem fungo ao alcance ele nao tem para onde ir e volta a perseguir: a
      // arena queimada nao o deixa acuado num canto, so o deixa mortal.
      const retreating =
        enemy.archetype === 'bishop' &&
        !onFungus &&
        enemy.hp < enemy.maxHp * BISHOP_RETREAT_HP_FRACTION;
      if (retreating) {
        const refuge = nearestFungal(state, enemy);
        if (refuge) {
          const flee = normalized(refuge.x + 0.5 - enemy.x, refuge.y + 0.5 - enemy.y);
          dirX = flee.x;
          dirY = flee.y;
        } else if (state.tick >= enemy.nextActionAt) {
          // Ferido e SEM refugio: e aqui, e so aqui, que a Supernova sai.
          //
          // Nao e mais um golpe no rodizio — e a resposta dele a ter perdido o
          // chao. O jogador vive a sequencia inteira como causa e efeito: queimei
          // o tapete, ele fugiu, nao achou nada, e replantou. Se disparasse por
          // cooldown, o replantio seria um evento que acontece COM o jogador;
          // assim e um evento que ele provocou.
          enemy.nextActionAt = state.tick + BISHOP_NOVA_COOLDOWN_TICKS;
          startAction(state, enemy, 'pulse', toward, BISHOP_NOVA_WINDUP_TICKS, 10, events, player.id);
          continue;
        }
      }

      // A investida exige LINHA DE VISAO na hora de comecar.
      //
      // A direcao congela no windup e nao se corrige mais — e o que torna o
      // telegrafo de 1,3 s uma informacao util em vez de um aviso de algo
      // inevitavel. Sem a checagem, o cavalo dispararia contra uma parede que
      // esta entre os dois e a acao inteira viraria ruido.
      if (
        enemy.archetype === 'fungal_horse' &&
        state.tick >= enemy.rangedReadyAt &&
        dist >= HORSE_CHARGE_MIN_RANGE &&
        dist <= HORSE_CHARGE_MAX_RANGE &&
        hasLineOfSight(state, enemy.x, enemy.y, player.x, player.y)
      ) {
        enemy.rangedReadyAt = state.tick + HORSE_CHARGE_COOLDOWN_TICKS;
        startAction(state, enemy, 'charge', toward, HORSE_CHARGE_WINDUP_TICKS, HORSE_CHARGE_TICKS, events, player.id);
        continue;
      }

      if (enemy.archetype === 'bomber' && dist < 2.05) {
        startAction(state, enemy, 'detonate', toward, 12, 4, events, player.id);
        continue;
      }

      // Bruiser: arranca a parede e joga.
      //
      // Ele era o unico sem NENHUMA resposta a distancia, a metade da velocidade
      // do jogador — contra quem recua, nunca encostava, e mais HP so alongaria
      // a mesma luta inofensiva. A municao sai do MUNDO: o bloco arrancado some
      // da arena, entao a cobertura de quem esta atras dela pode virar o proprio
      // projetil que vem. Sem parede ao alcance ele nao tem o que jogar e volta
      // a ser o perseguidor lento — em sala aberta a ameaca dele e outra.
      if (
        enemy.archetype === 'bruiser' &&
        state.tick >= enemy.rangedReadyAt &&
        dist >= BRUISER_HURL_MIN_RANGE &&
        dist <= BRUISER_HURL_MAX_RANGE
      ) {
        const ammo = findRippable(state, enemy);
        if (ammo && ripSolid(state, ammo.x, ammo.y, events)) {
          enemy.rangedReadyAt = state.tick + BRUISER_HURL_COOLDOWN_TICKS;
          startAction(state, enemy, 'hurl', toward, BRUISER_HURL_WINDUP_TICKS, 6, events, player.id);
          continue;
        }
      }

      // Bispo em fuga NAO para para cuspir. Uma acao a distancia no meio da
      // retirada apagaria o tell: ele pareceria estar manobrando, e nao correndo
      // para um lugar especifico.
      if (
        (enemy.archetype === 'spitter' ||
          enemy.archetype === 'guardian' ||
          (enemy.archetype === 'bishop' && !retreating)) &&
        state.tick >= enemy.rangedReadyAt
      ) {
        const rangedDistance = enemy.archetype === 'spitter' ? 5.5 : 6.5;
        if (dist <= rangedDistance) {
          const windup = enemy.archetype === 'spitter' ? 6 : 10;
          enemy.rangedReadyAt = state.tick + (enemy.archetype === 'spitter' ? 56 : 44);
          startAction(state, enemy, 'ranged', toward, windup, 5, events, player.id);
          continue;
        }
      }

      const contactRange = enemy.radius + player.radius + 0.18;
      if (dist < contactRange && state.tick >= enemy.contactReadyAt && enemy.archetype !== 'bomber') {
        const heavy = enemy.archetype === 'guardian' || enemy.archetype === 'bishop';
        const windup = heavy ? 7 : enemy.archetype === 'bruiser' ? 5 : 3;
        enemy.contactReadyAt = state.tick + def.contactCooldown;
        startAction(state, enemy, heavy ? 'slam' : 'contact', toward, windup, 4, events, player.id);
        continue;
      }

      if (enemy.archetype === 'spitter' && dist < 5) {
        dirX = -dirX;
        dirY = -dirY;
      }
      if (enemy.archetype === 'stalker') {
        const side = enemy.id % 2 === 0 ? 1 : -1;
        const ox = dirX;
        dirX += -dirY * 0.45 * side;
        dirY += ox * 0.45 * side;
        const flank = normalized(dirX, dirY);
        dirX = flank.x;
        dirY = flank.y;
        const aheadX = enemy.x + dirX * 0.8;
        const aheadY = enemy.y + dirY * 0.8;
        const ai = Math.floor(aheadY) * state.config.width + Math.floor(aheadX);
        if (ai >= 0 && ai < state.surface.length && state.surface[ai] === SURF_FIRE) {
          const temp = dirX;
          dirX = -dirY;
          dirY = temp;
        }
      }
      if (enemy.archetype === 'guardian' && state.tick >= enemy.nextActionAt && dist > 2.2) {
        enemy.nextActionAt = state.tick + 100;
        startAction(state, enemy, 'charge', toward, 8, 8, events, player.id);
        continue;
      }
    } else if (state.tick >= enemy.nextActionAt) {
      enemy.nextActionAt = state.tick + 40 + state.rng.nextInt(60);
      const angle = state.rng.nextFloat01() * Math.PI * 2;
      enemy.vx = Math.cos(angle) * def.speed * 0.35;
      enemy.vy = Math.sin(angle) * def.speed * 0.35;
    }

    // O cavalo em perseguicao NAO tem o rumo sobrescrito pela velocidade residual.
    //
    // O rumo dele e um acumulador: a curva abaixo soma um passo de
    // `HORSE_TURN_RATE` por tick em cima de `enemy.facing`, e e essa soma que
    // descreve o arco. Enquanto sobra velocidade de perambular ou de um empurrao,
    // reescrever `facing` pela velocidade jogava o acumulador de volta ao ponto de
    // partida todo tick — o cavalo repetia eternamente o mesmo primeiro passo de
    // curva e so comecava a virar de verdade quando a residual caia abaixo do
    // limiar, uma dezena de ticks depois. Quem estava sendo perseguido via o
    // bicho correr reto por uma tangente que ele nunca escolheu.
    const horseSteering = enemy.archetype === 'fungal_horse' && (dirX !== 0 || dirY !== 0);
    driftByVelocity(state, enemy, dt, events, !horseSteering);

    // O cavalo NAO vira no lugar.
    //
    // Todos os outros inimigos apontam para o jogador e andam naquela direcao no
    // mesmo tick. Num bicho de 2 tiles isso le como sprite sendo arrastado, e nao
    // como corpo correndo — e foi exatamente o que apareceu na primeira versao.
    // Fechando a curva aos poucos ele descreve um ARCO, que e o que da ao jogador
    // a chance de sair pelo lado de dentro dela.
    //
    // Vale so fora da investida: a investida ja congela a direcao no windup, e
    // suavizar por cima disso faria o cavalo desviar do proprio telegrafo.
    // Gira por ANGULO, e nao interpolando os dois vetores.
    //
    // Misturar `facing` com o alvo e normalizar parecia equivalente e nao e: com
    // os dois exatamente opostos, a mistura continua no MESMO eixo e a
    // normalizacao devolve o vetor original. O cavalo simplesmente nao virava —
    // e so quando quem estava atras dele era o jogador, que e o caso em que a
    // curva importa. Limitar o passo angular nao tem esse ponto cego.
    if (enemy.archetype === 'fungal_horse' && (dirX !== 0 || dirY !== 0)) {
      const current = Math.atan2(enemy.facing.y, enemy.facing.x);
      let delta = Math.atan2(dirY, dirX) - current;
      // Para o menor lado. Sem isto, virar de +170 para -170 graus daria a volta
      // inteira por fora em vez dos 20 graus que realmente separam os dois.
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const stepped = current + Math.max(-HORSE_TURN_RATE, Math.min(HORSE_TURN_RATE, delta));
      dirX = Math.cos(stepped);
      dirY = Math.sin(stepped);
    }

    if (dirX !== 0 || dirY !== 0) {
      enemy.facing.x = dirX;
      enemy.facing.y = dirY;
      const moved = moveEntity(state, enemy, dirX * speed * dt, dirY * speed * dt);
      if (moved.blockCell && crushesWalls(enemy)) {
        breakSolid(state, moved.blockCell.x, moved.blockCell.y, events);
      }
      // NAO existe mais um segundo empurrao no eixo livre quando o outro trava.
      //
      // Ele existia para "ajudar o inimigo a nao grudar na parede", e era
      // desnecessario: `moveEntity` ja resolve os eixos em separado, entao o eixo
      // livre SEMPRE anda inteiro e o deslizamento ja acontecia sozinho. O que o
      // empurrao extra fazia era somar 60% por cima do que ja tinha andado.
      //
      // Medido: um spitter colado numa parede, perseguindo em diagonal, andava a
      // 114% da propria velocidade. Raspar parede era mais rapido que correr em
      // campo aberto — o mesmo tipo de erro que o jogador reportou no movimento
      // dele, do outro lado da tela.
    }

    if (enemy.elite) {
      const i = cellUnder(state, enemy);
      if (state.surface[i] === SURF_FUNGAL) igniteCell(state, i, events);
    }
  }

  const guardian = state.enemies.find((e) => e.archetype === 'guardian');
  if (!guardian || !guardian.alive) return;
  const enraged = guardian.hp < guardian.maxHp * 0.5;

  if (enraged && !state.guardianSummoned) {
    state.guardianSummoned = true;
    // Em anel, e nao dois dos lados: saindo todos da mesma linha, o jogador
    // resolvia os quatro com um recuo so.
    const around = [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ];
    for (let k = 0; k < GUARDIAN_SUMMON_COUNT; k++) {
      const [dx, dy] = around[k % around.length];
      spawnEnemy(state, 'stalker', Math.floor(guardian.x) + dx, Math.floor(guardian.y) + dy, false);
    }
  }

  // O cerco espera o jogador estar DENTRO do raio.
  //
  // Fechado em volta do guardiao com o jogador longe, o efeito seria o oposto do
  // pretendido: trancaria o chefe e libertaria quem devia estar preso. Por isso
  // e uma tentativa por tick enquanto ele estiver enfurecido, e nao um evento
  // unico no instante em que a vida cruza a metade.
  if (enraged && !state.arenaClosed) {
    const near = state.players.find(
      (p) =>
        p.alive &&
        !state.playerExtras[p.slot ?? 0].downed &&
        Math.max(Math.abs(p.x - guardian.x), Math.abs(p.y - guardian.y)) < GUARDIAN_ARENA_RADIUS - 1
    );
    if (near) {
      const placed = closeArena(
        state,
        Math.floor(guardian.x),
        Math.floor(guardian.y),
        GUARDIAN_ARENA_RADIUS,
        GUARDIAN_ARENA_EXITS,
        events
      );
      if (placed > 0) state.arenaClosed = true;
    }
  }
};

export const applyExplosionDamage = (
  state: SurvivalState,
  ex: number,
  ey: number,
  radius: number,
  events: SemanticEvent[],
  playerDamageScale = 1,
  /**
   * De quem foi a explosao.
   *
   * E a informacao mais valiosa de toda a tabela de causas: morrer da propria
   * detonacao num corredor fechado e a morte de DECISAO que o design quer que
   * aconteca, e sem este campo ela chegaria ao jogador indistinguivel de um
   * bomber que ele nunca viu.
   */
  source: EffectOrigin['source'] = 'environment'
): void => {
  const joined = state.players.filter((p) => state.playerExtras[p.slot ?? 0].joined);
  for (const ent of [...joined, ...state.enemies]) {
    if (!ent.alive) continue;
    const d = Math.hypot(ent.x - ex, ent.y - ey);
    if (d <= radius + ent.radius) {
      const scale = ent.kind === 'player' ? playerDamageScale : 1;
      damageEntity(
        state,
        ent,
        EXPLOSION_DAMAGE * Math.max(0.35, 1 - d / (radius + 0.001)) * scale,
        events,
        { kind: 'explosion', source }
      );
    }
  }
};
