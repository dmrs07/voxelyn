// API publica da simulacao headless do Voxelyn Survival.
// Proibido: DOM, Canvas, requestAnimationFrame, performance.now, WebSocket, audio.
export * from './constants.js';
export * from './types.js';
export {
  resetPlayerProgress,
  createRun,
  stepRun,
  createSnapshot,
  hashAuthoritativeState,
  hashStaticWorld,
  emptyCommand,
  resolveChainedEvents,
  standingPlayers,
  joinedPlayers,
  nearestStandingPlayer,
} from './run.js';
export { generateWorld, floodOpen, chunkOf, cellIdx } from './worldgen.js';
export { ARCHETYPES, spawnEnemy, moveEntity, damageEntity, isSolidAt } from './entities.js';
export {
  explodeAt,
  dischargeAt,
  igniteCell,
  heatFungalCell,
  breakSolid,
  setSurface,
  stepCells,
  floodFrom,
  chargeCells,
} from './cells.js';
export { impactSolid, impactSurface, projectileClass, type ProjectileClass, type SolidImpact } from './materials.js';

export { MODULE_DEFINITIONS, moduleDefinition, activeModule, moduleHasCapacity, grantOrRechargeModule, consumeModuleCharge, expireTimedModules, rollModuleChoice } from './modules.js';
