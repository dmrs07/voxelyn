// Traduz o SurvivalState (arrays tipados, ids numericos, campos pensados para
// hash/wire) numa vista que um agente de LLM consegue ler e decidir em cima:
// nomes em vez de ids, distancias em vez de so coordenadas, e uma janela local
// do terreno em vez do grid inteiro (96x96 por setor — dois arrays inteiros a
// cada chamada seria a maior parte do payload sem ajudar a decisao tatica).
import {
  SOLID_CRYSTAL,
  SOLID_CRYSTAL_DULL,
  SOLID_FRAGILE,
  SOLID_FRAGILE_WEAK,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ORE_CHIPPED,
  SOLID_ORE_SPENT,
  SOLID_ROCK,
  SURF_BIOFLUID,
  SURF_EMBER,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_GLASS,
  SURF_ICE,
  SURF_NONE,
  SURF_RAIL,
  SURF_RAIL_V,
  SURF_SCORCHED,
  SURF_SILT,
  SURF_SPORES,
  SURF_WATER,
  type SurvivalState,
} from '@voxelyn/survival-sim';

const SOLID_NAMES: Record<number, string> = {
  [SOLID_NONE]: 'none',
  [SOLID_ROCK]: 'rock',
  [SOLID_FRAGILE]: 'fragile',
  [SOLID_ORE]: 'ore',
  [SOLID_CRYSTAL]: 'crystal',
  [SOLID_FRAGILE_WEAK]: 'fragile_weak',
  [SOLID_ORE_SPENT]: 'ore_spent',
  [SOLID_CRYSTAL_DULL]: 'crystal_dull',
  [SOLID_ORE_CHIPPED]: 'ore_chipped',
};

const SURFACE_NAMES: Record<number, string> = {
  [SURF_NONE]: 'none',
  [SURF_FUNGAL]: 'fungal',
  [SURF_BIOFLUID]: 'biofluid',
  [SURF_GAS]: 'gas',
  [SURF_FIRE]: 'fire',
  [SURF_SCORCHED]: 'scorched',
  [SURF_SPORES]: 'spores',
  [SURF_FUNGAL_HEATED]: 'fungal_heated',
  [SURF_WATER]: 'water',
  [SURF_EMBER]: 'ember',
  [SURF_ICE]: 'ice',
  [SURF_RAIL]: 'rail',
  [SURF_RAIL_V]: 'rail_v',
  [SURF_SILT]: 'silt',
  [SURF_GLASS]: 'glass',
};

const solidName = (id: number): string => SOLID_NAMES[id] ?? `unknown_${id}`;
const surfaceName = (id: number): string => SURFACE_NAMES[id] ?? `unknown_${id}`;

/** Raio padrao (em tiles) da janela de terreno em volta do jogador. */
export const DEFAULT_WINDOW_RADIUS = 12;
/** Teto do raio: uma janela maior que isso vira o grid inteiro por outro nome. */
export const MAX_WINDOW_RADIUS = 24;
/** Quantas entidades por lista (inimigos/projeteis) entram no snapshot, das mais proximas. */
const MAX_LISTED = 24;

const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(ax - bx, ay - by);

export type TerrainWindow = {
  /** Canto superior-esquerdo da janela, em coordenadas do mundo. */
  originX: number;
  originY: number;
  width: number;
  height: number;
  /** `rows[y][x]`, nomes de material — nao ids, para nao exigir uma segunda tabela. */
  solid: string[][];
  surface: string[][];
};

export type NearbyEnemy = {
  id: number;
  archetype: string;
  elite: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  distance: number;
  hp: number;
  maxHp: number;
  stunned: boolean;
  alerted: boolean;
};

export type NearbyProjectile = {
  id: number;
  kind: string;
  owner: number;
  hostile: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
};

export type AgentSnapshot = {
  tick: number;
  phase: SurvivalState['phase'];
  sector: number;
  sectorCount: number;
  stratum: string;
  occupation: string;
  contamination: number;
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    downed: boolean;
    aim: { x: number; y: number };
    facing: { x: number; y: number };
    heat: number;
    overheated: boolean;
    ability: string;
    abilityReady: boolean;
    dodgeReady: boolean;
    purgeCells: number;
    hasCore: boolean;
    activeModules: string[];
  };
  /** Presente so quando ha uma escolha de modulo pendente — `choose: 0 | 1` a resolve. */
  pendingModuleChoice: { options: [string, string] } | null;
  /** Ofertas de habilidade do poco, quando reveladas neste setor. */
  wellOffers: Array<{ ability: string; x: number; y: number; distance: number }>;
  corePos: { x: number; y: number; distance: number; taken: boolean };
  enemies: { shown: NearbyEnemy[]; totalAlive: number };
  projectiles: { shown: NearbyProjectile[]; total: number };
  terrain: TerrainWindow;
  statsSoFar: {
    shotsFired: number;
    kills: number;
    damageTakenTenths: number;
    damageDealtTenths: number;
    discoveries: number;
  };
};

export const buildAgentSnapshot = (
  state: SurvivalState,
  windowRadius: number = DEFAULT_WINDOW_RADIUS,
): AgentSnapshot => {
  const radius = Math.max(1, Math.min(MAX_WINDOW_RADIUS, Math.floor(windowRadius)));
  const player = state.player;
  const extra = state.playerExtra;
  const w = state.config.width;
  const h = state.config.height;

  const originX = Math.max(0, Math.min(w - 1, Math.floor(player.x) - radius));
  const originY = Math.max(0, Math.min(h - 1, Math.floor(player.y) - radius));
  const endX = Math.min(w, Math.floor(player.x) + radius + 1);
  const endY = Math.min(h, Math.floor(player.y) + radius + 1);
  const solidRows: string[][] = [];
  const surfaceRows: string[][] = [];
  for (let y = originY; y < endY; y++) {
    const solidRow: string[] = [];
    const surfaceRow: string[] = [];
    for (let x = originX; x < endX; x++) {
      const i = y * w + x;
      solidRow.push(solidName(state.solid[i]));
      surfaceRow.push(surfaceName(state.surface[i]));
    }
    solidRows.push(solidRow);
    surfaceRows.push(surfaceRow);
  }

  const aliveEnemies = state.enemies.filter((e) => e.alive);
  const sortedEnemies = [...aliveEnemies].sort(
    (a, b) => dist(a.x, a.y, player.x, player.y) - dist(b.x, b.y, player.x, player.y),
  );
  const enemies: NearbyEnemy[] = sortedEnemies.slice(0, MAX_LISTED).map((e) => ({
    id: e.id,
    archetype: e.archetype,
    elite: e.elite,
    x: e.x,
    y: e.y,
    dx: e.x - player.x,
    dy: e.y - player.y,
    distance: dist(e.x, e.y, player.x, player.y),
    hp: e.hp,
    maxHp: e.maxHp,
    stunned: e.stunnedUntil > state.tick,
    alerted: e.alertedUntil > state.tick,
  }));

  const sortedProjectiles = [...state.projectiles].sort(
    (a, b) => dist(a.x, a.y, player.x, player.y) - dist(b.x, b.y, player.x, player.y),
  );
  const projectiles: NearbyProjectile[] = sortedProjectiles.slice(0, MAX_LISTED).map((p) => ({
    id: p.id,
    kind: p.kind,
    owner: p.owner,
    hostile: p.hostile,
    x: p.x,
    y: p.y,
    vx: p.vx,
    vy: p.vy,
    damage: p.damage,
  }));

  return {
    tick: state.tick,
    phase: state.phase,
    sector: state.sector,
    sectorCount: state.config.depth.sectorCount,
    stratum: state.stratum,
    occupation: state.occupation,
    contamination: state.contamination,
    player: {
      x: player.x,
      y: player.y,
      hp: player.hp,
      maxHp: player.maxHp,
      alive: player.alive,
      downed: extra.downed,
      aim: { x: extra.aim.x, y: extra.aim.y },
      facing: { x: player.facing.x, y: player.facing.y },
      heat: extra.heat,
      overheated: extra.overheatedUntil > state.tick,
      ability: extra.ability,
      abilityReady: state.tick >= extra.abilityCooldownUntil,
      dodgeReady: state.tick >= extra.dodgeCooldownUntil,
      purgeCells: extra.purgeCells,
      hasCore: extra.hasCore,
      activeModules: extra.activeModules.map((m) => m.id),
    },
    pendingModuleChoice: extra.pendingModuleChoice
      ? { options: extra.pendingModuleChoice.options }
      : null,
    wellOffers: state.wellOffers.map((offer) => ({
      ability: offer.ability,
      x: offer.x,
      y: offer.y,
      distance: dist(offer.x, offer.y, player.x, player.y),
    })),
    corePos: {
      x: state.corePos.x,
      y: state.corePos.y,
      distance: dist(state.corePos.x, state.corePos.y, player.x, player.y),
      taken: (state.coresTakenMask & (1 << state.sector)) !== 0,
    },
    enemies: { shown: enemies, totalAlive: aliveEnemies.length },
    projectiles: { shown: projectiles, total: state.projectiles.length },
    terrain: {
      originX,
      originY,
      width: endX - originX,
      height: endY - originY,
      solid: solidRows,
      surface: surfaceRows,
    },
    statsSoFar: {
      shotsFired: state.stats.shotsFired,
      kills: Object.values(state.stats.kills).reduce((a, b) => a + b, 0),
      damageTakenTenths: state.stats.damageTakenTenths,
      damageDealtTenths: state.stats.damageDealtTenths,
      discoveries: state.stats.discoveries,
    },
  };
};
