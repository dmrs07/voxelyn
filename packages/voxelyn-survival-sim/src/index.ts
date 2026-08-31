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
  depthIntensity,
  horseChanceFor,
  LINEAGE_IDS,
  lineageOf,
  normalizedDepth,
  sectorBiome,
  sectorTitle,
  type LineageId,
  type OccupationId,
  type SectorBiome,
  type StratumId,
} from './strata.js';
export { ascend, descend, populateSector, sectorSeed } from './sectors.js';
export {
  clearCoreTaken,
  coreUnlocked,
  coresAvailable,
  countCoresTaken,
  deepestCoreSector,
  descentUnlocked,
  hasCoreHere,
  hasCoreInSector,
  isCoreTaken,
  isFinalSector,
  isRunFinalSector,
  markCoreTaken,
  markSectorBossDown,
  resolveSectorBoss,
  runDepth,
  runIsReturning,
  runSectorCount,
  sectorBossDefeated,
  sectorHasBoss,
  sectorIsSealed,
} from './depth.js';
export {
  BOSS_ARCHETYPES,
  BOSS_OF_OCCUPATION,
  BOSS_OF_STRATUM,
  IMPLEMENTED_BOSS,
  bossArchetypeForBiome,
  bossForBiome,
  bossForSector,
  emptyBossRuntime,
  isBossArchetype,
  sectorHoldsBoss,
  type BossBiome,
  type BossId,
  type SectorBossDefinition,
  type SectorBossSource,
} from './bosses.js';
export {
  TARGET_SECTOR_TICKS,
  targetExtractionTicks,
  addDamageTenths,
  buildSummary,
  emptyStats,
  markDiscovery,
  recordKill,
  starsFor,
  type StarInput,
  compareRunScore,
  runClass,
  runScore,
  type RunScore,
} from './stats.js';
export {
  ARCHETYPES,
  SIGNATURE_OF_STRATUM,
  spawnEnemy,
  moveEntity,
  damageEntity,
  isSolidAt,
  // A geometria da varredura do Coracao da Fornalha. Exportada porque o AVISO
  // dela e desenhado no cliente a partir do mesmo tick, e nao transmitido: uma
  // cunha derivada nao entra no snapshot, nao entra no hash e nao pode
  // dessincronizar.
  furnaceOverheatingAt,
  furnaceSweepAt,
  type FurnaceSweep,
} from './entities.js';
// O CAMPO DA BOCA do Devorador. Exportado pelo mesmo motivo que o Diluvio e a
// varredura da Fornalha: o vortice e DERIVADO e nao transmitido — o cliente
// refaz a mesma conta da simulacao, a partir do unico tick que viaja
// (`bossRuntime.mawOpenedAt`), e chega no mesmo alcance e na mesma forca.
export { mawIntensity, mawPull, mawReach } from './maw.js';
export { hasLineOfSight } from './pathing.js';
export {
  explodeAt,
  dischargeAt,
  igniteCell,
  isConductiveSurface,
  // O DILUVIO. Exportados porque a lamina e DERIVADA e nao transmitida: o
  // cliente refaz a mesma geometria da simulacao e chega na mesma resposta,
  // celula a celula, sem receber nenhuma.
  isConductiveCell,
  isDeluged,
  delugeFront,
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
  activeWeaponModule,
  isWeaponModule,
} from './modules.js';
export {
  emptyMinigunState,
  minigunDrainAccumulator,
  minigunJitter,
  minigunNextSpin,
  minigunPhaseFor,
  minigunPrimedAccumulator,
  minigunRateMilli,
  minigunSpread,
  resetMinigun,
  rotateUnit,
} from './minigun.js';
export {
  BASE_PURGE_CELLS,
  DEFAULT_PLAYER_TUNING,
  DEFAULT_RUN_DEPTH,
  GENERATION_THRESHOLDS,
  SECTORS_BY_GENERATION,
  TIER_CORE_COST,
  TIER_ORE_COST,
  TOTAL_UPGRADES,
  TUNING_HASH_ORDER,
  UPGRADES,
  UPGRADE_BRANCHES,
  coreSectorsForGeneration,
  deriveGeneration,
  derivePlayerTuning,
  findUpgrade,
  generationsReached,
  hashPlayerTuning,
  isProspectorGeneration,
  isValidRunDepth,
  isValidUpgradeSet,
  normalizeGeneration,
  normalizeRunDepth,
  normalizeUpgradeIds,
  runDepthForGeneration,
  sectorCountForGeneration,
  upgradesOfBranch,
  type LoreFragmentId,
  type PlayerTuning,
  type ProspectorGeneration,
  type RunDepthConfig,
  type UpgradeBranch,
  type UpgradeDefinition,
  type UpgradeId,
} from './progression.js';
