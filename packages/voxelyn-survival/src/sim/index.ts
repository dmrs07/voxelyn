// API publica da simulacao headless do Voxelyn Survival.
// Proibido: DOM, Canvas, requestAnimationFrame, performance.now, WebSocket, audio.
export * from './constants';
export * from './types';
export {
  createRun,
  stepRun,
  createSnapshot,
  hashAuthoritativeState,
  emptyCommand,
  resolveChainedEvents,
} from './run';
export { generateWorld, floodOpen, chunkOf, cellIdx } from './worldgen';
export { ARCHETYPES, spawnEnemy, moveEntity, damageEntity, isSolidAt } from './entities';
export { explodeAt, dischargeAt, igniteCell, breakSolid, setSurface, stepCells } from './cells';
