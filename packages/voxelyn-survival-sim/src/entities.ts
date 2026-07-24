import {
  BIOFLUID_SLOW,
  EXPLOSION_DAMAGE,
  GAS_LIFE_TICKS,
  SOLID_NONE,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_GAS,
  SURF_NONE,
  TICK_HZ,
} from './constants';
import { breakSolid, explodeAt, igniteCell, setSurface } from './cells';
import type { Entity, EnemyArchetype, SemanticEvent, SurvivalState } from './types';

export type ArchetypeDef = {
  hp: number;
  speed: number; // tiles/s
  radius: number;
  contactDamage: number;
  contactCooldown: number; // ticks
  aggroRange: number;
};

export const ARCHETYPES: Record<EnemyArchetype, ArchetypeDef> = {
  stalker: { hp: 26, speed: 5.2, radius: 0.32, contactDamage: 8, contactCooldown: 10, aggroRange: 9 },
  bruiser: { hp: 95, speed: 2.3, radius: 0.46, contactDamage: 18, contactCooldown: 16, aggroRange: 7 },
  spitter: { hp: 30, speed: 2.8, radius: 0.34, contactDamage: 6, contactCooldown: 14, aggroRange: 9 },
  bomber: { hp: 18, speed: 3.7, radius: 0.3, contactDamage: 4, contactCooldown: 10, aggroRange: 9 },
  guardian: { hp: 420, speed: 2.1, radius: 0.68, contactDamage: 24, contactCooldown: 14, aggroRange: 7 },
};

export const isSolidAt = (state: SurvivalState, x: number, y: number): boolean => {
  const w = state.config.width;
  const h = state.config.height;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return true;
  return state.solid[cy * w + cx] !== SOLID_NONE;
};

const circleBlocked = (state: SurvivalState, x: number, y: number, r: number): boolean =>
  isSolidAt(state, x - r, y - r) ||
  isSolidAt(state, x + r, y - r) ||
  isSolidAt(state, x - r, y + r) ||
  isSolidAt(state, x + r, y + r);

/** Movimento com colisao circulo-vs-grid, separado por eixo. Retorna celula que bloqueou (se houver). */
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
    if (!circleBlocked(state, nx, ent.y, ent.radius)) {
      ent.x = nx;
    } else {
      blockedX = true;
      blockCell = { x: Math.floor(nx + Math.sign(dx) * ent.radius), y: Math.floor(ent.y) };
    }
  }
  if (dy !== 0) {
    const ny = ent.y + dy;
    if (!circleBlocked(state, ent.x, ny, ent.radius)) {
      ent.y = ny;
    } else {
      blockedY = true;
      blockCell = { x: Math.floor(ent.x), y: Math.floor(ny + Math.sign(dy) * ent.radius) };
    }
  }
  return { blockedX, blockedY, blockCell };
};

export const cellUnder = (state: SurvivalState, ent: Entity): number => {
  const w = state.config.width;
  return Math.floor(ent.y) * w + Math.floor(ent.x);
};

/** Multiplicador de velocidade pelo material sob a entidade. */
export const surfaceSpeedMul = (state: SurvivalState, ent: Entity): number => {
  const surf = state.surface[cellUnder(state, ent)];
  return surf === SURF_BIOFLUID ? BIOFLUID_SLOW : 1;
};

export const damageEntity = (
  state: SurvivalState,
  ent: Entity,
  amount: number,
  events: SemanticEvent[]
): void => {
  if (!ent.alive) return;
  if (ent.kind === 'player') {
    const extra = state.playerExtras[ent.slot ?? 0];
    if (extra.iframesUntil > state.tick) return;
    // abatido nao recebe mais dano de vida (sangra por tempo); ignora acertos
    if (extra.downed) return;
    ent.hp = Math.max(0, ent.hp - amount);
    events.push({ t: 'hit', x: ent.x, y: ent.y, amount, target: ent.id });
    // morte/abatimento do player e resolvido em run.ts (resolveDownedAndDeaths)
    return;
  }
  ent.hp -= amount;
  events.push({ t: 'hit', x: ent.x, y: ent.y, amount, target: ent.id });
  if (ent.hp <= 0) {
    ent.hp = 0;
    ent.alive = false;
    events.push({ t: 'death', x: ent.x, y: ent.y, entity: ent.id, archetype: ent.archetype });
    if (ent.archetype === 'bomber') {
      // bomber morto sempre detona: explosao + nuvem de esporos
      explodeAt(state, ent.x, ent.y, 1.8, events);
      const w = state.config.width;
      const cx = Math.floor(ent.x);
      const cy = Math.floor(ent.y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = (cy + dy) * w + (cx + dx);
          if (i >= 0 && i < state.surface.length && state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
            setSurface(state, i, SURF_GAS, GAS_LIFE_TICKS);
          }
        }
      }
    }
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
    facing: { x: 1, y: 0 },
  };
  state.enemies.push(enemy);
  return enemy;
};

const distTo = (a: Entity, b: Entity): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Player de pe (vivo, nao abatido) mais proximo de (x,y). */
const nearestTarget = (state: SurvivalState, x: number, y: number): Entity | null => {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const p of state.players) {
    if (!p.alive || state.playerExtras[p.slot ?? 0].downed) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
};

export const updateEnemies = (state: SurvivalState, events: SemanticEvent[]): void => {
  const dt = 1 / TICK_HZ;

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    if (enemy.stunnedUntil > state.tick) continue;
    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    const player = nearestTarget(state, enemy.x, enemy.y);
    const dist = player ? distTo(enemy, player) : Infinity;
    const aggro = player !== null && dist <= def.aggroRange + (enemy.elite ? 3 : 0);

    // guardiao dorme ate o nucleo ser tomado ou o jogador chegar perto
    if (enemy.archetype === 'guardian' && !state.guardianAwake) {
      if (state.coreTaken || dist < 7) {
        state.guardianAwake = true;
        events.push({ t: 'guardian_awake' });
      } else {
        continue;
      }
    }

    let dirX = 0;
    let dirY = 0;
    let speed = def.speed * (enemy.elite ? 1.12 : 1) * surfaceSpeedMul(state, enemy);

    if (aggro && player) {
      dirX = player.x - enemy.x;
      dirY = player.y - enemy.y;
      const len = Math.hypot(dirX, dirY) || 1;
      dirX /= len;
      dirY /= len;

      if (enemy.archetype === 'spitter' && dist < 5) {
        // manter distancia
        dirX = -dirX;
        dirY = -dirY;
      }
      if (enemy.archetype === 'stalker') {
        // flanquear: componente perpendicular deterministica pelo id
        const side = enemy.id % 2 === 0 ? 1 : -1;
        dirX += -dirY * 0.45 * side;
        dirY += dirX * 0.45 * side;
        const l2 = Math.hypot(dirX, dirY) || 1;
        dirX /= l2;
        dirY /= l2;
        // stalker evita fogo a frente
        const aheadX = enemy.x + dirX * 0.8;
        const aheadY = enemy.y + dirY * 0.8;
        const w = state.config.width;
        const ai = Math.floor(aheadY) * w + Math.floor(aheadX);
        if (ai >= 0 && ai < state.surface.length && state.surface[ai] === SURF_FIRE) {
          const tmp = dirX;
          dirX = -dirY;
          dirY = tmp;
        }
      }
      if (enemy.archetype === 'guardian') {
        // ciclo: investida a cada ~5s
        if (state.tick >= enemy.nextActionAt) {
          enemy.nextActionAt = state.tick + 100;
          enemy.vx = dirX * 7;
          enemy.vy = dirY * 7;
        }
      }
      if (enemy.archetype === 'bomber' && dist < 1.7) {
        // detonacao por proximidade
        damageEntity(state, enemy, enemy.hp, events);
        continue;
      }
    } else {
      // vagar deterministicamente
      if (state.tick >= enemy.nextActionAt) {
        enemy.nextActionAt = state.tick + 40 + state.rng.nextInt(60);
        const angle = state.rng.nextFloat01() * Math.PI * 2;
        enemy.vx = Math.cos(angle) * def.speed * 0.35;
        enemy.vy = Math.sin(angle) * def.speed * 0.35;
      }
      dirX = 0;
      dirY = 0;
    }

    // impulso de investida do guardiao decai
    if (Math.hypot(enemy.vx, enemy.vy) > 0.05) {
      const moved = moveEntity(state, enemy, enemy.vx * dt, enemy.vy * dt);
      if (moved.blockCell && (enemy.archetype === 'bruiser' || enemy.archetype === 'guardian')) {
        breakSolid(state, moved.blockCell.x, moved.blockCell.y, events);
      }
      enemy.vx *= enemy.archetype === 'guardian' ? 0.92 : 0.82;
      enemy.vy *= enemy.archetype === 'guardian' ? 0.92 : 0.82;
    }

    if (dirX !== 0 || dirY !== 0) {
      enemy.facing.x = dirX;
      enemy.facing.y = dirY;
      const moved = moveEntity(state, enemy, dirX * speed * dt, dirY * speed * dt);
      if (moved.blockCell && (enemy.archetype === 'bruiser' || enemy.archetype === 'guardian')) {
        breakSolid(state, moved.blockCell.x, moved.blockCell.y, events);
      } else if ((moved.blockedX || moved.blockedY) && aggro) {
        // deslizar ao longo da parede
        const slideX = moved.blockedX ? 0 : dirX;
        const slideY = moved.blockedY ? 0 : dirY;
        moveEntity(state, enemy, slideX * speed * dt * 0.6, slideY * speed * dt * 0.6);
      }
    }

    // elite com aura de ignicao: incendeia vegetacao sob si
    if (enemy.elite) {
      const i = cellUnder(state, enemy);
      if (state.surface[i] === SURF_FUNGAL) igniteCell(state, i, events);
    }

    // cuspir (spitter e guardiao)
    if (aggro && player && (enemy.archetype === 'spitter' || enemy.archetype === 'guardian')) {
      const cooldown = enemy.archetype === 'guardian' ? 44 : 56;
      if (state.tick >= enemy.rangedReadyAt) {
        enemy.rangedReadyAt = state.tick + cooldown;
        const len = dist || 1;
        const sx = (player.x - enemy.x) / len;
        const sy = (player.y - enemy.y) / len;
        state.projectiles.push({
          id: state.nextEntityId++,
          owner: enemy.id,
          x: enemy.x,
          y: enemy.y,
          vx: sx * 7,
          vy: sy * 7,
          damage: enemy.archetype === 'guardian' ? 14 : 9,
          piercing: false,
          conductive: false,
          explosive: false,
          hostile: true,
          leavesBiofluid: true,
          ttl: Math.ceil((def.aggroRange + 4) / 7 * TICK_HZ),
        });
        events.push({ t: 'shot', x: enemy.x, y: enemy.y, dx: sx, dy: sy });
      }
    }

    // dano de contato ao player de pe mais proximo
    if (player && distTo(enemy, player) < enemy.radius + player.radius + 0.12 && state.tick >= enemy.contactReadyAt) {
      damageEntity(state, player, def.contactDamage * (enemy.elite ? 1.4 : 1), events);
      enemy.contactReadyAt = state.tick + def.contactCooldown;
    }
  }

  // guardiao invoca stalkers a 50% (uma vez)
  const guardian = state.enemies.find((e) => e.archetype === 'guardian');
  if (
    guardian &&
    guardian.alive &&
    guardian.hp < guardian.maxHp * 0.5 &&
    !state.enemies.some((e) => e.archetype === 'stalker' && e.id > guardian.id)
  ) {
    spawnEnemy(state, 'stalker', Math.floor(guardian.x) - 2, Math.floor(guardian.y), false);
    spawnEnemy(state, 'stalker', Math.floor(guardian.x) + 2, Math.floor(guardian.y), false);
  }
};

export const applyExplosionDamage = (
  state: SurvivalState,
  ex: number,
  ey: number,
  radius: number,
  events: SemanticEvent[]
): void => {
  const all = [...state.players, ...state.enemies];
  for (const ent of all) {
    if (!ent.alive) continue;
    const d = Math.hypot(ent.x - ex, ent.y - ey);
    if (d <= radius + ent.radius) {
      const falloff = Math.max(0.35, 1 - d / (radius + 0.001));
      damageEntity(state, ent, EXPLOSION_DAMAGE * falloff, events);
    }
  }
};
