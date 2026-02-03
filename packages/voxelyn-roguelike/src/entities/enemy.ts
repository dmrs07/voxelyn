import { ENEMY_ARCHETYPE_STATS } from '../game/constants';
import type { EnemyArchetype, EnemyState, Entity } from '../game/types';

export const createEnemy = (
  id: string,
  occ: number,
  archetype: EnemyArchetype,
  x: number,
  y: number,
  floorNumber: number
): EnemyState => {
  const template = ENEMY_ARCHETYPE_STATS[archetype];
  const floorScale = 1 + Math.max(0, floorNumber - 1) * 0.07;

  return {
    id,
    occ,
    kind: 'enemy',
    archetype,
    x,
    y,
    z: 0,
    blocks: true,
    hp: Math.round(template.hp * floorScale),
    maxHp: Math.round(template.hp * floorScale),
    attack: Math.round(template.attack * (1 + Math.max(0, floorNumber - 1) * 0.05)),
    damageReduction: archetype === 'guardian' ? 2 : archetype === 'bruiser' ? 1 : 0,
    alive: true,
    nextMoveAt: 0,
    nextAttackAt: 0,
    moveCooldownMs: template.moveCooldownMs,
    attackCooldownMs: template.attackCooldownMs,
    detectRadius: template.detectRadius,
    preferredMinRange: template.preferredMinRange,
    preferredMaxRange: template.preferredMaxRange,
    patrolOrigin: { x, y },
    patrolTarget: null,
  };
};

export const isEnemy = (entity: Entity): entity is EnemyState => entity.kind === 'enemy';
