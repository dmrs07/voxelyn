import { RNG } from '@voxelyn/core';
import {
  BLEEDOUT_TICKS,
  BOLT_COOLDOWN_TICKS,
  BOLT_DAMAGE,
  BOLT_SPEED,
  BRUISER_ROCK_STUN_TICKS,
  CONDUCTIVE_STUN_TICKS,
  FIRE_FUEL_TICKS,
  FLAMETHROWER_DAMAGE,
  SEEKER_BLAST_RADIUS,
  SEEKER_SPEED,
  SEEKER_TURN_RATE,
  WELL_OFFER_REACH,
  WELL_OFFER_REVEAL,
  WELL_OFFER_SPREAD,
  PURGE_CELL_HEAL,
  PURGE_CELL_RADIUS,
  CONTAMINATION_PER_TICK,
  DISCHARGE_DAMAGE,
  DODGE_COOLDOWN_TICKS,
  DODGE_IFRAME_TICKS,
  DODGE_SPEED,
  DODGE_TICKS,
  EXPLOSION_RADIUS,
  EXPLOSIVE_ARM_DISTANCE,
  EXTRACT_RADIUS,
  FIRE_DAMAGE_PER_TICK,
  GAS_DAMAGE_PER_TICK,
  SPORE_DAMAGE_PER_TICK,
  HEAT_DECAY_PER_TICK,
  HEAT_MAX,
  HEAT_PER_SHOT,
  MAX_PLAYERS,
  MAX_PROJECTILES,
  OVERHEAT_LOCK_TICKS,
  OVERHEAT_SELF_DAMAGE,
  PLAYER_HP,
  PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  REVIVE_HP_FRACTION,
  REVIVE_RADIUS,
  RETURN_DISC_MAX_DISTANCE,
  RETURN_DISC_SPEED,
  ORE_PER_MODULE,
  SALVAGE_SCAN_TICKS,
  CONTAMINATION_SECTOR_SCALE,
  SECTOR_COUNT,
  RUN_SEED_MIX,
  SOLID_NONE,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_NONE,
  SURF_SPORES,
  TICK_HZ,
  WORLD_H,
  WORLD_W,
} from './constants.js';
import {
  ABILITY_SHAPE,
  STARTING_ABILITY,
  abilityDefinition,
  emptyResonance,
  recordResonance,
  resonanceOffers,
} from './abilities.js';
import { dischargeAt, explodeAt, setSurface, stepCells } from './cells.js';
import { explosiveArmedByDistance, impactSolid, impactSurface, projectileClass } from './materials.js';
import {
  applyExplosionDamage,
  damageEntity,
  moveEntity,
  isStoneEnemy,
  spawnEnemy,
  stunEntity,
  surfaceSpeedMul,
  updateEnemies,
} from './entities.js';
import { generateWorld } from './worldgen.js';
import { buildSummary, emptyStats, markDiscovery } from './stats.js';
import { descend, isFinalSector, populateSector, sectorSeed } from './sectors.js';
import {
  activeModule,
  consumeModuleCharge,
  expireTimedModules,
  grantOrRechargeModule,
  moduleHasCapacity,
  rollModuleChoice,
} from './modules.js';
import {
  DISCOVERY_DISCHARGE_POOL,
  DISCOVERY_ORE_QUOTA,
  DISCOVERY_SELF_HARM,
} from './types.js';
import type {
  DamageCause,
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


export const emptyCommand = (): PlayerCommand => ({
  move: { x: 0, y: 0 },
  aim: { x: 1, y: 0 },
  fire: false,
  ability: false,
  dodge: false,
  interact: false,
  purge: false,
  choose: null,
});

const makePlayer = (slot: number, x: number, y: number): Entity => ({
  id: slot + 1,
  kind: 'player',
  archetype: 'prospector',
  x,
  y,
  vx: 0,
  vy: 0,
  hp: PLAYER_HP,
  maxHp: PLAYER_HP,
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

const makeExtra = (): PlayerExtra => ({
  aim: { x: 1, y: 0 },
  heat: 0,
  overheatedUntil: 0,
  nextShotAt: 0,
  dodgeUntil: 0,
  iframesUntil: 0,
  dodgeCooldownUntil: 0,
  abilityCooldownUntil: 0,
  purgeCells: 1,
  activeModules: [],
  pendingModuleChoice: null,
  hasCore: false,
  dodgeDir: { x: 1, y: 0 },
  downed: false,
  bleedoutAt: 0,
  joined: true, // default seguro: solo/local ja esta em jogo
  lastDamage: null,
  ability: STARTING_ABILITY,
  resonance: emptyResonance(),
});

/**
 * Zera o estado PERSISTENTE de um slot (upgrades, inventario, nucleo), sem
 * tocar em posicao/vida — quem chama cuida disso. Usado quando um slot
 * abandonado e reocupado: o novo jogador nao pode herdar os modificadores,
 * os frascos nem a posse do nucleo de quem saiu.
 */
export const resetPlayerProgress = (extra: PlayerExtra): void => {
  extra.activeModules = [];
  extra.pendingModuleChoice = null;
  extra.purgeCells = 1;
  extra.hasCore = false;
  extra.heat = 0;
  extra.overheatedUntil = 0;
  extra.nextShotAt = 0;
  extra.dodgeUntil = 0;
  extra.iframesUntil = 0;
  extra.dodgeCooldownUntil = 0;
  extra.abilityCooldownUntil = 0;
  extra.aim = { x: 1, y: 0 };
  extra.dodgeDir = { x: 1, y: 0 };
  extra.lastDamage = null;
  extra.ability = STARTING_ABILITY;
  extra.resonance = emptyResonance();
};

export const createRun = (config: RunConfig): SurvivalState => {
  const width = config.width ?? WORLD_W;
  const height = config.height ?? WORLD_H;
  const playerCount = Math.max(1, Math.min(MAX_PLAYERS, config.playerCount ?? 1));
  const sector = Math.max(1, Math.min(SECTOR_COUNT, config.sector ?? 1));
  // A seed de CADA setor sai da mesma derivacao. Usar a formula antiga so para
  // o primeiro faria o setor de abertura ser o unico fora do esquema, e a
  // derivacao e o que garante que uma seed compartilhada reproduza a descida
  // inteira, nao so o comeco.
  const world = generateWorld(sectorSeed((config.seed ^ RUN_SEED_MIX) >>> 0, sector), width, height);
  const rng = new RNG((config.seed * 0x85ebca6b + 0xc2b2ae35) >>> 0 || 1);

  // posicoes de spawn proximas a entrada (deterministicas, sem sobrepor)
  const offsets = [
    { x: 0.5, y: 0.5 },
    { x: 1.5, y: 0.5 },
  ];
  const players: Entity[] = [];
  const playerExtras: PlayerExtra[] = [];
  for (let s = 0; s < playerCount; s++) {
    players.push(makePlayer(s, world.entry.x + offsets[s].x, world.entry.y + offsets[s].y));
    playerExtras.push(makeExtra());
  }

  const state: SurvivalState = {
    config: { seed: config.seed, width, height, playerCount, sector },
    rng,
    tick: 0,
    phase: 'running',
    sector,
    sectorStartedAt: 0,
    solid: world.solid,
    surface: world.surface,
    surfaceTimer: new Uint16Array(width * height),
    chunkVersion: new Uint32Array(Math.ceil(width / 16) * Math.ceil(height / 16)),
    entry: world.entry,
    corePos: world.corePos,
    coreTaken: false,
    guardianAwake: false,
    guardianSummoned: false,
    arenaClosed: false,
    arenaBarrierCells: [],
    guardianPath: [],
    guardianPathAt: -1000,
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
    charges: [],
    contamination: 0,
    contaminationWaves: 0,
    // reserva todos os ids de player (1..playerCount) antes dos inimigos, para
    // que nenhum inimigo colida com um id de player nos snapshots por id
    nextEntityId: playerCount + 1,
    reactionQueue: [],
    oreModulesPaid: 0,
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
export const nearestStandingPlayer = (state: SurvivalState, x: number, y: number): Entity | null => {
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

const applyCellHazards = (state: SurvivalState, events: SemanticEvent[]): void => {
  const targets = [...joinedPlayers(state), ...state.enemies];
  for (const ent of targets) {
    if (!ent.alive) continue;
    const surf = state.surface[cellIndexAt(state, ent.x, ent.y)];
    if (surf === SURF_FIRE) {
      damageEntity(state, ent, FIRE_DAMAGE_PER_TICK, events, { kind: 'fire' });
    } else if (surf === SURF_GAS && ent.kind === 'player') {
      // Gas sulfuroso e toxico; criaturas do Veio sao imunes ao proprio ambiente.
      damageEntity(state, ent, GAS_DAMAGE_PER_TICK, events, { kind: 'gas' });
    } else if (surf === SURF_SPORES && ent.kind === 'player') {
      // Esporos do bomber sao organicos e irritantes, mas nao volateis/explosivos.
      damageEntity(state, ent, SPORE_DAMAGE_PER_TICK, events, { kind: 'spores' });
    }
  }
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
      if (ev.source === 'player') recordPlayerResonance(state, ev.owner, 'current');
      const cells = new Set(ev.cells);
      for (const ent of [...joinedPlayers(state), ...state.enemies]) {
        if (!ent.alive) continue;
        if (!cells.has(cellIndexAt(state, ent.x, ent.y))) continue;
        const scale = ev.source === 'player' && ent.kind === 'player'
          ? PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE
          : 1;
        damageEntity(state, ent, DISCHARGE_DAMAGE * scale, events, {
          kind: 'discharge',
          source: ev.source,
        });
        if (ev.source === 'player' && ent.kind === 'enemy' && !isStoneEnemy(ent)) {
          stunEntity(state, ent, CONDUCTIVE_STUN_TICKS);
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
        ev.source
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
  const player = state.players[slot];
  const extra = state.playerExtras[slot];
  const aimLength = Math.hypot(extra.aim.x, extra.aim.y) || 1;
  const dx = extra.aim.x / aimLength;
  const dy = extra.aim.y / aimLength;

  events.push({
    t: 'action_start', entity: player.id, action: 'pulse', x: player.x, y: player.y,
    dx, dy, startTick: state.tick, releaseTick: state.tick, endTick: state.tick + 8,
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
          if (state.surface[i] === SURF_FIRE || state.surface[i] === SURF_GAS || state.surface[i] === SURF_SPORES) {
            setSurface(state, i, SURF_NONE, 0);
            recordResonance(extra.resonance, 'kinetic');
          }
        }
      }
      return;
    }

    case 'flamethrower': {
      const { range, arc } = ABILITY_SHAPE.flamethrower;
      events.push({ t: 'flame_cone', x: player.x, y: player.y, dx, dy, range, arc });
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
          setSurface(state, i, SURF_FIRE, FIRE_FUEL_TICKS);
          recordResonance(extra.resonance, 'fire');
        }
      }
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const ox = enemy.x - player.x;
        const oy = enemy.y - player.y;
        const d = Math.hypot(ox, oy);
        if (d > range || d < 0.001) continue;
        if ((ox / d) * dx + (oy / d) * dy < Math.cos(arc)) continue;
        damageEntity(state, enemy, FLAMETHROWER_DAMAGE, events);
        recordResonance(extra.resonance, 'fire');
      }
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
        vx: dx * speed,
        vy: dy * speed,
        damage,
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
        damageEntity(state, best, damage, events);
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
 * Acorda os Ecos do poco na primeira vez que alguem chega perto.
 *
 * Congela a oferta. Recalcular a cada tick faria os dois Ecos trocarem de
 * habilidade enquanto o jogador anda entre eles — e a ressonancia MUDA enquanto
 * ele anda, porque andar ate o poco tambem provoca reacoes.
 *
 * Nao acontece no setor final: la o ponto e o nucleo do Guardiao, e parar para
 * escolher habilidade no meio da arena seria o pior lugar possivel para um menu.
 */
const revealWellOffers = (state: SurvivalState, events: SemanticEvent[]): void => {
  if (state.wellOffers.length > 0 || isFinalSector(state.sector)) return;
  const wellX = state.corePos.x + 0.5;
  const wellY = state.corePos.y + 0.5;
  let nearest: number | null = null;
  for (let slot = 0; slot < state.players.length; slot++) {
    const p = state.players[slot];
    if (!state.playerExtras[slot].joined || !p.alive) continue;
    if (Math.hypot(p.x - wellX, p.y - wellY) <= WELL_OFFER_REVEAL) nearest = slot;
  }
  if (nearest === null) return;

  // A oferta le a ressonancia de quem CHEGOU. No co-op os dois jogaram o mesmo
  // setor de formas diferentes, e escolher a de um deles e mais honesto do que
  // somar as duas: uma media de estilos nao descreve estilo nenhum.
  const offers = resonanceOffers(
    state.playerExtras[nearest].resonance,
    state.playerExtras[nearest].ability,
    state.config.seed,
    state.sector,
  );
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

const stepPlayer = (state: SurvivalState, slot: number, cmd: PlayerCommand, events: SemanticEvent[]): void => {
  const player = state.players[slot];
  const extra = state.playerExtras[slot];
  const dt = 1 / TICK_HZ;
  const coop = state.config.playerCount > 1;

  // slots nao reivindicados, abatidos e mortos nao agem
  if (!extra.joined || !player.alive || extra.downed) return;

  // Pedra do Bruiser interrompe movimento e todas as acoes. Timers do mundo e
  // dos modulos continuam correndo; o stun nao pausa a simulacao.
  if (player.stunnedUntil > state.tick) {
    player.vx = 0;
    player.vy = 0;
    extra.dodgeUntil = Math.min(extra.dodgeUntil, state.tick);
    extra.heat = Math.max(0, extra.heat - HEAT_DECAY_PER_TICK);
    return;
  }

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

  // mira
  const aimLen = Math.hypot(cmd.aim.x, cmd.aim.y);
  if (aimLen > 0.01) {
    extra.aim.x = cmd.aim.x / aimLen;
    extra.aim.y = cmd.aim.y / aimLen;
    player.facing.x = extra.aim.x;
    player.facing.y = extra.aim.y;
  }

  // esquiva
  if (cmd.dodge && state.tick >= extra.dodgeCooldownUntil) {
    const moveLen = Math.hypot(cmd.move.x, cmd.move.y);
    const dir = moveLen > 0.01
      ? { x: cmd.move.x / moveLen, y: cmd.move.y / moveLen }
      : { x: player.facing.x, y: player.facing.y };
    extra.dodgeDir = dir;
    extra.dodgeUntil = state.tick + DODGE_TICKS;
    extra.iframesUntil = state.tick + DODGE_IFRAME_TICKS;
    extra.dodgeCooldownUntil = state.tick + DODGE_COOLDOWN_TICKS;
    events.push({ t: 'dodge', x: player.x, y: player.y });
  }

  // movimento. `vx/vy` guarda deslocamento REAL para a mira preditiva do
  // Bruiser, em vez de assumir que o comando atravessou uma parede.
  const beforeMoveX = player.x;
  const beforeMoveY = player.y;
  if (state.tick < extra.dodgeUntil) {
    moveEntity(state, player, extra.dodgeDir.x * DODGE_SPEED * dt, extra.dodgeDir.y * DODGE_SPEED * dt);
  } else {
    const moveLen = Math.hypot(cmd.move.x, cmd.move.y);
    if (moveLen > 0.01) {
      const clamped = Math.min(1, moveLen);
      const nx = (cmd.move.x / moveLen) * clamped;
      const ny = (cmd.move.y / moveLen) * clamped;
      const speed = PLAYER_SPEED * surfaceSpeedMul(state, player);
      moveEntity(state, player, nx * speed * dt, ny * speed * dt);
    }
  }
  player.vx = (player.x - beforeMoveX) / dt;
  player.vy = (player.y - beforeMoveY) / dt;

  // extracao so libera depois de deixar a zona de entrada uma vez
  if (!state.leftEntryZone) {
    const distFromEntry = Math.hypot(player.x - (state.entry.x + 0.5), player.y - (state.entry.y + 0.5));
    if (distFromEntry > 4) state.leftEntryZone = true;
  }

  // calor decai
  extra.heat = Math.max(0, extra.heat - HEAT_DECAY_PER_TICK);

  // disparo principal
  if (
    cmd.fire &&
    state.tick >= extra.nextShotAt &&
    state.tick >= extra.overheatedUntil &&
    state.projectiles.length < MAX_PROJECTILES
  ) {
    extra.nextShotAt = state.tick + BOLT_COOLDOWN_TICKS;
    extra.heat += HEAT_PER_SHOT;

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
    if (moduleHasCapacity(extra, 'ricochet', state.tick)) modules.ricochet = { remainingBounces: 1 };
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
        damage: BOLT_DAMAGE * 0.85,
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
        vx: extra.aim.x * BOLT_SPEED,
        vy: extra.aim.y * BOLT_SPEED,
        damage: BOLT_DAMAGE,
        modules: armed,
        distanceTravelled: 0,
        hostile: false,
        leavesBiofluid: false,
        ttl: Math.ceil(TICK_HZ * 1.4),
      });
    }
    events.push({
      t: 'action_start', entity: player.id, action: 'player_shot', x: player.x, y: player.y,
      dx: extra.aim.x, dy: extra.aim.y, startTick: state.tick, releaseTick: state.tick, endTick: state.tick + 7,
    });
    events.push({ t: 'shot', x: player.x, y: player.y, dx: extra.aim.x, dy: extra.aim.y, owner: player.id });
    state.stats.shotsFired += 1;
    if (extra.heat >= HEAT_MAX) {
      extra.overheatedUntil = state.tick + OVERHEAT_LOCK_TICKS;
      extra.heat = HEAT_MAX * 0.55;
      damageEntity(state, player, OVERHEAT_SELF_DAMAGE, events, { kind: 'overheat' });
      markDiscovery(state.stats, DISCOVERY_SELF_HARM);
      events.push({ t: 'overheat', x: player.x, y: player.y });
    }
  }

  // habilidade: pulso cinetico (empurra criaturas, apaga fogo, dissipa gas)
  if (cmd.ability && state.tick >= extra.abilityCooldownUntil) {
    extra.abilityCooldownUntil = state.tick + abilityDefinition(extra.ability).cooldownTicks;
    castAbility(state, slot, events);
  }

  // Celula de Purga: cartucho interno de cura e descontaminacao.
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

  // interagir: revive parceiro > nucleo > terminal/cofre > extracao
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
          op.hp = Math.max(1, Math.floor(op.maxHp * REVIVE_HP_FRACTION));
          events.push({ t: 'revive', x: op.x, y: op.y, slot: other, tick: state.tick });
          state.stats.revivesGiven += 1;
          events.push({ t: 'message', text: `Parceiro revivido.` });
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
      // As outras ofertas somem: a escolha e UMA, e um Eco que continua ali
      // depois de voce escolher convida a voltar e trocar de novo.
      for (const other of state.wellOffers) {
        if (other.takenBy === null) other.takenBy = slot;
      }
      events.push({ t: 'ability_taken', slot, ability: offer.ability, x: offer.x, y: offer.y });
      return;
    }

    // O mesmo ponto significa coisas diferentes conforme a profundidade: nos
    // setores anteriores ao ultimo ele e o POCO, e no ultimo e o nucleo.
    const distCore = Math.hypot(player.x - (state.corePos.x + 0.5), player.y - (state.corePos.y + 0.5));
    if (!isFinalSector(state.sector) && distCore < 1.6) {
      // Descida COLETIVA, pela mesma razao da extracao: um parceiro deixado
      // para tras num mapa que deixou de existir nao teria como ser resgatado.
      const standing = standingPlayers(state);
      const allNear = standing.every(
        (p) => Math.hypot(p.x - (state.corePos.x + 0.5), p.y - (state.corePos.y + 0.5)) <= EXTRACT_RADIUS
      );
      const anyDowned = state.playerExtras.some((e, i) => e.joined && state.players[i].alive && e.downed);
      if (anyDowned) {
        events.push({ t: 'message', text: 'Revele o parceiro abatido antes de descer.' });
      } else if (!allNear) {
        events.push({ t: 'message', text: 'Aguarde todos no poco para descer.' });
      } else {
        descend(state, events);
      }
      return;
    }
    if (isFinalSector(state.sector) && !state.coreTaken && distCore < 1.6) {
      state.coreTaken = true;
      extra.hasCore = true;
      events.push({ t: 'pickup_core', x: player.x, y: player.y });
      events.push({ t: 'message', text: 'Nucleo extraido. O Veio despertou - volte para a entrada!' });
      return;
    }
    for (const site of state.salvageSites) {
      const terminalDistance = Math.hypot(
        player.x - (site.terminal.x + 0.5),
        player.y - (site.terminal.y + 0.5)
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
        const offsets = [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2]] as const;
        let spawned = 0;
        for (let i = 0; i < offsets.length && spawned < 2 + site.tier; i++) {
          const [dx, dy] = offsets[(i + site.id) % offsets.length];
          const x = site.terminal.x + dx;
          const y = site.terminal.y + dy;
          if (x < 1 || y < 1 || x >= state.config.width - 1 || y >= state.config.height - 1) continue;
          if (state.solid[y * state.config.width + x] !== SOLID_NONE) continue;
          spawnEnemy(state, spawned === 0 && site.tier > 1 ? 'spitter' : 'stalker', x, y, false);
          spawned++;
        }
        return;
      }

      const cacheDistance = Math.hypot(
        player.x - (site.cache.x + 0.5),
        player.y - (site.cache.y + 0.5)
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
        events.push({ t: 'salvage_cache_opened', siteId: site.id, slot, x: site.cache.x, y: site.cache.y });
        events.push({ t: 'purge_cell_acquired', slot, amount: 1 });
        return;
      }
    }
    // extracao coletiva: todos os players de pe precisam estar na zona de entrada
    const distEntry = Math.hypot(player.x - (state.entry.x + 0.5), player.y - (state.entry.y + 0.5));
    if (distEntry < 1.6 && state.leftEntryZone) {
      const allAtEntry = standingPlayers(state).every(
        (p) => Math.hypot(p.x - (state.entry.x + 0.5), p.y - (state.entry.y + 0.5)) <= EXTRACT_RADIUS
      );
      const anyDowned = state.playerExtras.some((e, i) => e.joined && state.players[i].alive && e.downed);
      if (allAtEntry && !anyDowned) {
        const withCore = state.playerExtras.some((e) => e.hasCore);
        state.phase = withCore ? 'extracted_with_core' : 'extracted';
        events.push({ t: 'extracted', withCore });
      } else if (anyDowned) {
        events.push({ t: 'message', text: 'Revele o parceiro abatido antes de extrair.' });
      } else {
        events.push({ t: 'message', text: 'Aguarde todos na saida para extrair.' });
      }
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
  events: SemanticEvent[]
): boolean => {
  if (!extra || slot === undefined) return false;
  if (!moduleHasCapacity(extra, id, state.tick)) return false;
  // Modulo por tempo vale enquanto durar: nao ha carga a debitar.
  if (activeModule(extra, id)?.lifetime.kind === 'timer') return true;
  return consumeModuleCharge(extra, id, slot, events);
};

/** O projetil ainda tem rebote sobrando neste voo? */
const canBounce = (proj: Projectile): boolean => (proj.modules?.ricochet?.remainingBounces ?? 0) > 0;

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
  events: SemanticEvent[]
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
const bounceOffSolid = (proj: Projectile, prevX: number, prevY: number, cx: number, cy: number): void => {
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

    // O missil rastreador CORRIGE o rumo, e nao aponta.
    //
    // A correcao e limitada por tick, e e isso que o impede de ser infalivel:
    // contra um alvo que muda de direcao ele erra a curva e passa reto. Acertar
    // exige atirar quando o inimigo esta comprometido — que e a decisao que a
    // habilidade cobra em troca do dano alto.
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
        proj.modules?.conductive && ownerExtra && moduleHasCapacity(ownerExtra, 'conductive', state.tick)
      );
      const cls = projectileClass(proj, conductiveReady, explosiveArmed);

      if (state.solid[i] !== SOLID_NONE) {
        // Explosive vem ANTES do disco: quem equipa os dois troca o retorno por
        // uma detonacao, e essa e a escolha — nao um dos dois sumindo em silencio.
        if (explosiveArmed && !proj.hostile && procModule(state, ownerExtra, ownerSlot, 'explosive', events)) {
          explodeAt(state, proj.x, proj.y, EXPLOSION_RADIUS, events, origin);
          dead = true;
          break;
        }

        if (proj.disc) {
          proj.x = prevX;
          proj.y = prevY;
          beginDiscReturn(state, proj, ownerExtra, ownerSlot, events);
          break;
        }

        const eventStart = events.length;
        const { stop, broke } = impactSolid(state, cx, cy, cls, events, origin);
        const dischargedHere = events.slice(eventStart).some((event) => event.t === 'discharge');
        if (conductiveReady && ownerExtra && ownerSlot !== undefined && dischargedHere) {
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
            if (!broke && canBounce(proj) && procModule(state, ownerExtra, ownerSlot, 'ricochet', events)) {
              bounceOffSolid(proj, prevX, prevY, cx, cy);
              break;
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
          conductiveReady && ownerExtra && ownerSlot !== undefined &&
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
        conductiveReady && ownerExtra && ownerSlot !== undefined &&
        state.surface[i] === SURF_BIOFLUID &&
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
            const vulnerable = extra.iframesUntil <= state.tick;
            // O dono do projetil pode ja ter morrido antes de a pedra chegar —
            // o telegrafo dura 0,8 s e o voo, mais. Sem o dono, o arquetipo sai
            // do proprio projetil: `rock` so existe vindo do bruiser.
            const shooter = state.enemies.find((e) => e.id === proj.owner);
            damageEntity(state, player, proj.damage, events, {
              kind: 'enemy_projectile',
              archetype: (shooter?.archetype as EnemyArchetype) ?? (proj.kind === 'rock' ? 'bruiser' : 'spitter'),
              elite: shooter?.elite ?? false,
              projectile: proj.kind,
            });
            if (proj.kind === 'rock' && vulnerable) {
              stunEntity(state, player, BRUISER_ROCK_STUN_TICKS);
            }
            if (proj.leavesBiofluid && state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
              setSurface(state, i, SURF_BIOFLUID, 0);
            }
            dead = true;
            break;
          }
        }
        if (dead) break;
      } else {
        for (const enemy of state.enemies) {
          if (!enemy.alive) continue;
          const discHits = proj.disc
            ? (proj.disc.phase === 'outbound' ? proj.disc.outboundHits : proj.disc.returnHits)
            : undefined;
          if (discHits?.includes(enemy.id) || proj.hits?.includes(enemy.id)) continue;
          if (Math.hypot(enemy.x - proj.x, enemy.y - proj.y) >= enemy.radius + (proj.radius ?? 0.2)) continue;

          let damage = proj.damage;
          const enemyCell = cellIndexAt(state, enemy.x, enemy.y);
          let conductiveTriggered = false;
          const conductiveAvailable = Boolean(
            proj.modules?.conductive && ownerExtra && ownerSlot !== undefined &&
            moduleHasCapacity(ownerExtra, 'conductive', state.tick)
          );
          if (
            conductiveAvailable && ownerExtra && ownerSlot !== undefined &&
            state.surface[enemyCell] === SURF_BIOFLUID &&
            consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events)
          ) {
            conductiveTriggered = true;
            damage *= 1.6;
            dischargeAt(state, Math.floor(enemy.x), Math.floor(enemy.y), events, origin);
          }
          if (
            conductiveAvailable && !conductiveTriggered && !isStoneEnemy(enemy) &&
            ownerExtra && ownerSlot !== undefined &&
            consumeModuleCharge(ownerExtra, 'conductive', ownerSlot, events)
          ) {
            conductiveTriggered = true;
          }
          if (conductiveTriggered && !isStoneEnemy(enemy)) {
            stunEntity(state, enemy, CONDUCTIVE_STUN_TICKS);
          }
          damageEntity(state, enemy, damage, events, { kind: 'player_shot' });

          if (
            proj.modules?.siphon && owner && ownerExtra && ownerSlot !== undefined &&
            owner.hp < owner.maxHp && moduleHasCapacity(ownerExtra, 'siphon', state.tick) &&
            consumeModuleCharge(ownerExtra, 'siphon', ownerSlot, events)
          ) {
            owner.hp = Math.min(owner.maxHp, owner.hp + 2);
          }

          // Detonar um Portador conta como estouro para quem o abateu, mesmo que
          // a explosao em si nasca com `source: 'enemy'`. O que a ressonancia
          // registra e a DECISAO do jogador — ele escolheu matar aquilo de perto.
          if (enemy.archetype === 'bomber' && !enemy.alive) {
            recordPlayerResonance(state, proj.owner, 'blast');
          }
          if (proj.kind === 'seeker') {
            // O missil detona no alvo. O raio e pequeno — ele e uma resposta a UM
            // inimigo, nao uma segunda granada — e a explosao herda o `origin` do
            // jogador, entao ela machuca quem atirou tambem se ele estiver colado.
            explodeAt(state, proj.x, proj.y, SEEKER_BLAST_RADIUS, events, origin);
            dead = true;
          } else if (explosiveArmed && procModule(state, ownerExtra, ownerSlot, 'explosive', events)) {
            explodeAt(state, proj.x, proj.y, EXPLOSION_RADIUS, events, origin);
            dead = true;
          } else if (proj.disc) {
            // O disco ja atravessa por natureza. Piercing nao e cobrado aqui
            // porque nao ha nada que ele acrescente a este veiculo.
            discHits?.push(enemy.id);
          } else if (proj.modules?.piercing && procModule(state, ownerExtra, ownerSlot, 'piercing', events)) {
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
      if (i >= 0 && i < state.solid.length && state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
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

/** Ondas de pressao por contaminacao (thresholds unicos). */
const stepContamination = (state: SurvivalState, events: SemanticEvent[]): void => {
  // O ritmo cresce com a profundidade E com o nucleo na mao. A profundidade e
  // o que impede o poco de virar botao de reset; o nucleo e a cobranca do
  // caminho de volta.
  const sectorScale = 1 + (state.sector - 1) * CONTAMINATION_SECTOR_SCALE;
  state.contamination = Math.min(
    1,
    state.contamination + CONTAMINATION_PER_TICK * sectorScale * (state.coreTaken ? 2.2 : 1)
  );
  const thresholds: Array<[number, number]> = [
    [0.35, 2],
    [0.6, 3],
    [0.85, 4],
  ];
  for (let w = 0; w < thresholds.length; w++) {
    const [level, count] = thresholds[w];
    // contador one-shot: vents sao reescritos por stepCells, entao um sentinel
    // ali seria apagado e a onda dispararia repetidamente.
    if (state.contamination >= level && state.contaminationWaves <= w) {
      state.contaminationWaves = w + 1;
      events.push({ t: 'message', text: 'O Veio se agita - a contaminacao aumenta.' });
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
    }
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
  if (e.hasCore) {
    e.hasCore = false;
    state.coreTaken = false; // volta ao pedestal, recuperavel pelo parceiro
    events.push({ t: 'message', text: 'O nucleo caiu com o portador.' });
  }
  events.push({
    t: 'death', x: p.x, y: p.y, entity: p.id, archetype: 'prospector',
    facingX: p.facing.x, facingY: p.facing.y, tick: state.tick,
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
        (o, i) => i !== slot && state.playerExtras[i].joined && o.alive && !state.playerExtras[i].downed
      );
      if (hasStandingAlly) {
        // co-op: entra em estado abatido, revivel pelo parceiro
        e.downed = true;
        e.bleedoutAt = state.tick + BLEEDOUT_TICKS;
        state.stats.timesDowned += 1;
        events.push({
          t: 'player_down', slot, x: p.x, y: p.y,
          facingX: p.facing.x, facingY: p.facing.y, tick: state.tick,
        });
      } else {
        events.push({
          t: 'player_down', slot, x: p.x, y: p.y,
          facingX: p.facing.x, facingY: p.facing.y, tick: state.tick,
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
  state.summary = buildSummary(state, state.phase === 'dead' ? runEndingCause(state) : null);
};

/**
 * A cota paga em ESCOLHA DE MODULO — a mesma moeda com que o salvage paga risco.
 *
 * Era a peca que faltava do minerio: o prospector e um robo de mineracao que nao
 * minerava, e "pontos no fim" nao e beneficio, e placar. Pagando com a moeda que
 * o jogo ja usa, as duas atividades ficam COMPARAVEIS dentro da run — vale mais
 * abrir aquele terminal ou arrancar aquele veio? — em vez de a mineracao virar
 * uma economia paralela com regras proprias.
 *
 * `sourceSiteId` negativo separa a oferta da cota das ofertas de salvage no
 * `rollModuleChoice`, que semeia por site: reusar um id de site faria a escolha
 * paga em minerio sair identica a de um cofre que o jogador ja abriu.
 *
 * Roda depois dos inimigos porque o drop do miner morto entra na mesma contagem:
 * o minerio que ele carregava conta como cota no mesmo tick em que ele cai.
 */
const payOreQuota = (state: SurvivalState, events: SemanticEvent[]): void => {
  const earned = Math.floor(state.stats.oreCollected / ORE_PER_MODULE);
  if (earned <= state.oreModulesPaid) return;
  state.oreModulesPaid = earned;
  markDiscovery(state.stats, DISCOVERY_ORE_QUOTA);
  // Uma escolha por jogador de pe. No co-op a cota e do time — quem carrega a
  // picareta e quem cobre nao deveriam ser pagos de forma diferente por isso.
  for (const player of standingPlayers(state)) {
    const extra = state.playerExtras[player.slot ?? 0];
    if (extra.pendingModuleChoice) continue;
    const options = rollModuleChoice(state.config.seed, -earned, 2, extra, state.tick);
    extra.pendingModuleChoice = { sourceSiteId: -earned, options, createdAtTick: state.tick };
  }
};

export const stepRun = (state: SurvivalState, commands: readonly PlayerCommand[]): StepResult => {
  const events: SemanticEvent[] = [];

  if (state.phase === 'dead' || state.phase === 'extracted' || state.phase === 'extracted_with_core') {
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
  applyCellHazards(state, events);
  stepContamination(state, events);
  payOreQuota(state, events);
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
    mix(e.purgeCells);
    // A habilidade equipada MUDA o resultado da run, entao ela e estado
    // autoritativo: duas simulacoes que discordam de qual habilidade o slot
    // carrega divergem no primeiro uso, e o replay tem de acusar isso.
    mixString(e.ability);
    mix(e.resonance.fire);
    mix(e.resonance.current);
    mix(e.resonance.blast);
    mix(e.resonance.kinetic);
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
  mix(state.sector);
  mix(state.coreTaken ? 1 : 0);
  mix(Math.round(state.contamination * 100000));
  mix(state.contaminationWaves);
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
  mix(state.guardianSummoned ? 1 : 0);
  mix(state.arenaClosed ? 1 : 0);
  mix(state.arenaBarrierCells.length);
  for (const cell of state.arenaBarrierCells) mix(cell);
  for (const enemy of state.enemies) {
    mix(enemy.id);
    mix(Math.round(enemy.x * 1000));
    mix(Math.round(enemy.y * 1000));
    mix(Math.round(enemy.hp * 100));
    mix(enemy.stunnedUntil);
    mix(enemy.alive ? 1 : 0);
    if (enemy.action) {
      mixString(enemy.action.kind);
      mix(enemy.action.startedAt);
      mix(enemy.action.releaseAt);
      mix(enemy.action.endsAt);
      mix(Math.round(enemy.action.direction.x * 1000));
      mix(Math.round(enemy.action.direction.y * 1000));
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
