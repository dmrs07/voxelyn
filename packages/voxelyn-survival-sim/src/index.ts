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
export {
  generateWorld,
  floodOpen,
  chunkOf,
  cellIdx,
  DEFAULT_PROFILE,
  type WorldgenProfile,
  type SurfaceBlobSpec,
} from './worldgen.js';
export {
  biomeMix,
  biomeProfile,
  horseChanceFor,
  lineageOf,
  sectorBiome,
  type LineageId,
  type OccupationId,
  type SectorBiome,
  type StratumId,
} from './strata.js';
export { descend, isFinalSector, populateSector, sectorSeed } from './sectors.js';
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
export {
  ARCHETYPES,
  SIGNATURE_OF_STRATUM,
  spawnEnemy,
  moveEntity,
  damageEntity,
  isSolidAt,
} from './entities.js';
export { hasLineOfSight } from './pathing.js';
export {
  explodeAt,
  dischargeAt,
  igniteCell,
  isConductiveSurface,
  meltIce,
  heatFungalCell,
  breakSolid,
  setSurface,
  stepCells,
  floodFrom,
  chargeCells,
} from './cells.js';
export {
  explosiveArmedByDistance,
  impactSolid,
  impactSurface,
  projectileClass,
  type ProjectileClass,
  type SolidImpact,
} from './materials.js';

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
export {
  MODULE_DEFINITIONS,
  moduleDefinition,
  activeModule,
  moduleHasCapacity,
  liveProjectileModules,
  grantOrRechargeModule,
  consumeModuleCharge,
  expireTimedModules,
  rollModuleChoice,
} from './modules.js';
export {
  BASE_PURGE_CELLS,
  DEFAULT_PLAYER_TUNING,
  GENERATION_THRESHOLDS,
  TIER_CORE_COST,
  TIER_ORE_COST,
  TOTAL_UPGRADES,
  TUNING_HASH_ORDER,
  UPGRADES,
  UPGRADE_BRANCHES,
  deriveGeneration,
  derivePlayerTuning,
  findUpgrade,
  generationsReached,
  hashPlayerTuning,
  isValidUpgradeSet,
  normalizeUpgradeIds,
  upgradesOfBranch,
  type LoreFragmentId,
  type PlayerTuning,
  type ProspectorGeneration,
  type UpgradeBranch,
  type UpgradeDefinition,
  type UpgradeId,
} from './progression.js';
