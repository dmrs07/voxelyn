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
export {
  descend,
  isFinalSector,
  populateSector,
  sectorSeed,
} from './sectors.js';
export {
  TARGET_EXTRACTION_TICKS,
  TARGET_SECTOR_TICKS,
  addDamageTenths,
  buildSummary,
  emptyStats,
  markDiscovery,
  recordKill,
  starsFor,
} from './stats.js';
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
export { explosiveArmedByDistance, impactSolid, impactSurface, projectileClass, type ProjectileClass, type SolidImpact } from './materials.js';

export {
  ABILITY_DEFINITIONS,
  ABILITY_SHAPE,
  STARTING_ABILITY,
  abilityDefinition,
  emptyResonance,
  recordResonance,
  resonanceOffers,
  type AbilityDefinition,
} from './abilities.js';
export { MODULE_DEFINITIONS, moduleDefinition, activeModule, moduleHasCapacity, grantOrRechargeModule, consumeModuleCharge, expireTimedModules, rollModuleChoice } from './modules.js';
