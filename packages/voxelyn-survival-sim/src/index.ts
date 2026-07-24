// API publica da simulacao headless do Voxelyn Survival.
// Proibido: DOM, Canvas, requestAnimationFrame, performance.now, WebSocket, audio.
export * from './constants.js';
export * from './types.js';
export {
  createRun,
  stepRun,
  createSnapshot,
  hashAuthoritativeState,
  emptyCommand,
  resolveChainedEvents,
} from './run.js';
export { generateWorld, floodOpen, chunkOf, cellIdx } from './worldgen.js';
export { ARCHETYPES, spawnEnemy, moveEntity, damageEntity, isSolidAt } from './entities.js';
export { explodeAt, dischargeAt, igniteCell, breakSolid, setSurface, stepCells } from './cells.js';
