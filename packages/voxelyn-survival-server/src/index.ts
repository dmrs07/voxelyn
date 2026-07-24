// Servidor autoritativo de co-op do Voxelyn Survival.
// O core (SurvivalServer/GameRoom) e transport-agnostic e testavel em Node;
// o adaptador ws (createWsServer) apenas transporta bytes.
export { SurvivalServer, type Outbound, type ServerOptions } from './server.js';
export { GameRoom, hashStaticWorld, type Slot } from './room.js';
export { createWsServer, type WsServerHandle } from './ws.js';
export { TICK_MS } from '@voxelyn/survival-sim';
