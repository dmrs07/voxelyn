import { RNG } from '@voxelyn/core';
import {
  BLEEDOUT_TICKS,
  BOLT_COOLDOWN_TICKS,
  BOLT_DAMAGE,
  BOLT_SPEED,
  BRUISER_ROCK_STUN_TICKS,
  CONDUCTIVE_STUN_TICKS,
  FIRE_FUEL_TICKS,
  FLAMETHROWER_CHANNEL_TICKS,
  FLAMETHROWER_EMISSION_DAMAGE,
  FLAMETHROWER_EMIT_INTERVAL_TICKS,
  FLAMETHROWER_LOS_STEP,
  SEEKER_BLAST_RADIUS,
  SEEKER_SPEED,
  SEEKER_TURN_RATE,
  WELL_OFFER_REACH,
  WELL_OFFER_REVEAL,
  WELL_OFFER_SPREAD,
  PURGE_CELL_HEAL,
  PURGE_CELL_RADIUS,
  contaminationPerTick,
  DISCHARGE_DAMAGE,
  LEYLINE_CHARGE_TICKS,
  LEYLINE_NODE_INTERACT_RADIUS,
  LEYLINE_REFRACTORY_TICKS,
  DELUGE_SHOCK_FULL_RANGE,
  DELUGE_SHOCK_MIN_SCALE,
  DODGE_SPEED,
  DODGE_TICKS,
  EXPLOSION_RADIUS,
  EXPLOSIVE_ARM_DISTANCE,
  EXTRACT_RADIUS,
  FIRE_DAMAGE_PER_TICK,
  GAS_DAMAGE_PER_TICK,
  SPORE_DAMAGE_PER_TICK,
  HEAT_PER_SHOT,
  MINIGUN_BURST_EVENT_TICKS,
  MINIGUN_DAMAGE,
  MINIGUN_HEAT_PER_SHOT,
  MINIGUN_MAX_SHOTS_PER_TICK,
  MINIGUN_PROJECTILE_RADIUS,
  MINIGUN_PROJECTILE_SPEED,
  MINIGUN_PROJECTILE_TTL_SECONDS,
  MAX_PLAYERS,
  MAX_PROJECTILES,
  PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE,
  PLAYER_RADIUS,
  REVIVE_HP_FRACTION,
  REVIVE_RADIUS,
  RETURN_DISC_MAX_DISTANCE,
  RICOCHET_BOUNCES,
  RETURN_DISC_SPEED,
  SALVAGE_SCAN_TICKS,
  CARGO_LOST_DISCOVERY_ORE,
  CONTAMINATION_WAVES,
  CONTAMINATION_SECTOR_SCALE,
  CONTAMINATION_SATURATED_AT,
  CONTAMINATION_SATURATION_PULSE_TICKS,
  CONTAMINATION_SATURATION_BASE_DAMAGE,
  CONTAMINATION_SATURATION_RAMP,
  CONTAMINATION_SATURATION_MAX_DAMAGE,
  CONTAMINATION_SURGE_INTERVAL_TICKS,
  CONTAMINATION_SURGE_COUNT,
  FURNACE_HEART_CYCLONE_TOUCH_TICKS,
  MAX_LINEAGE_SECTORS,
  RUN_SEED_MIX,
  SOLID_NONE,
  SURF_BIOFLUID,
  SURF_EMBER,
  EMBER_HEAT_DECAY_SCALE,
  FREEZE_GRACE_TICKS,
  FREEZE_THERMAL_CYCLE_HEAT,
  FREEZE_THERMAL_CYCLE_TICKS,
  SURF_FIRE,
  SURF_DEEP_WATER,
  ICE_GLIDE_EPSILON,
  ICE_MOMENTUM_CAP,
  isIceSurface,
  SURF_RAIL,
  SURF_RAIL_V,
  CART_SPEED,
  CART_DAMAGE,
  CART_WINDUP_TICKS,
  CART_COOLDOWN_TICKS,
  CART_RADIUS,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_SCORCHED,
  SOLID_CRYSTAL,
  SOLID_CRYSTAL_DULL,
  SURF_GAS,
  SURF_GLASS,
  SURF_SILT,
  SURF_NONE,
  SURF_SPORES,
  TICK_HZ,
  WORLD_H,
  WORLD_W,
} from './constants.js';
import { emptyBossRuntime } from './bosses.js';
import { clearFreeze, frostbiteBreaks, meltFreezeByHeat, stepFreezeDecay } from './frost.js';
import {
  ABILITY_SHAPE,
  STARTING_ABILITY,
  abilityDefinition,
  emptyResonance,
  fallbackOffer,
  recordResonance,
  resonanceOffers,
} from './abilities.js';
import {
  advanceIceCrack,
  chargeCells,
  dischargeAt,
  explodeAt,
  igniteCell,
  isConductiveSurface,
  isIceHole,
  isGlacialStabilised,
  markDirty,
  setSurface,
  stepCells,
} from './cells.js';
import { leviathanCovers } from './leviathan.js';
import {
  explosiveArmedByDistance,
  impactSolid,
  impactSurface,
  openNeighbours,
  leylineSegmentShorted,
  projectileClass,
} from './materials.js';
import {
  applyExplosionDamage,
  cellUnder,
  damageEntity,
  moveEntity,
  isStoneEnemy,
  spawnEnemy,
  stepCollapse,
  stunEntity,
  surfaceSpeedMul,
  updateEnemies,
} from './entities.js';
import { deriveLeylineNetwork, generateWorld } from './worldgen.js';
import { buildSummary, emptyStats, markDiscovery } from './stats.js';
import { ascend, descend, populateSector, sectorSeed } from './sectors.js';
import {
  clearCoreTaken,
  coreUnlocked,
  coresAvailable,
  countCoresTaken,
  descentUnlocked,
  hasCoreHere,
  isCoreTaken,
  isRunFinalSector,
  markCoreTaken,
  runDepth,
  runIsReturning,
  runSectorCount,
} from './depth.js';
import { sectorBiome, sectorProfile } from './strata.js';
import {
  activeModule,
  activeWeaponModule,
  consumeModuleCharge,
  expireTimedModules,
  grantOrRechargeModule,
  moduleHasCapacity,
  rollModuleChoice,
} from './modules.js';
import {
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
import {
  DISCOVERY_CARGO_LOST,
  DISCOVERY_DISCHARGE_POOL,
  DISCOVERY_LEVIATHAN_SHOCKED,
  DISCOVERY_LEYLINE_CIRCUIT,
  DISCOVERY_LEYLINE_ROUTED,
  DISCOVERY_SELF_HARM,
} from './types.js';
import {
  DEFAULT_PLAYER_TUNING,
  TUNING_HASH_ORDER,
  iceGlideFor,
  normalizeRunDepth,
  type PlayerTuning,
} from './progression.js';
import type {
  DamageCause,
  EffectOrigin,
  Entity,
  EnemyArchetype,
  ModuleId,
  PlayerCommand,
  PlayerExtra,
  Projectile,
  ResonanceKind,
  RunConfig,
  SemanticEvent,
  StepResult,
  SurvivalSnapshot,
  SurvivalState,
} from './types.js';

// `aim` NEUTRO e vetor ZERO, nunca um rumo valido. O default antigo `{1, 0}`
// era uma mira fantasma apontando para leste: qualquer tick sem input de mira
// (stick solto, menu aberto, slot sem comando) reenviava esse rumo e esmagava o
// facing persistido do jogador — o famoso "sempre volta para DR". O guard de
// `stepPlayer` ignora mira de comprimento ~0, entao o zero significa o que o
// nome diz: "sem mira nova, preserve a ultima".
export const emptyCommand = (): PlayerCommand => ({
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  fire: false,
  ability: false,
  dodge: false,
  interact: false,
  purge: false,
  choose: null,
});

/**
 * Dano com AUTORIA do Prospector.
 *
 * Aplicado na FONTE — onde o numero nasce —, e nao em `damageEntity`, porque a
 * causa nem sempre chega la: flamethrower e arc entram sem `DamageCause`. Na
 * fonte a lista e curta e auditavel, e nada mais escala junto: explosao
 * ambiental, carrinho, dano de inimigo e reacao sem autoria continuam intactos.
 */
const playerDamage = (tuning: PlayerTuning, base: number): number =>
  base * tuning.playerDamageScale;

/**
 * A penalidade de liquido, ja suavizada pelo tuning do Prospector.
 *
 * Encolhe a PENALIDADE, e nao multiplica a velocidade: `liquidSlowScale` de 0,92
 * significa "o slow dói 8% menos", entao agua continua sendo agua. Multiplicar a
 * velocidade final daria o mesmo bonus em chao seco, onde nao ha nada a
 * compensar — e MV-03 promete travessia, nao corrida.
 *
 * Inimigos continuam usando `surfaceSpeedMul` cru: a arvore e do Prospector.
 */
const playerSurfaceSpeedMul = (
  state: SurvivalState,
  player: Entity,
  tuning: PlayerTuning,
): number => {
  const base = surfaceSpeedMul(state, player);
  if (base >= 1) return base;
  return 1 - (1 - base) * tuning.liquidSlowScale;
};

const makePlayer = (slot: number, x: number, y: number, tuning: PlayerTuning): Entity => ({
  id: slot + 1,
  kind: 'player',
  archetype: 'prospector',
  x,
  y,
  vx: 0,
  vy: 0,
  hp: tuning.maxHp,
  maxHp: tuning.maxHp,
  radius: PLAYER_RADIUS,
  alive: true,
  elite: false,
  nextActionAt: 0,
  contactReadyAt: 0,
  rangedReadyAt: 0,
  stunnedUntil: 0,
  alertedUntil: 0,
  facing: { x: 1, y: 0 },
  slot,
});

const makeExtra = (tuning: PlayerTuning): PlayerExtra => ({
  aim: { x: 1, y: 0 },
  heat: 0,
  overheatedUntil: 0,
  nextShotAt: 0,
  channelingUntil: 0,
  dodgeUntil: 0,
  iframesUntil: 0,
  dodgeCooldownUntil: 0,
  abilityCooldownUntil: 0,
  purgeCells: tuning.startingPurgeCells,
  activeModules: [],
  pendingModuleChoice: null,
  minigun: emptyMinigunState(),
  hasCore: false,
  carriedCoreMask: 0,
  dodgeDir: { x: 1, y: 0 },
  downed: false,
  bleedoutAt: 0,
  joined: true, // default seguro: solo/local ja esta em jogo
  lastDamage: null,
  ability: STARTING_ABILITY,
  resonance: emptyResonance(),
  freeze: 0,
  frostbitten: false,
  freezeGraceUntil: 0,
  thermalCycleReadyAt: 0,
});

/**
 * Zera o estado PERSISTENTE de um slot (upgrades, inventario, nucleo), sem
 * tocar em posicao/vida — quem chama cuida disso. Usado quando um slot
 * abandonado e reocupado: o novo jogador nao pode herdar os modificadores,
 * os frascos nem a posse do nucleo de quem saiu.
 */
export const resetPlayerProgress = (extra: PlayerExtra, tuning: PlayerTuning): void => {
  extra.activeModules = [];
  extra.pendingModuleChoice = null;
  resetMinigun(extra.minigun);
  extra.purgeCells = tuning.startingPurgeCells;
  extra.hasCore = false;
  extra.carriedCoreMask = 0;
  extra.heat = 0;
  extra.overheatedUntil = 0;
  extra.nextShotAt = 0;
  extra.channelingUntil = 0;
  extra.dodgeUntil = 0;
  extra.iframesUntil = 0;
  extra.dodgeCooldownUntil = 0;
  extra.abilityCooldownUntil = 0;
  extra.aim = { x: 1, y: 0 };
  extra.dodgeDir = { x: 1, y: 0 };
  extra.lastDamage = null;
  extra.ability = STARTING_ABILITY;
  extra.resonance = emptyResonance();
  clearFreeze(extra);
};

export const createRun = (config: RunConfig): SurvivalState => {
  const width = config.width ?? WORLD_W;
  const height = config.height ?? WORLD_H;
  const playerCount = Math.max(1, Math.min(MAX_PLAYERS, config.playerCount ?? 1));
  // A PROFUNDIDADE, congelada aqui e nunca mais reconsultada.
  //
  // `normalizeRunDepth` e o unico caminho: uma configuracao ausente vira a run
  // de tres setores de sempre, e uma configuracao malformada (snapshot de outra
  // versao, ticket adulterado, corpo de requisicao) e saneada em vez de
  // confiada. O que ela nao faz, de proposito, e olhar o perfil — uma run
  // legada nao vira uma run de sete setores porque o perfil hoje esta em G-04.
  const depth = normalizeRunDepth(config.depth);
  const sector = Math.max(1, Math.min(depth.sectorCount, config.sector ?? 1));
  // Congelado UMA vez. A run inteira le deste objeto, e comprar um protocolo no
  // meio de uma expedicao nao muda o Prospector que ja desceu.
  const tuning = config.tuning ?? DEFAULT_PLAYER_TUNING;
  // A seed de CADA setor sai da mesma derivacao. Usar a formula antiga so para
  // o primeiro faria o setor de abertura ser o unico fora do esquema, e a
  // derivacao e o que garante que uma seed compartilhada reproduza a descida
  // inteira, nao so o comeco.
  // O bioma sai de derivacao PURA da seed (strata.ts): reconectar no setor N
  // reconstroi o mesmo estrato e a mesma ocupacao sem consumir a RNG da run.
  const biome = sectorBiome(config.seed, sector);
  // Perfil pela fonte unica (garantia da descida inclusa): ver sectorProfile.
  const profile = sectorProfile(config.seed, sector);
  const world = generateWorld(
    sectorSeed((config.seed ^ RUN_SEED_MIX) >>> 0, sector),
    width,
    height,
    profile,
  );
  const leylineNetwork = deriveLeylineNetwork(world, width);
  const rng = new RNG((config.seed * 0x85ebca6b + 0xc2b2ae35) >>> 0 || 1);

  // posicoes de spawn proximas a entrada (deterministicas, sem sobrepor)
  const offsets = [
    { x: 0.5, y: 0.5 },
    { x: 1.5, y: 0.5 },
  ];
  const players: Entity[] = [];
  const playerExtras: PlayerExtra[] = [];
  for (let s = 0; s < playerCount; s++) {
    players.push(makePlayer(s, world.entry.x + offsets[s].x, world.entry.y + offsets[s].y, tuning));
    playerExtras.push(makeExtra(tuning));
  }

  const state: SurvivalState = {
    config: { seed: config.seed, width, height, playerCount, sector, tuning, depth },
    rng,
    tick: 0,
    phase: 'running',
    sector,
    sectorStartedAt: 0,
    stratum: biome.stratum,
    occupation: biome.occupation,
    lineage: biome.lineage,
    solid: world.solid,
    surface: world.surface,
    surfaceTimer: new Uint16Array(width * height),
    // O campo do Diluvio nasce vazio: ele e DERIVADO e so e construido no
    // primeiro tick em que alguem pergunta se alguma coisa esta submersa.
    delugeField: null,
    delugeFieldBucket: -1,
    chunkVersion: new Uint32Array(Math.ceil(width / 16) * Math.ceil(height / 16)),
    entry: world.entry,
    corePos: world.corePos,
    coresTakenMask: 0,
    sectorBoss: { archetype: null, entityId: null, defeated: false },
    bossRuntime: emptyBossRuntime(),
    bossesDownMask: 0,
    leftEntryZone: false,
    players,
    playerExtras,
    player: players[0],
    playerExtra: playerExtras[0],
    enemies: [],
    projectiles: [],
    wellOffers: [],
    salvageSites: world.salvageSites.map((site) => ({
      ...site,
      terminalState: 'inactive' as const,
      scanEndsAt: 0,
      cacheRevealed: false,
      cacheOpened: false,
      openedBySlot: null,
    })),
    vents: world.ventPositions.map((p) => ({ x: p.x, y: p.y, nextEmitAt: 0 })),
    railTracks: world.railTracks.map((t) => ({
      ...t,
      readyAt: 0,
      firingAt: 0,
      fromEnd: 0 as const,
    })),
    // Geometria da seed, relogios zerados: todo segmento nasce dormente. Ver
    // LeylineSegment para o contrato (relogios no hash, celulas fora).
    leylineSegments: world.leylines.map((seg) => ({
      cells: seg.cells,
      dischargeAt: 0,
      refractoryUntil: 0,
      triggeredBy: -1,
      relayed: false,
    })),
    // Adjacencia e circuito derivados da seed, num lugar so. Ver
    // deriveLeylineNetwork.
    leylineNodes: leylineNetwork.nodes,
    leylineCircuit: {
      sourceNode: leylineNetwork.circuit.sourceNode,
      members: leylineNetwork.circuit.members,
      reached: [],
      live: false,
      closed: false,
    },
    stratumSubverted: false,
    hallCenters: world.hallCenters,
    charges: [],
    contamination: 0,
    contaminationWaves: 0,
    contaminationSaturatedAt: 0,
    contaminationNextPulseAt: 0,
    contaminationNextSurgeAt: 0,
    // reserva todos os ids de player (1..playerCount) antes dos inimigos, para
    // que nenhum inimigo colida com um id de player nos snapshots por id
    nextEntityId: playerCount + 1,
    reactionQueue: [],
    iceHoles: [],
    stats: emptyStats(),
    summary: null,
  };

  // A composicao e o Guardiao dependem do setor; ver sectors.ts. A posicao do
  // Guardiao ja vem reservada pelo worldgen com folga para o corpo grande.
  populateSector(state, world.enemySpawns, world.guardianSpawn);

  return state;
};

/** Slots efetivamente em jogo (reivindicados por um jogador). */
export const joinedPlayers = (state: SurvivalState): Entity[] =>
  state.players.filter((p) => state.playerExtras[p.slot ?? 0].joined);

/** Players de pe (em jogo, vivos e nao abatidos). */
export const standingPlayers = (state: SurvivalState): Entity[] =>
  state.players.filter((p) => {
    const e = state.playerExtras[p.slot ?? 0];
    return e.joined && p.alive && !e.downed;
  });

/** Player de pe mais proximo de (x,y), ou null. */
export const nearestStandingPlayer = (
  state: SurvivalState,
  x: number,
  y: number,
): Entity | null => {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const p of standingPlayers(state)) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
};

const cellIndexAt = (state: SurvivalState, x: number, y: number): number =>
  Math.floor(y) * state.config.width + Math.floor(x);

/**
 * A ARMADILHA DE CARRINHO: pisar num tramo armado dispara o telegrafo; no
 * fim do telegrafo um carrinho desgovernado atravessa o tramo vindo do lado
 * LONGE de quem pisou. O carrinho e um projetil hostil comum (kind 'cart') —
 * anda, colide com parede e entra no hash como qualquer outro — com duas
 * excecoes no laco de projeteis: nao morre ao atropelar (segue ate o fim da
 * linha) e atropela INIMIGO tambem, porque fisica nao escolhe lado.
 */
const stepRailCarts = (state: SurvivalState, events: SemanticEvent[]): void => {
  const w = state.config.width;
  for (const track of state.railTracks) {
    if (track.firingAt > 0) {
      if (state.tick >= track.firingAt) {
        const tail = track.fromEnd === 1;
        const sx = tail ? track.x + track.dx * (track.len - 1) : track.x;
        const sy = tail ? track.y + track.dy * (track.len - 1) : track.y;
        const dir = tail ? -1 : 1;
        state.projectiles.push({
          kind: 'cart',
          id: state.nextEntityId++,
          owner: -1,
          x: sx + 0.5,
          y: sy + 0.5,
          vx: track.dx * dir * CART_SPEED,
          vy: track.dy * dir * CART_SPEED,
          damage: CART_DAMAGE,
          radius: CART_RADIUS,
          hostile: true,
          leavesBiofluid: false,
          distanceTravelled: 0,
          // Ate o fim do tramo + folga; a parede no fim mata antes na pratica.
          ttl: Math.ceil(((track.len + 2) / CART_SPEED) * TICK_HZ),
          hits: [],
        });
        track.firingAt = 0;
        track.readyAt = state.tick + CART_COOLDOWN_TICKS;
      }
      continue;
    }
    if (state.tick < track.readyAt) continue;
    for (const player of standingPlayers(state)) {
      const px = Math.floor(player.x);
      const py = Math.floor(player.y);
      const underfoot = state.surface[py * w + px];
      if (underfoot !== SURF_RAIL && underfoot !== SURF_RAIL_V) continue;
      const on =
        track.dx === 1
          ? py === track.y && px >= track.x && px < track.x + track.len
          : px === track.x && py >= track.y && py < track.y + track.len;
      if (!on) continue;
      const along = track.dx === 1 ? px - track.x : py - track.y;
      // O carrinho vem do lado LONGE: maximo de linha para atravessar — e de
      // tempo de aviso util para quem pisou.
      track.fromEnd = along * 2 < track.len ? 1 : 0;
      track.firingAt = state.tick + CART_WINDUP_TICKS;
      events.push({
        t: 'cart_warning',
        x: track.x,
        y: track.y,
        dx: track.dx,
        dy: track.dy,
        len: track.len,
      });
      break;
    }
  }
};

/**
 * O relogio das leylines: cumpre a descarga que `impactSolid` anunciou.
 *
 * A carga sai pelas celulas ABERTAS coladas no segmento (openNeighbours — o
 * mesmo caminho da descarga de veio) e vira UM evento `discharge`, sem `from`:
 * dano plano, como as descargas de fonte multipla do Arquicantor. Um evento so
 * por ativacao e o que entrega tres requisitos de graca, todos ja em
 * resolveChainedEvents: um hit por entidade, o desconto de fogo amigo para o
 * dono, e +1 ressonancia `current` por ATIVACAO (frequencia, nunca area).
 *
 * Roda antes de resolveChainedEvents para o dano sair no mesmo tick do evento.
 */
const stepLeylines = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (let segIdx = 0; segIdx < state.leylineSegments.length; segIdx++) {
    const seg = state.leylineSegments[segIdx];
    if (seg.dischargeAt === 0 || state.tick < seg.dischargeAt) continue;
    // Capturados ANTES do reset: o rele e a descarga leem os dois, e o bug
    // classico aqui seria zerar primeiro e repassar autoria de ninguem.
    const triggeredBy = seg.triggeredBy;
    const wasRelayed = seg.relayed;
    const origin: EffectOrigin =
      triggeredBy >= 0 ? { source: 'player', owner: triggeredBy } : { source: 'environment' };
    chargeCells(state, openNeighbours(state, seg.cells), events, origin, undefined, wasRelayed);
    // A cascata do circuito registra por onde passou. Ordenado e sem repetir
    // para o hash nao depender da ordem em que os segmentos calharam de
    // descarregar dentro do mesmo tick.
    if (state.leylineCircuit.live && !state.leylineCircuit.reached.includes(segIdx)) {
      state.leylineCircuit.reached.push(segIdx);
      state.leylineCircuit.reached.sort((a, b) => a - b);
    }
    // A descoberta e do RELE EFETIVO: a energia saiu do outro lado de uma
    // juncao que o jogador abriu — nao do toggle, que sozinho nao ensina nada.
    if (wasRelayed) markDiscovery(state.stats, DISCOVERY_LEYLINE_ROUTED);
    seg.dischargeAt = 0;
    seg.refractoryUntil = state.tick + LEYLINE_REFRACTORY_TICKS;
    seg.triggeredBy = -1;
    seg.relayed = false;

    // O RELE: toda juncao ROTEADA que toca este segmento repassa a carga aos
    // vizinhos DORMENTES como ativacao nova — telegrafada (leyline_charge) e
    // refrataria como qualquer outra. A excecao a "a propagacao termina na
    // juncao" e paga por um ato deliberado do jogador na propria juncao.
    //
    // Anti-loop por construcao, nao por contador: este segmento acabou de
    // ganhar 10 s de refrataria (LEYLINE_REFRACTORY_TICKS >> 16 ticks de
    // carga), entao quando a cascata tentar voltar por ele, ele nao esta
    // dormente e o rele nao arma. E o dischargeAt armado aqui e futuro
    // (tick + carga), entao segmentos visitados adiante neste mesmo loop nao
    // disparam neste tick.
    for (const node of state.leylineNodes) {
      if (!node.routed || !node.segments.includes(segIdx)) continue;
      for (const otherIdx of node.segments) {
        if (otherIdx === segIdx) continue;
        const other = state.leylineSegments[otherIdx];
        if (other.dischargeAt !== 0 || state.tick < other.refractoryUntil) continue;
        // O CURTO para a cascata aqui. E o obstaculo do circuito: o trecho
        // com cristal e minerio demais encostados sangra a carga, e so volta
        // a conduzir depois que o jogador limpar a parede.
        if (leylineSegmentShorted(state, other.cells)) {
          events.push({ t: 'leyline_short', seg: otherIdx, cells: other.cells });
          continue;
        }
        other.dischargeAt = state.tick + LEYLINE_CHARGE_TICKS;
        other.triggeredBy = triggeredBy;
        other.relayed = true;
        events.push({
          t: 'leyline_charge',
          seg: otherIdx,
          cells: other.cells,
          dischargeTick: other.dischargeAt,
        });
      }
    }
  }
  settleCircuit(state, events);
};

/**
 * O LANCAMENTO: a nascente arma os segmentos que ela toca e a cascata comeca.
 *
 * Nao cobra nada — nem carga de modulo, nem recurso, nem cooldown proprio. O
 * unico limite e o ciclo que ja existia: segmento carregando ou refratario nao
 * rearma, entao lancar de novo no meio de uma cascata nao a acelera.
 *
 * Relanca com o circuito ja fechado de proposito: a rede continua sendo uma
 * arma depois de resolvida, e travar a nascente puniria quem quer usar a
 * descarga em combate por ter fechado o circuito antes.
 */
const launchCircuit = (state: SurvivalState, player: Entity, events: SemanticEvent[]): void => {
  const circuit = state.leylineCircuit;
  const node = state.leylineNodes[circuit.sourceNode];
  if (!node) return;

  let armed = 0;
  for (const segIdx of node.segments) {
    const seg = state.leylineSegments[segIdx];
    if (seg.dischargeAt !== 0 || state.tick < seg.refractoryUntil) continue;
    if (leylineSegmentShorted(state, seg.cells)) {
      events.push({ t: 'leyline_short', seg: segIdx, cells: seg.cells });
      continue;
    }
    seg.dischargeAt = state.tick + LEYLINE_CHARGE_TICKS;
    seg.triggeredBy = player.id;
    // A ativacao original NAO e `relayed`: ela credita a ressonancia `current`
    // uma vez, e o resto da cascata viaja repassado como sempre.
    seg.relayed = false;
    armed++;
    events.push({
      t: 'leyline_charge',
      seg: segIdx,
      cells: seg.cells,
      dischargeTick: seg.dischargeAt,
    });
  }

  // Sem nada armado nao ha cascata para julgar: marcar `live` aqui faria
  // `settleCircuit` fechar o veredito no mesmo tick, contra uma rede que nunca
  // acendeu.
  if (armed === 0) return;
  circuit.live = true;
  circuit.reached = [];
};

/**
 * A SUBVERSAO: a propriedade que da identidade ao estrato para de valer ate a
 * proxima descida.
 *
 * O premio nao e um numero no personagem, e uma REGRA DO MUNDO que desliga —
 * e e essa escolha que mantem a ajuda pequena sem precisar de um multiplicador
 * timido. Quase toda propriedade desligada aqui servia aos DOIS lados: sem
 * conducao no Aquifero o jogador tambem perde eletrificar poca; com os
 * cristais opacos na Catedral ele perde a fonte gratis de ressonancia
 * `current`. Duas sao assimetricas de proposito (a brasa da Fornalha e a
 * sobrecarga do Miner so pressionam o jogador), e nesses dois o preco esta no
 * custo de fechar, nao no premio.
 *
 * Dois estratos pedem varredura de grid porque a materia deles E a
 * propriedade; o resto so levanta `stratumSubverted` e quem le decide. Manter
 * a leitura espalhada e deliberado: `isConductiveCell` sabe da agua, o calor
 * sabe da brasa, o Miner sabe da sobrecarga. Centralizar viraria uma tabela de
 * excecoes que ninguem mantem.
 *
 * O basalto nao tem entrada, e a ausencia e a regra: ele nao tem propriedade
 * hostil para desligar. O setor 1 e sempre basalto, entao o primeiro circuito
 * da run ensina a linguagem sem pagar premio — e e assim que deve ser.
 */
const subvertStratum = (state: SurvivalState, events: SemanticEvent[]): void => {
  state.stratumSubverted = true;
  markDiscovery(state.stats, DISCOVERY_LEYLINE_CIRCUIT);

  const w = state.config.width;
  if (state.stratum === 'prismatic') {
    // O cristal fica OPACO: nao descarrega mais (nem em voce, nem para voce),
    // e o Arquicantor perde a municao dele. `SOLID_CRYSTAL_DULL` ja existia
    // como o cristal que o acido gastou — aqui a rede faz o mesmo de uma vez.
    for (let i = 0; i < state.solid.length; i++) {
      if (state.solid[i] !== SOLID_CRYSTAL) continue;
      state.solid[i] = SOLID_CRYSTAL_DULL;
      markDirty(state, i % w, Math.floor(i / w));
    }
  } else if (state.stratum === 'silica') {
    // A silica solta VITRIFICA: vidro e chao firme, e o Devorador Branco nao
    // sobe por ele. E o mesmo efeito que o calor ja produzia celula a celula
    // (ver o ramo SURF_SILT em cells.ts), aplicado ao setor.
    for (let i = 0; i < state.surface.length; i++) {
      if (state.surface[i] !== SURF_SILT) continue;
      setSurface(state, i, SURF_GLASS, 0);
    }
  }

  events.push({ t: 'message', key: 'sim.leylineCircuitClosed' });
};

/**
 * A cascata do circuito acabou? Entao o setor tem uma resposta.
 *
 * Roda no fim de `stepLeylines`, e nao junto de cada descarga, porque "acabou"
 * e uma propriedade da REDE e nao de um segmento: enquanto sobrar um relogio
 * armado a cascata ainda esta viajando, e julgar antes cobraria do jogador um
 * circuito que ainda estava acendendo.
 *
 * Fechar exige acender TODOS os `members` na MESMA cascata — e por isso
 * `reached` zera aqui, no desfecho, em vez de acumular entre lancamentos.
 * Somar tentativas transformaria o circuito em persistencia: bastaria lancar
 * uma vez por segmento, sem nunca resolver a rede como rede.
 */
const settleCircuit = (state: SurvivalState, events: SemanticEvent[]): void => {
  const circuit = state.leylineCircuit;
  if (!circuit.live) return;
  if (state.leylineSegments.some((seg) => seg.dischargeAt !== 0)) return;

  const lit = circuit.members.filter((m) => circuit.reached.includes(m)).length;
  const closed = circuit.members.length > 0 && lit === circuit.members.length;
  events.push({ t: 'leyline_circuit', closed, lit, total: circuit.members.length });
  circuit.live = false;
  circuit.reached = [];
  // `closed` e pegajoso ate a troca de setor: a subversao e uma mudanca do
  // MUNDO, e desfaze-la porque uma segunda cascata correu pior faria o jogador
  // perder o previo por mexer na rede que ele acabou de resolver.
  if (closed && !circuit.closed) {
    circuit.closed = true;
    subvertStratum(state, events);
  }
};

const applyCellHazards = (state: SurvivalState, events: SemanticEvent[]): void => {
  const targets = [...joinedPlayers(state), ...state.enemies];
  for (const ent of targets) {
    if (!ent.alive) continue;
    const surf = state.surface[cellIndexAt(state, ent.x, ent.y)];
    if (surf === SURF_FIRE) {
      damageEntity(state, ent, FIRE_DAMAGE_PER_TICK, events, { kind: 'fire' }, true);
    } else if (surf === SURF_GAS && ent.kind === 'player') {
      // Gas sulfuroso e toxico; criaturas do Veio sao imunes ao proprio ambiente.
      damageEntity(state, ent, GAS_DAMAGE_PER_TICK, events, { kind: 'gas' }, true);
    } else if (surf === SURF_SPORES && ent.kind === 'player') {
      // Esporos do bomber sao organicos e irritantes, mas nao volateis/explosivos.
      damageEntity(state, ent, SPORE_DAMAGE_PER_TICK, events, { kind: 'spores' }, true);
    }
  }
};

/**
 * Quanto de uma descarga chega a um corpo, pela DISTANCIA ate a fonte.
 *
 * A corrente entra no condutor num ponto e se espalha. Enquanto a poca era do
 * tamanho de uma poca, tratar isso como dano plano nao custava nada — mas o
 * Diluvio do Leviata faz do setor inteiro um condutor so, e ai o dano plano
 * vira um botao de vitoria nos dois sentidos: uma descarga solta em qualquer
 * canto cobraria integral de tudo o que estivesse na lamina, inclusive do outro
 * lado do mapa, inclusive de quem a soltou.
 *
 * Com a atenuacao, distancia vira decisao. Dentro do raio cheio o choque cobra
 * inteiro — e contato. Alem dele cai com o QUADRADO da distancia, que e como a
 * densidade de corrente cai saindo de uma fonte pontual, ate um piso: zero
 * significaria "existe uma distancia segura", e no lencol nao existe. Quem quer
 * derrubar o Leviata precisa eletrificar PERTO dele, que e exatamente onde e
 * mais caro estar.
 *
 * Descargas sem ponto de origem (o canto do Arquicantor arma dezenas de
 * cristais, e cada um e uma fonte) continuam planas, como sempre foram.
 */
const shockFalloff = (
  ev: { fromX?: number; fromY?: number },
  ent: { x: number; y: number },
): number => {
  if (ev.fromX === undefined || ev.fromY === undefined) return 1;
  const d = Math.hypot(ent.x - ev.fromX, ent.y - ev.fromY);
  if (d <= DELUGE_SHOCK_FULL_RANGE) return 1;
  const ratio = DELUGE_SHOCK_FULL_RANGE / d;
  return Math.max(DELUGE_SHOCK_MIN_SCALE, ratio * ratio);
};

/** Processa eventos encadeados (descargas e explosoes causam dano que gera novos eventos). */
export const resolveChainedEvents = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (let i = 0; i < events.length && i < 512; i++) {
    const ev = events[i];
    if (ev.t === 'discharge') {
      // Credita a DESCARGA, e nao o atordoamento de quem por acaso estava na poca:
      // eletrificar biofluido vazio continua sendo o jogador escolhendo resolver as
      // coisas com corrente, e quem quebra cristal para abrir caminho tambem esta
      // usando corrente. Preso ao stun, o registro so contaria com bicho em cima.
      // Descarga REPASSADA por rele nao credita: a cascata inteira e uma
      // ativacao so — a ressonancia mede frequencia do habito, nao o tamanho
      // da rede que o jogador montou.
      if (ev.source === 'player' && !ev.relayed) recordPlayerResonance(state, ev.owner, 'current');
      const cells = new Set(ev.cells);
      // O canto do Arquicantor usa os cristais da Catedral como extensao do
      // proprio corpo. Ressonantes pertencem a essa mesma rede — inclusive os
      // que acabaram de cristalizar para repor o coro —, entao a onda regida
      // pelo chefe atravessa todos eles sem fogo amigo. A excecao e presa ao
      // DONO Arquicantor: descarga do jogador, do ambiente e ate a lanca de uma
      // voz continuam seguindo suas regras normais.
      const archcantorCrystalShock =
        ev.source === 'enemy' &&
        ev.owner !== undefined &&
        state.enemies.some((enemy) => enemy.id === ev.owner && enemy.archetype === 'archcantor');
      for (const ent of [...joinedPlayers(state), ...state.enemies]) {
        if (!ent.alive) continue;
        if (!cells.has(cellIndexAt(state, ent.x, ent.y))) continue;
        if (archcantorCrystalShock && ent.kind === 'enemy' && ent.archetype === 'resonant')
          continue;
        const scale =
          ev.source === 'player' && ent.kind === 'player' ? PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE : 1;
        damageEntity(state, ent, DISCHARGE_DAMAGE * scale * shockFalloff(ev, ent), events, {
          kind: 'discharge',
          source: ev.source,
        });
        if (ev.source === 'player' && ent.kind === 'enemy' && !isStoneEnemy(ent)) {
          stunEntity(state, ent, CONDUCTIVE_STUN_TICKS);
          if (ent.archetype === 'sheet_leviathan') {
            markDiscovery(state.stats, DISCOVERY_LEVIATHAN_SHOCKED);
          }
        }
        // Eletrificar a poca em que voce mesmo esta e a licao numero um do
        // material condutivo, e ela so ensina se for registrada.
        if (ev.source === 'player' && ent.kind === 'player') {
          markDiscovery(state.stats, DISCOVERY_SELF_HARM);
        }
      }
      if (ev.cells.length > 1) markDiscovery(state.stats, DISCOVERY_DISCHARGE_POOL);
    } else if (ev.t === 'explosion') {
      if (ev.source === 'player') recordPlayerResonance(state, ev.owner, 'blast');
      applyExplosionDamage(
        state,
        ev.x,
        ev.y,
        ev.radius,
        events,
        ev.source === 'player' ? PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE : 1,
        ev.source,
      );
    }
  }
};

/**
 * Executa a habilidade equipada do slot.
 *
 * Um `switch` exaustivo, e nao um mapa de callbacks: cada habilidade precisa do
 * estado inteiro e de `events`, entao um callback nao economizaria nada e
 * esconderia, atras de indirecao, exatamente o codigo que alguem abre este
 * arquivo para ler.
 *
 * Nenhuma delas cobra recurso alem do cooldown. Habilidade que consome carga
 * seria um segundo modulo, e o poco ja resolve a escassez pelo outro lado: voce
 * so tem UMA, e trocar custa abrir mao da que estava funcionando.
 */
/**
 * Credita uma reacao ao jogador que a causou.
 *
 * Passa pelo `owner` do evento em vez de pelo slot que estava mirando: quem
 * acendeu a poca pode ja ter morrido, e a reacao continua sendo dele. Ignora
 * silenciosamente owner que nao e jogador — inimigo tambem detona e eletrifica, e
 * isso nao ensina nada sobre como ESTE Prospector joga.
 */
const recordPlayerResonance = (
  state: SurvivalState,
  owner: number | undefined,
  kind: ResonanceKind,
): void => {
  if (owner === undefined) return;
  const slot = state.players.findIndex((p) => p.id === owner);
  if (slot < 0) return;
  recordResonance(state.playerExtras[slot].resonance, kind);
};

const castAbility = (state: SurvivalState, slot: number, events: SemanticEvent[]): void => {
  const tuning = state.config.tuning;
  const player = state.players[slot];
  const extra = state.playerExtras[slot];
  const aimLength = Math.hypot(extra.aim.x, extra.aim.y) || 1;
  const dx = extra.aim.x / aimLength;
  const dy = extra.aim.y / aimLength;

  // O sopro e a unica habilidade com DURACAO: o telegrafo dela cobre o canal
  // inteiro, senao o cliente encerraria a pose de canalizacao em 8 ticks.
  const isBreath = extra.ability === 'flamethrower';
  events.push({
    t: 'action_start',
    entity: player.id,
    action: isBreath ? 'breath' : 'pulse',
    x: player.x,
    y: player.y,
    dx,
    dy,
    startTick: state.tick,
    releaseTick: state.tick,
    endTick: state.tick + (isBreath ? FLAMETHROWER_CHANNEL_TICKS : 8),
  });

  switch (extra.ability) {
    case 'pulse': {
      const { radius, knockback } = ABILITY_SHAPE.pulse;
      events.push({ t: 'pulse', x: player.x, y: player.y, radius });
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const ex = enemy.x - player.x;
        const ey = enemy.y - player.y;
        const d = Math.hypot(ex, ey);
        if (d <= radius && d > 0.001) {
          enemy.vx += (ex / d) * knockback * TICK_HZ * 0.25;
          enemy.vy += (ey / d) * knockback * TICK_HZ * 0.25;
          enemy.stunnedUntil = state.tick + 6;
          recordResonance(extra.resonance, 'kinetic');
        }
      }
      const w = state.config.width;
      const r = Math.ceil(radius);
      const px = Math.floor(player.x);
      const py = Math.floor(player.y);
      for (let y = py - r; y <= py + r; y++) {
        for (let x = px - r; x <= px + r; x++) {
          if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
          const ox = x + 0.5 - player.x;
          const oy = y + 0.5 - player.y;
          if (ox * ox + oy * oy > radius * radius) continue;
          const i = y * w + x;
          if (
            state.surface[i] === SURF_FIRE ||
            state.surface[i] === SURF_GAS ||
            state.surface[i] === SURF_SPORES
          ) {
            setSurface(state, i, SURF_NONE, 0);
            recordResonance(extra.resonance, 'kinetic');
          }
        }
      }
      return;
    }

    case 'flamethrower': {
      // O cast so ABRE o canal. Celulas, dano, evento visual e a leitura da
      // mira acontecem POR EMISSAO em `emitFlameBreath`, no ritmo do intervalo:
      // e isso que faz o sopro seguir o stick durante a habilidade em vez de
      // congelar a mira do instante do cast.
      extra.channelingUntil = state.tick + FLAMETHROWER_CHANNEL_TICKS;
      return;
    }

    case 'seeker': {
      const { damage, speed, ttl } = ABILITY_SHAPE.seeker;
      state.projectiles.push({
        kind: 'seeker',
        id: state.nextEntityId++,
        owner: player.id,
        x: player.x + dx * 0.5,
        y: player.y + dy * 0.5,
        vx: dx * speed * tuning.projectileSpeedScale,
        vy: dy * speed * tuning.projectileSpeedScale,
        damage: playerDamage(tuning, damage),
        radius: 0.32,
        distanceTravelled: 0,
        hostile: false,
        leavesBiofluid: false,
        ttl,
      });
      events.push({ t: 'shot', x: player.x, y: player.y, dx, dy, owner: player.id });
      return;
    }

    case 'arc': {
      const { range, damage, maxTargets } = ABILITY_SHAPE.arc;
      // Salta do jogador para o inimigo vivo mais proximo, e dali para o proximo.
      // NAO precisa de poca: o arco condutivo e o que o modulo `conductive`
      // ensinou a fazer sem chao molhado, e essa e a diferenca que justifica ele
      // existir ao lado do modulo.
      const hops: Array<{ x: number; y: number }> = [{ x: player.x, y: player.y }];
      const struck = new Set<number>();
      let fromX = player.x;
      let fromY = player.y;
      for (let hop = 0; hop < maxTargets; hop++) {
        let best: Entity | null = null;
        let bestDistance = range;
        for (const enemy of state.enemies) {
          if (!enemy.alive || struck.has(enemy.id)) continue;
          const d = Math.hypot(enemy.x - fromX, enemy.y - fromY);
          if (d < bestDistance) {
            best = enemy;
            bestDistance = d;
          }
        }
        if (!best) break;
        struck.add(best.id);
        hops.push({ x: best.x, y: best.y });
        damageEntity(state, best, playerDamage(tuning, damage), events);
        // Mesma regra do modulo condutivo: pedra nao conduz. Duplicar a excecao
        // aqui seria criar uma segunda verdade sobre o Britador.
        if (!isStoneEnemy(best)) stunEntity(state, best, CONDUCTIVE_STUN_TICKS);
        recordResonance(extra.resonance, 'current');
        fromX = best.x;
        fromY = best.y;
      }
      if (hops.length > 1) events.push({ t: 'arc_chain', hops });
      return;
    }
  }
};

/**
 * Encerra o canal do sopro NESTE tick e so entao cobra o cooldown.
 *
 * O cooldown corre a partir do FIM do canal, nao do cast: cobrar no gatilho
 * fazia 2,5 s da janela serem consumidos pela propria chama, e "8 s de
 * cooldown" viravam 5,5 s de espera real. A cobranca vale tambem para canal
 * INTERROMPIDO (stun, queda) — sem ela, ser atordoado viraria recast gratis.
 * `channelingUntil === 0` e o marcador de "sem canal", e e o que garante que a
 * cobranca aconteca uma unica vez por canal.
 *
 * A excecao unica e a troca de habilidade no poco, que zera o cooldown por
 * design e por isso descarta o canal DIRETO, sem passar por aqui.
 *
 * Interrupcao (tick ainda dentro do canal) tambem emite `action_end`: o
 * `action_start` do cast prometeu ao cliente uma pose ate o `endTick` cheio, e
 * sem o aviso um jogador derrubado e reerguido RETOMAVA a pose de sopro sem
 * chama nenhuma saindo. O fim natural nao avisa — ele coincide com o prazo que
 * o cliente ja conhece.
 */
const settleBreathChannel = (state: SurvivalState, slot: number, events: SemanticEvent[]): void => {
  const extra = state.playerExtras[slot];
  if (extra.channelingUntil === 0) return;
  if (state.tick < extra.channelingUntil) {
    events.push({ t: 'action_end', entity: state.players[slot].id });
  }
  extra.channelingUntil = 0;
  extra.abilityCooldownUntil =
    state.tick +
    Math.round(
      abilityDefinition('flamethrower').cooldownTicks * state.config.tuning.abilityCooldownScale,
    );
};

/**
 * Quantos raios de amostra viajam no evento `flame_cone.reach`, de `-arc` a
 * `+arc`. Cinco cobrem o cone visual sem inflar o snapshot; o GAMEPLAY nao usa
 * isto — as celulas sao varridas uma a uma com linha-de-visada propria.
 */
const FLAME_REACH_LANES = 5;

/**
 * Ate onde o sopro alcanca na direcao (dx,dy) antes de bater em solido ou na
 * borda do mapa, em tiles. Amostra o raio em passos menores que meia celula
 * (`FLAMETHROWER_LOS_STEP`), entao uma parede de um tile nunca e saltada.
 */
const flameReach = (
  state: SurvivalState,
  x: number,
  y: number,
  dx: number,
  dy: number,
  range: number,
): number => {
  const w = state.config.width;
  const h = state.config.height;
  const steps = Math.ceil(range / FLAMETHROWER_LOS_STEP);
  for (let s = 1; s <= steps; s++) {
    const d = (range * s) / steps;
    const cx = Math.floor(x + dx * d);
    const cy = Math.floor(y + dy * d);
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return (range * (s - 1)) / steps;
    if (state.solid[cy * w + cx] !== SOLID_NONE) return (range * (s - 1)) / steps;
  }
  return range;
};

/**
 * A chama consegue viajar de (x0,y0) ate (x1,y1) sem atravessar solido?
 *
 * Para no instante em que a amostra entra na CELULA alvo: o que se pergunta e
 * se o caminho ate ela esta livre, nao se ela propria e solida — quem chama ja
 * decidiu isso. Ambos os extremos precisam estar dentro do mapa.
 */
const flameCanReach = (
  state: SurvivalState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean => {
  const distance = Math.hypot(x1 - x0, y1 - y0);
  if (distance < 0.001) return true;
  const w = state.config.width;
  const targetCx = Math.floor(x1);
  const targetCy = Math.floor(y1);
  const steps = Math.ceil(distance / FLAMETHROWER_LOS_STEP);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const cx = Math.floor(x0 + (x1 - x0) * t);
    const cy = Math.floor(y0 + (y1 - y0) * t);
    if (cx === targetCx && cy === targetCy) break;
    if (state.solid[cy * w + cx] !== SOLID_NONE) return false;
  }
  return true;
};

/**
 * UMA emissao do sopro canalizado: le a mira ATUAL, acende as celulas do cone
 * que a chama de fato alcanca e fere criaturas na mesma area.
 *
 * A direcao vem da MIRA persistida (`extra.aim`), nunca do movimento: stick de
 * mira neutro reusa a ultima mira valida — o comando neutro tem mira zero e nao
 * toca em `extra.aim` —, e andar para um lado soprando para o outro funciona
 * por construcao. Tudo aqui e deterministico: sem RNG, so tick e geometria.
 */
const emitFlameBreath = (state: SurvivalState, slot: number, events: SemanticEvent[]): void => {
  const tuning = state.config.tuning;
  const player = state.players[slot];
  const extra = state.playerExtras[slot];
  const aimLength = Math.hypot(extra.aim.x, extra.aim.y) || 1;
  const dx = extra.aim.x / aimLength;
  const dy = extra.aim.y / aimLength;
  const { range, arc } = ABILITY_SHAPE.flamethrower;

  // Alcances reais por raio de amostra, para o cliente desenhar o jato ate onde
  // a simulacao chegou. Centesimos bastam para apresentacao e mantem o evento
  // curto no wire.
  const reach: number[] = [];
  for (let lane = 0; lane < FLAME_REACH_LANES; lane++) {
    const angle = -arc + (2 * arc * lane) / (FLAME_REACH_LANES - 1);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    reach.push(Math.round(flameReach(state, player.x, player.y, lx, ly, range) * 100) / 100);
  }
  const seq = extra.channelingUntil - state.tick;
  events.push({
    t: 'flame_cone',
    owner: player.id,
    x: player.x,
    y: player.y,
    dx,
    dy,
    range,
    arc,
    seq,
    reach,
  });

  // Dano e chao sao resolvidos pela MESMA varredura de celulas: o cone acende
  // o que atravessa, e o fogo que fica e o que continua matando depois. Sem
  // isso o lanca-chamas seria um tiro largo com nome bonito.
  const w = state.config.width;
  const h = state.config.height;
  const r = Math.ceil(range);
  const px = Math.floor(player.x);
  const py = Math.floor(player.y);
  for (let y = py - r; y <= py + r; y++) {
    for (let x = px - r; x <= px + r; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const ox = x + 0.5 - player.x;
      const oy = y + 0.5 - player.y;
      const d = Math.hypot(ox, oy);
      if (d > range || d < 0.001) continue;
      // Dentro do cone: o produto escalar com a mira normalizada da o cosseno
      // do angulo, e comparar cossenos evita um `atan2` por celula.
      if ((ox / d) * dx + (oy / d) * dy < Math.cos(arc)) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) continue;
      // Parede BLOQUEIA o sopro: celula dentro do cone mas atras de solido nao
      // recebe chama. O cone antigo pintava fogo do outro lado da parede.
      if (!flameCanReach(state, player.x, player.y, x + 0.5, y + 0.5)) continue;
      const before = state.surface[i];
      // O cone NAO acende materia por conta propria: ele pede a `igniteCell`,
      // como toda outra fonte de chama do jogo. Escrever `SURF_FIRE` direto
      // pulava as regras do material — fungo umido saltava para fogo sem
      // passar pelo estado fumegante que AVISA, gas recebia o combustivel
      // longo em vez do flash curto, e nem o evento de ignicao nem a
      // descoberta aconteciam. Uma habilidade nova que ensina outra fisica
      // para o mesmo material e pior do que uma habilidade que falta.
      const ignited = igniteCell(state, i, events);
      if (!ignited) {
        // Chao nu nao tem o que "pegar" fogo: ali a chama do sopro fica por
        // conta propria. Qualquer superficie com materia pertence a
        // `igniteCell`, inclusive quando ela decide nao acender nada.
        const bare = state.surface[i];
        if (bare === SURF_NONE || bare === SURF_SCORCHED || bare === SURF_FIRE) {
          setSurface(state, i, SURF_FIRE, FIRE_FUEL_TICKS);
        }
      }
      // Credita pelo RESULTADO, e so quando ele MUDOU nesta emissao: o canal
      // repassa as mesmas celulas dezenas de vezes, e creditar chama ja acesa a
      // cada emissao inflaria a ressonancia de fogo por repeticao, nao por
      // provocacao.
      const after = state.surface[i];
      if (after !== before && (after === SURF_FIRE || after === SURF_FUNGAL_HEATED)) {
        recordResonance(extra.resonance, 'fire');
      }
    }
  }
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const ox = enemy.x - player.x;
    const oy = enemy.y - player.y;
    const d = Math.hypot(ox, oy);
    if (d > range || d < 0.001) continue;
    if ((ox / d) * dx + (oy / d) * dy < Math.cos(arc)) continue;
    if (!flameCanReach(state, player.x, player.y, enemy.x, enemy.y)) continue;
    damageEntity(state, enemy, playerDamage(tuning, FLAMETHROWER_EMISSION_DAMAGE), events);
    recordResonance(extra.resonance, 'fire');
  }
};

/**
 * Acorda os Ecos do poco na primeira vez que alguem chega perto.
 *
 * Congela a oferta. Recalcular a cada tick faria os dois Ecos trocarem de
 * habilidade enquanto o jogador anda entre eles — e a ressonancia MUDA enquanto
 * ele anda, porque andar ate o poco tambem provoca reacoes.
 *
 * Nao acontece onde o ponto e um PEDESTAL — o setor final e qualquer setor de
 * Nucleo. La o ponto ja tem dono (e, quando ha chefe, a arena dele em volta), e
 * parar para escolher habilidade no meio da arena seria o pior lugar possivel
 * para um menu.
 */
const revealWellOffers = (state: SurvivalState, events: SemanticEvent[]): void => {
  if (state.wellOffers.length > 0 || isRunFinalSector(state) || hasCoreHere(state)) return;
  const wellX = state.corePos.x + 0.5;
  const wellY = state.corePos.y + 0.5;
  // O MAIS PROXIMO, e nao o ultimo iterado. Guardar a ultima ocorrencia fazia o
  // slot de numero mais alto ganhar sempre que os dois estivessem no alcance no
  // mesmo tick — a oferta descrevia o estilo do parceiro que ficou para tras por
  // causa da ordem do laco. Empate exato mantem o slot menor, que e deterministico.
  let nearest: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let slot = 0; slot < state.players.length; slot++) {
    const p = state.players[slot];
    if (!state.playerExtras[slot].joined || !p.alive) continue;
    const distance = Math.hypot(p.x - wellX, p.y - wellY);
    if (distance > WELL_OFFER_REVEAL) continue;
    if (nearest === null || distance < nearestDistance) {
      nearest = slot;
      nearestDistance = distance;
    }
  }
  if (nearest === null) return;

  // A oferta le a ressonancia de quem CHEGOU. No co-op os dois jogaram o mesmo
  // setor de formas diferentes, e escolher a de um deles e mais honesto do que
  // somar as duas: uma media de estilos nao descreve estilo nenhum.
  let offers = resonanceOffers(
    state.playerExtras[nearest].resonance,
    state.playerExtras[nearest].ability,
    state.config.seed,
    state.sector,
  );
  // O poco do PRIMEIRO setor nunca fica mudo: pelo menos UM Eco, sempre.
  //
  // Nos setores fundos a regra continua a historica — sem ressonancia o Veio
  // nao tem o que demonstrar. Mas o setor 1 e onde o jogador APRENDE que o poco
  // oferece habilidade, e um poco calado na primeira descida ensina que ele e
  // so um buraco. Quem chegou sem provocar reacao nenhuma recebe uma
  // demonstracao sorteada pela seed (deterministica: mesmo Eco para as duas
  // maquinas da sala e para o replay).
  if (offers.length === 0 && state.sector === 1) {
    offers = [fallbackOffer(state.playerExtras[nearest].ability, state.config.seed, state.sector)];
  }
  if (offers.length === 0) return;

  state.wellOffers = offers.map((ability, index) => {
    // Um de cada lado do poco, no eixo que a entrada nao usa. Ficar EM CIMA do
    // poco faria o jogador pegar habilidade ao tentar descer.
    const side = index === 0 ? -1 : 1;
    return {
      ability,
      x: wellX + side * WELL_OFFER_SPREAD,
      y: wellY + side * WELL_OFFER_SPREAD * 0.5,
      takenBy: null,
    };
  });
  events.push({ t: 'well_offers', sector: state.sector, abilities: offers });
};

/**
 * A barra de calor estourou? Entao trava o gatilho, cobra vida e avisa.
 *
 * Extraida do bloco do bolt porque agora ha DOIS gatilhos que aquecem o mesmo
 * cano — o tiro comum e a Minigun — e a regra de superaquecimento e uma so por
 * decisao de design: "a arma so volta a funcionar depois de cair abaixo do
 * limiar de recuperacao que o sistema de calor ja usa". Duas copias da conta
 * seriam duas regras, e a segunda envelheceria calada.
 */
const settleOverheat = (state: SurvivalState, slot: number, events: SemanticEvent[]): void => {
  const extra = state.playerExtras[slot];
  const player = state.players[slot];
  const tuning = state.config.tuning;
  if (extra.heat < tuning.heatMax) return;
  extra.overheatedUntil = state.tick + tuning.overheatLockTicks;
  extra.heat = tuning.heatMax * 0.55;
  damageEntity(state, player, tuning.overheatSelfDamage, events, { kind: 'overheat' });
  markDiscovery(state.stats, DISCOVERY_SELF_HARM);
  events.push({ t: 'overheat', slot, x: player.x, y: player.y });
};

/**
 * Uma bala da Minigun. Devolve `false` quando nao havia como dispara-la.
 *
 * A ordem interna e a unica que nao duplica dano nem municao: a carga sai
 * PRIMEIRO (e `consumeModuleCharge` e quem recusa a 301a e publica o
 * `module_expired` uma vez so), e o projetil so nasce depois. Invertido, um
 * `MAX_PROJECTILES` cheio comeria a carga sem por bala no mundo.
 *
 * O projetil sai SEM `modules`, e isso e a matriz de compatibilidade
 * acontecendo: perfura, condutivo, explosivo, sifao e ricochete continuam
 * instalados e com as cargas intactas, mas nao viajam na bala. Ver
 * `modules.ts`.
 */
const fireMinigunRound = (
  state: SurvivalState,
  slot: number,
  index: number,
  events: SemanticEvent[],
): boolean => {
  if (state.projectiles.length >= MAX_PROJECTILES) return false;
  const extra = state.playerExtras[slot];
  const player = state.players[slot];
  const tuning = state.config.tuning;
  if (!consumeModuleCharge(extra, 'minigun', slot, events, true)) return false;

  // DISPERSAO: cresce com o calor e e deterministica por (tick, slot, indice).
  const spread = minigunSpread(extra.heat / Math.max(1, tuning.heatMax));
  const angle = spread * minigunJitter(state.tick, slot, index);
  const dir = rotateUnit(extra.aim.x, extra.aim.y, angle);

  state.projectiles.push({
    kind: 'flechette',
    id: state.nextEntityId++,
    owner: player.id,
    x: player.x + dir.x * 0.4,
    y: player.y + dir.y * 0.4,
    vx: dir.x * MINIGUN_PROJECTILE_SPEED * tuning.projectileSpeedScale,
    vy: dir.y * MINIGUN_PROJECTILE_SPEED * tuning.projectileSpeedScale,
    damage: playerDamage(tuning, MINIGUN_DAMAGE),
    radius: MINIGUN_PROJECTILE_RADIUS,
    modules: undefined,
    distanceTravelled: 0,
    hostile: false,
    leavesBiofluid: false,
    ttl: Math.ceil(TICK_HZ * MINIGUN_PROJECTILE_TTL_SECONDS),
  });

  extra.heat += MINIGUN_HEAT_PER_SHOT;
  meltFreezeByHeat(extra, MINIGUN_HEAT_PER_SHOT);
  extra.minigun.pendingRounds++;
  state.stats.shotsFired += 1;
  return true;
};

/**
 * UM TICK do canhao rotativo. Devolve `true` quando ele esta com o gatilho.
 *
 * A ordem e deliberada e vale a pena ler de cima a baixo:
 *
 *  1. `wantsSpin` e a intencao COMPLETA — gatilho apertado, modulo com
 *     municao, sem travamento de calor. Superaquecido, o jogador pode apertar
 *     o quanto quiser: os canos descem.
 *  2. A rotacao anda um passo. Ela anda SEMPRE, inclusive com o modulo ja
 *     gasto, porque a desaceleracao e o fim da fantasia da arma — a bala 300
 *     sai e os canos continuam girando ate parar.
 *  3. A fase e derivada da rotacao (funcao total, ver `minigun.ts`), e a
 *     transicao — e so ela — vira evento.
 *  4. O acumulador entrega os tiros do tick. Nunca "um por quadro".
 *  5. A rajada e publicada AGREGADA a cada `MINIGUN_BURST_EVENT_TICKS`.
 *
 * O `true` de retorno bloqueia o bolt no mesmo tick, e ele vale enquanto ha
 * MUNICAO — nao enquanto ha rotacao: a desaceleracao depois da ultima bala nao
 * pode segurar o tiro comum, que ja voltou a ser a arma do jogador.
 */
const stepMinigun = (
  state: SurvivalState,
  slot: number,
  triggerHeld: boolean,
  events: SemanticEvent[],
): boolean => {
  const extra = state.playerExtras[slot];
  const player = state.players[slot];
  const mg = extra.minigun;
  const equipped = activeWeaponModule(extra, state.tick) === 'minigun';

  // Sem arma e sem rotacao residual nao ha nada a fazer — o caminho quente de
  // toda run que nunca viu uma Minigun sai daqui.
  if (!equipped && mg.spin === 0 && mg.phase === 'idle' && mg.pendingRounds === 0) return false;

  const overheated = state.tick < extra.overheatedUntil;
  const wantsSpin = equipped && triggerHeld && !overheated;
  const previousPhase = mg.phase;

  mg.spin = minigunNextSpin(mg.spin, wantsSpin);
  mg.phase = minigunPhaseFor(mg.spin, wantsSpin, overheated);

  if (mg.phase === 'firing') {
    const rate = minigunRateMilli(mg.spin);
    // Entrando na rajada: semeia o acumulador para a primeira bala sair NESTE
    // tick, e nao um tick depois de a rotacao ja ter cruzado o limiar.
    if (previousPhase !== 'firing') mg.fireAccum = minigunPrimedAccumulator(rate);
    const drained = minigunDrainAccumulator(mg.fireAccum, rate, MINIGUN_MAX_SHOTS_PER_TICK);
    mg.fireAccum = drained.accum;
    for (let i = 0; i < drained.shots; i++) {
      if (!fireMinigunRound(state, slot, i, events)) break;
    }
    settleOverheat(state, slot, events);
    // O travamento pode ter acontecido DENTRO do laco acima: a fase tem de
    // dizer a verdade no mesmo tick, senao o cliente desenha canos girando
    // enquanto a simulacao ja travou o gatilho.
    if (state.tick < extra.overheatedUntil) mg.phase = 'overheated';
  } else {
    // Fora da rajada o acumulador zera. Guardar fracao entre rajadas daria uma
    // bala "gratis" no reaperto — e o que barateia a retomada e a ROTACAO que
    // sobrou, nunca municao adiantada.
    mg.fireAccum = 0;
  }

  if (mg.phase !== previousPhase) {
    events.push({
      t: 'minigun_spin',
      slot,
      x: player.x,
      y: player.y,
      phase: mg.phase,
      spin: mg.spin,
    });
  }

  // A RAJADA AGREGADA. Cinco por segundo, e so quando houve bala: uma janela
  // silenciosa nao publica nada.
  if (mg.pendingRounds > 0 && state.tick % MINIGUN_BURST_EVENT_TICKS === 0) {
    events.push({
      t: 'minigun_burst',
      slot,
      x: player.x,
      y: player.y,
      dx: extra.aim.x,
      dy: extra.aim.y,
      rounds: mg.pendingRounds,
      spin: mg.spin,
    });
    // O tronco tambem so gira uma vez por janela. `player_shot` continua sendo
    // a acao — o atlas do Prospector nao ganhou pose nova — e o `endTick`
    // cobre com folga a janela seguinte, entao a pose fica CONTINUA durante a
    // rajada em vez de piscar cinco vezes por segundo.
    events.push({
      t: 'action_start',
      entity: player.id,
      action: 'player_shot',
      x: player.x,
      y: player.y,
      dx: extra.aim.x,
      dy: extra.aim.y,
      startTick: state.tick,
      releaseTick: state.tick,
      endTick: state.tick + MINIGUN_BURST_EVENT_TICKS + 3,
    });
    mg.pendingRounds = 0;
  }

  return equipped;
};

/**
 * AS CELULAS QUE ESTE SEGMENTO DE MOVIMENTO ATRAVESSOU, em ordem.
 *
 * Nao e "a celula do centro depois de andar": a 20 Hz um Prospector no embalo
 * do gelo percorre mais de meio tile por tick, e uma esquiva percorre bem mais
 * de um. Ler so o destino faria a diagonal pular quinas e a esquiva pular
 * placas inteiras — e uma placa pulada e uma travessia que nao contou, ou pior,
 * um buraco que nao matou ninguem.
 *
 * A caminhada e um DDA por eixo: a cada passo cruza-se a proxima fronteira em
 * X ou em Y, a que estiver mais perto (empate resolve em X, deterministicamente
 * — as duas maquinas de uma sala precisam do mesmo desempate). O resultado e um
 * caminho conexo por ARESTA: nunca ha um salto na diagonal por cima de uma
 * quina, que e exatamente onde um buraco poderia ser atravessado de graca.
 *
 * A celula de PARTIDA nao entra: quem ja estava ali nao acabou de entrar. Ficar
 * parado devolve lista vazia pela mesma razao, e e assim que "permanecer imovel
 * nao progride a rachadura" cai da geometria em vez de virar um caso especial.
 */
export const cellsCrossed = (
  state: SurvivalState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number[] => {
  const w = state.config.width;
  const h = state.config.height;
  const clampX = (v: number): number => Math.max(0, Math.min(w - 1, v));
  const clampY = (v: number): number => Math.max(0, Math.min(h - 1, v));
  let cx = clampX(Math.floor(x0));
  let cy = clampY(Math.floor(y0));
  const ex = clampX(Math.floor(x1));
  const ey = clampY(Math.floor(y1));
  const out: number[] = [];
  if (cx === ex && cy === ey) return out;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  // Parametro t em [0,1] ate a proxima fronteira de cada eixo. Eixo parado
  // recebe infinito: ele nunca e escolhido, e a caminhada vira reta pura.
  const invX = dx !== 0 ? 1 / Math.abs(dx) : Infinity;
  const invY = dy !== 0 ? 1 / Math.abs(dy) : Infinity;
  let tX = dx !== 0 ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * invX : Infinity;
  let tY = dy !== 0 ? (dy > 0 ? cy + 1 - y0 : y0 - cy) * invY : Infinity;

  // Teto de passos: a soma das distancias em celulas mais folga. Um segmento
  // nunca cruza mais fronteiras que isso, e o limite impede que um NaN vindo de
  // uma posicao corrompida transforme a caminhada em laco infinito.
  const budget = Math.abs(ex - cx) + Math.abs(ey - cy) + 2;
  for (let n = 0; n < budget; n++) {
    if (tX <= tY) {
      cx += stepX;
      tX += invX;
    } else {
      cy += stepY;
      tY += invY;
    }
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) break;
    out.push(cy * w + cx);
    if (cx === ex && cy === ey) break;
  }
  return out;
};

/**
 * O CHAO CEDEU SOB ESTE PROSPECTOR.
 *
 * Nao passa por `damageEntity`: a queda nao e dano. HP cheio nao salva, iframe
 * de esquiva nao salva, e nao ha estado abatido no fundo do buraco — um corpo
 * revivivel dentro de agua profunda seria um resgate que o mundo nao permite
 * executar, e o co-op ficaria esperando por ele ate o sangramento.
 *
 * O que ela REUSA e todo o resto: `killPlayer` devolve os Nucleos aos pedestais
 * certos, emite o `death` que o cliente ja sabe apresentar, e
 * `resolveDownedAndDeaths` fecha a run no mesmo tick se ninguem mais estiver de
 * pe. `lastDamage` recebe a causa propria para a tela de fim dizer o que
 * aconteceu em vez de cair no "o Veio te consumiu".
 */
const plungeIntoDeepWater = (
  state: SurvivalState,
  slot: number,
  cellIdx: number,
  events: SemanticEvent[],
): void => {
  const player = state.players[slot];
  const extra = state.playerExtras[slot];
  const w = state.config.width;
  // O corpo para NO buraco. Sem isto o `death` sai na posicao pos-movimento,
  // que pode ser a celula seguinte — e o afundamento apareceria ao lado da
  // agua, com o Prospector boiando sobre gelo intacto.
  player.x = (cellIdx % w) + 0.5;
  player.y = Math.floor(cellIdx / w) + 0.5;
  player.vx = 0;
  player.vy = 0;
  player.hp = 0;
  // Abatido que cai deixa de estar abatido: ele MORREU. Sem limpar a flag,
  // `resolveDownedAndDeaths` continuaria contando o sangramento de um corpo que
  // nao existe e a run nao fecharia.
  extra.downed = false;
  extra.bleedoutAt = 0;
  extra.lastDamage = { cause: { kind: 'deep_water' }, tick: state.tick };
  // De que agua: o buraco de uma placa (registrado em `iceHoles`) ou a agua
  // profunda nativa do Aquifero. A mesma morte, duas apresentacoes.
  events.push({
    t: 'ice_fall',
    x: player.x,
    y: player.y,
    slot,
    medium: isIceHole(state, cellIdx) ? 'ice' : 'water',
  });
  killPlayer(state, slot, events);
};

/**
 * Esta celula AFOGA quem pisa nela agora? Agua profunda, e nao tampada pelo
 * corpo aberto do Leviata (ver `leviathanCovers`): enquanto ele esta ancorado
 * — e durante o mergulho, ate a cauda sumir — as celulas profundas debaixo da
 * manta sao chao. No tick em que a cauda some, a poca volta a ser fatal.
 */
const drownsAt = (state: SurvivalState, cellIdx: number): boolean =>
  state.surface[cellIdx] === SURF_DEEP_WATER && !leviathanCovers(state, cellIdx);

/**
 * A CARGA DESTE PROSPECTOR SOBRE O GELO, ao longo do que ele acabou de andar.
 *
 * Roda depois do movimento e le o segmento inteiro, entao vale igual para
 * caminhada, deslize e esquiva — nao ha "modo de andar" que atravesse de graca.
 *
 * Uma celula avanca NO MAXIMO um degrau por Prospector por passo: a caminhada
 * visita cada indice uma vez, e o `Set` guarda contra um segmento degenerado
 * que voltasse sobre si mesmo. Em co-op cada slot roda o proprio passo na ordem
 * autoritativa dos slots, entao dois Prospectors na mesma celula no mesmo tick
 * descem dois degraus, sempre na mesma ordem, nas duas maquinas.
 */
const applyIceLoad = (
  state: SurvivalState,
  slot: number,
  fromX: number,
  fromY: number,
  events: SemanticEvent[],
): void => {
  const player = state.players[slot];
  const crossed = cellsCrossed(state, fromX, fromY, player.x, player.y);
  if (crossed.length === 0) return;
  const seen = new Set<number>();
  for (const i of crossed) {
    if (seen.has(i)) continue;
    seen.add(i);
    // O buraco que JA estava aberto mata na entrada, antes de qualquer outra
    // leitura: atravessar um vao de agua profunda no embalo nao e uma travessia
    // bem-sucedida, e o segmento acaba ali.
    if (drownsAt(state, i)) {
      plungeIntoDeepWater(state, slot, i, events);
      return;
    }
    if (advanceIceCrack(state, i, events) === 'collapsed') {
      plungeIntoDeepWater(state, slot, i, events);
      return;
    }
  }
};

/**
 * Calor decai — DEVAGAR em cima de uma fissura incandescente da Fornalha.
 * A fissura nao machuca: o que ela cobra e a barra que ja esta no HUD, e
 * sair dela e a decisao que devolve a dissipacao normal.
 */
const decayHeat = (state: SurvivalState, slot: number): void => {
  const player = state.players[slot];
  const extra = state.playerExtras[slot];
  const tuning = state.config.tuning;
  const onEmber = state.surface[cellIndexAt(state, player.x, player.y)] === SURF_EMBER;
  extra.heat = Math.max(
    0,
    extra.heat -
      tuning.heatDecayPerTick *
        // Circuito fechado na Fornalha: a fissura para de segurar o calor da
        // arma. E uma das duas subversoes assimetricas — brasa so pressiona o
        // jogador —, e o preco dela esta no custo de fechar, nao no premio.
        (onEmber && !(state.stratumSubverted && state.stratum === 'furnace')
          ? EMBER_HEAT_DECAY_SCALE
          : 1),
  );
};

/**
 * O tick de um Prospector CONGELADO POR INTEIRO.
 *
 * Tudo o que e acao esta fora: movimento, rumo, esquiva, interacao,
 * habilidade, canal do sopro (cancelado cobrando o cooldown, como a pedra do
 * Britador faz) e o gatilho como arma. Os canos da Minigun desaceleram — o
 * passo roda com o gatilho SOLTO — e o calor dissipa como sempre. O corpo
 * continua vulneravel: o dano entra pelo funil de sempre, sem reducao.
 *
 * O gatilho e interceptado AQUI, antes de qualquer arma existir: apertar nao
 * cria bolt, disco nem bala, nao consome carga, nao incrementa `shotsFired`,
 * nao emite `shot` e nao deixa nada enfileirado. O que ele faz e um CICLO
 * TERMICO seco, de cadencia fixa: o motor tenta partir por baixo da crosta,
 * gera calor de verdade no sistema de calor de sempre, e e esse calor novo
 * que derrete o gelo. O superaquecimento continua valendo — o ciclo passa
 * por `settleOverheat` como um tiro passaria — e durante o lockout os ciclos
 * ficam suspensos, sem perder o que ja derreteu.
 *
 * A crosta se parte quando uma camada inteira foi embora (`frostbiteBreaks`).
 * O tick da libertacao NAO dispara: o ciclo consumiu o gatilho; o proximo
 * aperto elegivel atira normalmente.
 */
const stepFrostbitten = (
  state: SurvivalState,
  slot: number,
  cmd: PlayerCommand,
  events: SemanticEvent[],
): void => {
  const player = state.players[slot];
  const extra = state.playerExtras[slot];
  player.vx = 0;
  player.vy = 0;
  extra.dodgeUntil = Math.min(extra.dodgeUntil, state.tick);
  settleBreathChannel(state, slot, events);
  decayHeat(state, slot);
  stepMinigun(state, slot, false, events);

  if (cmd.fire && state.tick >= extra.thermalCycleReadyAt && state.tick >= extra.overheatedUntil) {
    extra.thermalCycleReadyAt = state.tick + FREEZE_THERMAL_CYCLE_TICKS;
    extra.heat += FREEZE_THERMAL_CYCLE_HEAT;
    meltFreezeByHeat(extra, FREEZE_THERMAL_CYCLE_HEAT);
    events.push({
      t: 'thermal_cycle',
      slot,
      x: player.x,
      y: player.y,
      freeze: extra.freeze,
      heat: extra.heat,
    });
    settleOverheat(state, slot, events);
    if (frostbiteBreaks(extra)) {
      extra.frostbitten = false;
      extra.freezeGraceUntil = state.tick + FREEZE_GRACE_TICKS;
      // O gatilho deste tick foi o ciclo; o cano so volta a valer no proximo.
      extra.nextShotAt = Math.max(extra.nextShotAt, state.tick + 1);
      events.push({ t: 'frostbite_break', slot, x: player.x, y: player.y });
    }
  }
};

const stepPlayer = (
  state: SurvivalState,
  slot: number,
  cmd: PlayerCommand,
  events: SemanticEvent[],
): void => {
  const tuning = state.config.tuning;
  const player = state.players[slot];
  const extra = state.playerExtras[slot];
  const dt = 1 / TICK_HZ;
  const coop = state.config.playerCount > 1;

  // slots nao reivindicados, abatidos e mortos nao agem. Cair ou morrer CANCELA
  // o canal do sopro (cobrando o cooldown no cancelamento): um canal "pausado"
  // voltaria a cuspir fogo no revive e manteria o bolt travado sem nada na tela
  // explicando por que.
  if (!extra.joined || !player.alive || extra.downed) {
    settleBreathChannel(state, slot, events);
    // Cair com o gatilho apertado nao deixa os canos girando para sempre.
    if (extra.joined) stepMinigun(state, slot, false, events);
    return;
  }

  // Pedra do Bruiser interrompe movimento e todas as acoes. Timers do mundo e
  // dos modulos continuam correndo; o stun nao pausa a simulacao. O canal do
  // sopro e interrompido DE VEZ, como a esquiva — com ele cai o bloqueio de
  // disparo, que so existe enquanto ha chama saindo, e o cooldown comeca a
  // correr do instante da interrupcao.
  if (player.stunnedUntil > state.tick) {
    player.vx = 0;
    player.vy = 0;
    extra.dodgeUntil = Math.min(extra.dodgeUntil, state.tick);
    settleBreathChannel(state, slot, events);
    extra.heat = Math.max(0, extra.heat - tuning.heatDecayPerTick);
    stepFreezeDecay(state, slot);
    // A pedra do Britador para o gatilho, e os canos DESACELERAM enquanto o
    // Prospector esta atordoado — com a fase e o evento saindo normalmente,
    // para o som do motor descer junto em vez de congelar no ar.
    stepMinigun(state, slot, false, events);
    return;
  }

  // O FRIO. O decaimento natural corre para todo Prospector em campo, antes
  // de qualquer coisa que o gatilho faca neste tick; travado, ele nao corre
  // (ver `stepFreezeDecay`).
  stepFreezeDecay(state, slot);

  // Escolha privada do slot: idempotente e nao pausa movimento/simulacao.
  if (cmd.choose !== null && extra.pendingModuleChoice) {
    const pending = extra.pendingModuleChoice;
    const picked = pending.options[cmd.choose];
    const recharged = Boolean(activeModule(extra, picked));
    grantOrRechargeModule(extra, picked, state.tick);
    extra.pendingModuleChoice = null;
    // So conta modulo NOVO. Recarga e a mesma peca ganhando cargas de volta, e
    // somar as duas faria "modulos adquiridos" premiar quem repetiu a escolha.
    if (!recharged) state.stats.modulesAcquired += 1;
    events.push({
      t: 'module_selected',
      slot,
      module: picked,
      sourceSiteId: pending.sourceSiteId,
      recharged,
    });
  }

  // CONGELADO POR INTEIRO. A estatua nao anda, nao gira, nao esquiva, nao
  // interage e nao usa habilidade; o cano nao dispara. O que resta e o
  // gatilho, e ele faz outra coisa aqui: forca o motor por baixo do gelo.
  if (extra.frostbitten) {
    stepFrostbitten(state, slot, cmd, events);
    return;
  }

  // mira e rumo visual. `extra.aim` e a MIRA (bolts e sopro saem por ela);
  // `player.facing` e para onde o corpo olha. Mira nova comanda os dois.
  const aimLen = Math.hypot(cmd.aim.x, cmd.aim.y);
  const moveInputLen = Math.hypot(cmd.move.x, cmd.move.y);
  if (aimLen > 0.01) {
    extra.aim.x = cmd.aim.x / aimLen;
    extra.aim.y = cmd.aim.y / aimLen;
    player.facing.x = extra.aim.x;
    player.facing.y = extra.aim.y;
  } else if (moveInputLen > 0.01 && state.tick >= extra.channelingUntil) {
    // Sem mira neste tick, ANDAR vira o rumo do corpo — e parar preserva a
    // ultima direcao USADA, seja ela de mira ou de movimento. So o facing:
    // a mira persistida fica intacta, senao caminhar depois de apontar
    // redirecionaria o proximo bolt para onde os pes foram. Durante o canal
    // do sopro o corpo pertence a chama: mover nao gira o tronco.
    player.facing.x = cmd.move.x / moveInputLen;
    player.facing.y = cmd.move.y / moveInputLen;
  }

  // esquiva
  if (cmd.dodge && state.tick >= extra.dodgeCooldownUntil) {
    const moveLen = Math.hypot(cmd.move.x, cmd.move.y);
    const dir =
      moveLen > 0.01
        ? { x: cmd.move.x / moveLen, y: cmd.move.y / moveLen }
        : { x: player.facing.x, y: player.facing.y };
    extra.dodgeDir = dir;
    extra.dodgeUntil = state.tick + DODGE_TICKS;
    extra.iframesUntil = state.tick + tuning.dodgeIframeTicks;
    extra.dodgeCooldownUntil = state.tick + tuning.dodgeCooldownTicks;
    events.push({ t: 'dodge', x: player.x, y: player.y });
  }

  // movimento. `vx/vy` guarda deslocamento REAL para a mira preditiva do
  // Bruiser, em vez de assumir que o comando atravessou uma parede.
  const beforeMoveX = player.x;
  const beforeMoveY = player.y;
  if (state.tick < extra.dodgeUntil) {
    moveEntity(
      state,
      player,
      extra.dodgeDir.x * DODGE_SPEED * dt,
      extra.dodgeDir.y * DODGE_SPEED * dt,
    );
  } else if (isIceSurface(state.surface[cellUnder(state, player)])) {
    // INERCIA DO GELO: o pe nao morde a lamina. O rumo comandado entra aos
    // poucos na velocidade real, e soltar o direcional NAO para na hora — o
    // Prospector desliza ate o atrito residual vencer. `vx/vy` ja e o
    // deslocamento REAL do tick anterior (pos-colisao), entao bater na parede
    // zera o embalo sozinho, sem caso especial. Fora do gelo nada muda: o
    // ramo historico abaixo segue byte a byte.
    //
    // QUALQUER ESTAGIO RACHADO E GELO aqui. A rachadura muda o que a celula aguenta,
    // nunca o que ela faz com os pes: um piso que parasse de escorregar ao
    // rachar recompensaria gastar a propria rota, que e o oposto do loop.
    const moveLen = Math.hypot(cmd.move.x, cmd.move.y);
    let desiredX = 0;
    let desiredY = 0;
    if (moveLen > 0.01) {
      const clamped = Math.min(1, moveLen);
      const speed = tuning.moveSpeed * playerSurfaceSpeedMul(state, player, tuning);
      desiredX = (cmd.move.x / moveLen) * clamped * speed;
      desiredY = (cmd.move.y / moveLen) * clamped * speed;
    }
    // A inercia sai de `iceGlideFor`: o tuning interpola entre a lamina de
    // fabrica (~2,5 tiles de frenagem) e a estabilizada por MV-04 (~0,98). A
    // conta vive na progressao porque a arena e os testes precisam da MESMA
    // resposta sem reimplementa-la.
    // Circuito fechado na Cripta: a inercia da lamina some junto com o degelo.
    const glide = isGlacialStabilised(state) ? 0 : iceGlideFor(tuning);
    // O embalo QUE ENTRA no gelo e limitado: a esquiva sai a DODGE_SPEED (11
    // tiles/s) e sem teto ela viraria transporte — quase seis tiles de deslize
    // por toque, encadeaveis. Com teto ela continua carregando momento (sai
    // mais longe do que sairia no chao seco) e satura em vez de acumular.
    const carried = Math.hypot(player.vx, player.vy);
    const carryScale = carried > ICE_MOMENTUM_CAP ? ICE_MOMENTUM_CAP / carried : 1;
    const vx = player.vx * carryScale * glide + desiredX * (1 - glide);
    const vy = player.vy * carryScale * glide + desiredY * (1 - glide);
    if (Math.hypot(vx, vy) > ICE_GLIDE_EPSILON) moveEntity(state, player, vx * dt, vy * dt);
  } else {
    const moveLen = Math.hypot(cmd.move.x, cmd.move.y);
    if (moveLen > 0.01) {
      const clamped = Math.min(1, moveLen);
      const nx = (cmd.move.x / moveLen) * clamped;
      const ny = (cmd.move.y / moveLen) * clamped;
      const speed = tuning.moveSpeed * playerSurfaceSpeedMul(state, player, tuning);
      moveEntity(state, player, nx * speed * dt, ny * speed * dt);
    }
  }
  player.vx = (player.x - beforeMoveX) / dt;
  player.vy = (player.y - beforeMoveY) / dt;

  // A CARGA SOBRE O GELO. Depois do movimento e antes de tudo o mais: se o chao
  // cedeu, este Prospector saiu de campo e nada abaixo (calor, habilidade,
  // gatilho) deve rodar para um corpo que ja afundou.
  applyIceLoad(state, slot, beforeMoveX, beforeMoveY, events);
  if (!player.alive) return;

  // extracao so libera depois de deixar a zona de entrada uma vez
  if (!state.leftEntryZone) {
    const distFromEntry = Math.hypot(
      player.x - (state.entry.x + 0.5),
      player.y - (state.entry.y + 0.5),
    );
    if (distFromEntry > 4) state.leftEntryZone = true;
  }

  decayHeat(state, slot);

  // Canal do sopro que chegou ao proprio fim: liquida ANTES do gate de cast —
  // o cooldown recem-cobrado ja bloqueia um recast neste mesmo tick, e o
  // gatilho do bolt (que le `channeling` abaixo) destrava imediatamente.
  if (extra.channelingUntil !== 0 && state.tick >= extra.channelingUntil) {
    settleBreathChannel(state, slot, events);
  }

  // habilidade. Vem ANTES do gatilho: um cast de sopro no mesmo tick do disparo
  // ja trava o bolt daquele tick, em vez de deixar escapar um ultimo tiro.
  if (
    cmd.ability &&
    state.tick >= extra.abilityCooldownUntil &&
    state.tick >= extra.channelingUntil
  ) {
    // O sopro cobra o cooldown no FIM do canal (`settleBreathChannel`); as
    // habilidades instantaneas cobram aqui, onde o efeito inteiro acontece.
    // Arredondado para TICK inteiro: cooldown fracionario faria a comparacao
    // `state.tick >= until` depender de acumulo de float ao longo da run.
    if (extra.ability !== 'flamethrower') {
      extra.abilityCooldownUntil =
        state.tick +
        Math.round(abilityDefinition(extra.ability).cooldownTicks * tuning.abilityCooldownScale);
    }
    castAbility(state, slot, events);
  }

  // Canalizacao do sopro: a simulacao emite chama por conta propria, no ritmo
  // do intervalo, sempre lendo a mira ATUAL — o jogador redireciona o jato
  // durante a habilidade. A fase vem de `channelingUntil`, entao a primeira
  // emissao sai no proprio tick do cast.
  const channeling = state.tick < extra.channelingUntil;
  if (channeling && (extra.channelingUntil - state.tick) % FLAMETHROWER_EMIT_INTERVAL_TICKS === 0) {
    emitFlameBreath(state, slot, events);
  }

  // CANHAO ROTATIVO. Vem antes do gatilho comum e devolve `true` quando ele
  // esta com a arma: a Minigun nao MODIFICA o tiro, ela OCUPA o gatilho (ver
  // a matriz de compatibilidade em `modules.ts`). O passo tambem roda com a
  // arma ja gasta, para os canos DESACELERAREM em vez de parar no ar.
  const minigunHoldsTrigger = stepMinigun(state, slot, Boolean(cmd.fire) && !channeling, events);

  // disparo principal. `!channeling` e o bloqueio AUTORITATIVO do bolt durante
  // o sopro: a tentativa barrada nao arma modulo, nao gera calor e nao toca em
  // `nextShotAt` — nada e consumido, e nada fica enfileirado para depois. O
  // bloqueio morre junto com o canal, inclusive quando ele e cancelado.
  if (
    cmd.fire &&
    !channeling &&
    !minigunHoldsTrigger &&
    state.tick >= extra.nextShotAt &&
    state.tick >= extra.overheatedUntil &&
    state.projectiles.length < MAX_PROJECTILES
  ) {
    extra.nextShotAt = state.tick + BOLT_COOLDOWN_TICKS;
    extra.heat += HEAT_PER_SHOT;
    // O tiro de verdade tambem derrete o gelo residual de quem ja se soltou:
    // e o mesmo calor novo, so que agora saindo pelo cano.
    meltFreezeByHeat(extra, HEAT_PER_SHOT);

    // O disparo apenas ARMA os modulos ativos; nenhuma carga e debitada aqui.
    // Cobrar no gatilho punia o tiro que errava tudo — e, pior, obrigava o
    // Return Disc a ser um caminho alternativo (`if disco else bolt`), o que
    // fazia ele engolir em silencio todos os outros modulos equipados. Aqui ele
    // e so mais uma flag: decide o VEICULO, e o resto viaja junto.
    const modules: NonNullable<SurvivalState['projectiles'][number]['modules']> = {};
    if (moduleHasCapacity(extra, 'piercing', state.tick)) modules.piercing = true;
    if (moduleHasCapacity(extra, 'explosive', state.tick)) {
      modules.explosive = { armAfterDistance: EXPLOSIVE_ARM_DISTANCE };
    }
    if (moduleHasCapacity(extra, 'ricochet', state.tick)) {
      modules.ricochet = { remainingBounces: RICOCHET_BOUNCES };
    }
    if (moduleHasCapacity(extra, 'conductive', state.tick)) modules.conductive = true;
    if (moduleHasCapacity(extra, 'siphon', state.tick)) modules.siphon = true;
    const armed = Object.keys(modules).length > 0 ? modules : undefined;

    if (moduleHasCapacity(extra, 'return_disc', state.tick)) {
      state.projectiles.push({
        kind: 'return_disc',
        id: state.nextEntityId++,
        owner: player.id,
        x: player.x + extra.aim.x * 0.45,
        y: player.y + extra.aim.y * 0.45,
        vx: extra.aim.x * RETURN_DISC_SPEED,
        vy: extra.aim.y * RETURN_DISC_SPEED,
        damage: playerDamage(tuning, BOLT_DAMAGE * 0.85),
        modules: armed,
        distanceTravelled: 0,
        disc: {
          phase: 'outbound',
          travelled: 0,
          maxDistance: RETURN_DISC_MAX_DISTANCE,
          outboundHits: [],
          returnHits: [],
        },
        hostile: false,
        leavesBiofluid: false,
        ttl: Math.ceil(TICK_HZ * 3),
      });
    } else {
      state.projectiles.push({
        kind: 'bolt',
        id: state.nextEntityId++,
        owner: player.id,
        x: player.x + extra.aim.x * 0.4,
        y: player.y + extra.aim.y * 0.4,
        vx: extra.aim.x * BOLT_SPEED * tuning.projectileSpeedScale,
        vy: extra.aim.y * BOLT_SPEED * tuning.projectileSpeedScale,
        damage: playerDamage(tuning, BOLT_DAMAGE),
        modules: armed,
        distanceTravelled: 0,
        hostile: false,
        leavesBiofluid: false,
        ttl: Math.ceil(TICK_HZ * 1.4),
      });
    }
    events.push({
      t: 'action_start',
      entity: player.id,
      action: 'player_shot',
      x: player.x,
      y: player.y,
      dx: extra.aim.x,
      dy: extra.aim.y,
      startTick: state.tick,
      releaseTick: state.tick,
      endTick: state.tick + 7,
    });
    events.push({
      t: 'shot',
      x: player.x,
      y: player.y,
      dx: extra.aim.x,
      dy: extra.aim.y,
      owner: player.id,
    });
    state.stats.shotsFired += 1;
    settleOverheat(state, slot, events);
  }

  // Celula de Purga: cartucho interno de cura e descontaminacao LOCAL.
  //
  // "Local" e a palavra que falta na promessa: ela cura, e limpa gas e esporos
  // no raio — mas nao encosta em `state.contamination`, a barra global que de
  // fato encerra a run. E o que faz da contaminacao o unico sistema de pressao
  // do jogo sem contrajogada nenhuma: ela sobe, acelera por setor, dobra com o
  // Nucleo, e a unica resposta disponivel e andar mais rapido.
  //
  // Nao foi decidido contra — nunca chegou a ser decidido. Poe-la para cortar
  // uma fracao da barra e uma linha aqui; o trabalho todo e de calibragem, e a
  // economia de celulas (um cofre por site, tres sites por setor, setor
  // regenerado na subida) e o que decide se a ideia funciona. Numeros medidos,
  // faixa a testar e riscos em
  // docs/audit/2026-08-31-contaminacao-em-aberto.md §1.
  if (cmd.purge && extra.purgeCells > 0) {
    extra.purgeCells--;
    player.hp = Math.min(player.maxHp, player.hp + PURGE_CELL_HEAL);
    const w = state.config.width;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    for (let y = py - PURGE_CELL_RADIUS; y <= py + PURGE_CELL_RADIUS; y++) {
      for (let x = px - PURGE_CELL_RADIUS; x <= px + PURGE_CELL_RADIUS; x++) {
        if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
        const i = y * w + x;
        if (state.surface[i] === SURF_GAS || state.surface[i] === SURF_SPORES) {
          setSurface(state, i, SURF_NONE, 0);
        }
      }
    }
    events.push({ t: 'purge_cell_used', slot, x: player.x, y: player.y });
    state.stats.purgeCellsUsed += 1;
  }

  // interagir: revive parceiro > nucleo > terminal/cofre > extracao > juncao
  if (cmd.interact) {
    // co-op: reviver parceiro abatido proximo tem prioridade
    if (coop) {
      for (let other = 0; other < state.players.length; other++) {
        if (other === slot) continue;
        const op = state.players[other];
        const oe = state.playerExtras[other];
        if (!oe.joined || !op.alive || !oe.downed) continue;
        if (Math.hypot(player.x - op.x, player.y - op.y) <= REVIVE_RADIUS) {
          oe.downed = false;
          oe.bleedoutAt = 0;
          clearFreeze(oe);
          op.hp = Math.max(1, Math.floor(op.maxHp * REVIVE_HP_FRACTION));
          events.push({ t: 'revive', x: op.x, y: op.y, slot: other, tick: state.tick });
          state.stats.revivesGiven += 1;
          events.push({ t: 'message', key: 'sim.partnerRevived' });
          return;
        }
      }
    }

    // Pegar a habilidade que um Eco demonstra tem prioridade sobre descer: os dois
    // acontecem ao lado do poco, e quem apertou usar em cima de um Eco quis o Eco.
    // Sem esta ordem, chegar perto do poco tornaria impossivel aceitar a oferta.
    for (const offer of state.wellOffers) {
      if (offer.takenBy !== null) continue;
      if (Math.hypot(player.x - offer.x, player.y - offer.y) > WELL_OFFER_REACH) continue;
      offer.takenBy = slot;
      extra.ability = offer.ability;
      // O cooldown zera na troca. Herdar o cooldown da habilidade antiga puniria
      // justamente quem acabou de usar a que tinha para chegar vivo ate aqui.
      extra.abilityCooldownUntil = state.tick;
      // Um canal de sopro em andamento morre junto com a habilidade antiga:
      // continuar cuspindo chama de uma habilidade que o slot nao tem mais
      // deixaria o bolt travado por um estado orfao. Descartado DIRETO, sem
      // `settleBreathChannel`: a troca zera o cooldown por design, e cobrar
      // para zerar na linha de cima seria contradicao morta. O cliente ainda
      // recebe o `action_end` — a pose prometida pelo cast morre junto.
      if (extra.channelingUntil > state.tick) {
        events.push({ t: 'action_end', entity: player.id });
      }
      extra.channelingUntil = 0;
      // As outras ofertas somem: a escolha e UMA, e um Eco que continua ali
      // depois de voce escolher convida a voltar e trocar de novo.
      for (const other of state.wellOffers) {
        if (other.takenBy === null) other.takenBy = slot;
      }
      events.push({ t: 'ability_taken', slot, ability: offer.ability, x: offer.x, y: offer.y });
      return;
    }

    // O mesmo ponto significa coisas diferentes conforme a CONFIGURACAO da run:
    // pedestal do Nucleo, poco de descida, ou os dois (setor de Nucleo
    // intermediario). O bloco abaixo resolve nesta ordem.
    const distCore = Math.hypot(
      player.x - (state.corePos.x + 0.5),
      player.y - (state.corePos.y + 0.5),
    );
    if (distCore < 1.6) {
      // O PEDESTAL vem antes do poco.
      //
      // Nos setores de Nucleo intermediario (G-03 e G-04, setor 3) os dois
      // moram no mesmo ponto, e a ordem importa: quem chega la quer o Nucleo
      // que veio buscar, e descer sem ele por causa de uma interacao ambigua
      // seria perder a coleta atras de um mapa que nao volta. Recolher primeiro
      // e descer na SEGUNDA interacao e a leitura que o jogador ja tem.
      if (hasCoreHere(state) && !isCoreTaken(state, state.sector)) {
        if (!coreUnlocked(state)) {
          // Selado. O cliente nem consegue forcar: a recusa e autoritativa e
          // acontece aqui, no unico ponto que escreve a posse.
          events.push({ t: 'message', key: 'sim.coreSealedByBoss', slot });
          return;
        }
        markCoreTaken(state, state.sector);
        extra.carriedCoreMask |= 1 << state.sector;
        extra.hasCore = true;
        events.push({
          t: 'pickup_core',
          x: player.x,
          y: player.y,
          sector: state.sector,
          taken: countCoresTaken(state),
          total: coresAvailable(state),
        });
        // Duas mensagens diferentes para duas situacoes diferentes. Com Veio
        // abaixo, o Nucleo na mao NAO encerra nada — dizer "volte a superficie"
        // ali mandaria o jogador embora no meio da run que ele pagou para ver.
        events.push({
          t: 'message',
          key: isRunFinalSector(state) ? 'sim.coreTaken' : 'sim.coreTakenDeeper',
        });
        return;
      }

      if (isRunFinalSector(state)) return;

      // Com o Nucleo MAIS FUNDO na mao o poco SELOU: descer de novo nao
      // existe. O caminho de volta sai por onde se entrou — a ENTRADA do
      // setor. Antes disso (um Nucleo intermediario na carga) descer continua
      // liberado: recolhe-lo e uma aposta no meio da descida, nao o fim dela.
      if (runIsReturning(state)) {
        events.push({ t: 'message', key: 'sim.wellSealedReturn', slot });
        return;
      }

      // O SELO DO SETOR. Nada de "mate todos os inimigos": so o dono do setor
      // tranca o poco, e so enquanto ele estiver de pe.
      if (!descentUnlocked(state)) {
        events.push({ t: 'message', key: 'sim.descentSealedByBoss', slot });
        return;
      }

      // Descida COLETIVA, pela mesma razao da extracao: um parceiro deixado
      // para tras num mapa que deixou de existir nao teria como ser resgatado.
      const standing = standingPlayers(state);
      const allNear = standing.every(
        (p) =>
          Math.hypot(p.x - (state.corePos.x + 0.5), p.y - (state.corePos.y + 0.5)) <=
          EXTRACT_RADIUS,
      );
      const anyDowned = state.playerExtras.some(
        (e, i) => e.joined && state.players[i].alive && e.downed,
      );
      if (anyDowned) {
        events.push({ t: 'message', key: 'sim.reviveBeforeDescend', slot });
      } else if (!allNear) {
        events.push({ t: 'message', key: 'sim.waitAtShaft', slot });
      } else {
        // Canal de sopro atravessando a descida e liquidado ANTES: o cooldown
        // cobrado sobrevive a transicao, senao descer no meio do canal seria o
        // unico jeito de sopro sem preco.
        for (let s = 0; s < state.playerExtras.length; s++) settleBreathChannel(state, s, events);
        descend(state, events);
      }
      return;
    }
    for (const site of state.salvageSites) {
      const terminalDistance = Math.hypot(
        player.x - (site.terminal.x + 0.5),
        player.y - (site.terminal.y + 0.5),
      );
      if (site.terminalState === 'inactive' && terminalDistance < 1.45) {
        site.terminalState = 'scanning';
        site.scanEndsAt = state.tick + SALVAGE_SCAN_TICKS;
        events.push({
          t: 'terminal_activated',
          siteId: site.id,
          x: site.terminal.x,
          y: site.terminal.y,
          completesAtTick: site.scanEndsAt,
        });
        const offsets = [
          [-3, 0],
          [3, 0],
          [0, -3],
          [0, 3],
          [-2, -2],
          [2, 2],
        ] as const;
        let spawned = 0;
        for (let i = 0; i < offsets.length && spawned < 2 + site.tier; i++) {
          const [dx, dy] = offsets[(i + site.id) % offsets.length];
          const x = site.terminal.x + dx;
          const y = site.terminal.y + dy;
          if (x < 1 || y < 1 || x >= state.config.width - 1 || y >= state.config.height - 1)
            continue;
          if (state.solid[y * state.config.width + x] !== SOLID_NONE) continue;
          spawnEnemy(state, spawned === 0 && site.tier > 1 ? 'spitter' : 'stalker', x, y, false);
          spawned++;
        }
        return;
      }

      const cacheDistance = Math.hypot(
        player.x - (site.cache.x + 0.5),
        player.y - (site.cache.y + 0.5),
      );
      if (site.cacheRevealed && !site.cacheOpened && cacheDistance < 1.35) {
        site.cacheOpened = true;
        site.openedBySlot = slot;
        extra.purgeCells++;
        const options = rollModuleChoice(state.config.seed, site.id, site.tier, extra, state.tick);
        extra.pendingModuleChoice = {
          sourceSiteId: site.id,
          options,
          createdAtTick: state.tick,
        };
        events.push({
          t: 'salvage_cache_opened',
          siteId: site.id,
          slot,
          x: site.cache.x,
          y: site.cache.y,
        });
        events.push({ t: 'purge_cell_acquired', slot, amount: 1 });
        return;
      }
    }
    // extracao coletiva: todos os players de pe precisam estar na zona de entrada
    const distEntry = Math.hypot(
      player.x - (state.entry.x + 0.5),
      player.y - (state.entry.y + 0.5),
    );
    if (distEntry < 1.6 && state.leftEntryZone) {
      const allAtEntry = standingPlayers(state).every(
        (p) =>
          Math.hypot(p.x - (state.entry.x + 0.5), p.y - (state.entry.y + 0.5)) <= EXTRACT_RADIUS,
      );
      const anyDowned = state.playerExtras.some(
        (e, i) => e.joined && state.players[i].alive && e.downed,
      );
      const withCore = state.playerExtras.some((e) => e.hasCore);
      const cores = countCoresTaken(state);
      // Com o NUCLEO, a entrada de um setor profundo nao extrai: ela SOBE. O
      // contrato so fecha na plataforma do setor 1 — cada setor tem de ser
      // atravessado de novo, ao contrario, com a contaminacao cobrando o
      // dobro. Sem o nucleo, abandonar o contrato continua possivel em
      // qualquer profundidade, como sempre foi.
      if (withCore && state.sector > 1) {
        if (anyDowned) {
          events.push({ t: 'message', key: 'sim.reviveBeforeExtract', slot });
        } else if (!allAtEntry) {
          events.push({ t: 'message', key: 'sim.waitAtExit', slot });
        } else {
          // Mesma regra da descida: o preco do canal nao some na subida.
          for (let s = 0; s < state.playerExtras.length; s++) settleBreathChannel(state, s, events);
          ascend(state, events);
        }
        return;
      }
      if (allAtEntry && !anyDowned) {
        state.phase = withCore ? 'extracted_with_core' : 'extracted';
        events.push({ t: 'extracted', withCore, cores });
      } else if (anyDowned) {
        events.push({ t: 'message', key: 'sim.reviveBeforeExtract', slot });
      } else {
        events.push({ t: 'message', key: 'sim.waitAtExit', slot });
      }
      // O return que faltava: sem ele, um no de leyline por acaso colado na
      // entrada toggle-aria JUNTO com a mensagem de "aguarde na saida".
      return;
    }

    // JUNCAO DE LEYLINE — o ultimo alvo da cadeia, de proposito: a juncao e
    // parede e nao disputa espaco com objetivo nenhum, mas o ultimo lugar
    // GARANTE que rotear nunca rouba um interact de revive, poco, terminal,
    // cofre ou extracao. O toggle e persistente ate a troca de setor; dois
    // jogadores togglando no mesmo tick fazem liga-e-desliga com dois eventos
    // (slot 0 age primeiro, como em toda a cadeia) — comportamento aceito e
    // testado, nao defendido. Nenhuma descoberta aqui: o bit e do RELE
    // efetivo (stepLeylines), nao do aperto de botao.
    for (let n = 0; n < state.leylineNodes.length; n++) {
      const node = state.leylineNodes[n];
      const nx = (node.cell % state.config.width) + 0.5;
      const ny = Math.floor(node.cell / state.config.width) + 0.5;
      if (Math.hypot(player.x - nx, player.y - ny) > LEYLINE_NODE_INTERACT_RADIUS) continue;
      // A NASCENTE tem outro verbo: ela LANCA a cascata do circuito em vez de
      // togglar o proprio rele. Uma tecla, um verbo — e a nascente ja nasce
      // roteada (deriveLeylineNetwork), entao nao ha nada para togglar nela.
      //
      // Este e o ponto que tira a leyline de tras do modulo Conductive: lancar
      // nao cobra item, carga nem desbloqueio. Quem entrou no setor pode
      // acender a rede.
      if (n === state.leylineCircuit.sourceNode) {
        launchCircuit(state, player, events);
        return;
      }
      node.routed = !node.routed;
      events.push({ t: 'leyline_routed', node: n, x: nx, y: ny, routed: node.routed, slot });
      return;
    }
  }
};

/**
 * Cobra uma carga do modulo porque o efeito dele ACONTECEU agora.
 *
 * O disparo apenas arma; quem paga e o proc. Cobrar no gatilho fazia o jogador
 * gastar Piercing num tiro que saiu pela porta e Explosive num tiro que nao
 * encostou em nada — o custo vinha antes de existir beneficio. Falso quando o
 * modulo nao esta ativo ou ficou sem carga entre o disparo e este instante, e
 * ai o efeito simplesmente nao ocorre.
 */
const procModule = (
  state: SurvivalState,
  extra: PlayerExtra | undefined,
  slot: number | undefined,
  id: ModuleId,
  events: SemanticEvent[],
): boolean => {
  if (!extra || slot === undefined) return false;
  if (!moduleHasCapacity(extra, id, state.tick)) return false;
  // Modulo por tempo vale enquanto durar: nao ha carga a debitar.
  if (activeModule(extra, id)?.lifetime.kind === 'timer') return true;
  return consumeModuleCharge(extra, id, slot, events);
};

/** O projetil ainda tem rebote sobrando neste voo? */
const canBounce = (proj: Projectile): boolean =>
  (proj.modules?.ricochet?.remainingBounces ?? 0) > 0;

/**
 * O disco iniciou a volta — e AQUI que o Return Disc entrega o que promete, e
 * portanto e aqui que ele cobra. Um disco que explodiu na ida nunca voltou, e
 * nao deve ser cobrado por isso.
 *
 * A volta acontece mesmo se a carga acabou nesse meio-tempo: o disco ja esta em
 * voo e some-lo no ar seria confuso. A folga cai a favor do jogador.
 */
const beginDiscReturn = (
  state: SurvivalState,
  proj: Projectile,
  extra: PlayerExtra | undefined,
  slot: number | undefined,
  events: SemanticEvent[],
): void => {
  if (!proj.disc || proj.disc.phase === 'returning') return;
  proj.disc.phase = 'returning';
  procModule(state, extra, slot, 'return_disc', events);
};

/**
 * Reflete o projetil na face por onde ele ENTROU na celula solida e devolve-o a
 * posicao anterior.
 *
 * Quem chama isto tem de chamar DEPOIS de `impactSolid`. Testar o rebote antes
 * fazia do Ricochet um desligador silencioso da escavacao: a primeira parede de
 * cada tiro saia intacta, porque o projetil ja tinha voltado antes de o
 * material poder reagir. Destruir terreno e mecanica central, e um modulo de
 * tier 1 anunciado como "seguro" nao pode desligar isso sem avisar.
 */
const bounceOffSolid = (
  proj: Projectile,
  prevX: number,
  prevY: number,
  cx: number,
  cy: number,
): void => {
  const enteredX = Math.floor(prevX) !== cx;
  const enteredY = Math.floor(prevY) !== cy;
  if (enteredX) proj.vx *= -1;
  if (enteredY) proj.vy *= -1;
  if (!enteredX && !enteredY) {
    if (Math.abs(proj.vx) >= Math.abs(proj.vy)) proj.vx *= -1;
    else proj.vy *= -1;
  }
  proj.x = prevX;
  proj.y = prevY;
  const ricochet = proj.modules?.ricochet;
  if (ricochet) ricochet.remainingBounces--;
};

/**
 * Ponto de contato do projetil na FACE por onde ele entrou na celula solida
 * (cx,cy), mais a normal dessa face. Mesma heuristica de face de
 * `bounceOffSolid`; o ponto e a interseccao do segmento prev->pos com o plano
 * da face, entao o burst de impacto nasce NA superficie da parede — nem dentro
 * dela, nem no centro da celula errada, nem na posicao anterior do projetil.
 */
export const solidImpactPoint = (
  prevX: number,
  prevY: number,
  x: number,
  y: number,
  cx: number,
  cy: number,
): { x: number; y: number; nx: number; ny: number } => {
  const enteredX = Math.floor(prevX) !== cx;
  const enteredY = Math.floor(prevY) !== cy;
  const dx = x - prevX;
  const dy = y - prevY;
  let tx = Number.POSITIVE_INFINITY;
  let ty = Number.POSITIVE_INFINITY;
  if (enteredX && dx !== 0) tx = ((dx > 0 ? cx : cx + 1) - prevX) / dx;
  if (enteredY && dy !== 0) ty = ((dy > 0 ? cy : cy + 1) - prevY) / dy;
  if (!Number.isFinite(tx) && !Number.isFinite(ty)) {
    // Projetil que ja NASCEU dentro do solido (tiro colado na parede): a ultima
    // posicao livre e o contato honesto, com a normal contra o rumo dominante.
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    return {
      x: prevX,
      y: prevY,
      nx: horizontal ? -Math.sign(dx) || 1 : 0,
      ny: horizontal ? 0 : -Math.sign(dy) || 1,
    };
  }
  // ENTRADA POR QUINA: vale a ULTIMA travessia, e nao a primeira.
  //
  // Quando um sub-passo cruza a linha de x E a de y antes de terminar dentro da
  // celula solida, cada travessia leva o projetil para uma celula diferente. Na
  // primeira delas ele entra numa VIZINHA — que quase sempre esta vazia, senao
  // a colisao teria sido com ela — e so na segunda entra na celula com que de
  // fato colidiu. O ponto de contato e, portanto, o de MAIOR `t`.
  //
  // Isto ja estava errado quando o ponto so posicionava o burst de plasma (o
  // clarao abria na celula ao lado, meio tile fora do lugar em que o tiro
  // visivelmente bateu). Passou a importar de verdade quando o mesmo ponto
  // virou o CENTRO da detonacao do bolt explosivo: o centro decide quais
  // celulas quebram e acendem, e um centro na celula errada e um buraco
  // diferente no mapa — estado autoritativo, nao decoracao.
  //
  // `Math.max` cru nao serve: o eixo que NAO foi cruzado vale infinito, e o
  // maximo entre um finito e infinito e infinito. So ha ultima travessia
  // quando ha duas travessias.
  const corner = Number.isFinite(tx) && Number.isFinite(ty);
  const entry = corner ? Math.max(tx, ty) : Math.min(tx, ty);
  const t = Math.max(0, Math.min(1, entry));
  const ix = prevX + dx * t;
  const iy = prevY + dy * t;
  // A normal e a da face cruzada NESSE instante. Fora da quina e a unica face
  // cruzada; na quina, a de maior `t` — a que o projetil atravessou por ultimo.
  const throughX = corner ? tx >= ty : Number.isFinite(tx);
  if (throughX) return { x: ix, y: iy, nx: dx > 0 ? -1 : 1, ny: 0 };
  return { x: ix, y: iy, nx: 0, ny: dy > 0 ? -1 : 1 };
};

const stepProjectiles = (state: SurvivalState, events: SemanticEvent[]): void => {
  const dt = 1 / TICK_HZ;
  const w = state.config.width;
  const survivors: typeof state.projectiles = [];

  for (const proj of state.projectiles) {
    let dead = false;
    proj.ttl--;
    if (proj.ttl <= 0) {
      if (proj.leavesBiofluid) {
        const i = cellIndexAt(state, proj.x, proj.y);
        if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
          setSurface(state, i, SURF_BIOFLUID, 0);
        }
      }
      continue;
    }

    const owner = state.players.find((player) => player.id === proj.owner);
    const ownerSlot = owner?.slot;
    const ownerExtra = ownerSlot === undefined ? undefined : state.playerExtras[ownerSlot];
    const origin = proj.hostile
      ? { source: 'enemy' as const, owner: proj.owner }
      : owner
        ? { source: 'player' as const, owner: proj.owner }
        : { source: 'environment' as const };

    // O drone rastreador CORRIGE o rumo, e nao aponta.
    //
    // A correcao e limitada por tick, e e isso que o impede de ser infalivel:
    // contra um alvo que muda de direcao ele erra a curva e passa reto. Acertar
    // exige lancar quando o inimigo esta comprometido — que e a decisao que a
    // habilidade cobra em troca do dano alto.
    // O CICLONE acende o que atravessa, e e ai que mora o perigo dele.
    //
    // O corpo passa e vai embora; o rastro FICA. E a diferenca entre um
    // projetil que o jogador desvia uma vez e um que reescreve a rota dele
    // pelo resto do encontro — que e o que "a sala virou fogo" quer dizer.
    //
    // `igniteCell` primeiro, como no resto do sistema termico: cada materia
    // tem a propria resposta ao calor, e o ciclone nao e a excecao que
    // atropela a tabela.
    if (proj.kind === 'cyclone') {
      const i = cellIndexAt(state, proj.x, proj.y);
      if (state.solid[i] === SOLID_NONE && !igniteCell(state, i, events)) {
        if (state.surface[i] === SURF_NONE) setSurface(state, i, SURF_EMBER, 200);
      }
    }

    if (proj.kind === 'seeker') {
      let target: Entity | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const d = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
        if (d < bestDistance) {
          target = enemy;
          bestDistance = d;
        }
      }
      if (target) {
        const desired = Math.atan2(target.y - proj.y, target.x - proj.x);
        const current = Math.atan2(proj.vy, proj.vx);
        // Diferenca angular normalizada para [-pi, pi]: sem isso o missil daria a
        // volta pelo lado longo sempre que a curva cruzasse +-180 graus.
        let delta = desired - current;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const turn = Math.max(-SEEKER_TURN_RATE, Math.min(SEEKER_TURN_RATE, delta));
        const heading = current + turn;
        const speed = Math.hypot(proj.vx, proj.vy) || SEEKER_SPEED;
        proj.vx = Math.cos(heading) * speed;
        proj.vy = Math.sin(heading) * speed;
      }
    }

    // Return Disc follows the owner's current position on the return leg.
    if (proj.disc?.phase === 'returning') {
      if (!owner || !ownerExtra?.joined || !owner.alive) continue;
      const dx = owner.x - proj.x;
      const dy = owner.y - proj.y;
      const length = Math.hypot(dx, dy);
      if (length < owner.radius + 0.35) continue;
      proj.vx = (dx / Math.max(length, 0.001)) * RETURN_DISC_SPEED;
      proj.vy = (dy / Math.max(length, 0.001)) * RETURN_DISC_SPEED;
    }

    // 2 sub-passos anti-tunelamento.
    for (let sub = 0; sub < 2 && !dead; sub++) {
      const prevX = proj.x;
      const prevY = proj.y;
      const stepX = proj.vx * dt * 0.5;
      const stepY = proj.vy * dt * 0.5;
      proj.x += stepX;
      proj.y += stepY;
      const travelled = Math.hypot(stepX, stepY);
      proj.distanceTravelled += travelled;
      if (proj.disc?.phase === 'outbound') {
        proj.disc.travelled += travelled;
        if (proj.disc.travelled >= proj.disc.maxDistance) {
          beginDiscReturn(state, proj, ownerExtra, ownerSlot, events);
        }
      }

      const cx = Math.floor(proj.x);
      const cy = Math.floor(proj.y);
      if (cx < 0 || cy < 0 || cx >= w || cy >= state.config.height) {
        if (proj.disc?.phase === 'outbound') {
          proj.x = prevX;
          proj.y = prevY;
          beginDiscReturn(state, proj, ownerExtra, ownerSlot, events);
          break;
        }
        dead = true;
        break;
      }
      const i = cy * w + cx;
      // Um tiro cuja carga acabou em pleno voo continua com a FLAG, mas nao pode
      // mais detonar. As duas capacidades tem de chegar em `projectileClass`
      // junto com a flag, senao o material reage a um fogo que nunca vem — e no
      // caso do gas sulfurico isso rendia uma explosao inteira de graca, porque
      // a ignicao nao passa pelo ponto que cobra o modulo.
      const explosiveArmed =
        explosiveArmedByDistance(proj) &&
        Boolean(ownerExtra && moduleHasCapacity(ownerExtra, 'explosive', state.tick));
      const conductiveReady = Boolean(
        proj.modules?.conductive &&
        ownerExtra &&
        moduleHasCapacity(ownerExtra, 'conductive', state.tick),
      );
      const cls = projectileClass(proj, conductiveReady, explosiveArmed);

      if (state.solid[i] !== SOLID_NONE) {
        // Explosive vem ANTES do disco: quem equipa os dois troca o retorno por
        // uma detonacao, e essa e a escolha — nao um dos dois sumindo em silencio.
        if (
          explosiveArmed &&
          !proj.hostile &&
          procModule(state, ownerExtra, ownerSlot, 'explosive', events)
        ) {
          // Detona NA FACE da parede, e nao na posicao crua do projetil.
          //
          // O sub-passo anda ate um terco de tile por vez, entao `proj.x/y` no
          // instante do teste ja esta DENTRO do bloco — e era ali que a explosao
          // nascia. O jogador via o estilhaco tocar a pedra e o clarao abrir
          // atras dela, meio tile adiante, com o anel de choque prometendo um
          // alcance deslocado do ponto de contato. `solidImpactPoint` e o mesmo
          // ponto que o `bolt_impact` do tiro comum ja usava: os dois fins de
          // voo passam a acontecer onde o tiro visivelmente parou.
          const contact = solidImpactPoint(prevX, prevY, proj.x, proj.y, cx, cy);
          explodeAt(state, contact.x, contact.y, EXPLOSION_RADIUS, events, origin);
          dead = true;
          break;
        }

        // O disco NA VOLTA atravessa terreno.
        //
        // Ele deixou de mirar uma direcao e passou a mirar uma PESSOA: a cada
        // tick o rumo e recalculado para a posicao do dono. Devolve-lo a celula
        // anterior quando encosta em pedra, como faz a ida, cria um laco fechado
        // — recalcula o rumo para o dono, anda para dentro da parede, volta para
        // onde estava, recalcula de novo — e o disco fica cravado na parede pelos
        // tres segundos inteiros de TTL antes de sumir. Basta o jogador recuar
        // uma esquina depois de arremessar, que e o uso normal da arma.
        //
        // Nao ha o que colidir na volta: o disco ja gastou a carga, ja cobrou o
        // modulo e nao machuca terreno em nenhuma das duas pernas. Deixa-lo
        // atravessar e o comportamento que a ferramenta promete — ela VOLTA — e o
        // unico que nao mente para quem contou com isso.
        if (proj.disc?.phase === 'returning') continue;

        if (proj.disc) {
          proj.x = prevX;
          proj.y = prevY;
          beginDiscReturn(state, proj, ownerExtra, ownerSlot, events);
          break;
        }

        const eventStart = events.length;
        const { stop, broke } = impactSolid(state, cx, cy, cls, events, origin);
        const impactEvents = events.slice(eventStart);
        const dischargedHere = impactEvents.some((event) => event.t === 'discharge');
        // Armar uma leyline cobra a carga do modulo como qualquer descarga: a
        // decisao eletrica do jogador aconteceu AQUI, no impacto — a descarga
        // em si so sai do relogio dali a LEYLINE_CHARGE_TICKS (stepLeylines).
        const armedLeylineHere = impactEvents.some((event) => event.t === 'leyline_charge');
        if (
          conductiveReady &&
          ownerExtra &&
          ownerSlot !== undefined &&
          (dischargedHere || armedLeylineHere)
        ) {
          consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events);
        }
        // Quebrar cristal dentro de uma poca E o jogador usando corrente, mesmo
        // que a descarga em si nasca com `source: 'environment'`. Aquela origem
        // existe para o ESCALONAMENTO DE DANO — cristal quebrado fere o proprio
        // Prospector sem o desconto de fogo amigo, que e a licao do material —, e
        // reaproveita-la como autoria diria que ninguem provocou nada.
        if (dischargedHere && origin.source === 'player') {
          recordPlayerResonance(state, origin.owner, 'current');
        }
        if (stop) {
          const pierces =
            broke &&
            Boolean(proj.modules?.piercing) &&
            procModule(state, ownerExtra, ownerSlot, 'piercing', events);
          if (!pierces) {
            // O rebote so acontece no que NAO cedeu. Se a parede quebrou,
            // refletir seria refletir num buraco recem-aberto — e o tiro ja fez
            // o que tinha a fazer ali.
            if (
              !broke &&
              canBounce(proj) &&
              procModule(state, ownerExtra, ownerSlot, 'ricochet', events)
            ) {
              bounceOffSolid(proj, prevX, prevY, cx, cy);
              break;
            }
            // O fim SILENCIOSO do bolt: parede firme que nao cedeu, sem rebote
            // sobrando e sem perfuracao — o unico termino que nao emitia evento
            // nenhum. O burst de plasma nasce aqui, uma unica vez, no ponto de
            // contato. Parede que QUEBROU ja tem `break` (entulho + som), e os
            // outros veiculos ficam de fora: explosive detonou antes, o disco
            // reverte, e cuspe/pedra hostis nao sao plasma de bolt.
            if (proj.kind === 'bolt' && !proj.hostile && !broke) {
              const impact = solidImpactPoint(prevX, prevY, proj.x, proj.y, cx, cy);
              events.push({
                t: 'bolt_impact',
                x: impact.x,
                y: impact.y,
                nx: impact.nx,
                ny: impact.ny,
              });
            }
            dead = true;
          }
        }
        break;
      }

      const surfaceBeforeImpact = state.surface[i];
      const heatsFungal =
        cls === 'thermal' &&
        (surfaceBeforeImpact === SURF_FUNGAL || surfaceBeforeImpact === SURF_FUNGAL_HEATED);
      const alreadyHeatedHere = heatsFungal && proj.heatedSurfaceCells?.includes(i);

      if (!alreadyHeatedHere) {
        const eventStart = events.length;
        const surfaceBeforeShot = state.surface[i];
        const consumedBySurface = impactSurface(state, cx, cy, cls, events, origin);
        // Fogo tem de ser GANHAVEL com o kit basico. Se so o proprio lanca-chamas
        // registrasse chama, ninguem sem lanca-chamas acumularia ressonancia de
        // fogo — e o poco jamais ofereceria a habilidade a quem passou o setor
        // inteiro secando fungo e tocando fogo com o bolt comum.
        //
        // Olha o CHAO e nao um evento: o fungo aquecido so vira chama varios ticks
        // depois, em `stepCells`, longe de qualquer coisa que saiba quem atirou.
        // O instante em que o material muda de estado e o unico em que a autoria
        // ainda existe.
        const surfaceAfterShot = state.surface[i];
        if (
          origin.source === 'player' &&
          surfaceAfterShot !== surfaceBeforeShot &&
          (surfaceAfterShot === SURF_FIRE || surfaceAfterShot === SURF_FUNGAL_HEATED)
        ) {
          recordPlayerResonance(state, origin.owner, 'fire');
        }
        if (
          conductiveReady &&
          ownerExtra &&
          ownerSlot !== undefined &&
          events.slice(eventStart).some((event) => event.t === 'discharge')
        ) {
          consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events);
        }
        if (heatsFungal) (proj.heatedSurfaceCells ??= []).push(i);
        if (consumedBySurface) {
          dead = true;
          break;
        }
      }

      if (
        conductiveReady &&
        ownerExtra &&
        ownerSlot !== undefined &&
        isConductiveSurface(state.surface[i]) &&
        consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events)
      ) {
        dischargeAt(state, cx, cy, events, origin);
        dead = true;
        break;
      }

      if (proj.hostile) {
        for (const player of state.players) {
          const extra = state.playerExtras[player.slot ?? 0];
          if (!extra.joined || !player.alive || extra.downed) continue;
          const projectileRadius = proj.radius ?? 0.2;
          if (Math.hypot(player.x - proj.x, player.y - proj.y) < player.radius + projectileRadius) {
            // O CARRINHO atropela e SEGUE: nao morre no impacto (a linha
            // continua ate a parede) e cada corpo so paga uma vez (hits).
            // O CICLONE nao morre no toque, e cobra por TEMPO e nao por corpo.
            //
            // Ele atravessa a sala devagar, entao encostaria dezenas de ticks
            // seguidos: sem um intervalo, ficar um segundo dentro dele seria
            // morte certa e desviar dele deixaria de ser uma decisao para
            // virar a unica jogada. Um relogio por ciclone, e nao por par
            // (ciclone, jogador): dois Prospectors dentro do mesmo funil estao
            // no mesmo problema, e o encontro nao fica mais barato por serem
            // dois.
            if (proj.kind === 'cyclone') {
              if (state.tick < (proj.nextTouchAt ?? 0)) continue;
              proj.nextTouchAt = state.tick + FURNACE_HEART_CYCLONE_TOUCH_TICKS;
              damageEntity(state, player, proj.damage, events, {
                kind: 'enemy_projectile',
                archetype: 'furnace_heart',
                elite: false,
                projectile: proj.kind,
              });
              continue;
            }
            if (proj.kind === 'cart') {
              if (proj.hits?.includes(player.id)) continue;
              proj.hits?.push(player.id);
              damageEntity(state, player, proj.damage, events, {
                kind: 'enemy_projectile',
                archetype: 'miner',
                elite: false,
                projectile: proj.kind,
              });
              continue;
            }
            const vulnerable = extra.iframesUntil <= state.tick;
            // O dono do projetil pode ja ter morrido antes de a pedra chegar —
            // o telegrafo dura 0,8 s e o voo, mais. Sem o dono, o arquetipo sai
            // do proprio projetil: `rock` so existe vindo do bruiser.
            const shooter = state.enemies.find((e) => e.id === proj.owner);
            damageEntity(state, player, proj.damage, events, {
              kind: 'enemy_projectile',
              archetype:
                (shooter?.archetype as EnemyArchetype) ??
                (proj.kind === 'rock' ? 'bruiser' : 'spitter'),
              elite: shooter?.elite ?? false,
              projectile: proj.kind,
            });
            // So a pedra que CARREGA a flag atordoa (o arremesso unico do
            // Britador). A Salva Litoclasta do Guardiao usa o mesmo `kind`
            // sem ela: tres pedras encadeando stun seria um lock sem resposta.
            if (proj.kind === 'rock' && proj.stuns && vulnerable) {
              stunEntity(state, player, BRUISER_ROCK_STUN_TICKS);
            }
            if (
              proj.leavesBiofluid &&
              state.solid[i] === SOLID_NONE &&
              state.surface[i] === SURF_NONE
            ) {
              setSurface(state, i, SURF_BIOFLUID, 0);
            }
            dead = true;
            break;
          }
        }
        if (dead) break;
        // Fisica nao escolhe lado: o carrinho atropela INIMIGO tambem — a
        // armadilha da operacao vira ferramenta de quem aprender a posiciona-la.
        if (proj.kind === 'cart') {
          for (const enemy of state.enemies) {
            if (!enemy.alive) continue;
            if (proj.hits?.includes(enemy.id)) continue;
            if (
              Math.hypot(enemy.x - proj.x, enemy.y - proj.y) >=
              enemy.radius + (proj.radius ?? 0.2)
            )
              continue;
            proj.hits?.push(enemy.id);
            damageEntity(state, enemy, proj.damage, events, {
              kind: 'enemy_projectile',
              archetype: 'miner',
              elite: false,
              projectile: proj.kind,
            });
          }
        }
      } else {
        for (const enemy of state.enemies) {
          if (!enemy.alive) continue;
          const discHits = proj.disc
            ? proj.disc.phase === 'outbound'
              ? proj.disc.outboundHits
              : proj.disc.returnHits
            : undefined;
          if (discHits?.includes(enemy.id) || proj.hits?.includes(enemy.id)) continue;
          if (Math.hypot(enemy.x - proj.x, enemy.y - proj.y) >= enemy.radius + (proj.radius ?? 0.2))
            continue;

          let damage = proj.damage;
          const enemyCell = cellIndexAt(state, enemy.x, enemy.y);
          let conductiveTriggered = false;
          const conductiveAvailable = Boolean(
            proj.modules?.conductive &&
            ownerExtra &&
            ownerSlot !== undefined &&
            moduleHasCapacity(ownerExtra, 'conductive', state.tick),
          );
          if (
            conductiveAvailable &&
            ownerExtra &&
            ownerSlot !== undefined &&
            isConductiveSurface(state.surface[enemyCell]) &&
            consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events)
          ) {
            conductiveTriggered = true;
            damage *= 1.6;
            dischargeAt(state, Math.floor(enemy.x), Math.floor(enemy.y), events, origin);
          }
          if (
            conductiveAvailable &&
            !conductiveTriggered &&
            !isStoneEnemy(enemy) &&
            ownerExtra &&
            ownerSlot !== undefined &&
            consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events)
          ) {
            conductiveTriggered = true;
          }
          if (conductiveTriggered && !isStoneEnemy(enemy)) {
            stunEntity(state, enemy, CONDUCTIVE_STUN_TICKS);
            // Eletrificar a lamina em que ele nada e o contra-jogo do
            // Aquifero, e o atordoamento e o instante em que isso fica claro.
            if (enemy.archetype === 'sheet_leviathan') {
              markDiscovery(state.stats, DISCOVERY_LEVIATHAN_SHOCKED);
            }
          }
          damageEntity(state, enemy, damage, events, { kind: 'player_shot' });

          if (
            proj.modules?.siphon &&
            owner &&
            ownerExtra &&
            ownerSlot !== undefined &&
            owner.hp < owner.maxHp &&
            moduleHasCapacity(ownerExtra, 'siphon', state.tick) &&
            consumeModuleCharge(ownerExtra, 'siphon', ownerSlot, events)
          ) {
            owner.hp = Math.min(owner.maxHp, owner.hp + 2);
          }

          // Detonar um Portador conta como estouro para quem o abateu, mesmo que
          // a explosao em si nasca com `source: 'enemy'`. O que a ressonancia
          // registra e a DECISAO do jogador — ele escolheu matar aquilo de perto.
          // Vale para os DOIS bombardeiros: a decisao do jogador e a mesma
          // (matar aquilo de perto), e a Fenda e a Fornalha — onde so nasce o
          // de enxofre — sao justamente biomas de afinidade com explosao.
          if (
            (enemy.archetype === 'bomber' || enemy.archetype === 'sulfur_bomber') &&
            !enemy.alive
          ) {
            recordPlayerResonance(state, proj.owner, 'blast');
          }
          if (proj.kind === 'seeker') {
            // O missil detona no alvo. O raio e pequeno — ele e uma resposta a UM
            // inimigo, nao uma segunda granada — e a explosao herda o `origin` do
            // jogador, entao ela machuca quem atirou tambem se ele estiver colado.
            explodeAt(state, proj.x, proj.y, SEEKER_BLAST_RADIUS, events, origin);
            dead = true;
          } else if (
            explosiveArmed &&
            procModule(state, ownerExtra, ownerSlot, 'explosive', events)
          ) {
            explodeAt(state, proj.x, proj.y, EXPLOSION_RADIUS, events, origin);
            dead = true;
          } else if (proj.disc) {
            // O disco ja atravessa por natureza. Piercing nao e cobrado aqui
            // porque nao ha nada que ele acrescente a este veiculo.
            discHits?.push(enemy.id);
          } else if (
            proj.modules?.piercing &&
            procModule(state, ownerExtra, ownerSlot, 'piercing', events)
          ) {
            (proj.hits ??= []).push(enemy.id);
          } else {
            dead = true;
          }
          break;
        }
      }
    }

    if (dead && proj.leavesBiofluid) {
      const i = cellIndexAt(state, proj.x, proj.y);
      if (
        i >= 0 &&
        i < state.solid.length &&
        state.solid[i] === SOLID_NONE &&
        state.surface[i] === SURF_NONE
      ) {
        setSurface(state, i, SURF_BIOFLUID, 0);
      }
    }
    if (!dead) survivors.push(proj);
  }
  state.projectiles = survivors;
};

const stepSalvageSites = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (const site of state.salvageSites) {
    if (site.terminalState !== 'scanning' || state.tick < site.scanEndsAt) continue;
    site.terminalState = 'complete';
    site.cacheRevealed = true;
    state.stats.salvageCompleted += 1;
    events.push({
      t: 'terminal_scan_complete',
      siteId: site.id,
      x: site.terminal.x,
      y: site.terminal.y,
    });
    events.push({
      t: 'salvage_cache_revealed',
      siteId: site.id,
      x: site.cache.x,
      y: site.cache.y,
    });
  }
};

/**
 * Solta uma leva de contaminacao no anel de distancia do jogador.
 *
 * Extraido porque agora tem DOIS chamadores — os degraus da escada e a onda
 * tardia que repete. Enquanto era um so, o corpo inline era honesto; com dois,
 * duplicar significaria que a onda repetida poderia nascer colada no jogador
 * sem que ninguem percebesse.
 */
const spawnContaminationWave = (state: SurvivalState, count: number): void => {
  let spawned = 0;
  for (let attempt = 0; attempt < 80 && spawned < count; attempt++) {
    const x = state.rng.nextInt(state.config.width);
    const y = state.rng.nextInt(state.config.height);
    const i = y * state.config.width + x;
    if (state.solid[i] !== SOLID_NONE) continue;
    const ref = nearestStandingPlayer(state, x + 0.5, y + 0.5) ?? state.players[0];
    const d = Math.hypot(x + 0.5 - ref.x, y + 0.5 - ref.y);
    if (d < 11 || d > 26) continue;
    spawnEnemy(state, spawned % 2 === 0 ? 'stalker' : 'bomber', x, y, false);
    spawned++;
  }
};

/**
 * Ondas de pressao por contaminacao, e a cobranca da saturacao.
 *
 * Tres regimes, em ordem de gravidade:
 *
 * 1. ESCADA (0,35 / 0,6 / 0,85): uma leva por degrau, uma vez cada.
 * 2. ONDA TARDIA: passado o ultimo degrau, a leva volta a cada
 *    `CONTAMINATION_SURGE_INTERVAL_TICKS`. Antes, cruzar 0,85 ENCERRAVA a
 *    pressao — o trecho mais contaminado da run era o mais tranquilo.
 * 3. SATURACAO (>= 1,0): o ar cobra direto, em pancadas de um segundo que
 *    escalam. Antes, 1,0 era so onde a barra parava.
 */
const stepContamination = (state: SurvivalState, events: SemanticEvent[]): void => {
  // O ritmo cresce com a profundidade E com o nucleo na mao. A profundidade e
  // o que impede o poco de virar botao de reset; o nucleo e a cobranca do
  // caminho de volta.
  const sectorScale = 1 + (state.sector - 1) * CONTAMINATION_SECTOR_SCALE;
  // A taxa sai da PROFUNDIDADE DA RUN, e nao de uma constante de parede: uma
  // descida de sete setores dura 2,3x mais que a de tres, e um relogio que nao
  // soubesse disso mataria toda run funda no meio do caminho de volta. Ver
  // `contaminationPerTick`.
  const perTick = contaminationPerTick(runSectorCount(state));
  state.contamination = Math.min(
    1,
    state.contamination + perTick * sectorScale * (state.coresTakenMask !== 0 ? 2.2 : 1),
  );
  for (let w = 0; w < CONTAMINATION_WAVES.length; w++) {
    const [level, count] = CONTAMINATION_WAVES[w];
    // contador one-shot: vents sao reescritos por stepCells, entao um sentinel
    // ali seria apagado e a onda dispararia repetidamente.
    if (state.contamination >= level && state.contaminationWaves <= w) {
      state.contaminationWaves = w + 1;
      events.push({ t: 'message', key: 'sim.contaminationRising' });
      spawnContaminationWave(state, count);
    }
  }

  const lastStep = CONTAMINATION_WAVES[CONTAMINATION_WAVES.length - 1][0];
  if (state.contamination >= lastStep) {
    // O relogio da onda tardia so comeca a contar quando o ultimo degrau cai —
    // armado aqui, e nao no inicio da run, senao ele venceria imediatamente e a
    // primeira leva tardia sairia junto com o degrau que a precede.
    if (state.contaminationNextSurgeAt === 0) {
      state.contaminationNextSurgeAt = state.tick + CONTAMINATION_SURGE_INTERVAL_TICKS;
    } else if (state.tick >= state.contaminationNextSurgeAt) {
      state.contaminationNextSurgeAt = state.tick + CONTAMINATION_SURGE_INTERVAL_TICKS;
      events.push({ t: 'message', key: 'sim.contaminationRising' });
      spawnContaminationWave(state, CONTAMINATION_SURGE_COUNT);
    }
  }

  if (state.contamination < CONTAMINATION_SATURATED_AT) return;

  if (state.contaminationSaturatedAt === 0) {
    state.contaminationSaturatedAt = state.tick;
    // A primeira pancada nao sai junto com o aviso: o jogador ganha um pulso
    // inteiro para ler a tela e escolher o rumo antes de pagar por estar ali.
    state.contaminationNextPulseAt = state.tick + CONTAMINATION_SATURATION_PULSE_TICKS;
    events.push({ t: 'message', key: 'sim.contaminationCritical' });
    return;
  }

  if (state.tick < state.contaminationNextPulseAt) return;
  state.contaminationNextPulseAt = state.tick + CONTAMINATION_SATURATION_PULSE_TICKS;

  // A escalada se mede pelo tempo saturado, e nao por um contador de pulsos,
  // para que um pulso perdido (pausa, alt-tab, tick engolido) nao devolva
  // desconto: o ar nao esquece quanto tempo voce ficou nele.
  const secondsSaturated =
    (state.tick - state.contaminationSaturatedAt) / CONTAMINATION_SATURATION_PULSE_TICKS;
  const damage = Math.min(
    CONTAMINATION_SATURATION_MAX_DAMAGE,
    CONTAMINATION_SATURATION_BASE_DAMAGE + CONTAMINATION_SATURATION_RAMP * (secondsSaturated - 1),
  );
  // Abatido nao paga: no co-op ele ja esta num relogio proprio (`bleedout`), e
  // somar os dois transformaria cada queda tardia em morte sem janela de
  // resgate — o oposto do que a saturacao quer ensinar, que e correr junto.
  for (const p of standingPlayers(state)) {
    damageEntity(state, p, damage, events, { kind: 'contamination' }, true);
  }
};

/** Converte players com hp<=0 em abatidos (co-op) ou mortos; encerra a run se todos cairem. */
/**
 * Mata o player do slot e DEVOLVE o nucleo ao mundo se ele o carregava.
 * Sem isso o morto continua com hasCore: ele sai de standingPlayers e de
 * anyDowned, mas a extracao calcula withCore sobre TODOS os extras, entao o
 * parceiro sairia sozinho com 'extracted_with_core' sem nunca ter o nucleo.
 */
const killPlayer = (state: SurvivalState, slot: number, events: SemanticEvent[]): void => {
  const p = state.players[slot];
  const e = state.playerExtras[slot];
  p.alive = false;
  e.activeModules = [];
  e.pendingModuleChoice = null;
  // Morrer congelado nao deixa a estatua para a proxima vida: o revive e o
  // reset partem de um corpo limpo, e a crosta e da run que acabou.
  clearFreeze(e);
  if (e.carriedCoreMask !== 0) {
    // Cada Nucleo volta AO PEDESTAL DELE, e nao "ao pedestal": o portador de
    // uma run de G-04 pode estar carregando o do setor 3 e o do setor 7, e
    // devolver os dois ao mesmo lugar deixaria um pedestal vazio para sempre e
    // o outro rendendo duas coletas.
    for (let sector = 1; sector <= MAX_LINEAGE_SECTORS; sector++) {
      if ((e.carriedCoreMask & (1 << sector)) !== 0) clearCoreTaken(state, sector);
    }
    e.carriedCoreMask = 0;
    e.hasCore = false;
    events.push({ t: 'message', key: 'sim.coreDropped' });
  }
  events.push({
    t: 'death',
    x: p.x,
    y: p.y,
    entity: p.id,
    archetype: 'prospector',
    facingX: p.facing.x,
    facingY: p.facing.y,
    tick: state.tick,
  });
};

const resolveDownedAndDeaths = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (let slot = 0; slot < state.players.length; slot++) {
    const p = state.players[slot];
    const e = state.playerExtras[slot];
    if (!e.joined || !p.alive) continue;

    if (e.downed) {
      // abatido morre ao esgotar o tempo de sangramento
      if (state.tick >= e.bleedoutAt) {
        // Sangrar ate o fim SOBRESCREVE a causa: o que matou nao foi o golpe que
        // derrubou, foi os vinte segundos sem ninguem chegar. Sao licoes
        // diferentes e o co-op depende de distingui-las.
        e.lastDamage = { cause: { kind: 'bleedout' }, tick: state.tick };
        killPlayer(state, slot, events);
      }
      continue;
    }

    if (p.hp <= 0) {
      p.hp = 0;
      const hasStandingAlly = state.players.some(
        (o, i) =>
          i !== slot && state.playerExtras[i].joined && o.alive && !state.playerExtras[i].downed,
      );
      if (hasStandingAlly) {
        // co-op: entra em estado abatido, revivel pelo parceiro
        e.downed = true;
        // Cair DESFAZ o congelamento: o abatido nao age de qualquer jeito, e
        // um revivido que voltasse preso na estatua morreria de novo sem ter
        // tocado o gatilho uma vez.
        clearFreeze(e);
        // O corpo PARA ao cair: sem isto, vx/vy congelam com o valor do tick
        // anterior e a inercia do gelo consumiria esse embalo velho segundos
        // depois, no revive — o revivido deslizando sozinho na direcao antiga.
        p.vx = 0;
        p.vy = 0;
        e.bleedoutAt = state.tick + BLEEDOUT_TICKS;
        state.stats.timesDowned += 1;
        events.push({
          t: 'player_down',
          slot,
          x: p.x,
          y: p.y,
          facingX: p.facing.x,
          facingY: p.facing.y,
          tick: state.tick,
        });
      } else {
        events.push({
          t: 'player_down',
          slot,
          x: p.x,
          y: p.y,
          facingX: p.facing.x,
          facingY: p.facing.y,
          tick: state.tick,
        });
        killPlayer(state, slot, events);
      }
    }
  }

  // run acaba quando nenhum player pode continuar (todos mortos ou abatidos)
  const joined = state.players.filter((_, i) => state.playerExtras[i].joined);
  const anyActive = joined.some((p) => p.alive && !state.playerExtras[p.slot ?? 0].downed);
  if (joined.length > 0 && !anyActive) {
    state.phase = 'dead';
  }
};

/**
 * A causa que a tela de fim deve mostrar quando a run acaba em morte.
 *
 * No co-op ha duas causas possiveis e a pergunta "o que acabou com a run" tem
 * uma resposta so: a do ULTIMO a cair, porque foi ela que encerrou a partida. O
 * primeiro a morrer nao terminou nada — o parceiro ainda estava de pe.
 */
const runEndingCause = (state: SurvivalState): DamageCause => {
  let latest: { cause: DamageCause; tick: number } | null = null;
  for (let slot = 0; slot < state.players.length; slot++) {
    const last = state.playerExtras[slot].lastDamage;
    if (!state.playerExtras[slot].joined || !last) continue;
    if (!latest || last.tick > latest.tick) latest = last;
  }
  return latest?.cause ?? { kind: 'unknown' };
};

/**
 * Congela o sumario no PRIMEIRO tick em que a run deixa de estar correndo.
 *
 * A guarda `summary === null` e o ponto todo. `stepRun` tem dois caminhos de
 * saida e a extracao termina a run no meio do laco de jogadores, entao sem ela
 * o sumario seria reconstruido em ticks subsequentes — e a tela de resultado
 * mostraria numeros mudando enquanto o jogador os le.
 */
const finalizeRun = (state: SurvivalState): void => {
  if (state.phase === 'running' || state.summary !== null) return;
  // A licao central do loop novo, anotada no unico instante em que ela e
  // verdade: o Prospector caiu carregando carga que nunca sera homologada.
  //
  // O limiar existe para a descoberta significar alguma coisa — morrer com duas
  // lascas nao ensina nada sobre perder uma carga. Marcado ANTES do sumario
  // porque `buildSummary` congela `stats.discoveries`.
  if (state.phase === 'dead' && state.stats.oreCollected >= CARGO_LOST_DISCOVERY_ORE) {
    markDiscovery(state.stats, DISCOVERY_CARGO_LOST);
  }
  state.summary = buildSummary(state, state.phase === 'dead' ? runEndingCause(state) : null);
};

export const stepRun = (state: SurvivalState, commands: readonly PlayerCommand[]): StepResult => {
  const events: SemanticEvent[] = [];

  if (
    state.phase === 'dead' ||
    state.phase === 'extracted' ||
    state.phase === 'extracted_with_core'
  ) {
    return { state, events };
  }

  state.tick++;

  for (let slot = 0; slot < state.players.length; slot++) {
    expireTimedModules(state.playerExtras[slot], state.tick, slot, events);
    stepPlayer(state, slot, commands[slot] ?? emptyCommand(), events);
    if (state.phase !== 'running') {
      resolveChainedEvents(state, events);
      resolveDownedAndDeaths(state, events);
      finalizeRun(state);
      return { state, events };
    }
  }

  revealWellOffers(state, events);
  stepSalvageSites(state, events);
  stepProjectiles(state, events);
  updateEnemies(state, events);
  stepCells(state, events);
  stepRailCarts(state, events);
  stepLeylines(state, events);
  // O teto DEPOIS dos projeteis e do movimento: a estalactite cobra onde o
  // jogador terminou o tick, e nao onde ele estava quando ela foi marcada.
  stepCollapse(state, events);
  applyCellHazards(state, events);
  stepContamination(state, events);
  // A REDE DE SEGURANCA DO BURACO. `applyIceLoad` ja cobre o caminho comum
  // (andar, deslizar, esquivar), mas o Prospector nem sempre se move por conta
  // propria: o eletroima do Coveiro ARRASTA, e um abatido pode ser puxado. Se a
  // agua profunda so matasse quem entra nela por vontade propria, a regra
  // "entrar e fatal" teria uma excecao que ninguem escreveu.
  //
  // Uma varredura por tick sobre os slots (dois, no maximo) — barata, e o unico
  // lugar em que a pergunta e feita sobre TODO deslocamento, venha ele de onde
  // vier.
  for (let slot = 0; slot < state.players.length; slot++) {
    const p = state.players[slot];
    if (!state.playerExtras[slot].joined || !p.alive) continue;
    const i = cellIndexAt(state, p.x, p.y);
    if (drownsAt(state, i)) plungeIntoDeepWater(state, slot, i, events);
  }
  resolveChainedEvents(state, events);
  resolveDownedAndDeaths(state, events);
  finalizeRun(state);

  return { state, events };
};

export const createSnapshot = (state: SurvivalState, viewerId?: string): SurvivalSnapshot => {
  void viewerId; // filtragem por viewer fica a cargo do servidor
  return {
    tick: state.tick,
    phase: state.phase,
    player: {
      x: state.player.x,
      y: state.player.y,
      hp: state.player.hp,
      heat: state.playerExtra.heat,
      hasCore: state.playerExtra.hasCore,
    },
    players: joinedPlayers(state).map((p) => {
      const i = p.slot ?? 0;
      return {
        slot: i,
        x: p.x,
        y: p.y,
        hp: p.hp,
        maxHp: p.maxHp,
        heat: state.playerExtras[i].heat,
        hasCore: state.playerExtras[i].hasCore,
        downed: state.playerExtras[i].downed,
        alive: p.alive,
      };
    }),
    enemyCount: state.enemies.filter((e) => e.alive).length,
    contamination: state.contamination,
  };
};

/**
 * Ordem FIXA dos arquetipos no hash.
 *
 * `Object.keys` teria funcionado por acidente e quebrado em silencio: a ordem de
 * iteracao de um objeto depende da ordem de INSERCAO, e basta alguem reordenar
 * o literal em `emptyStats` para dois builds do mesmo codigo produzirem hashes
 * diferentes — divergencia de co-op sem nenhuma mudanca de comportamento.
 */
const HASHED_ARCHETYPES: readonly EnemyArchetype[] = [
  'stalker',
  'bruiser',
  'spitter',
  'bomber',
  'guardian',
  // Novos entram no FIM, nunca no meio: inserir 'bishop' antes de 'guardian'
  // mudaria o hash de toda run existente sem mudar comportamento nenhum.
  'bishop',
  'fungal_horse',
  'miner',
  // Bestiario de assinatura, no fim pela mesma regra. Sem eles aqui, duas runs
  // com resultados diferentes contra assinaturas produziriam o MESMO hash de
  // verificacao — o contador apareceria no sumario sem estar coberto pelo
  // replay do leaderboard.
  'resonant',
  'mud_lamprey',
  'bellows',
  'scoriac',
  'frost_wraith',
  // Fauna afinada por bioma, tambem no fim pela mesma regra de nunca
  // reordenar o que ja existe.
  'sulfur_bomber',
  'undertaker',
  'diamandis',
  'white_devourer',
  // Os seis chefes de estrato, no fim pela mesma regra de nunca reordenar.
  'archcantor',
  'sheet_leviathan',
  'lung_matrix',
  'furnace_heart',
  'frost_queen',
  'magnetarch',
];

/** FNV-1a 32-bit sobre o estado autoritativo. */
export const hashAuthoritativeState = (state: SurvivalState): string => {
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 24) & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  const mixString = (value: string): void => {
    mix(value.length);
    for (let i = 0; i < value.length; i++) mix(value.charCodeAt(i));
  };

  mix(state.tick);
  mixString(state.phase);
  // As ofertas do poco sao estado autoritativo: elas decidem o que pode ser
  // pego, e uma simulacao que as revelou noutro tick oferece outra coisa.
  mix(state.wellOffers.length);
  for (const offer of state.wellOffers) {
    mixString(offer.ability);
    mix(Math.round(offer.x * 1000));
    mix(Math.round(offer.y * 1000));
    mix(offer.takenBy === null ? -1 : offer.takenBy);
  }
  for (let i = 0; i < state.solid.length; i++) mix(state.solid[i] | (state.surface[i] << 8));
  for (let slot = 0; slot < state.players.length; slot++) {
    const p = state.players[slot];
    const e = state.playerExtras[slot];
    if (!e.joined) continue;
    mix(slot);
    mix(Math.round(p.x * 1000));
    mix(Math.round(p.y * 1000));
    mix(Math.round(p.hp * 100));
    mix(p.stunnedUntil);
    mix(p.alive ? 1 : 0);
    mix(e.downed ? 1 : 0);
    mix(Math.round(e.heat * 100));
    // A mira persistida, o rumo do corpo e o canal do sopro sao estado
    // autoritativo: a mira decide o rumo do proximo bolt e de cada emissao do
    // sopro, o facing decide a esquiva sem direcional, e o canal decide se
    // esse bolt sequer existe. Duas simulacoes que discordam aqui divergem no
    // primeiro disparo ou na primeira esquiva neutra.
    mix(Math.round(e.aim.x * 1000));
    mix(Math.round(e.aim.y * 1000));
    mix(Math.round(p.facing.x * 1000));
    mix(Math.round(p.facing.y * 1000));
    mix(e.channelingUntil);
    mix(e.purgeCells);
    // A habilidade equipada MUDA o resultado da run, entao ela e estado
    // autoritativo: duas simulacoes que discordam de qual habilidade o slot
    // carrega divergem no primeiro uso, e o replay tem de acusar isso.
    mixString(e.ability);
    mix(e.resonance.fire);
    mix(e.resonance.current);
    mix(e.resonance.blast);
    mix(e.resonance.kinetic);
    // O CANHAO ROTATIVO entra no hash inteiro: rotacao, acumulador e fase.
    //
    // Os tres decidem QUANDO a proxima bala sai. Duas simulacoes que discordem
    // da rotacao divergem no tick em que uma cruza o limiar operacional e a
    // outra ainda nao — e a divergencia aparece como "o parceiro atirou e eu
    // nao", que e a forma mais confusa possivel de dessincronia. Sao inteiros
    // por construcao (ver `minigun.ts`), entao nao ha arredondamento a fazer.
    mix(e.minigun.spin);
    mix(e.minigun.fireAccum);
    mixString(e.minigun.phase);
    mix(e.minigun.pendingRounds);
    mix(e.activeModules.length);
    for (const module of e.activeModules) {
      mixString(module.id);
      mixString(module.lifetime.kind);
      if (module.lifetime.kind === 'charges') {
        mix(module.lifetime.remaining);
        mix(module.lifetime.maximum);
      } else {
        mix(module.lifetime.acquiredAtTick);
        mix(module.lifetime.expiresAtTick);
      }
    }
    if (e.pendingModuleChoice) {
      mix(1);
      mix(e.pendingModuleChoice.sourceSiteId);
      mix(e.pendingModuleChoice.createdAtTick);
      mixString(e.pendingModuleChoice.options[0]);
      mixString(e.pendingModuleChoice.options[1]);
    } else {
      mix(0);
    }
    // O FRIO, no fim do bloco do slot (append-only, como tudo aqui). Duas
    // simulacoes que discordam do medidor discordam de quando um Prospector
    // trava — e o travamento e a decisao mais visivel do encontro.
    mix(e.freeze);
    mix(e.frostbitten ? 1 : 0);
    mix(e.freezeGraceUntil);
    mix(e.thermalCycleReadyAt);
  }
  for (const site of state.salvageSites) {
    mix(site.id);
    mix(site.tier);
    mixString(site.terminalState);
    mix(site.scanEndsAt);
    mix(site.cacheRevealed ? 1 : 0);
    mix(site.cacheOpened ? 1 : 0);
    mix(site.openedBySlot ?? -1);
  }
  // O tuning entra no hash porque ele MUDA a run.
  //
  // Sem isto, uma expedicao com +12% de vida verificaria contra o replay de uma
  // run de fabrica: o leaderboard confere re-simulando o log de comandos, e dois
  // Prospectors diferentes chegariam ao mesmo digest. Milesimos inteiros pela
  // mesma razao dos contadores — float acumulado em ordens diferentes diverge
  // entre maquinas.
  //
  // `navigation` fica de fora: nada la altera um tick, e inclui-lo faria duas
  // runs identicas divergirem por causa de um HUD.
  for (const key of TUNING_HASH_ORDER) mix(Math.round(state.config.tuning[key] * 1000));
  mix(state.sector);
  // A PROFUNDIDADE CONGELADA entra no hash porque ela muda a run inteira: o
  // setor final, onde estao os Nucleos, quais setores tem chefe. Duas runs com a
  // mesma seed e `sectorCount` diferente sao runs diferentes desde o tick zero,
  // e o replay do leaderboard tem de acusar isso em vez de verificar uma contra
  // a outra.
  const depthConfig = runDepth(state);
  mixString(depthConfig.generation);
  mix(depthConfig.sectorCount);
  mix(depthConfig.coreSectors.length);
  for (const coreSector of depthConfig.coreSectors) mix(coreSector);
  // Mascara e nao booleano: com dois Nucleos, "algum foi pego" deixou de
  // descrever o estado. Duas simulacoes que discordem de QUAL pedestal esta
  // vazio divergem na proxima interacao com ele.
  mix(state.coresTakenMask);
  mix(Math.round(state.contamination * 100000));
  mix(state.contaminationWaves);
  // Os relogios da saturacao entram no hash porque REALIMENTAM a simulacao: o
  // dano do proximo pulso sai da diferenca entre o tick atual e o tick em que o
  // ar saturou. Duas maquinas que discordem disso divergem em vida.
  mix(state.contaminationSaturatedAt);
  mix(state.contaminationNextPulseAt);
  mix(state.contaminationNextSurgeAt);
  // Contadores entram no hash apesar de nao afetarem a simulacao.
  //
  // Poderiam ficar de fora — nada aqui realimenta o mundo. Entram porque o
  // leaderboard verifica runs re-simulando o log de comandos e comparando
  // hashes: fora do hash, um resultado com os mesmos movimentos mas contagens
  // diferentes passaria pela verificacao. Sao inteiros exatamente para poderem
  // entrar; ver `addDamageTenths`.
  mix(state.stats.shotsFired);
  mix(state.stats.damageTakenTenths);
  mix(state.stats.damageDealtTenths);
  mix(state.stats.solidsDestroyed);
  mix(state.stats.salvageCompleted);
  mix(state.stats.modulesAcquired);
  mix(state.stats.purgeCellsUsed);
  mix(state.stats.timesDowned);
  mix(state.stats.revivesGiven);
  mix(state.stats.oreCollected);
  mix(state.stats.innocentsKilled);
  mix(state.stats.discoveries);
  for (const archetype of HASHED_ARCHETYPES) mix(state.stats.kills[archetype]);
  // As FASES ja disparadas (bitmask), no lugar do antigo par de booleanos:
  // duas simulacoes que discordam de uma fase de uma vez divergem no proximo
  // gatilho dela.
  mix(state.bossRuntime.phasesFired);
  // Chefes abatidos: decide o que a SUBIDA vai (nao) repovoar, entao duas
  // simulacoes que discordam disso divergem no primeiro retorno.
  mix(state.bossesDownMask);
  mix(state.bossRuntime.arenaClosed ? 1 : 0);
  mix(state.bossRuntime.arenaBarrierCells.length);
  for (const cell of state.bossRuntime.arenaBarrierCells) mix(cell);
  // OS BURACOS NO GELO e o relogio de cada um.
  //
  // O id da superficie ja entra no hash pela varredura do grid — o buraco em si
  // nao poderia divergir sem ser notado. O que NAO entrava e o RELOGIO: duas
  // simulacoes que discordem de quando a rota volta a existir parecem iguais
  // por doze segundos e divergem quando uma delas recongela primeiro (e um
  // Prospector atravessa por cima do que na outra ainda e agua). Curto por
  // construcao — sao os buracos abertos, nao as celulas de gelo.
  mix(state.iceHoles.length);
  for (const hole of state.iceHoles) {
    mix(hole.idx);
    mix(hole.at);
  }
  // As cargas MARCADAS: duas simulacoes que discordem de onde a Salva de
  // Demolicao cai divergem no estrago, um telegrafo depois.
  mix(state.bossRuntime.blastCells.length);
  for (const cell of state.bossRuntime.blastCells) mix(cell);
  // O TETO MARCADO: duas simulacoes que discordem de onde — ou de quando — a
  // estalactite cai divergem no dano um segundo depois, longe da causa.
  mix(state.bossRuntime.collapseCells.length);
  for (const cell of state.bossRuntime.collapseCells) {
    mix(cell.idx);
    mix(cell.at);
  }
  // Quais modulos soltaram e quais foram arrancados decidem QUAIS ARMAS o
  // chefe ainda tem e quanto minerio o abate paga: divergir aqui e divergir na
  // luta e na recompensa.
  mix(state.bossRuntime.modulesExposed);
  mix(state.bossRuntime.modulesLost);
  // O ARCO do Devorador: onde ele vai cair e quantos saltos faltam na rajada.
  //
  // Os dois sao escolhidos UMA vez, na decolagem, e mandam no resto do ciclo —
  // a cratera, o dano, a posicao final e se o proximo pouso encadeia outro arco
  // ou abre a janela de dano. Duas simulacoes que discordem aqui ainda parecem
  // iguais no tick da escolha e so divergem visivelmente um segundo depois;
  // sem estes campos no hash, o desvio seria detectado tarde e no lugar errado.
  mix(Math.round(state.bossRuntime.leapToX * 1000));
  mix(Math.round(state.bossRuntime.leapToY * 1000));
  mix(state.bossRuntime.leapsLeft);
  // A BOCA. Um numero que decide, a cada tick da janela, quem esta sendo puxado,
  // com que forca e quanta areia ja foi engolida — e a partir dele, quem chega
  // na garganta. Duas simulacoes que discordassem de um unico tick de abertura
  // continuariam parecendo iguais no comeco da janela e divergiriam segundos
  // depois, com um jogador devorado de um lado e a tres tiles do centro do
  // outro.
  mix(state.bossRuntime.mawOpenedAt);
  // O DILUVIO. Tres numeros que valem por uma camada de mundo inteira: eles
  // decidem, celula a celula, o que esta submerso — e submerso decide por onde
  // o chefe nada, onde ele emerge e quanto uma descarga cobra. Fora do hash,
  // duas simulacoes que discordassem do instante da subida continuariam
  // parecendo iguais por alguns ticks e divergiriam depois em tudo.
  mix(state.bossRuntime.delugeAt);
  mix(Math.round(state.bossRuntime.delugeX * 1000));
  mix(Math.round(state.bossRuntime.delugeY * 1000));
  mix(state.bossRuntime.leviathanShockAt);
  mix(state.bossRuntime.leviathanShockRecoverAt);
  mix(state.bossRuntime.leviathanShockSeq);
  for (const bubble of state.bossRuntime.protectiveBubbles) {
    mix(Math.round(bubble.x * 1000));
    mix(Math.round(bubble.y * 1000));
    mix(Math.round(bubble.radius * 1000));
  }
  // A PRIMEIRA FASE do Leviata: onde a Sondagem vai romper (e se afunda),
  // quantas ja sairam, para onde ele viaja e quando emerge, e as bacias que
  // ele abriu. Cada um decide chao, posicao ou tampa — duas simulacoes que
  // discordem de um deles divergem no proximo impacto ou na proxima queda.
  mix(state.bossRuntime.leviathanProbeCell);
  mix(state.bossRuntime.leviathanProbeDeepen ? 1 : 0);
  mix(state.bossRuntime.leviathanProbeSeq);
  mix(state.bossRuntime.leviathanAnchorProbes);
  mix(state.bossRuntime.leviathanDest);
  mix(state.bossRuntime.leviathanSurfaceAt);
  mix(state.bossRuntime.leviathanPools.length);
  for (const pool of state.bossRuntime.leviathanPools) mix(pool);
  // O CORO CARDINAL. Tres campos que decidem a POSICAO de quatro corpos que
  // interceptam tiro: quem ocupa cada assento, quantos quartos de volta a
  // formacao ja deu e quando ela gira de novo. Duas simulacoes que discordem de
  // um assento divergem no primeiro disparo que passa (ou nao passa) por ali —
  // e continuam divergindo, porque o guarda que uma delas matou a outra ainda
  // tem em orbita. As posicoes em si NAO entram aqui: elas ja entram no laco de
  // inimigos, como as de qualquer corpo.
  for (const seat of state.bossRuntime.choir) mix(seat);
  mix(state.bossRuntime.choirRotation);
  mix(state.bossRuntime.choirPattern);
  mix(state.bossRuntime.choirRotateAt);
  mix(state.bossRuntime.choirRecruitAt);
  // Os relogios da leyline DECIDEM dano (a descarga sai deles), entao entram
  // no hash — ao contrario dos railTimers, que so telegrafam um projetil que
  // ja e hasheado por conta propria. Duas simulacoes discordando de
  // `dischargeAt` divergiriam em vida um segundo depois, longe da causa.
  // A geometria fica FORA: e derivada da seed, como hallCenters.
  for (const seg of state.leylineSegments) {
    mix(seg.dischargeAt);
    mix(seg.refractoryUntil);
    mix(seg.triggeredBy);
    // `relayed` decide credito de ressonancia — divergir nele diverge a oferta
    // do poco dali a um setor, longe da causa.
    mix(seg.relayed ? 1 : 0);
  }
  // O rele de cada juncao decide se a descarga ATRAVESSA — dano futuro.
  // `cell`/`segments` ficam fora: geometria derivada da seed.
  for (const node of state.leylineNodes) mix(node.routed ? 1 : 0);
  // O CIRCUITO decide o mundo: `closed` desliga a propriedade do estrato, e
  // `live`/`reached` decidem se a proxima cascata vai fecha-lo. Divergir aqui
  // divergiria a fisica do setor inteiro — a agua conduzindo numa ponta e nao
  // na outra — muito depois de a causa ter passado.
  //
  // `sourceNode`/`members` ficam FORA: geometria derivada da seed, como as
  // celulas dos segmentos.
  mix(state.leylineCircuit.live ? 1 : 0);
  mix(state.leylineCircuit.closed ? 1 : 0);
  for (const seg of state.leylineCircuit.reached) mix(seg);
  for (const enemy of state.enemies) {
    mix(enemy.id);
    mix(Math.round(enemy.x * 1000));
    mix(Math.round(enemy.y * 1000));
    mix(Math.round(enemy.hp * 100));
    mix(enemy.stunnedUntil);
    mix(enemy.alive ? 1 : 0);
    // mood e estado autoritativo: no Ressonante ele escolhe entre o pulso
    // selvagem, a orbita do coro e o ataque diagonal do Solista. Dois estados
    // com papeis diferentes precisam divergir ANTES do proximo movimento.
    mix(enemy.mood ?? 0);
    if (enemy.action) {
      mixString(enemy.action.kind);
      mix(enemy.action.startedAt);
      mix(enemy.action.releaseAt);
      mix(enemy.action.endsAt);
      mix(Math.round(enemy.action.direction.x * 1000));
      mix(Math.round(enemy.action.direction.y * 1000));
      // O LATCH DO BOTE decide se este `charge` ainda pode cobrar contato.
      // Ele e marcado mesmo quando iframes rejeitam dano e frio; deixa-lo fora
      // faria dois estados com o mesmo HP/geada aceitarem o mesmo hash agora e
      // divergirem quando os iframes acabassem antes da recovery.
      mix(enemy.action.landed === true ? 1 : 0);
    }
  }
  for (const proj of state.projectiles) {
    mix(proj.id);
    mixString(proj.kind);
    mix(proj.owner);
    mix(Math.round(proj.x * 1000));
    mix(Math.round(proj.y * 1000));
    mix(Math.round(proj.vx * 1000));
    mix(Math.round(proj.vy * 1000));
    mix(Math.round(proj.distanceTravelled * 1000));
    mix(proj.ttl);
    mix(proj.nextTouchAt ?? 0);
    mix(proj.modules?.piercing ? 1 : 0);
    mix(proj.modules?.conductive ? 1 : 0);
    mix(proj.modules?.siphon ? 1 : 0);
    mix(proj.modules?.explosive ? Math.round(proj.modules.explosive.armAfterDistance * 1000) : 0);
    mix(proj.modules?.ricochet?.remainingBounces ?? 0);
    if (proj.disc) {
      mixString(proj.disc.phase);
      mix(Math.round(proj.disc.travelled * 1000));
      mix(proj.disc.outboundHits.length);
      for (const id of proj.disc.outboundHits) mix(id);
      mix(proj.disc.returnHits.length);
      for (const id of proj.disc.returnHits) mix(id);
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** Hash FNV-1a das camadas estaticas iniciais (validacao de geracao local no cliente). */
export const hashStaticWorld = (state: SurvivalState): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < state.solid.length; i++) {
    const v = state.solid[i] | (state.surface[i] << 8);
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};
