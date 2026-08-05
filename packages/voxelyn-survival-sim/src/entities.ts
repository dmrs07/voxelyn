import {
  ALERT_TICKS,
  BIOFLUID_SLOW,
  WITNESS_RANGE,
  ARCHCANTOR_COOLDOWN_TICKS,
  ARCHCANTOR_CRYSTAL_BUDGET,
  ARCHCANTOR_HP,
  ARCHCANTOR_PULSE_RADIUS,
  ARCHCANTOR_SILENT_ARMOR,
  ARCHCANTOR_WINDUP_TICKS,
  FROST_QUEEN_FREEZE_COOLDOWN_TICKS,
  FROST_QUEEN_FREEZE_RADIUS,
  FROST_QUEEN_FREEZE_WINDUP_TICKS,
  FROST_QUEEN_HP,
  FROST_QUEEN_ICE_ARMOR,
  FROST_QUEEN_ICE_RADIUS,
  FROST_QUEEN_ICE_THRESHOLD,
  FROST_QUEEN_RADIUS,
  FROST_QUEEN_SPEED,
  FROST_QUEEN_WRAITHS,
  FROST_QUEEN_WRAITH_HP_FRACTION,
  FURNACE_HEART_CYCLE_TICKS,
  FURNACE_HEART_HOT_ARMOR,
  FURNACE_HEART_HP,
  FURNACE_HEART_RADIUS,
  FURNACE_HEART_WAVE_ARC,
  FURNACE_HEART_WAVE_INTERVAL_TICKS,
  FURNACE_HEART_WAVE_RADIUS,
  LEVIATHAN_BREACH_DAMAGE,
  LEVIATHAN_BREACH_RADIUS,
  LEVIATHAN_BREACH_SEARCH,
  LEVIATHAN_BREACH_WINDUP_TICKS,
  LEVIATHAN_DIVE_MIN_TICKS,
  LEVIATHAN_HP,
  LEVIATHAN_LEAD_SECONDS,
  LEVIATHAN_RADIUS,
  LEVIATHAN_SUBMERGED_ARMOR,
  LEVIATHAN_SURFACE_SPEED,
  LEVIATHAN_SURFACE_TICKS,
  LEVIATHAN_SWIM_SPEED,
  LUNG_MATRIX_BREATH_INTERVAL_TICKS,
  LUNG_MATRIX_BURN_DAMAGE,
  LUNG_MATRIX_CYCLE_TICKS,
  LUNG_MATRIX_EXHALE_LENGTH,
  LUNG_MATRIX_EXHALE_WIDTH,
  LUNG_MATRIX_HP,
  LUNG_MATRIX_INHALE_PER_BREATH,
  LUNG_MATRIX_INHALE_RADIUS,
  LUNG_MATRIX_RADIUS,
  MAGNETARCH_CRUSH_DAMAGE,
  MAGNETARCH_CRUSH_RANGE,
  MAGNETARCH_CYCLE_TICKS,
  MAGNETARCH_FIELD_RANGE,
  MAGNETARCH_FIELD_TICK_INTERVAL,
  MAGNETARCH_HP,
  MAGNETARCH_PULL_STEP,
  MAGNETARCH_RADIUS,
  MAGNETARCH_SPEED,
  MAGNETARCH_TETHER_DAMAGE,
  MAGNETARCH_TETHER_RANGE,
  MAX_ENEMIES,
  DEVOURER_BURROWED_ARMOR,
  DEVOURER_BURROW_MIN_TICKS,
  DEVOURER_BURROW_SPEED,
  DEVOURER_ERUPT_DAMAGE,
  DEVOURER_ERUPT_RADIUS,
  DEVOURER_ERUPT_SEARCH,
  DEVOURER_LAUNCH_DAMAGE,
  DEVOURER_LAUNCH_SEARCH,
  DEVOURER_LEAP_MAX_RANGE,
  DEVOURER_LEAP_MIN_RANGE,
  DEVOURER_LEAP_SPEED,
  DEVOURER_LEAP_TURN,
  DEVOURER_ERUPT_WINDUP_TICKS,
  DEVOURER_HP,
  DEVOURER_LEAD_SECONDS,
  DEVOURER_RADIUS,
  DEVOURER_SURFACE_SPEED,
  DEVOURER_HOP_GAP_TICKS,
  DEVOURER_LEAPS_PER_CYCLE,
  DEVOURER_STUCK_TICKS,
  DEVOURER_TRAIL_WIDTH,
  SURF_GLASS,
  SURF_SCORCHED,
  SURF_SILT,
  DIAMANDIS_BEAM_COOLDOWN_TICKS,
  DIAMANDIS_BEAM_DAMAGE,
  DIAMANDIS_BEAM_LENGTH,
  DIAMANDIS_BEAM_STEP,
  DIAMANDIS_BEAM_WINDUP_TICKS,
  DIAMANDIS_DEMOLISH_CHARGES,
  DIAMANDIS_DEMOLISH_COOLDOWN_TICKS,
  DIAMANDIS_DEMOLISH_MIN_RANGE,
  DIAMANDIS_DEMOLISH_RADIUS,
  DIAMANDIS_DEMOLISH_RANGE,
  DIAMANDIS_DEMOLISH_SPREAD,
  DIAMANDIS_DEMOLISH_WINDUP_TICKS,
  DIAMANDIS_DRILL_COOLDOWN_TICKS,
  DIAMANDIS_DRILL_DAMAGE,
  DIAMANDIS_DRILL_MAX_RANGE,
  DIAMANDIS_DRILL_MIN_RANGE,
  DIAMANDIS_DRILL_SPEED,
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_WIDTH,
  DIAMANDIS_DRILL_WINDUP_TICKS,
  DIAMANDIS_HP,
  DIAMANDIS_MODULE_COUNT,
  DIAMANDIS_MODULE_EXPOSE_AT,
  DIAMANDIS_MODULE_ORE,
  DIAMANDIS_RADIUS,
  DIAMANDIS_REACTOR_CADENCE_SCALE,
  DIAMANDIS_REACTOR_EMBER_RADIUS,
  DIAMANDIS_REACTOR_EMBER_TICKS,
  DIAMANDIS_REACTOR_HP_FRACTION,
  DIAMANDIS_SPEED,
  SOLID_ORE,
  SOLID_ORE_CHIPPED,
  BRUISER_HURL_COOLDOWN_TICKS,
  BRUISER_HURL_DAMAGE,
  BRUISER_HURL_FLIGHT_TILES,
  BRUISER_HURL_MAX_RANGE,
  BRUISER_HURL_MIN_RANGE,
  BRUISER_HURL_REACH,
  BRUISER_HURL_SPEED,
  BRUISER_HURL_WINDUP_TICKS,
  BRUISER_ROCK_RADIUS,
  MINER_CLEAVE_COOLDOWN_TICKS,
  MINER_CLEAVE_DAMAGE,
  MINER_CLEAVE_RADIUS,
  MINER_CLEAVE_WINDUP_TICKS,
  MINER_FEAR_HEAT,
  MINER_FLEE_SPEED,
  MINER_HP,
  MINER_NOTICE_RANGE,
  MINER_ORE_DROP,
  MINER_RAGE_HEAT,
  MINER_RAGE_SPEED,
  BISHOP_FUNGAL_SEARCH,
  BISHOP_HP,
  BISHOP_NOVA_COOLDOWN_TICKS,
  BISHOP_NOVA_DAMAGE,
  BISHOP_NOVA_FUNGAL_TICKS,
  BISHOP_NOVA_RADIUS,
  BISHOP_NOVA_SEEK_TICKS,
  BISHOP_NOVA_WINDUP_TICKS,
  BISHOP_REGEN_PER_TICK,
  BISHOP_RETREAT_HP_FRACTION,
  HORSE_CHARGE_COOLDOWN_TICKS,
  HORSE_CHARGE_MAX_RANGE,
  HORSE_CHARGE_MIN_RANGE,
  HORSE_CHARGE_SPEED,
  HORSE_CHARGE_TICKS,
  HORSE_CHARGE_WINDUP_TICKS,
  HORSE_HP,
  HORSE_TRAIL_DELAY_TICKS,
  HORSE_TURN_RATE,
  HORSE_TRAIL_FUEL_TICKS,
  GUARDIAN_ARENA_EXITS,
  GUARDIAN_ARENA_RADIUS,
  GUARDIAN_FAN_SPREAD,
  GUARDIAN_PATH_INTERVAL_TICKS,
  GUARDIAN_ROCK_DAMAGE,
  GUARDIAN_ROCK_FLIGHT_TILES,
  GUARDIAN_ROCK_RADIUS,
  GUARDIAN_ROCK_SPEED,
  GUARDIAN_SALVO_COOLDOWN_TICKS,
  GUARDIAN_SUMMON_COUNT,
  GUARDIAN_VOLLEY_INTERVAL_TICKS,
  GUARDIAN_VOLLEY_SHOTS,
  EXPLOSION_DAMAGE,
  SOLID_NONE,
  SPORE_LIFE_TICKS,
  SURF_BIOFLUID,
  SURF_WATER,
  WATER_SLOW,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_NONE,
  SURF_SPORES,
  TICK_HZ,
  BELLOWS_BREATH_INTERVAL_TICKS,
  BELLOWS_BREATH_RADIUS,
  BELLOWS_CYCLE_TICKS,
  BELLOWS_EXHALE_LENGTH,
  BELLOWS_INHALE_PER_BREATH,
  GAS_LIFE_TICKS,
  LAMPREY_LUNGE_COOLDOWN_TICKS,
  LAMPREY_LUNGE_RANGE,
  LAMPREY_LUNGE_WINDUP_TICKS,
  RESONANT_COOLDOWN_TICKS,
  RESONANT_CRYSTAL_BUDGET,
  RESONANT_PULSE_RADIUS,
  RESONANT_WINDUP_TICKS,
  SCORIAC_ARMOR_SCALE,
  SCORIAC_HOT_SPEED_SCALE,
  SCORIAC_HOT_TICKS,
  SOLID_CRYSTAL,
  SURF_EMBER,
  SURF_GAS,
  SURF_ICE,
  WRAITH_LUNGE_COOLDOWN_TICKS,
  WRAITH_LUNGE_RANGE,
  WRAITH_LUNGE_WINDUP_TICKS,
  WRAITH_UNDER_ICE_SPEED_SCALE,
  SULFUR_BOMBER_GAS_LIFE_TICKS,
  SULFUR_BOMBER_GAS_RADIUS,
  UNDERTAKER_PULL_COOLDOWN_TICKS,
  UNDERTAKER_SALVAGE_ESCAPE_DIST,
  UNDERTAKER_SALVAGE_RANGE,
  UNDERTAKER_SALVAGE_REACH,
  UNDERTAKER_SALVAGE_WINDUP_TICKS,
  UNDERTAKER_PULL_MIN_RANGE,
  UNDERTAKER_PULL_RANGE,
  UNDERTAKER_PULL_STEP,
  UNDERTAKER_PULL_TILES,
  UNDERTAKER_PULL_WINDUP_TICKS,
  UNDERTAKER_SLAM_DAMAGE,
  UNDERTAKER_SLAM_RANGE,
  UNDERTAKER_SLAM_WINDUP_TICKS,
} from './constants.js';
import { breakSolid, canRip, chargeCells, closeArena, explodeAt, igniteCell, isConductiveSurface, meltIce, openArena, ripSolid, setSurface } from './cells.js';
import { findPath, hasLineOfSight } from './pathing.js';
import { isBossArchetype } from './bosses.js';
import { markSectorBossDown, runDepth } from './depth.js';
import { addDamageTenths, markDiscovery, recordKill } from './stats.js';
import {
  BELLOWS_EXHALING,
  BELLOWS_INHALING,
  DEVOURER_AIRBORNE,
  DEVOURER_BURROWED,
  DEVOURER_STUCK,
  DEVOURER_SURFACED,
  FURNACE_COOLING,
  FURNACE_OVERHEATING,
  LUNG_EXHALING,
  LUNG_INHALING,
  MAGNET_ATTRACT,
  MAGNET_REPEL,
  BOSS_MODULE_DRILL,
  BOSS_MODULE_SCANNER,
  BOSS_MODULE_TOWER,
  BOSS_PHASE_REACTOR,
  BOSS_PHASE_SUMMON,
  DISCOVERY_BISHOP_HEALED,
  DISCOVERY_BISHOP_NOVA_SURVIVED,
  DISCOVERY_DIAMANDIS_CORRIDOR,
  DISCOVERY_CATHEDRAL_SILENCED,
  DISCOVERY_DIAMANDIS_MODULE,
  DISCOVERY_FURNACE_COOLED,
  DISCOVERY_LUNG_IGNITED,
  DISCOVERY_MAGNET_BANDED,
  DISCOVERY_QUEEN_THAWED,
  DISCOVERY_MINER_ENRAGED,
  DISCOVERY_MINER_FLED,
  LURKER_EXPOSED,
  LURKER_HIDDEN,
  MINER_MOOD_ENRAGED,
  MINER_MOOD_FLEEING,
  MINER_MOOD_PASSIVE,
  SCORIAC_COOL,
  SCORIAC_HOT,
} from './types.js';
import type {
  DamageCause,
  EffectOrigin,
  Entity,
  EntityAction,
  EntityActionKind,
  EnemyArchetype,
  SemanticEvent,
  SurvivalState,
  Vec2,
} from './types.js';

export type ArchetypeDef = {
  hp: number;
  speed: number;
  radius: number;
  contactDamage: number;
  contactCooldown: number;
  aggroRange: number;
};

export const ARCHETYPES: Record<EnemyArchetype, ArchetypeDef> = {
  stalker: { hp: 26, speed: 5.2, radius: 0.32, contactDamage: 8, contactCooldown: 10, aggroRange: 9 },
  // 160 e nao 95: com 95 ele morria em 1,7 s de fogo sustentado, o que dava
  // tempo para exatamente UM arremesso — a mecanica nova mal existia. Aqui vida
  // e o portao de quantas vezes ela acontece, e nao um jeito de alongar uma luta
  // inofensiva (que e por que o guardiao NAO ganha vida).
  bruiser: { hp: 160, speed: 2.3, radius: 0.46, contactDamage: 18, contactCooldown: 16, aggroRange: 7 },
  spitter: { hp: 30, speed: 2.8, radius: 0.34, contactDamage: 6, contactCooldown: 14, aggroRange: 9 },
  bomber: { hp: 18, speed: 3.7, radius: 0.3, contactDamage: 4, contactCooldown: 10, aggroRange: 9 },
  guardian: { hp: 420, speed: 2.1, radius: 0.68, contactDamage: 24, contactCooldown: 14, aggroRange: 7 },
  // Vida MENOR que a do guardiao de proposito. A dificuldade do bispo nao mora
  // na barra: em cima do fungo ele se cura mais rapido do que se leva dano, e
  // fora dele cai depressa. Somar vida grande a cura seria cobrar as duas coisas
  // pelo mesmo problema e transformar a luta em espera.
  bishop: { hp: BISHOP_HP, speed: 2.6, radius: 0.6, contactDamage: 20, contactCooldown: 14, aggroRange: 10 },
  // Alcance de aggro alto e velocidade alta porque a ameaca dele e CHEGAR: um
  // cavalo que espera o jogador entrar num raio pequeno nunca teria distancia
  // para investir, e a investida e o bicho inteiro.
  fungal_horse: { hp: HORSE_HP, speed: 4.4, radius: 0.44, contactDamage: 14, contactCooldown: 12, aggroRange: 13 },
  // Corpo GRANDE (raio 0,46, entre o bruiser e o guardiao) e vida BAIXA.
  //
  // A combinacao e deliberada e diz o que ele e: uma maquina de carga de 2,5 m
  // que nunca foi construida para lutar. Ele nao e um desafio de combate, e uma
  // DECISAO — quem decidir destrui-lo consegue, sempre, e o custo nunca foi a
  // luta. Subir a vida junto com o tamanho transformaria a decisao num
  // orcamento de municao, que e outra coisa.
  miner: { hp: MINER_HP, speed: MINER_RAGE_SPEED, radius: 0.46, contactDamage: 6, contactCooldown: 18, aggroRange: MINER_NOTICE_RANGE },
  // ------------------------------------------------------------------------
  // Bestiario de assinatura (um por estrato; ver constants.ts).
  // ------------------------------------------------------------------------
  // Lento e parrudo de proposito: a ameaca dele nao e alcancar ninguem, e o
  // ESPACO que os cristais armados negam. Matar e facil; matar DE PERTO, entre
  // cristais carregando, e a decisao.
  resonant: { hp: 95, speed: 1.6, radius: 0.44, contactDamage: 10, contactCooldown: 16, aggroRange: 10 },
  // Rapida NA AGUA (a lentidao da agua nao vale para ela — e o elemento dela).
  // Vida baixa: a defesa e nao estar visivel, nao ser um saco de pancada.
  mud_lamprey: { hp: 55, speed: 3.6, radius: 0.4, contactDamage: 16, contactCooldown: 14, aggroRange: 11 },
  // Corpo largo, quase parado: ele e um orgao do bioma, nao um cacador. O
  // perigo dele e ONDE o gas passa a estar, nunca a perseguicao.
  bellows: { hp: 80, speed: 1.7, radius: 0.5, contactDamage: 10, contactCooldown: 16, aggroRange: 9 },
  // Vida media com couraça que corta mais da metade do dano: frio, ele demora
  // como um bruiser; quente, morre rapido — e corre atras da troca.
  scoriac: { hp: 130, speed: 2.4, radius: 0.44, contactDamage: 16, contactCooldown: 14, aggroRange: 8 },
  frost_wraith: { hp: 48, speed: 3.8, radius: 0.36, contactDamage: 14, contactCooldown: 12, aggroRange: 11 },
  // Mesmo chassi do Spore Bomber (vida baixa, corre e estoura): trocar os
  // numeros faria dele outro inimigo, e ele e o MESMO inimigo com outra
  // quimica. O que muda esta na morte — gas no lugar de esporo.
  sulfur_bomber: { hp: 18, speed: 3.7, radius: 0.3, contactDamage: 4, contactCooldown: 10, aggroRange: 9 },
  // Lento e pesado: ele nao precisa te alcancar, ele te TRAZ. Vida alta de
  // bruiser porque o encontro tem de durar o bastante para o puxao acontecer
  // pelo menos duas vezes — uma so seria um susto, nao uma regra aprendida.
  undertaker: { hp: 145, speed: 1.9, radius: 0.5, contactDamage: 12, contactCooldown: 16, aggroRange: UNDERTAKER_PULL_RANGE },
  // DIAMANDIS. Vida de chefe e corpo MODERADO: visualmente ele e dez vezes um
  // Prospector, mas uma hitbox gigante transformaria toda parede em gaiola e
  // todo tiro em acerto garantido. O tamanho dele mora no sprite e no ESTRAGO
  // que ele deixa no mapa, nunca no raio de colisao. Lento porque nunca foi
  // feito para alcancar ninguem: o perigo e o caminho que ele abre.
  // DEVORADOR BRANCO. Vida de chefe e corpo grande, mas o numero que importa e
  // a REDUCAO submerso (ver DEVOURER_BURROWED_ARMOR): a barra dele nao e o
  // problema, a janela e. `speed` fica com a velocidade de superficie — o
  // mergulho tem a propria, e ele nem usa `moveEntity` la.
  white_devourer: {
    hp: DEVOURER_HP,
    speed: DEVOURER_SURFACE_SPEED,
    radius: DEVOURER_RADIUS,
    contactDamage: 22,
    contactCooldown: 16,
    aggroRange: 26,
  },
  // ------------------------------------------------------------------------
  // Chefes de estrato: um dono por geologia. Ver constants.ts.
  // ------------------------------------------------------------------------
  // Lento e pesado: ele nao persegue, ele CANTA e a sala responde.
  archcantor: {
    hp: ARCHCANTOR_HP,
    speed: 1.2,
    radius: 0.75,
    contactDamage: 20,
    contactCooldown: 16,
    aggroRange: ARCHCANTOR_PULSE_RADIUS + 2,
  },
  // `speed` e a de superficie; o mergulho tem a propria e nem usa moveEntity.
  sheet_leviathan: {
    hp: LEVIATHAN_HP,
    speed: LEVIATHAN_SURFACE_SPEED,
    radius: LEVIATHAN_RADIUS,
    contactDamage: 24,
    contactCooldown: 16,
    aggroRange: 26,
  },
  // FIXO (speed 0): ancorado nos respiradouros. O perigo dele e onde o gas
  // passa a estar, nunca a perseguicao.
  lung_matrix: {
    hp: LUNG_MATRIX_HP,
    speed: 0,
    radius: LUNG_MATRIX_RADIUS,
    contactDamage: 18,
    contactCooldown: 16,
    aggroRange: LUNG_MATRIX_EXHALE_LENGTH + 4,
  },
  // FIXO tambem: a luta e contra a sala, e ele e o centro dela.
  furnace_heart: {
    hp: FURNACE_HEART_HP,
    speed: 0,
    radius: FURNACE_HEART_RADIUS,
    contactDamage: 26,
    contactCooldown: 16,
    aggroRange: FURNACE_HEART_WAVE_RADIUS + 4,
  },
  frost_queen: {
    hp: FROST_QUEEN_HP,
    speed: FROST_QUEEN_SPEED,
    radius: FROST_QUEEN_RADIUS,
    contactDamage: 20,
    contactCooldown: 14,
    aggroRange: 12,
  },
  magnetarch: {
    hp: MAGNETARCH_HP,
    speed: MAGNETARCH_SPEED,
    radius: MAGNETARCH_RADIUS,
    contactDamage: 22,
    contactCooldown: 16,
    aggroRange: MAGNETARCH_FIELD_RANGE,
  },
  diamandis: {
    hp: DIAMANDIS_HP,
    speed: DIAMANDIS_SPEED,
    radius: DIAMANDIS_RADIUS,
    contactDamage: 28,
    contactCooldown: 16,
    aggroRange: 10,
  },
};

/** O inimigo de assinatura de cada estrato, ou null (basalto e silica). */
export const SIGNATURE_OF_STRATUM: Partial<Record<string, EnemyArchetype>> = {
  prismatic: 'resonant',
  aquifer: 'mud_lamprey',
  sulfur: 'bellows',
  furnace: 'scoriac',
  glacial: 'frost_wraith',
  ferric: 'undertaker',
};

/**
 * Quantas assinaturas o setor recebe. Padrao: UMA — um encontro autoral.
 *
 * A Lampreia e a excecao, e veio de playtest: com uma por setor, o Aquifero
 * inteiro tinha UM lago perigoso e todos os outros eram cenario — o jogador
 * atravessava a agua sem nunca aprender a regra dela. Tres lampreias
 * espalhadas transformam "aquele lago tem o bicho" em "agua e territorio
 * DELA", que e a leitura que o estrato promete. Continuam ocupando vagas
 * comuns da contagem: a densidade do setor nao muda.
 */
/**
 * Quantas assinaturas o setor recebe, por arquetipo.
 *
 * A regra ANTIGA era "uma, sempre" — um encontro autoral — e a Lampreia era a
 * unica excecao. O playtest disse a mesma coisa dela que dizia dos outros: um
 * bicho por mapa e uma CURIOSIDADE, nao a fauna do lugar. O jogador cruzava a
 * Cripta inteira sem entender que o gelo pertence ao Espectro, porque so havia
 * um, num canto, e o resto do bestiario era o mesmo elenco generico de sempre.
 *
 * Agora cada estrato tem um bando de verdade. Continuam ocupando VAGAS COMUNS
 * do orcamento — a densidade do setor nao muda, o que muda e quem a preenche:
 * onde antes entrava mais um stalker, entra o bicho que so existe ali.
 *
 * Os numeros nao sao uniformes porque as ameacas nao sao: o Fole e um orgao
 * do bioma (varios respiradouros fazem a Fenda respirar), o Ressonante e caro
 * de enfrentar perto de cristal (dois ja redesenham a sala), e o Coveiro puxa
 * — tres deles numa galeria de minerio e a promessa inteira do Ferrifero.
 */
export const SIGNATURE_PACK: Partial<Record<EnemyArchetype, number>> = {
  mud_lamprey: 3,
  bellows: 3,
  scoriac: 3,
  undertaker: 3,
  resonant: 2,
  frost_wraith: 2,
};

export const isSolidAt = (state: SurvivalState, x: number, y: number): boolean => {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= state.config.width || cy >= state.config.height) return true;
  return state.solid[cy * state.config.width + cx] !== SOLID_NONE;
};

const circleBlocked = (state: SurvivalState, x: number, y: number, r: number): boolean =>
  isSolidAt(state, x - r, y - r) ||
  isSolidAt(state, x + r, y - r) ||
  isSolidAt(state, x - r, y + r) ||
  isSolidAt(state, x + r, y + r);

export const moveEntity = (
  state: SurvivalState,
  ent: Entity,
  dx: number,
  dy: number
): { blockedX: boolean; blockedY: boolean; blockCell: { x: number; y: number } | null } => {
  let blockCell: { x: number; y: number } | null = null;
  let blockedX = false;
  let blockedY = false;
  if (dx !== 0) {
    const nx = ent.x + dx;
    if (!circleBlocked(state, nx, ent.y, ent.radius)) ent.x = nx;
    else {
      blockedX = true;
      blockCell = { x: Math.floor(nx + Math.sign(dx) * ent.radius), y: Math.floor(ent.y) };
    }
  }
  if (dy !== 0) {
    const ny = ent.y + dy;
    if (!circleBlocked(state, ent.x, ny, ent.radius)) ent.y = ny;
    else {
      blockedY = true;
      blockCell = { x: Math.floor(ent.x), y: Math.floor(ny + Math.sign(dy) * ent.radius) };
    }
  }
  return { blockedX, blockedY, blockCell };
};

export const cellUnder = (state: SurvivalState, ent: Entity): number =>
  Math.floor(ent.y) * state.config.width + Math.floor(ent.x);

export const surfaceSpeedMul = (state: SurvivalState, ent: Entity): number => {
  const surf = state.surface[cellUnder(state, ent)];
  if (surf === SURF_BIOFLUID) return BIOFLUID_SLOW;
  if (surf === SURF_WATER) return WATER_SLOW;
  return 1;
};

/** Nuvem organica localizada deixada pela ruptura do Spore Bomber. */
const addBomberSpores = (state: SurvivalState, ent: Entity): void => {
  const cx = Math.floor(ent.x);
  const cy = Math.floor(ent.y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= state.config.width || y >= state.config.height) continue;
      const i = y * state.config.width + x;
      if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
        setSurface(state, i, SURF_SPORES, SPORE_LIFE_TICKS);
      }
    }
  }
};

/**
 * Nuvem de GAS deixada pela ruptura do Bombardeiro de Enxofre.
 *
 * Mesma forma da nuvem de esporos, materia diferente — e a diferenca e toda a
 * razao de o bicho existir: esporo envenena quem fica dentro, gas ESPERA uma
 * faisca. Numa Fornalha, morrer perto de uma fissura de brasa transforma o
 * cadaver dele na sua propria emboscada.
 *
 * So pinta chao NU: gas por cima de fogo aceso seria uma explosao decidida
 * pela ordem de iteracao, e por cima de agua ou gelo seria quimica inventada.
 */
const addSulfurCloud = (state: SurvivalState, ent: Entity, events: SemanticEvent[]): void => {
  const cx = Math.floor(ent.x);
  const cy = Math.floor(ent.y);
  const r = SULFUR_BOMBER_GAS_RADIUS;
  const laid: number[] = [];
  // O calor ja presente na vizinhanca decide o destino da nuvem, e por isso e
  // medido ANTES de ela existir: brasa e fogo nao aceitam gas por cima (a
  // celula ja esta ocupada), entao procurar a faisca depois de pintar acharia
  // apenas as celulas que o gas nao pode ter tomado.
  const heatCells: number[] = [];
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= state.config.width || y >= state.config.height) continue;
      const i = y * state.config.width + x;
      const surf = state.surface[i];
      if (surf === SURF_EMBER || surf === SURF_FIRE) heatCells.push(i);
    }
  }
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= state.config.width || y >= state.config.height) continue;
      const i = y * state.config.width + x;
      if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
        setSurface(state, i, SURF_GAS, SULFUR_BOMBER_GAS_LIFE_TICKS);
        laid.push(i);
      }
    }
  }
  // E se havia calor, a nuvem ACENDE — que e a razao inteira de o bicho existir
  // na Fornalha. Sem esta passagem a promessa nao se cumpria: a explosao roda
  // ANTES de a nuvem ser depositada (ela nasce da morte, e a morte e o que
  // detona), e uma fissura de brasa nao propaga fogo sozinha para o gas que
  // apareceu no tick seguinte. A ignicao entra por uma celula so: o resto e a
  // propagacao normal do fogo, que ja existe e ja e orcada.
  // ACENDE TODA celula de gas que ENCOSTA no calor — todas, e nao a primeira.
  //
  // Duas correcoes moram nesta unica regra, e as duas vieram de contraexemplos
  // com parede no meio da nuvem. A primeira: acender `laid[0]` punha fogo do
  // lado errado da rocha, deixando intacta justamente a bolsa que tocava a
  // brasa. A segunda: parar na primeira bolsa encontrada deixava a OUTRA
  // metade fria quando cada metade tinha a sua propria brasa — e o fogo, que
  // so anda por celulas conectadas, nunca atravessaria a parede para
  // corrigir.
  //
  // Acender cada borda quente e mais simples que mapear componentes conexos e
  // e o que a fisica ja diz: gas encostado em brasa pega fogo onde encosta.
  // Dentro de uma mesma bolsa o resultado nao muda — a propagacao levaria o
  // fogo ali de qualquer jeito, so alguns ticks depois.
  // "Encostar" aqui e a MESMA vizinhanca que o fogo usa para andar: as quatro
  // arestas, nunca a diagonal (ver `stepCells`, que propaga por
  // `[i-1, i+1, i-w, i+w]`). Com a diagonal valendo, uma brasa que so toca o
  // gas pelo CANTO de duas paredes acendia a nuvem por uma passagem que o
  // fogo comum nao atravessa — a ignicao do bombardeiro viraria a unica
  // excecao a geometria do jogo, e justamente num canto selado, onde o
  // jogador conta com a parede.
  const w = state.config.width;
  for (const gas of laid) {
    const touchesHeat = heatCells.some((h) => {
      const dx = Math.abs((gas % w) - (h % w));
      const dy = Math.abs(Math.floor(gas / w) - Math.floor(h / w));
      return dx + dy === 1;
    });
    if (touchesHeat) igniteCell(state, gas, events);
  }
};

export const damageEntity = (
  state: SurvivalState,
  ent: Entity,
  amount: number,
  events: SemanticEvent[],
  /**
   * O que causou este dano.
   *
   * Opcional na assinatura e nunca opcional na pratica: o padrao `unknown`
   * existe para nao obrigar cada teste a inventar uma causa, e todo caminho de
   * dano de producao passa a sua. Uma morte que chegue ao jogador como
   * "unknown" e um bug de contabilidade, nao um estado esperado.
   */
  cause: DamageCause = { kind: 'unknown' }
): void => {
  if (!ent.alive) return;
  if (ent.kind === 'player') {
    const extra = state.playerExtras[ent.slot ?? 0];
    if (extra.iframesUntil > state.tick || extra.downed) return;
    // A selagem ambiental (CA-04) e aplicada AQUI, e nao em cada `applyCellHazards`,
    // porque a lista de causas ambientais e a coisa que precisa ficar visivel: um
    // caminho de dano novo que se esqueca dela apareceria como bug de balanco em
    // vez de aparecer neste `if`.
    //
    // Ataques, explosoes e overheat ficam de FORA de proposito. "Dano ambiental"
    // e o chao cobrando presenca — fogo, gas, esporo —; uma pedra do Britador nao
    // vira ambiente por ter caido do teto, e o overheat e o reator do proprio
    // Prospector, ja coberto por RX-05.
    const scaled = isEnvironmentalCause(cause)
      ? amount * state.config.tuning.environmentalDamageScale
      : amount;
    ent.hp = Math.max(0, ent.hp - scaled);
    // Registrado AQUI e nao na morte: quando `resolveDownedAndDeaths` roda, ele
    // so ve `hp <= 0` e nao tem como saber se foram os 22 da pedra ou os 2,2 do
    // fogo por baixo.
    extra.lastDamage = { cause, tick: state.tick };
    state.stats.damageTakenTenths = addDamageTenths(state.stats.damageTakenTenths, scaled);
    events.push({ t: 'hit', x: ent.x, y: ent.y, amount: scaled, target: ent.id });
    return;
  }
  // Dano CAUSADO conta so o que e ATRIBUIVEL ao jogador, por lista fechada.
  //
  // A alternativa era contar tudo menos o que veio de inimigo, e ela inflava o
  // numero em silencio: fogo ambiente consumindo um bicho num canto do mapa, um
  // bomber explodindo em cima de um stalker, a descarga de um cristal que o
  // guardiao quebrou — nada disso e feito do jogador, e tudo isso somaria.
  // `Math.min(amount, ent.hp)` corta o excedente do golpe fatal: 14 de dano num
  // alvo com 3 de vida sao 3 de dano causado, nao 14.
  // A couraça do Escoriaceo reduz TODO dano enquanto fria — inclusive fogo,
  // de proposito: fogo nao o mata mais rapido, fogo o ABRE (o calor poe a
  // postura em HOT e ai o dano entra inteiro). A reducao vive aqui, no unico
  // funil de dano, para nenhum caminho novo esquecer dela.
  if (ent.archetype === 'scoriac' && ent.mood !== SCORIAC_HOT) {
    amount *= SCORIAC_ARMOR_SCALE;
  }
  // A areia entre o tiro e o corpo. Reducao e nao imunidade, pela mesma razao
  // da couraça acima: imune ensinaria "guarde a municao e espere", que e a
  // ausencia de jogo. Vive aqui, no unico funil de dano, para nenhum caminho
  // novo esquecer dela.
  if (ent.archetype === 'white_devourer' && ent.mood === DEVOURER_BURROWED) {
    amount *= DEVOURER_BURROWED_ARMOR;
  }
  // As blindagens dos chefes de estrato, todas no unico funil de dano — assim
  // nenhum caminho novo (fogo, descarga, explosao) as esquece.
  //
  // Leviata submerso: a lamina entre o tiro e o corpo. Coracao superaquecido:
  // o nucleo fechado. Rainha cercada de gelo: a couraça E o estrato, e ela cai
  // quando o lago derrete. Arquicantor SEM rede: o inverso de todas — a sala
  // esvaziada o deixa mais FRAGIL, porque a Catedral era a defesa dele.
  if (ent.archetype === 'sheet_leviathan' && ent.mood === DEVOURER_BURROWED) {
    amount *= LEVIATHAN_SUBMERGED_ARMOR;
  }
  if (ent.archetype === 'furnace_heart') {
    if (ent.mood === FURNACE_OVERHEATING) amount *= FURNACE_HEART_HOT_ARMOR;
    // Acertar na janela fria E a leitura do encontro: ele nao esta mais duro,
    // voce esperou a hora. A marca sai aqui e nao no golpe do jogador porque
    // e AQUI que se sabe que o dano entrou inteiro.
    else markDiscovery(state.stats, DISCOVERY_FURNACE_COOLED);
  }
  if (ent.archetype === 'frost_queen') {
    if (frostQueenIceAround(state, ent) >= FROST_QUEEN_ICE_THRESHOLD) amount *= FROST_QUEEN_ICE_ARMOR;
    else markDiscovery(state.stats, DISCOVERY_QUEEN_THAWED);
  }
  if (ent.archetype === 'archcantor' && !archcantorHasNetwork(state, ent)) {
    amount *= ARCHCANTOR_SILENT_ARMOR;
    markDiscovery(state.stats, DISCOVERY_CATHEDRAL_SILENCED);
  }
  const attributable =
    cause.kind === 'player_shot' ||
    ((cause.kind === 'explosion' || cause.kind === 'discharge') && cause.source === 'player');
  if (attributable) {
    state.stats.damageDealtTenths = addDamageTenths(
      state.stats.damageDealtTenths,
      Math.min(amount, ent.hp)
    );
  }
  ent.hp -= amount;
  // Levar dano ACORDA. Antes o aggro era so distancia, recalculada a cada tick,
  // entao um inimigo baleado de fora do proprio raio continuava perambulando ao
  // acaso enquanto morria. Com alcance de tiro de 18 tiles contra raios de 7 a
  // 9, atirar de longe nao era uma tatica esperta: era a ausencia de jogo.
  ent.alertedUntil = state.tick + ALERT_TICKS;
  events.push({ t: 'hit', x: ent.x, y: ent.y, amount, target: ent.id });
  if (ent.hp > 0) return;
  ent.hp = 0;
  ent.alive = false;
  recordKill(state.stats, ent.archetype as EnemyArchetype);
  // O chefe deste setor CAIU — e cai uma vez so na run.
  //
  // A marca vive no estado (e nao na entidade, que o repovoamento descarta)
  // porque a extracao de retorno REGENERA o setor na subida: sem ela, quem
  // matou o Bispo para poder descer o encontrava inteiro na volta. Fauna
  // comum repovoar e a pressao prometida; um chefe repovoar apaga a conquista.
  // "Esta entidade era o dono DESTE setor" tem uma definicao so, e ela e o
  // `entityId` que `populateSector` guardou ao spawnar o chefe. Enumerar
  // arquetipos a mao (`bishop || guardian`) ja errou: a tabela ganhou oito
  // chefes e esta linha continuou marcando dois, entao o Arquicantor abatido
  // renascia na subida e o portal do setor dele nunca destrancava.
  if (state.sectorBoss.entityId === ent.id && isBossArchetype(ent.archetype)) {
    markSectorBossDown(state, state.sector);
    // O SELO CEDEU. Evento proprio, e nao o `death` reinterpretado: o cliente
    // nao tem como saber sozinho que aquele cadaver era o dono do setor.
    events.push({
      t: 'sector_unsealed',
      sector: state.sector,
      archetype: ent.archetype as EnemyArchetype,
      coreUnlocked: runDepth(state).coreSectors.includes(state.sector),
    });
  }
  events.push({
    t: 'death',
    x: ent.x,
    y: ent.y,
    entity: ent.id,
    archetype: ent.archetype,
    facingX: ent.facing.x,
    facingY: ent.facing.y,
    tick: state.tick,
  });
  if (ent.archetype === 'bomber') {
    explodeAt(state, ent.x, ent.y, 1.8, events, { source: 'enemy', owner: ent.id });
    addBomberSpores(state, ent);
  }
  // O de ENXOFRE explode igual e larga GAS no lugar dos esporos. A nuvem sai
  // DEPOIS da explosao de proposito: a explosao ja consumiu o instante dela
  // (e ja acendeu o que tinha de acender), entao o gas assenta sobre o
  // resultado — inclusive sobre o fogo que a propria explosao criou, que e
  // exatamente a corrente de reacoes que este bicho existe para provocar.
  if (ent.archetype === 'sulfur_bomber') {
    explodeAt(state, ent.x, ent.y, 1.8, events, { source: 'enemy', owner: ent.id });
    addSulfurCloud(state, ent, events);
  }
  // O MINER e o unico corpo do bestiario cuja morte vira JULGAMENTO, e por isso
  // e o unico que precisa saber QUEM o matou.
  //
  // O humor sozinho nao basta. Um bomber explodindo em cima do veio, ou o fogo
  // que o proprio minerador acendeu ao raspar fungo, matam gente sem que o
  // jogador tenha apertado nada — e a tela de fim anotava aquilo como civil
  // abatido por ele. Pelo mesmo caminho, um minerado hostil consumido pelo
  // ambiente pagava minerio que ninguem foi buscar.
  //
  // `attributable` e a MESMA lista fechada que ja decide dano causado, algumas
  // linhas acima: nao existe motivo para "o que conta como acao do jogador" ter
  // duas definicoes no mesmo arquivo. Sem autoria, a morte simplesmente nao
  // rende nada — nem anotacao, nem carga.
  if (ent.archetype === 'miner' && attributable) {
    if (ent.mood === MINER_MOOD_PASSIVE) {
      // Passivo morto NAO dropa. Nao e punicao — e a ausencia de recompensa.
      //
      // Dropar seria transformar "matar todo mundo por precaucao" na jogada
      // otima e apagar o encontro inteiro: por que arriscar aproximar-se frio se
      // a bala rende o mesmo? Sem drop, a violencia gratuita custa municao,
      // calor e tempo, e devolve so a anotacao.
      state.stats.innocentsKilled += 1;
    } else {
      state.stats.oreCollected += MINER_ORE_DROP;
      events.push({
        t: 'ore_gained',
        x: ent.x,
        y: ent.y,
        amount: MINER_ORE_DROP,
        total: state.stats.oreCollected,
      });
    }
  }
  // O DIAMANDIS paga pelo que NAO foi levado embora. Cada modulo ainda preso
  // a carcaça vira lasca no abate; os arrancados ja foram — ou estao a caminho
  // da borda nas maos de um Coveiro.
  if (ent.archetype === 'diamandis') {
    let kept = 0;
    for (let m = 0; m < DIAMANDIS_MODULE_COUNT; m++) {
      if ((state.bossRuntime.modulesLost & (1 << m)) === 0) kept++;
    }
    if (kept > 0) {
      const paid = kept * DIAMANDIS_MODULE_ORE;
      state.stats.oreCollected += paid;
      events.push({
        t: 'ore_gained',
        x: ent.x,
        y: ent.y,
        amount: paid,
        total: state.stats.oreCollected,
      });
    }
  }
  // O CARREGADOR abatido DERRUBA a peca — e ela ainda pode ser sua. E a
  // segunda metade da escolha: deixar o Coveiro arrancar nao e perder a
  // sucata, e passar a ter de intercepta-lo antes da borda.
  if (ent.archetype === 'undertaker' && (ent.mood ?? 0) > 0) {
    const module = ent.mood! - 1;
    if ((state.bossRuntime.modulesLost & (1 << module)) !== 0) {
      state.stats.oreCollected += DIAMANDIS_MODULE_ORE;
      events.push({ t: 'boss_module', x: ent.x, y: ent.y, module, state: 'dropped' });
      events.push({
        t: 'ore_gained',
        x: ent.x,
        y: ent.y,
        amount: DIAMANDIS_MODULE_ORE,
        total: state.stats.oreCollected,
      });
    }
  }
  if (ent.archetype === 'guardian') {
    // A parede e uma fase da luta, nao uma alteracao permanente do mapa.
    // Derruba-la aqui garante acesso ao nucleo mesmo se o cerco fechou
    // com o Guardian ja afastado do pedestal.
    openArena(state, events);
  }
};

export const spawnEnemy = (
  state: SurvivalState,
  archetype: EnemyArchetype,
  x: number,
  y: number,
  elite: boolean
): Entity => {
  const def = ARCHETYPES[archetype];
  const enemy: Entity = {
    id: state.nextEntityId++,
    kind: 'enemy',
    archetype,
    x: x + 0.5,
    y: y + 0.5,
    vx: 0,
    vy: 0,
    hp: elite ? Math.floor(def.hp * 2.2) : def.hp,
    maxHp: elite ? Math.floor(def.hp * 2.2) : def.hp,
    radius: def.radius,
    alive: true,
    elite,
    nextActionAt: 0,
    contactReadyAt: 0,
    rangedReadyAt: 0,
    stunnedUntil: 0,
    alertedUntil: 0,
    facing: { x: 1, y: 0 },
    // Todo miner nasce PASSIVO. A postura nao e sorteada no spawn: ela e
    // decidida no instante em que ele te nota, pelo calor da sua arma.
    ...(archetype === 'miner' ? { mood: MINER_MOOD_PASSIVE } : {}),
    // Assinaturas nascem na postura de repouso do proprio elemento.
    ...(archetype === 'mud_lamprey' || archetype === 'frost_wraith' ? { mood: LURKER_HIDDEN } : {}),
    ...(archetype === 'scoriac' ? { mood: SCORIAC_COOL } : {}),
    ...(archetype === 'bellows' ? { mood: BELLOWS_INHALING } : {}),
    // O Devorador nasce POR BAIXO: a primeira coisa que o jogador ve dele e o
    // rastro de areia, nunca o corpo.
    ...(archetype === 'white_devourer' ? { mood: DEVOURER_BURROWED } : {}),
    // O Leviata tambem nasce por baixo: a primeira coisa que se ve dele e a
    // ondulacao. Os tres de ciclo nascem na fase de abertura do proprio ciclo.
    ...(archetype === 'sheet_leviathan' ? { mood: DEVOURER_BURROWED } : {}),
    ...(archetype === 'lung_matrix' ? { mood: LUNG_INHALING } : {}),
    ...(archetype === 'furnace_heart' ? { mood: FURNACE_OVERHEATING } : {}),
    ...(archetype === 'magnetarch' ? { mood: MAGNET_ATTRACT } : {}),
  };
  state.enemies.push(enemy);
  return enemy;
};

const distTo = (a: Entity, b: Entity): number => Math.hypot(a.x - b.x, a.y - b.y);
const normalized = (x: number, y: number): Vec2 => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

/**
 * Corpos grandes o bastante para ABRIR caminho em vez de contornar.
 *
 * O bispo entra na lista sem ganhar a busca de rota do guardiao: chefe preso e
 * chefe morto, mas a rota mora em `state.bossRuntime.path`, um campo unico do
 * encontro. Compartilha-la daria dois chefes disputando o mesmo array —
 * inofensivo hoje, porque `bossForBiome` poe UM chefe por run. Empurrar e
 * quebrar resolve o mesmo problema sem inventar acoplamento com prazo de
 * validade; no dia em que houver dois chefes, `BossRuntime` vira um mapa por
 * entidade e este comentario e o unico lugar que precisa mudar.
 */
const crushesWalls = (enemy: Entity): boolean =>
  enemy.archetype === 'bruiser' ||
  enemy.archetype === 'guardian' ||
  enemy.archetype === 'bishop' ||
  enemy.archetype === 'diamandis';

/**
 * Os chefes que GUARDAM o Nucleo: dormem ate serem notados e, acordados, nunca
 * mais perdem o alvo. Nao e uma lista de "quem e chefe" — o Bispo e chefe e
 * nao esta aqui, porque ele e territorial (a luta dele e o chao em que pisa) e
 * nao um portao com um objetivo atras.
 */
const guardsTheCore = (enemy: Entity): boolean =>
  enemy.archetype === 'guardian' || enemy.archetype === 'diamandis';

/** Bruiser e Guardian sao corpos minerais; eletricidade causa dano, nao paralisia. */
export const isStoneEnemy = (enemy: Entity): boolean =>
  enemy.archetype === 'bruiser' ||
  enemy.archetype === 'guardian' ||
  // O Diamandis nao e mineral, e uma MAQUINA — e entra aqui pelo outro motivo
  // da lista: chefe paralisavel e chefe que morre num stun-lock. Corrente o
  // machuca, como machuca os outros dois; nao o desliga.
  enemy.archetype === 'diamandis';

/**
 * O chao cobrando presenca: fogo, gas e esporo.
 *
 * Lista FECHADA e nomeada, em vez de "tudo que nao e ataque": explosao, descarga,
 * overheat e pedra tem autor, e um deles entrando aqui por descuido daria a CA-04
 * uma reducao de dano geral que a arvore nunca prometeu.
 */
export const isEnvironmentalCause = (cause: DamageCause): boolean =>
  cause.kind === 'fire' || cause.kind === 'gas' || cause.kind === 'spores';

/** Aplica controle autoritativo e interrompe a acao corrente do alvo. */
export const stunEntity = (state: SurvivalState, entity: Entity, durationTicks: number): void => {
  // Bercos de impacto (CA-02) encurtam o stun de QUEM O RECEBE, e so do jogador.
  // Arredondado para tick inteiro: `stunnedUntil` e comparado com `state.tick`, e
  // meio tick de atordoamento nao existe.
  const ticks =
    entity.kind === 'player'
      ? Math.round(durationTicks * state.config.tuning.stunDurationScale)
      : durationTicks;
  entity.stunnedUntil = Math.max(entity.stunnedUntil, state.tick + ticks);
  entity.vx = 0;
  entity.vy = 0;
  if (entity.kind === 'enemy') {
    entity.action = undefined;
  } else {
    const extra = state.playerExtras[entity.slot ?? 0];
    extra.dodgeUntil = Math.min(extra.dodgeUntil, state.tick);
  }
};

/**
 * Mira de interceptacao sem homing: resolve uma unica vez no release e depois a
 * pedra segue reta. Usa a velocidade REAL observada do alvo, limitada pelo tempo
 * maximo de voo, para continuar desviavel lateralmente.
 */
export const interceptDirection = (
  sourceX: number,
  sourceY: number,
  target: Entity,
  projectileSpeed: number,
  maxLeadSeconds: number
): Vec2 => {
  const rx = target.x - sourceX;
  const ry = target.y - sourceY;
  const vx = target.vx;
  const vy = target.vy;
  const a = vx * vx + vy * vy - projectileSpeed * projectileSpeed;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;
  let time = 0;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) time = -c / b;
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      const t1 = (-b - root) / (2 * a);
      const t2 = (-b + root) / (2 * a);
      const candidates = [t1, t2].filter((t) => t > 0);
      if (candidates.length > 0) time = Math.min(...candidates);
    }
  }
  const lead = Math.max(0, Math.min(maxLeadSeconds, time));
  return normalized(rx + vx * lead, ry + vy * lead);
};

const nearestTarget = (state: SurvivalState, x: number, y: number): Entity | null => {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const p of state.players) {
    const e = state.playerExtras[p.slot ?? 0];
    if (!e.joined || !p.alive || e.downed) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
};

const startAction = (
  state: SurvivalState,
  enemy: Entity,
  action: EntityActionKind,
  direction: Vec2,
  windupTicks: number,
  recoveryTicks: number,
  events: SemanticEvent[],
  target?: number
): void => {
  const releaseAt = state.tick + windupTicks;
  enemy.action = {
    kind: action,
    phase: 'windup',
    startedAt: state.tick,
    releaseAt,
    endsAt: releaseAt + recoveryTicks,
    direction: { ...direction },
    target,
  };
  enemy.facing = { ...direction };
  events.push({
    t: 'action_start',
    entity: enemy.id,
    action,
    x: enemy.x,
    y: enemy.y,
    dx: direction.x,
    dy: direction.y,
    startTick: state.tick,
    releaseTick: releaseAt,
    endTick: releaseAt + recoveryTicks,
  });
};

/** Gira um vetor unitario por `angle` radianos. */
const rotated = (dir: Vec2, angle: number): Vec2 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: dir.x * cos - dir.y * sin, y: dir.x * sin + dir.y * cos };
};

/** Uma pedra da Salva Litoclasta. Sem biofluido, sem stun — ver constants.ts. */
const fireGuardianRock = (
  state: SurvivalState,
  enemy: Entity,
  dir: Vec2,
  events: SemanticEvent[],
): void => {
  state.projectiles.push({
    kind: 'rock',
    id: state.nextEntityId++,
    owner: enemy.id,
    x: enemy.x,
    y: enemy.y,
    vx: dir.x * GUARDIAN_ROCK_SPEED,
    vy: dir.y * GUARDIAN_ROCK_SPEED,
    damage: GUARDIAN_ROCK_DAMAGE,
    radius: GUARDIAN_ROCK_RADIUS,
    distanceTravelled: 0,
    hostile: true,
    leavesBiofluid: false,
    ttl: Math.ceil((GUARDIAN_ROCK_FLIGHT_TILES / GUARDIAN_ROCK_SPEED) * TICK_HZ),
  });
  events.push({ t: 'shot', x: enemy.x, y: enemy.y, dx: dir.x, dy: dir.y, owner: enemy.id });
};

/**
 * O release da Salva Litoclasta.
 *
 * Sem `salvo` na acao: LEQUE — tres pedras de uma vez, a central interceptando
 * a posicao prevista do alvo e as laterais abrindo GUARDIAN_FAN_SPREAD para
 * cada lado. Tres corredores legiveis, que e o contrario de tres tiros
 * perfeitos em sequencia.
 *
 * Com `salvo`: RAJADA da segunda fase — uma pedra por release, com correcao de
 * mira entre disparos. O truque da cadencia mora aqui: enquanto restam
 * disparos, a acao volta para `windup` e empurra o proprio `releaseAt` pelo
 * intervalo, entao `advanceAction` a libera de novo sozinho. Os relogios da
 * acao entram no hash autoritativo, e as duas maquinas de uma sala empurram os
 * mesmos valores.
 *
 * A mira re-resolve por interceptacao a CADA disparo e nunca corrige em voo:
 * a pedra lancada e reta e desviavel, como a do Britador.
 */
const guardianSalvoRelease = (
  state: SurvivalState,
  enemy: Entity,
  action: EntityAction,
  target: Entity | null,
  events: SemanticEvent[],
): void => {
  const aim = target
    ? interceptDirection(
        enemy.x,
        enemy.y,
        target,
        GUARDIAN_ROCK_SPEED,
        GUARDIAN_ROCK_FLIGHT_TILES / GUARDIAN_ROCK_SPEED
      )
    : action.direction;
  enemy.facing = { ...aim };
  action.direction = { ...aim };

  if (action.salvo === undefined) {
    for (const spread of [-GUARDIAN_FAN_SPREAD, 0, GUARDIAN_FAN_SPREAD]) {
      fireGuardianRock(state, enemy, rotated(aim, spread), events);
    }
    return;
  }

  fireGuardianRock(state, enemy, aim, events);
  if (action.salvo > 0) {
    action.salvo -= 1;
    action.phase = 'windup';
    action.releaseAt = state.tick + GUARDIAN_VOLLEY_INTERVAL_TICKS;
    action.endsAt = action.releaseAt + 6;
  }
};

/**
 * SALVA DE DEMOLICAO — as marcas, no inicio do telegrafo.
 *
 * Tres cargas: uma sobre a posicao do alvo NAQUELE instante e duas abertas
 * perpendicularmente. As marcas nao se corrigem depois de postas, e e por isso
 * que o golpe tem resposta: sair do circulo funciona porque o circulo ficou
 * onde nasceu. Uma salva que perseguisse seria dano sem contra-jogo, com um
 * telegrafo bonito por cima.
 */
const markDemolition = (
  state: SurvivalState,
  enemy: Entity,
  target: Entity,
  fireTick: number,
  events: SemanticEvent[],
): void => {
  const w = state.config.width;
  const toward = normalized(target.x - enemy.x, target.y - enemy.y);
  // Perpendicular ao eixo chefe->alvo: as laterais abrem o corredor de fuga
  // para os LADOS, e nao para tras (recuar em linha reta ja e o reflexo de
  // todo mundo, e um golpe que so pune o reflexo nao ensina nada).
  const side = { x: -toward.y, y: toward.x };
  state.bossRuntime.blastCells = [];
  for (let k = 0; k < DIAMANDIS_DEMOLISH_CHARGES; k++) {
    const offset = (k - (DIAMANDIS_DEMOLISH_CHARGES - 1) / 2) * DIAMANDIS_DEMOLISH_SPREAD;
    const bx = Math.floor(target.x + side.x * offset);
    const by = Math.floor(target.y + side.y * offset);
    if (bx < 1 || by < 1 || bx >= w - 1 || by >= state.config.height - 1) continue;
    state.bossRuntime.blastCells.push(by * w + bx);
    events.push({
      t: 'blast_marker',
      x: bx + 0.5,
      y: by + 0.5,
      radius: DIAMANDIS_DEMOLISH_RADIUS,
      fireTick,
    });
  }
};

/**
 * FEIXE DE PROSPECCAO — uma passada da linha.
 *
 * `powered` false e a VARREDURA: um scanner medindo, que nao machuca nada.
 * True e a passagem com potencia, e ai a linha aplica a tabela de materiais
 * que o jogo ja tem — `igniteCell` seca fungo e acende gas, `meltIce` derrete,
 * o minerio energiza — alem de queimar quem estiver nela. Nenhuma reacao nova:
 * o feixe e mais um cliente do sistema de materiais, como o rastro do Corcel.
 *
 * Para na primeira parede, nos dois modos: um levantamento que atravessa rocha
 * nao seria um levantamento, e um feixe que queima do outro lado do muro seria
 * dano sem sinal.
 */
const fireProspectingBeam = (
  state: SurvivalState,
  enemy: Entity,
  dir: Vec2,
  powered: boolean,
  events: SemanticEvent[],
): void => {
  const w = state.config.width;
  let reach = DIAMANDIS_BEAM_LENGTH;
  const hitPlayers = new Set<number>();
  for (let d = 0.5; d <= DIAMANDIS_BEAM_LENGTH; d += DIAMANDIS_BEAM_STEP) {
    const fx = enemy.x + dir.x * d;
    const fy = enemy.y + dir.y * d;
    const cx = Math.floor(fx);
    const cy = Math.floor(fy);
    if (cx < 0 || cy < 0 || cx >= w || cy >= state.config.height) {
      reach = d;
      break;
    }
    const i = cy * w + cx;
    if (state.solid[i] !== SOLID_NONE) {
      // A parede PARA o feixe — mas antes disso o minerio dela responde: o
      // veio energiza pelas aberturas coladas nele, que e a mesma regra da
      // descarga em rocha. E o que "ativar minerio" quer dizer sem inventar
      // reacao nova.
      if (powered && (state.solid[i] === SOLID_ORE || state.solid[i] === SOLID_ORE_CHIPPED)) {
        const open: number[] = [];
        for (const n of [i - 1, i + 1, i - w, i + w]) {
          if (n >= 0 && n < state.solid.length && state.solid[n] === SOLID_NONE) open.push(n);
        }
        if (open.length > 0) chargeCells(state, open, events, { source: 'enemy', owner: enemy.id });
      }
      reach = d;
      break;
    }
    if (!powered) continue;
    igniteCell(state, i, events);
    meltIce(state, i);
    for (const player of state.players) {
      if (!player.alive || !state.playerExtras[player.slot ?? 0].joined) continue;
      if (hitPlayers.has(player.id)) continue;
      if (Math.hypot(player.x - fx, player.y - fy) > player.radius + 0.4) continue;
      hitPlayers.add(player.id);
      damageEntity(state, player, DIAMANDIS_BEAM_DAMAGE, events, {
        kind: 'enemy_contact',
        archetype: 'diamandis',
        elite: enemy.elite,
      });
    }
  }
  events.push({
    t: 'beam_line',
    x: enemy.x,
    y: enemy.y,
    dx: dir.x,
    dy: dir.y,
    length: reach,
    powered,
  });
};

const releaseAction = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const action = enemy.action;
  if (!action || action.phase !== 'windup') return;
  action.phase = 'release';
  const target = action.target === undefined
    ? null
    : state.players.find((p) => p.id === action.target && p.alive && !state.playerExtras[p.slot ?? 0].downed) ?? null;

  if (action.kind === 'pulse') {
    if (enemy.archetype === 'resonant') resonantPulse(state, enemy, events);
    else if (enemy.archetype === 'archcantor') archcantorPulse(state, enemy, events);
    else bishopNova(state, enemy, events);
    return;
  }
  if (action.kind === 'demolish') {
    const w = state.config.width;
    for (const cell of state.bossRuntime.blastCells) {
      explodeAt(state, (cell % w) + 0.5, Math.floor(cell / w) + 0.5, DIAMANDIS_DEMOLISH_RADIUS, events, {
        source: 'enemy',
        owner: enemy.id,
      });
    }
    state.bossRuntime.blastCells = [];
    return;
  }
  if (action.kind === 'erupt') {
    if (enemy.archetype === 'sheet_leviathan') leviathanBreach(state, enemy, events);
    else devourerErupt(state, enemy, events);
    return;
  }
  if (action.kind === 'freeze') {
    frostQueenFreeze(state, enemy, events);
    return;
  }
  if (action.kind === 'beam') {
    fireProspectingBeam(state, enemy, action.direction, true, events);
    return;
  }
  if (action.kind === 'drill') {
    // A broca NAO recebe impulso aqui, pela mesma razao da investida do
    // Corcel: ela e conduzida tick a tick por `diamandisDrillStride`, que
    // precisa da posicao exata de cada passo para abrir o vao na largura
    // certa. Somar velocidade solta daria dois movimentos no mesmo tick e o
    // corredor sairia desalinhado do caminho percorrido.
    return;
  }
  if (action.kind === 'detonate') {
    // O bomber se mata; a explosao que sai disso e que machuca o jogador, e ela
    // carrega a propria causa (`explosion`/`enemy`) em explodeAt.
    damageEntity(state, enemy, enemy.hp, events, { kind: 'explosion', source: 'enemy' });
    return;
  }
  if (action.kind === 'ranged') {
    // Salva Litoclasta: o ranged do Guardiao e PEDRA, nunca gosma. Ver
    // guardianSalvoRelease — leque na primeira fase, rajada alternada na
    // segunda. O cuspe abaixo volta a ser exclusivo do Spitter.
    if (enemy.archetype === 'guardian') {
      guardianSalvoRelease(state, enemy, action, target, events);
      return;
    }
    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    state.projectiles.push({
      kind: 'spit',
      id: state.nextEntityId++,
      owner: enemy.id,
      x: enemy.x,
      y: enemy.y,
      vx: action.direction.x * 7,
      vy: action.direction.y * 7,
      damage: 9,
      distanceTravelled: 0,
      hostile: true,
      leavesBiofluid: true,
      ttl: Math.ceil(((def.aggroRange + 4) / 7) * TICK_HZ),
    });
    events.push({ t: 'shot', x: enemy.x, y: enemy.y, dx: action.direction.x, dy: action.direction.y, owner: enemy.id });
  } else if (action.kind === 'contact' && target) {
    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    if (distTo(enemy, target) < enemy.radius + target.radius + 0.45) {
      damageEntity(state, target, def.contactDamage * (enemy.elite ? 1.4 : 1), events, {
        kind: 'enemy_contact',
        archetype: enemy.archetype as EnemyArchetype,
        elite: enemy.elite,
      });
    }
  } else if (action.kind === 'hurl') {
    if (target) {
      action.direction = interceptDirection(
        enemy.x,
        enemy.y,
        target,
        BRUISER_HURL_SPEED,
        BRUISER_HURL_FLIGHT_TILES / BRUISER_HURL_SPEED
      );
      enemy.facing = { ...action.direction };
    }
    state.projectiles.push({
      kind: 'rock',
      id: state.nextEntityId++,
      owner: enemy.id,
      x: enemy.x,
      y: enemy.y,
      vx: action.direction.x * BRUISER_HURL_SPEED,
      vy: action.direction.y * BRUISER_HURL_SPEED,
      damage: BRUISER_HURL_DAMAGE,
      radius: BRUISER_ROCK_RADIUS,
      distanceTravelled: 0,
      hostile: true,
      // O stun e a assinatura DESTE arremesso: um bloco unico, telegrafado por
      // 0,8 s, que custa uma parede da arena. A salva do Guardiao usa o mesmo
      // `kind` sem a flag — tres pedras atordoando seria stun-lock.
      stuns: true,
      // Pedra nao deixa poca: quem suja o chao e o cuspidor, e as duas ameacas
      // tem de continuar querendo dizer coisas diferentes.
      leavesBiofluid: false,
      ttl: Math.ceil((BRUISER_HURL_FLIGHT_TILES / BRUISER_HURL_SPEED) * TICK_HZ),
    });
    events.push({ t: 'shot', x: enemy.x, y: enemy.y, dx: action.direction.x, dy: action.direction.y, owner: enemy.id });
  } else if (action.kind === 'charge') {
    // O cavalo NAO recebe impulso aqui. A investida dele e conduzida tick a tick
    // por `horseChargeStride`, que precisa da posicao exata de cada passo para
    // acender o rastro; somar velocidade solta por cima daria dois movimentos no
    // mesmo tick e o fogo sairia desalinhado do caminho percorrido.
    if (enemy.archetype === 'fungal_horse') return;
    enemy.vx = action.direction.x * 7;
    enemy.vy = action.direction.y * 7;
  } else if (action.kind === 'slam' && enemy.archetype === 'miner') {
    // Cleave de picareta: CIRCULAR em volta dele, e nao um golpe direcional.
    //
    // Circular porque a resposta certa e RECUAR. Um golpe frontal ensinaria a
    // orbitar por tras, que e o que o jogador ja faz com todo o resto do
    // bestiario — o miner enfurecido existe justamente para punir quem entra em
    // cima confiando nisso.
    for (const victim of state.players) {
      if (!victim.alive || !state.playerExtras[victim.slot ?? 0].joined) continue;
      if (distTo(enemy, victim) > MINER_CLEAVE_RADIUS) continue;
      damageEntity(state, victim, MINER_CLEAVE_DAMAGE, events, {
        kind: 'enemy_contact',
        archetype: 'miner',
        elite: enemy.elite,
      });
    }
    events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: MINER_CLEAVE_RADIUS });
  } else if (action.kind === 'haul' && enemy.archetype === 'undertaker' && (enemy.mood ?? 0) > 0) {
    // ARRANQUE DO MODULO. O mesmo eletroima, outro alvo: aqui ele nao puxa
    // ninguem para perto, ele destaca a peca. O chefe perde a arma daquele
    // modulo NESTE instante — e a partir daqui o Coveiro vira um carregador,
    // que e um alvo diferente de um Coveiro caçando.
    const module = enemy.mood! - 1;
    const bit = 1 << module;
    if ((state.bossRuntime.modulesLost & bit) === 0) {
      state.bossRuntime.modulesLost |= bit;
      events.push({ t: 'boss_module', x: enemy.x, y: enemy.y, module, state: 'detached' });
      // Ver o arranque e a Descoberta: e quando fica claro que o Coveiro nao
      // e minion do chefe — e um catador que chegou primeiro.
      const witness = nearestTarget(state, enemy.x, enemy.y);
      if (witness && distTo(enemy, witness) <= WITNESS_RANGE) {
        markDiscovery(state.stats, DISCOVERY_DIAMANDIS_MODULE);
      }
      events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: 1.4 });
    }
    return;
  } else if (action.kind === 'haul' && target) {
    // O ELETROIMA. Arrasta o alvo em passos pequenos, e cada passo respeita a
    // colisao: quem tem uma quina entre si e o Coveiro para NELA, e nao no
    // colo dele. Um teleporte (ou um salto grande de uma vez) atravessaria
    // parede e transformaria um golpe com contra-jogo geometrico num castigo
    // sem resposta — e o corredor estreito e justamente onde ele mora.
    //
    // Puxa POR PASSOS e nao por velocidade porque o jogador nao integra
    // `vx/vy`: o movimento dele e comandado tick a tick e o campo e derivado
    // (so a inercia do gelo o consome). Um impulso ali seria apagado no mesmo
    // tick, e o puxao simplesmente nao aconteceria.
    const pull = normalized(enemy.x - target.x, enemy.y - target.y);
    const steps = Math.round(UNDERTAKER_PULL_TILES / UNDERTAKER_PULL_STEP);
    const stop = enemy.radius + target.radius + 0.05;
    for (let s = 0; s < steps; s++) {
      if (distTo(enemy, target) <= stop) break; // chegou: nao empurra por dentro
      const moved = moveEntity(state, target, pull.x * UNDERTAKER_PULL_STEP, pull.y * UNDERTAKER_PULL_STEP);
      // Bateu em alguma coisa: o arrasto acabou aqui — e basta UM DOS EIXOS
      // travar. Testar "nao saiu do lugar" (os dois eixos juntos) era um erro
      // silencioso em toda diagonal: com a parede segurando so o X, o passo
      // continuava valendo pelo Y e o jogador era arrastado RASPANDO na
      // parede, contornando obstaculo curto ate o colo do Coveiro. A quina
      // deixava de ser protecao justamente no caso comum.
      if (moved.blockedX || moved.blockedY) break;
    }
    // O rastro do campo, para o cliente desenhar o feixe entre os dois.
    events.push({ t: 'pulse', x: target.x, y: target.y, radius: 1.2 });
    // E a prensa vem em seguida, com telegrafo proprio: sao DOIS avisos, e o
    // segundo ainda da tempo de rolar. O puxao tira a posicao; o dano continua
    // sendo uma coisa que o jogador pode negar.
    enemy.contactReadyAt = state.tick + UNDERTAKER_SLAM_WINDUP_TICKS;
    // A prensa aponta PARA o alvo, e nao ao contrario. `pull` foi calculado do
    // alvo em direcao ao Coveiro (e o que arrasta para dentro); reaproveitar
    // esse vetor no golpe fazia o cliente desenhar o braco descendo para o
    // lado OPOSTO de quem acabou de ser puxado — o segundo telegrafo mentindo
    // sobre onde o golpe vai cair, embora o dano (por distancia) acertasse.
    const toTarget = { x: -pull.x, y: -pull.y };
    enemy.facing = { ...toTarget };
    startAction(state, enemy, 'slam', toTarget, UNDERTAKER_SLAM_WINDUP_TICKS, 8, events, target.id);
  } else if (action.kind === 'slam' && target) {
    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    // A prensa do Coveiro tem dano PROPRIO (o dobro largo do contato dele):
    // derivar de `contactDamage` faria o golpe pesado valer 14, e um golpe
    // que custa uma posicao inteira nao pode doer como um encostao.
    const heavy =
      enemy.archetype === 'undertaker'
        ? UNDERTAKER_SLAM_DAMAGE
        : def.contactDamage * 1.2;
    const reach = enemy.archetype === 'undertaker' ? UNDERTAKER_SLAM_RANGE : 2.1;
    if (distTo(enemy, target) < reach) {
      damageEntity(state, target, heavy, events, {
        kind: 'enemy_contact',
        archetype: enemy.archetype as EnemyArchetype,
        elite: enemy.elite,
      });
    }
  }
};

/** Returns true while an authoritative action owns the enemy's pose/movement. */
const advanceAction = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): boolean => {
  const action = enemy.action;
  if (!action) return false;
  if (state.tick >= action.releaseAt && action.phase === 'windup') releaseAction(state, enemy, events);
  if (!enemy.alive) return true;
  if (state.tick >= action.endsAt) {
    enemy.action = undefined;
    return false;
  }
  if (action.phase === 'release') action.phase = 'recovery';
  return true;
};

/**
 * Celula de parede mais proxima que o bruiser consegue arrancar, ou null.
 *
 * A varredura e em ordem FIXA e escolhe pela menor distancia, com a ordem de
 * iteracao como desempate: a simulacao e deterministica e duas maquinas da
 * mesma sala precisam arrancar exatamente o mesmo bloco. Um sorteio aqui
 * divergiria o mundo entre os dois jogadores.
 */
export const findRippable = (state: SurvivalState, ent: Entity): { x: number; y: number } | null => {
  const ex = Math.floor(ent.x);
  const ey = Math.floor(ent.y);
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let dy = -BRUISER_HURL_REACH; dy <= BRUISER_HURL_REACH; dy++) {
    for (let dx = -BRUISER_HURL_REACH; dx <= BRUISER_HURL_REACH; dx++) {
      const x = ex + dx;
      const y = ey + dy;
      if (x < 0 || y < 0 || x >= state.config.width || y >= state.config.height) continue;
      // MESMO criterio de `ripSolid`, e nao uma copia dele.
      //
      // A copia existia e discordava do original em um detalhe: a borda do mapa
      // parece arrancavel pelo tipo do bloco, mas `ripSolid` a recusa. Perto da
      // moldura o bruiser escolhia a borda por ser a mais proxima, tomava um
      // `false`, e escolhia a MESMA celula no tick seguinte — travado para
      // sempre, com paredes validas a dois passos de distancia.
      if (!canRip(state, x, y)) continue;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
};

/**
 * Direcao de perseguicao do guardiao, contornando ou arrombando o que houver.
 *
 * Com linha de visao livre ele vai reto, e nem chega a pensar: buscar caminho a
 * cada tick para um alvo que esta a vista seria gasto puro, e a rota em grade
 * ainda daria um andar quadriculado onde o certo e a diagonal.
 *
 * Bloqueado, ele segue a rota de menor custo — que pode passar POR DENTRO de uma
 * parede quebravel quando o desvio livre e longo demais. A rota e recalculada em
 * intervalos e nao a cada tick: o alvo se move pouco entre um calculo e outro, e
 * a busca e a coisa mais cara que a simulacao faz por criatura.
 */
const guardianSteering = (
  state: SurvivalState,
  enemy: Entity,
  targetX: number,
  targetY: number,
  events: SemanticEvent[]
): Vec2 => {
  if (hasLineOfSight(state, enemy.x, enemy.y, targetX, targetY)) {
    state.bossRuntime.path = [];
    return normalized(targetX - enemy.x, targetY - enemy.y);
  }

  const w = state.config.width;
  const ex = Math.floor(enemy.x);
  const ey = Math.floor(enemy.y);
  const stale = state.tick - state.bossRuntime.pathAt >= GUARDIAN_PATH_INTERVAL_TICKS;
  if (stale || state.bossRuntime.path.length === 0) {
    state.bossRuntime.path = findPath(state, ex, ey, Math.floor(targetX), Math.floor(targetY));
    state.bossRuntime.pathAt = state.tick;
  }

  // Consome os passos ja alcancados. Sem isto ele fica mirando a celula em que
  // ja esta e trava no lugar.
  while (state.bossRuntime.path.length > 0 && state.bossRuntime.path[0] === ey * w + ex) {
    state.bossRuntime.path.shift();
  }
  if (state.bossRuntime.path.length === 0) {
    // Sem rota dentro do orcamento: volta a empurrar na direcao do alvo. Pior,
    // mas nunca imovel — um chefe parado e o fim da luta.
    return normalized(targetX - enemy.x, targetY - enemy.y);
  }

  const next = state.bossRuntime.path[0];
  const nx = next % w;
  const ny = (next / w) | 0;
  // Parede no proximo passo: a rota ja pagou o preco de atravessa-la, entao ele
  // ABRE em vez de tropecar. E o que transforma "preso atras de uma pedra" em
  // "vem vindo, e a pedra nao vai adiantar".
  //
  // E abre BRECHA, nao porta. O guardiao tem raio 0,68 — corpo de quase um tile
  // e meio — e a colisao amostra os quatro cantos dele: num vao de uma celula so
  // os cantos ainda caem na pedra dos lados, e ele fica encostado no buraco que
  // acabou de fazer. Medido, foi exatamente o que aconteceu: parede quebrada,
  // caminho vazio e o chefe parado a 1,7 tile dela pelo resto da luta. As
  // vizinhas PERPENDICULARES ao passo sao o que da largura ao vao.
  if (state.solid[ny * w + nx] !== SOLID_NONE) {
    const alongX = Math.abs(nx - ex) >= Math.abs(ny - ey);
    for (const [ox, oy] of alongX ? [[0, 0], [0, -1], [0, 1]] : [[0, 0], [-1, 0], [1, 0]]) {
      const bx = nx + ox;
      const by = ny + oy;
      if (state.solid[by * w + bx] === SOLID_NONE) continue;
      if (!breakSolid(state, bx, by, events)) ripSolid(state, bx, by, events);
    }
  }
  return normalized(nx + 0.5 - enemy.x, ny + 0.5 - enemy.y);
};

/**
 * O Bispo se cura do chao, e nao de si mesmo.
 *
 * Em cima de fungo VIVO ele regenera acima do que o tiro base sustenta, entao
 * atrito nao o mata: a luta e resolvida mudando o piso, nao a barra de vida.
 *
 * Fungo AQUECIDO (fumegando, antes de virar fogo) ja nao cura. O detalhe e o
 * ponto inteiro do encontro: o jogador ve a cura parar no instante em que
 * encosta calor, e nao quatro segundos depois quando a chama finalmente sobe.
 * Se a recompensa so viesse com o fogo, a licao chegaria tarde demais para ser
 * lida como consequencia da propria acao.
 */
const bishopRegen = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): boolean => {
  if (state.surface[cellUnder(state, enemy)] !== SURF_FUNGAL) return false;
  if (enemy.hp >= enemy.maxHp) return true;
  enemy.hp = Math.min(enemy.maxHp, enemy.hp + BISHOP_REGEN_PER_TICK);
  // A cura VISTA e uma descoberta — e o documento que ela abre e uma medicao
  // de campo, entao medir exige ter estado la. O bit ja aceso sai antes de
  // qualquer raycast: sem essa saida, a linha de visao seria recalculada a
  // cada tick de cura pelo resto da run, por nada.
  if ((state.stats.discoveries & DISCOVERY_BISHOP_HEALED) === 0) {
    const witness = nearestTarget(state, enemy.x, enemy.y);
    if (
      witness &&
      distTo(enemy, witness) <= WITNESS_RANGE &&
      hasLineOfSight(state, enemy.x, enemy.y, witness.x, witness.y)
    ) {
      markDiscovery(state.stats, DISCOVERY_BISHOP_HEALED);
    }
  }
  // Um evento a cada quatro ticks, e nao a cada tick: a 20 Hz o barramento
  // semantico levaria 20 curas por segundo so deste inimigo, e o mixer de audio
  // gastaria o orcamento de vozes inteiro num som que se le igual em 5 Hz.
  if (state.tick % 4 === 0) {
    events.push({ t: 'heal', x: enemy.x, y: enemy.y, entity: enemy.id, amount: BISHOP_REGEN_PER_TICK * 4 });
  }
  return true;
};

/**
 * Celula de fungo vivo mais proxima, ou null.
 *
 * Varredura em ordem fixa com a menor distancia vencendo e a ordem de iteracao
 * como desempate, pelo mesmo motivo de `findRippable`: duas maquinas da mesma
 * sala precisam mandar o bispo para o MESMO tapete.
 */
const nearestFungal = (state: SurvivalState, ent: Entity): { x: number; y: number } | null => {
  const w = state.config.width;
  const ex = Math.floor(ent.x);
  const ey = Math.floor(ent.y);
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let dy = -BISHOP_FUNGAL_SEARCH; dy <= BISHOP_FUNGAL_SEARCH; dy++) {
    for (let dx = -BISHOP_FUNGAL_SEARCH; dx <= BISHOP_FUNGAL_SEARCH; dx++) {
      const x = ex + dx;
      const y = ey + dy;
      if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
      if (state.surface[y * w + x] !== SURF_FUNGAL) continue;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
};

/**
 * O calor da arma do jogador mais proximo, ou -1 se ninguem esta perto.
 *
 * Do jogador de pe MAIS PROXIMO, e nao do maior calor da sala: quem se
 * aproxima e quem o miner esta olhando. No co-op isso significa que um parceiro
 * frio pode chegar perto enquanto o outro fica queimando la atras — e essa
 * divisao de tarefas e um plano legitimo, nao uma brecha.
 */
const approachingHeat = (state: SurvivalState, ent: Entity): number => {
  const player = nearestTarget(state, ent.x, ent.y);
  if (!player || distTo(ent, player) > MINER_NOTICE_RANGE) return -1;
  if (!hasLineOfSight(state, ent.x, ent.y, player.x, player.y)) return -1;
  return state.playerExtras[player.slot ?? 0].heat;
};

/**
 * Decide a postura do Miner quando ele te NOTA, e congela a decisao.
 *
 * Congelar importa: se a postura seguisse o calor tick a tick, o miner
 * oscilaria entre fugir e atacar enquanto a arma esfria, e o jogador veria um
 * NPC epiletico em vez de uma reacao. O calor decide UMA vez, no instante em que
 * ele levanta a cabeca — depois disso o encontro ja e o que e.
 */
const settleMinerMood = (state: SurvivalState, ent: Entity, events: SemanticEvent[]): void => {
  if (ent.mood !== MINER_MOOD_PASSIVE) return;
  const heat = approachingHeat(state, ent);
  if (heat < 0) return;
  if (heat >= MINER_RAGE_HEAT) {
    ent.mood = MINER_MOOD_ENRAGED;
    markDiscovery(state.stats, DISCOVERY_MINER_ENRAGED);
    events.push({ t: 'miner_mood', entity: ent.id, x: ent.x, y: ent.y, mood: MINER_MOOD_ENRAGED });
    return;
  }
  if (heat >= MINER_FEAR_HEAT) {
    ent.mood = MINER_MOOD_FLEEING;
    markDiscovery(state.stats, DISCOVERY_MINER_FLED);
    events.push({ t: 'miner_mood', entity: ent.id, x: ent.x, y: ent.y, mood: MINER_MOOD_FLEEING });
  }
  // Arma fria: ele nao faz nada, e continua nao fazendo nada. Este e o unico
  // inimigo do jogo que o jogador pode simplesmente deixar em paz.
};

/**
 * Supernova Fungica: dano em 360 graus e o tapete REPLANTADO em volta dele.
 *
 * A parte que importa e a segunda. Sem replantar, queimar a arena resolvia a
 * luta de uma vez — o jogador aprendia a resposta certa e o resto do encontro
 * virava formalidade. Com o replantio, a resposta certa continua certa e passa a
 * ter de ser REPETIDA, que e a diferenca entre um truque e uma luta.
 *
 * Nao planta sobre solido nem sobre fogo vivo: plantar dentro da chama apagaria
 * o incendio que o jogador acabou de acender, e transformaria a acao dele em
 * nada. O fungo cresce onde o fogo ja passou, e nao por cima dele.
 */
const bishopNova = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const w = state.config.width;
  const r = Math.ceil(BISHOP_NOVA_RADIUS);
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > BISHOP_NOVA_RADIUS * BISHOP_NOVA_RADIUS) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) continue;
      if (state.surface[i] === SURF_FIRE || state.surface[i] === SURF_FUNGAL) continue;
      setSurface(state, i, SURF_FUNGAL, BISHOP_NOVA_FUNGAL_TICKS);
    }
  }
  // Quem estava DENTRO do disco, medido ANTES do dano: depois dele o corpo
  // pode ter caido, e a pergunta que a descoberta faz e "estava la?", nao
  // "continua de pe?" — as duas juntas e que valem a marca.
  const caught: Entity[] = [];
  for (const player of state.players) {
    if (!player.alive || !state.playerExtras[player.slot ?? 0].joined) continue;
    if (distTo(enemy, player) > BISHOP_NOVA_RADIUS) continue;
    caught.push(player);
    damageEntity(state, player, BISHOP_NOVA_DAMAGE, events, {
      kind: 'enemy_contact',
      archetype: 'bishop',
      elite: enemy.elite,
    });
  }
  // Sobreviver a Supernova destrava o documento que diz que ela nunca foi um
  // ataque. Le `hp > 0` e nao `alive`: quem chegou a zero ainda esta vivo
  // neste instante — `resolveDownedAndDeaths` roda depois, no fim do tick — e
  // marcar ali daria a descoberta a quem justamente nao sobreviveu.
  for (const player of caught) {
    if (player.hp > 0 && !state.playerExtras[player.slot ?? 0].downed) {
      markDiscovery(state.stats, DISCOVERY_BISHOP_NOVA_SURVIVED);
      break;
    }
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: BISHOP_NOVA_RADIUS });
};

/**
 * O pulso do Ressonante: arma os cristais em volta e cada um DESCARREGA pelas
 * aberturas coladas nele.
 *
 * Ele nao ataca o jogador; ele opera a regra da Catedral. A carga sai de
 * `chargeCells` com origem de inimigo, entao o dano e o mesmo de qualquer
 * descarga (26) — inclusive contra OUTROS inimigos parados no lugar errado, de
 * proposito: a cadeia e do mundo, nao dele. O orcamento de cristais e a
 * varredura em ordem fixa mantem o custo e o determinismo previsiveis.
 *
 * O contra-jogo mora no que o pulso NAO faz: cristal quebrado antes do pulso e
 * um cristal que nao arma. Preservar a sala e proteger a luz; esvazia-la e
 * desarmar o bicho.
 */
const resonantPulse = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const w = state.config.width;
  const h = state.config.height;
  const r = Math.ceil(RESONANT_PULSE_RADIUS);
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  const charged = new Set<number>();
  let armed = 0;
  for (let dy = -r; dy <= r && armed < RESONANT_CRYSTAL_BUDGET; dy++) {
    for (let dx = -r; dx <= r && armed < RESONANT_CRYSTAL_BUDGET; dx++) {
      if (dx * dx + dy * dy > RESONANT_PULSE_RADIUS * RESONANT_PULSE_RADIUS) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_CRYSTAL) continue;
      armed++;
      for (const n of [i - 1, i + 1, i - w, i + w]) {
        if (state.solid[n] === SOLID_NONE) charged.add(n);
      }
    }
  }
  if (charged.size > 0) {
    chargeCells(state, [...charged], events, { source: 'enemy', owner: enemy.id });
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: RESONANT_PULSE_RADIUS });
};

/**
 * Passo dos ESPREITADORES: Lampreia de Lodo (agua) e Espectro de Geada (gelo).
 *
 * O padrao e um so e o elemento muda: escondido dentro da propria lamina, o
 * corpo nao aparece — o cliente desenha a ondulacao/rachadura pela postura — e
 * o movimento so aceita passos que CONTINUEM dentro do elemento. O bote e a
 * unica saida, e e telegrafado. Nenhum dos dois e "um stalker invisivel": a
 * postura viaja no snapshot e a posicao e sempre legivel pela superficie.
 *
 * O contra-jogo e territorial, nao de mira: eletrificar a agua atordoa a
 * Lampreia (regra generica de descarga); derreter o gelo tira a cobertura do
 * Espectro e o deixa lento na agua que o proprio jogador tornou condutiva.
 */
const lurkerStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  dist: number,
  dt: number,
  events: SemanticEvent[]
): void => {
  const isLamprey = enemy.archetype === 'mud_lamprey';
  const w = state.config.width;
  const inElement = (i: number): boolean =>
    i >= 0 && i < state.surface.length &&
    (isLamprey ? isConductiveSurface(state.surface[i]) : state.surface[i] === SURF_ICE);

  const hidden = inElement(cellUnder(state, enemy));
  enemy.mood = hidden ? LURKER_HIDDEN : LURKER_EXPOSED;
  if (!player) return;

  const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
  if (dist > def.aggroRange && state.tick >= enemy.alertedUntil) return;

  const toward = normalized(player.x - enemy.x, player.y - enemy.y);
  enemy.facing = { ...toward };

  const range = isLamprey ? LAMPREY_LUNGE_RANGE : WRAITH_LUNGE_RANGE;
  if (
    dist < range &&
    state.tick >= enemy.contactReadyAt &&
    hasLineOfSight(state, enemy.x, enemy.y, player.x, player.y)
  ) {
    enemy.contactReadyAt =
      state.tick + (isLamprey ? LAMPREY_LUNGE_COOLDOWN_TICKS : WRAITH_LUNGE_COOLDOWN_TICKS);
    // O bote expoe ANTES de sair: o windup inteiro acontece com o corpo
    // visivel — a agua "se abre", o gelo racha — e e essa a janela de reacao.
    enemy.mood = LURKER_EXPOSED;
    startAction(
      state,
      enemy,
      'charge',
      toward,
      isLamprey ? LAMPREY_LUNGE_WINDUP_TICKS : WRAITH_LUNGE_WINDUP_TICKS,
      8,
      events,
      player.id
    );
    return;
  }

  // Dentro do elemento a lamina nao retarda (e o meio DELE); o Espectro ainda
  // desliza mais rapido que qualquer coisa anda. Fora, valem as regras de
  // superficie de todo mundo — a agua que cobre a Lampreia e a mesma que
  // atola o Espectro desabrigado.
  const speed = hidden
    ? def.speed * (isLamprey ? 1 : WRAITH_UNDER_ICE_SPEED_SCALE)
    : def.speed * 0.8 * surfaceSpeedMul(state, enemy);
  const stepX = toward.x * speed * dt;
  const stepY = toward.y * speed * dt;

  if (hidden) {
    // So anda por onde o elemento continua. Na borda, desliza pelos eixos; sem
    // caminho molhado/congelado, guarda a margem — que e exatamente a leitura
    // que o jogador precisa ter dele.
    const stays = (mx: number, my: number): boolean =>
      inElement(Math.floor(enemy.y + my) * w + Math.floor(enemy.x + mx));
    if (stays(stepX, stepY)) moveEntity(state, enemy, stepX, stepY);
    else if (stays(stepX, 0)) moveEntity(state, enemy, stepX, 0);
    else if (stays(0, stepY)) moveEntity(state, enemy, 0, stepY);
  } else {
    moveEntity(state, enemy, stepX, stepY);
  }
};

/**
 * Passo do FOLE: ele respira o ambiente da Fenda.
 *
 * Fase de inspirar: remove gas num raio em volta, algumas celulas por folego,
 * varredura em ordem fixa. Fase de expelir: sopra uma linha de gas na direcao
 * OPOSTA ao jogador. As duas juntas produzem a decisao que o define: as vezes
 * vale deixa-lo vivo por alguns segundos para que limpe a passagem desejada —
 * sabendo que a rota de tras esta sendo contaminada enquanto isso.
 *
 * A fase sai do RELOGIO (tick + id), nao de sorteio: as duas maquinas de uma
 * sala de co-op veem o mesmo folego, e a RNG da run nao anda por causa dele.
 */
const bellowsStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  dist: number,
  dt: number,
  events: SemanticEvent[]
): void => {
  const w = state.config.width;
  const h = state.config.height;
  const phase = Math.floor((state.tick + enemy.id * 37) / BELLOWS_CYCLE_TICKS) % 2;
  enemy.mood = phase === 0 ? BELLOWS_INHALING : BELLOWS_EXHALING;

  if (state.tick >= enemy.nextActionAt) {
    enemy.nextActionAt = state.tick + BELLOWS_BREATH_INTERVAL_TICKS;
    if (enemy.mood === BELLOWS_INHALING) {
      const r = BELLOWS_BREATH_RADIUS;
      const cx = Math.floor(enemy.x);
      const cy = Math.floor(enemy.y);
      let inhaled = 0;
      for (let dy = -r; dy <= r && inhaled < BELLOWS_INHALE_PER_BREATH; dy++) {
        for (let dx = -r; dx <= r && inhaled < BELLOWS_INHALE_PER_BREATH; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          if (state.surface[i] !== SURF_GAS) continue;
          setSurface(state, i, SURF_NONE, 0);
          inhaled++;
        }
      }
    } else {
      const dir = player ? normalized(enemy.x - player.x, enemy.y - player.y) : enemy.facing;
      for (let step = 1; step <= BELLOWS_EXHALE_LENGTH; step++) {
        const x = Math.floor(enemy.x + dir.x * step);
        const y = Math.floor(enemy.y + dir.y * step);
        if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) break;
        const i = y * w + x;
        if (state.solid[i] !== SOLID_NONE) break;
        if (state.surface[i] === SURF_NONE) setSurface(state, i, SURF_GAS, GAS_LIFE_TICKS);
      }
    }
  }

  if (!player) return;
  const def = ARCHETYPES.bellows;
  if (dist > def.aggroRange && state.tick >= enemy.alertedUntil) return;
  const toward = normalized(player.x - enemy.x, player.y - enemy.y);
  enemy.facing = { ...toward };
  const contactRange = enemy.radius + player.radius + 0.18;
  if (dist < contactRange && state.tick >= enemy.contactReadyAt) {
    enemy.contactReadyAt = state.tick + def.contactCooldown;
    startAction(state, enemy, 'contact', toward, 6, 4, events, player.id);
    return;
  }
  const speed = def.speed * surfaceSpeedMul(state, enemy);
  moveEntity(state, enemy, toward.x * speed * dt, toward.y * speed * dt);
};

/**
 * Postura termica do Escoriaceo, decidida pelo CHAO e nao por sorteio.
 *
 * `rangedReadyAt` guarda o "quente ate": ele e o unico campo de relogio ocioso
 * num inimigo sem ataque a distancia, e um campo novo na entidade entraria no
 * snapshot e no resync por causa de um unico arquetipo.
 */
/** Ha algum cristal no raio do pulso? Varredura com saida cedo. */
const hasCrystalNear = (state: SurvivalState, enemy: Entity): boolean => {
  const w = state.config.width;
  const h = state.config.height;
  const r = Math.ceil(RESONANT_PULSE_RADIUS);
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > RESONANT_PULSE_RADIUS * RESONANT_PULSE_RADIUS) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
      if (state.solid[y * w + x] === SOLID_CRYSTAL) return true;
    }
  }
  return false;
};

const settleScoriacHeat = (state: SurvivalState, enemy: Entity): void => {
  const surf = state.surface[cellUnder(state, enemy)];
  if (surf === SURF_EMBER || surf === SURF_FIRE) {
    enemy.rangedReadyAt = state.tick + SCORIAC_HOT_TICKS;
  }
  enemy.mood = state.tick < enemy.rangedReadyAt ? SCORIAC_HOT : SCORIAC_COOL;
};

/**
 * Uma passada da investida do Cavalo: move, atropela e deixa rastro.
 *
 * Mora fora de `releaseAction` porque a investida do cavalo dura DEZENAS de
 * ticks, e nao um instante. As outras acoes resolvem tudo no release — a pedra
 * sai, o golpe acerta ou nao — e por isso `advanceAction` pode devolver `true` e
 * a criatura ficar parada na recuperacao. Aqui a recuperacao E a acao.
 *
 * O rastro nasce ATRAS, e sem guardar historico: a posicao de onde o fogo sobe e
 * a posicao atual menos a direcao vezes o atraso. Guardar as celulas visitadas
 * daria o mesmo resultado e acrescentaria um campo por inimigo ao estado
 * autoritativo — que e sincronizado, hasheado e reenviado a cada resync.
 */
const horseChargeStride = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const action = enemy.action;
  if (!action || action.kind !== 'charge' || action.phase === 'windup') return;

  const dt = 1 / TICK_HZ;
  const step = HORSE_CHARGE_SPEED * dt;
  enemy.facing = { ...action.direction };
  const moved = moveEntity(state, enemy, action.direction.x * step, action.direction.y * step);

  // Bater na pedra ENCERRA a investida. E o unico contra-jogo posicional que o
  // cavalo oferece: quem entende o telegrafo poe uma parede no caminho e ganha o
  // cooldown inteiro de graca. Continuar raspando na parede ate o tempo acabar
  // tiraria a recompensa de ter lido a ameaca.
  if (moved.blockedX || moved.blockedY) {
    enemy.action = undefined;
    enemy.vx = 0;
    enemy.vy = 0;
    return;
  }

  const victim = nearestTarget(state, enemy.x, enemy.y);
  if (victim && state.tick >= enemy.contactReadyAt && distTo(enemy, victim) < enemy.radius + victim.radius + 0.35) {
    enemy.contactReadyAt = state.tick + ARCHETYPES.fungal_horse.contactCooldown;
    damageEntity(state, victim, ARCHETYPES.fungal_horse.contactDamage * (enemy.elite ? 1.4 : 1), events, {
      kind: 'enemy_contact',
      archetype: 'fungal_horse',
      elite: enemy.elite,
    });
  }

  // O rastro so comeca depois que a investida ANDOU o atraso inteiro.
  //
  // Subtrair sempre a distancia cheia supoe que ela ja foi percorrida, e nas
  // primeiras passadas ela nao foi: a primeira, de 0,525 tile, mira cerca de
  // 1,575 tile ATRAS do ponto de partida — chao do outro lado da origem, onde o
  // cavalo nunca esteve. Toda investida acendia fogo pelas costas de onde
  // comecou, o que apagava a leitura do rastro como caminho percorrido e podia
  // queimar o jogador que tinha recuado na direcao certa.
  const strides = state.tick - action.releaseAt;
  if (strides < HORSE_TRAIL_DELAY_TICKS) return;

  const trailX = Math.floor(enemy.x - action.direction.x * step * HORSE_TRAIL_DELAY_TICKS);
  const trailY = Math.floor(enemy.y - action.direction.y * step * HORSE_TRAIL_DELAY_TICKS);
  if (trailX < 0 || trailY < 0 || trailX >= state.config.width || trailY >= state.config.height) return;
  const i = trailY * state.config.width + trailX;
  if (state.solid[i] !== SOLID_NONE) return;
  // `igniteCell` primeiro: cada materia tem a propria resposta ao calor (o fungo
  // seca antes de pegar, o gas da flash, o esporo esteriliza), e o cavalo nao
  // tem por que ser a excecao que atropela essa tabela. So quando o chao nao tem
  // resposta propria — rocha nua — o rastro traz o proprio combustivel.
  if (!igniteCell(state, i, events)) {
    if (state.surface[i] === SURF_NONE) {
      setSurface(state, i, SURF_FIRE, HORSE_TRAIL_FUEL_TICKS);
      events.push({ t: 'ignite', x: trailX, y: trailY });
    }
  }
};

/**
 * Uma passada da BROCA DE AVANCO: anda, abre o vao e atropela.
 *
 * Mora fora de `releaseAction` pelo mesmo motivo da investida do Corcel — a
 * recuperacao E a acao, e ela dura dezenas de ticks. O que a distingue do
 * Corcel e o que acontece na pedra: o cavalo PARA (ler o telegrafo e por uma
 * parede no caminho e o contra-jogo dele), a broca ATRAVESSA. Contra o
 * Diamandis a parede nao e resposta; a resposta e sair da linha, e o corredor
 * que fica aberto e permanente.
 *
 * `canRip` decide o que cai: rocha e fragil vao, minerio e cristal FICAM de
 * pe. E a mesma regra do Britador, e e o que faz a passagem dele EXPOR veio
 * que estava emparedado — o estrago do chefe vira a mina do jogador.
 */
const diamandisDrillStride = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const action = enemy.action;
  if (!action || action.kind !== 'drill' || action.phase === 'windup') return;

  const w = state.config.width;
  const dt = 1 / TICK_HZ;
  const step = DIAMANDIS_DRILL_SPEED * dt;
  enemy.facing = { ...action.direction };

  // Abre ANTES de andar, e nao depois: um corpo de raio 0,9 empurrado contra
  // rocha e um corpo travado, e a broca que so limpasse o rastro deixaria o
  // chefe raspando na parede com a acao correndo. O vao nasce a frente, na
  // largura do corpo, e ai o passo cabe.
  const ahead = 1.2;
  const side = { x: -action.direction.y, y: action.direction.x };
  for (let lane = -DIAMANDIS_DRILL_WIDTH; lane <= DIAMANDIS_DRILL_WIDTH; lane++) {
    for (const reach of [ahead, ahead + 0.9]) {
      const cx = Math.floor(enemy.x + action.direction.x * reach + side.x * lane);
      const cy = Math.floor(enemy.y + action.direction.y * reach + side.y * lane);
      if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= state.config.height - 1) continue;
      if (state.solid[cy * w + cx] === SOLID_NONE) continue;
      // `breakSolid` primeiro (fragil e cristal tem resposta propria), e o que
      // ele recusar vai para `ripSolid`, que e quem derruba rocha comum.
      const opened = breakSolid(state, cx, cy, events) || ripSolid(state, cx, cy, events);
      // A obra VISTA e uma descoberta. Sai antes de qualquer raycast quando o
      // bit ja esta aceso — a broca abre dezenas de celulas por passagem, e
      // isto roda por celula.
      // A obra VISTA e uma descoberta. So distancia, SEM linha de visao — e a
      // unica testemunha do jogo em que exigir visada seria absurdo: a parede
      // entre os dois e exatamente a coisa que esta sendo removida, e quem
      // esta do outro lado dela e quem mais precisa entender o que aconteceu.
      if (opened && (state.stats.discoveries & DISCOVERY_DIAMANDIS_CORRIDOR) === 0) {
        const witness = nearestTarget(state, enemy.x, enemy.y);
        if (witness && distTo(enemy, witness) <= WITNESS_RANGE) {
          markDiscovery(state.stats, DISCOVERY_DIAMANDIS_CORRIDOR);
        }
      }
    }
  }

  moveEntity(state, enemy, action.direction.x * step, action.direction.y * step);

  const victim = nearestTarget(state, enemy.x, enemy.y);
  if (victim && state.tick >= enemy.contactReadyAt && distTo(enemy, victim) < enemy.radius + victim.radius + 0.4) {
    enemy.contactReadyAt = state.tick + ARCHETYPES.diamandis.contactCooldown;
    damageEntity(state, victim, DIAMANDIS_DRILL_DAMAGE, events, {
      kind: 'enemy_contact',
      archetype: 'diamandis',
      elite: enemy.elite,
    });
  }

  // Reator em colapso deixa brasa por onde passa: a obra vai esquentando a
  // sala sozinha, sem nenhum golpe a mais.
  if ((state.bossRuntime.phasesFired & BOSS_PHASE_REACTOR) !== 0) {
    const i = cellUnder(state, enemy);
    if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
      setSurface(state, i, SURF_EMBER, DIAMANDIS_REACTOR_EMBER_TICKS);
    }
  }
};

/**
 * O passo do DEVORADOR BRANCO: mergulhado, ele anda por baixo e deixa rastro;
 * exposto, e um corpo lento que pode ser cobrado.
 *
 * O ciclo inteiro mora aqui porque ele nao e "perseguir e bater" em nenhum
 * momento — submerso ele nem colide com o jogador, e exposto ele nao decide
 * nada alem de continuar de pe pelo tempo da janela. E o mesmo motivo pelo qual
 * o Miner, os espreitadores e o Fole tem fluxo proprio.
 */
const devourerStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  dt: number,
  events: SemanticEvent[],
): void => {
  const w = state.config.width;

  // NO AR o arco ja foi resolvido inteiro na decolagem, e quem conduz o corpo e
  // `devourerLeapStride`, no ramo em que a ACAO manda (o mesmo do Corcel e da
  // broca). Chegar aqui voando significa que a acao sumiu no meio do voo —
  // um `endsAt` curto demais, um atordoamento, um resync.
  //
  // A resposta e POUSAR, e nao ignorar. Ignorar foi a primeira versao e deixava
  // o chefe suspenso para sempre: sem acao para conduzi-lo e sem humor que a IA
  // aceitasse, ele parava no ar e a luta acabava ali. Um chefe que trava e pior
  // que um chefe que cai um passo fora do lugar.
  if (enemy.mood === DEVOURER_AIRBORNE) {
    devourerLand(state, enemy, events);
    return;
  }

  // PRESO: a janela. Ele nao faz NADA aqui, e a lista do que ele nao faz e a
  // mecanica inteira — nao anda, nao vira, nao cobra contato e nao tem areia
  // absorvendo tiro. Encostar nele e de graca, e e por isso que este e o
  // momento de gastar o superaquecimento.
  //
  // Antes existia um estado EXPOSTO em que ele perseguia devagar e machucava
  // por contato. Ele saiu: perseguir de leve no meio da unica abertura do ciclo
  // punia justamente a aproximacao que a abertura existe para convidar.
  if (enemy.mood === DEVOURER_STUCK) {
    if (state.tick >= enemy.nextActionAt) {
      enemy.mood = DEVOURER_BURROWED;
      state.bossRuntime.leapsLeft = DEVOURER_LEAPS_PER_CYCLE;
      enemy.nextActionAt = state.tick + DEVOURER_BURROW_MIN_TICKS;
    }
    return;
  }

  // MERGULHADO. Ele nao colide e nao e alcancado pelo terreno: esta POR BAIXO
  // dele. O que fica na superficie e a faixa de silica solta — o aviso de por
  // onde ele anda, e ao mesmo tempo a materia que o contra-jogo consome.
  if (!player) return;
  const toward = normalized(player.x - enemy.x, player.y - enemy.y);
  enemy.facing = { ...toward };
  const step = DEVOURER_BURROW_SPEED * dt;
  // Sem `moveEntity`: parede nao vale por baixo. Ele e o unico corpo do jogo
  // que atravessa solido, e e por isso que perseguir nao e uma resposta a ele.
  enemy.x = Math.max(1.5, Math.min(w - 1.5, enemy.x + toward.x * step));
  enemy.y = Math.max(1.5, Math.min(state.config.height - 1.5, enemy.y + toward.y * step));

  // O RASTRO: silica solta na faixa por onde passou, so em chao aberto e limpo.
  // Nao pinta por cima de nada — nem de fogo, nem de agua, nem do proprio
  // vidro: sobrescrever o vidro apagaria o contra-jogo do jogador com o
  // proprio corpo do chefe.
  const side = { x: -toward.y, y: toward.x };
  for (let lane = -DEVOURER_TRAIL_WIDTH; lane <= DEVOURER_TRAIL_WIDTH; lane++) {
    const tx = Math.floor(enemy.x + side.x * lane);
    const ty = Math.floor(enemy.y + side.y * lane);
    if (tx < 1 || ty < 1 || tx >= w - 1 || ty >= state.config.height - 1) continue;
    const i = ty * w + tx;
    if (state.solid[i] !== SOLID_NONE) continue;
    if (state.surface[i] !== SURF_NONE && state.surface[i] !== SURF_SCORCHED) continue;
    setSurface(state, i, SURF_SILT, 0);
  }

  if (state.tick < enemy.nextActionAt) return;

  // A EMERGENCIA. Ele mira onde o jogador VAI estar, e nao onde esta: o alvo
  // parado e o unico que a antecipacao erra, e isso e de proposito — quem le o
  // rastro e para de correr em linha reta ja esta jogando contra ele.
  const leadX = player.x + player.vx * DEVOURER_LEAD_SECONDS;
  const leadY = player.y + player.vy * DEVOURER_LEAD_SECONDS;
  const spot = devourerSurfacingSpot(state, Math.floor(leadX), Math.floor(leadY));
  if (spot < 0) {
    // Chao vitrificado em toda a volta: ele NAO consegue cair aqui. Volta a
    // andar por baixo e tenta de novo mais tarde — e essa recusa e a
    // recompensa inteira de quem transformou a areia em vidro.
    enemy.nextActionAt = state.tick + DEVOURER_BURROW_MIN_TICKS;
    events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: 1.2 });
    return;
  }
  const landX = (spot % w) + 0.5;
  const landY = Math.floor(spot / w) + 0.5;
  // A conta se recompoe sozinha em vez de depender de quem criou o chefe: um
  // Devorador que chegue aqui com a rajada zerada (spawn por caminho novo,
  // resync, teste) comeca uma rajada inteira em vez de saltar uma vez e ir
  // direto para a janela.
  if (state.bossRuntime.leapsLeft <= 0) state.bossRuntime.leapsLeft = DEVOURER_LEAPS_PER_CYCLE;

  // A DECOLAGEM fica ATRAS da queda, na linha por onde ele veio: ele recua por
  // baixo o quanto for preciso e sobe dali. E aqui que o vidro cobra a segunda
  // vez — sem chao solto para romper, nao ha salto.
  const launch = devourerLaunchSpot(state, enemy, landX, landY);
  if (launch < 0) {
    enemy.nextActionAt = state.tick + DEVOURER_BURROW_MIN_TICKS;
    events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: 1.2 });
    return;
  }
  enemy.x = (launch % w) + 0.5;
  enemy.y = Math.floor(launch / w) + 0.5;
  state.bossRuntime.leapToX = landX;
  state.bossRuntime.leapToY = landY;
  // O telegrafo aponta para a QUEDA e nao para o jogador: e o rumo do arco que
  // o aviso precisa prometer, e nos poucos ticks entre a mira e a decolagem o
  // jogador ja andou. Apontar para ele desenharia uma linha que o salto nao vai
  // seguir.
  const arc = normalized(landX - enemy.x, landY - enemy.y);
  startAction(state, enemy, 'erupt', arc, DEVOURER_ERUPT_WINDUP_TICKS, 6, events, player.id);
};

/**
 * Onde o salto DECOLA, ou -1 se nao houver chao solto para romper.
 *
 * O ponto ideal fica na reta entre ele e a queda, recuado o bastante para o
 * arco ter comprimento legivel — a distancia e a que ele ja tem, presa entre o
 * minimo e o maximo. Se ele estiver perto demais, o ponto cai ATRAS dele: e ele
 * recua por baixo antes de subir, que e exatamente o que um bicho que toma
 * impulso faz.
 *
 * A validacao e a MESMA da queda (`devourerSurfacingSpot`): nem vidro, nem
 * solido. Reusar a funcao e o ponto — sao a mesma pergunta ("da para romper o
 * chao aqui?") e duas copias dela acabariam discordando sobre o vidro, que e a
 * unica coisa que o jogador controla no encontro.
 */
const devourerLaunchSpot = (
  state: SurvivalState,
  enemy: Entity,
  landX: number,
  landY: number,
): number => {
  const span = Math.hypot(enemy.x - landX, enemy.y - landY);
  // Colado no ponto de queda, a subtracao nao da direcao nenhuma — e esse e o
  // caso COMUM, nao o raro: o pouso e mirado no jogador, entao o salto seguinte
  // comeca de cima dele. Sem um rumo de recuo aqui o arco sai com comprimento
  // zero. O rumo do corpo e o primeiro recurso; o eixo x e o ultimo, para a
  // funcao nunca devolver um vetor nulo.
  let back = span > 0.5 ? normalized(enemy.x - landX, enemy.y - landY) : { ...enemy.facing };
  if (Math.hypot(back.x, back.y) < 0.001) back = { x: 1, y: 0 };
  // E cada salto da rajada gira: os tres cercam o alvo em vez de repetirem o
  // mesmo ataque de um lado so.
  const done = DEVOURER_LEAPS_PER_CYCLE - state.bossRuntime.leapsLeft;
  const dir = rotated(back, done * DEVOURER_LEAP_TURN);
  const reach = Math.min(
    DEVOURER_LEAP_MAX_RANGE,
    Math.max(DEVOURER_LEAP_MIN_RANGE, span)
  );
  return devourerSurfacingSpot(
    state,
    Math.floor(landX + dir.x * reach),
    Math.floor(landY + dir.y * reach),
    DEVOURER_LAUNCH_SEARCH
  );
};

/**
 * UM TICK DE VOO. Conduzido pela acao, como a investida do Corcel.
 *
 * Sem `moveEntity`: ele esta no AR, e parede nao vale para quem passa por cima
 * dela — pela mesma razao que nao valia para quem passava por baixo. E sem
 * rastro: silica solta e o que o corpo revira ao raspar por baixo do chao, e no
 * arco nao ha chao raspando. O jogador que ve a faixa parar sabe que ele saiu.
 */
const devourerLeapStride = (
  state: SurvivalState,
  enemy: Entity,
  dt: number,
  events: SemanticEvent[],
): void => {
  const toX = state.bossRuntime.leapToX;
  const toY = state.bossRuntime.leapToY;
  const dx = toX - enemy.x;
  const dy = toY - enemy.y;
  const remaining = Math.hypot(dx, dy);
  const step = DEVOURER_LEAP_SPEED * dt;
  if (remaining <= step || remaining <= 0.0001) {
    enemy.x = toX;
    enemy.y = toY;
    devourerLand(state, enemy, events);
    return;
  }
  enemy.x += (dx / remaining) * step;
  enemy.y += (dy / remaining) * step;
  enemy.facing = { x: dx / remaining, y: dy / remaining };
};

/**
 * A QUEDA: a segunda cratera, e o fim do arco.
 *
 * Ela devolve o chefe a janela de dano de sempre — o salto ACRESCENTA tempo
 * exposto, nao substitui o que ja existia. A acao e limpa aqui e nao pelo
 * relogio dela: quem decide que o voo acabou e a CHEGADA, e um arco que
 * terminasse pelo cronometro poderia largar o corpo um passo antes ou depois do
 * ponto que o telegrafo prometeu.
 */
const devourerLand = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  enemy.action = undefined;
  devourerCrater(state, enemy, DEVOURER_ERUPT_DAMAGE, events);
  // A rajada decide o que vem depois da cratera. Ainda ha salto na conta: ele
  // mergulha de novo por pouco tempo e arma o proximo arco. Acabou: ele ENTALA.
  //
  // O decremento acontece aqui, no pouso, e nao na decolagem — um arco que o
  // vidro negou nunca chegou a ser um ataque, e cobrar da conta um salto que
  // nao aconteceu deixaria o jogador ganhar a janela sem ter esquivado nada.
  state.bossRuntime.leapsLeft -= 1;
  if (state.bossRuntime.leapsLeft > 0) {
    enemy.mood = DEVOURER_BURROWED;
    enemy.nextActionAt = state.tick + DEVOURER_HOP_GAP_TICKS;
    return;
  }
  enemy.mood = DEVOURER_STUCK;
  enemy.nextActionAt = state.tick + DEVOURER_STUCK_TICKS;
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: DEVOURER_ERUPT_RADIUS });
};

/**
 * Onde ele consegue sair, a partir do ponto mirado, ou -1.
 *
 * VIDRO recusa: e o unico jeito de o jogador negar espaco a ele. Solido
 * tambem, e por um motivo diferente — sair dentro de uma parede o deixaria
 * emparedado, e chefe preso e chefe morto.
 *
 * A busca e em anel crescente e deterministica: duas maquinas da mesma sala
 * precisam faze-lo emergir na MESMA celula.
 */
const devourerSurfacingSpot = (
  state: SurvivalState,
  cx: number,
  cy: number,
  search = DEVOURER_ERUPT_SEARCH,
): number => {
  const w = state.config.width;
  const h = state.config.height;
  for (let r = 0; r <= search; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        if (state.solid[i] !== SOLID_NONE) continue;
        if (state.surface[i] === SURF_GLASS) continue;
        return i;
      }
    }
  }
  return -1;
};

/**
 * O SUMIDOURO: a cratera que rompe o chao, nas DUAS pontas do arco.
 *
 * Abre o chao em volta (fragil cede, rocha nao — ele rompe por onde o terreno ja
 * era instavel), machuca quem estiver no raio e deixa o solo revirado como
 * silica solta. O estrago dele ALIMENTA o contra-jogo: cada cratera entrega
 * mais areia para o jogador vitrificar, e agora sao duas por ciclo.
 *
 * O `damage` e parametro porque as duas pontas nao valem o mesmo: a queda e
 * mirada em voce, a decolagem acontece longe. Ver DEVOURER_LAUNCH_DAMAGE.
 */
const devourerCrater = (
  state: SurvivalState,
  enemy: Entity,
  damage: number,
  events: SemanticEvent[],
): void => {
  const w = state.config.width;
  const r = Math.ceil(DEVOURER_ERUPT_RADIUS);
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > DEVOURER_ERUPT_RADIUS * DEVOURER_ERUPT_RADIUS) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) {
        // Sumidouro: o que ja era fragil cede. Rocha, minerio e cristal ficam —
        // ele revira o chao instavel, nao demole a galeria (isso e o Diamandis).
        breakSolid(state, x, y, events);
        continue;
      }
      // O vidro NAO volta a ser areia. Quem vitrificou pagou por aquilo, e o
      // chefe passando por cima nao pode desfazer a decisao do jogador — senao
      // o contra-jogo se apaga sozinho a cada emergencia.
      if (state.surface[i] === SURF_NONE || state.surface[i] === SURF_SCORCHED) {
        setSurface(state, i, SURF_SILT, 0);
      }
    }
  }
  for (const player of state.players) {
    if (!player.alive || !state.playerExtras[player.slot ?? 0].joined) continue;
    if (distTo(enemy, player) > DEVOURER_ERUPT_RADIUS) continue;
    damageEntity(state, player, damage, events, {
      kind: 'enemy_contact',
      archetype: 'white_devourer',
      elite: enemy.elite,
    });
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: DEVOURER_ERUPT_RADIUS });
};

/**
 * A DECOLAGEM: primeira cratera, e o comeco do voo.
 *
 * Encadear a acao do arco aqui dentro segue o caminho que o Coveiro ja abriu
 * (`haul` arma o `slam` no proprio release). A acao de salto nao tem ramo de
 * release nenhum: ela existe para POR o corpo no fluxo conduzido pela acao e
 * para dar ao cliente o vao de tempo do voo. Quem termina o arco e a chegada,
 * em `devourerLeapStride`.
 */
const devourerErupt = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  devourerCrater(state, enemy, DEVOURER_LAUNCH_DAMAGE, events);
  const toX = state.bossRuntime.leapToX;
  const toY = state.bossRuntime.leapToY;
  const dx = toX - enemy.x;
  const dy = toY - enemy.y;
  const distance = Math.hypot(dx, dy);
  // O vao da acao arredonda para CIMA, e o `ceil` nao e gosto: o voo anda em
  // passos de `velocidade / TICK_HZ` e o ultimo passo quase nunca fecha a
  // distancia exata. Arredondando para baixo, a acao expirava um tick antes de
  // o corpo chegar — e `advanceAction`, ao limpar a acao, devolve o chefe ao
  // fluxo de IA no meio do arco. Medido: o salto de 10 tiles pedia 23 ticks e
  // recebia 22, e o Devorador ficava parado no ar a 0,1 tile do alvo, para
  // sempre. A acao tem de sobreviver ao voo; quem o encerra e a CHEGADA.
  const flightTicks = Math.max(1, Math.ceil((distance / DEVOURER_LEAP_SPEED) * TICK_HZ));
  enemy.mood = DEVOURER_AIRBORNE;
  const arc = distance > 0.0001 ? { x: dx / distance, y: dy / distance } : { ...enemy.facing };
  startAction(state, enemy, 'leap', arc, flightTicks, 0, events);
};

// ---------------------------------------------------------------------------
// OS CHEFES DE ESTRATO
// ---------------------------------------------------------------------------

/**
 * ARQUICANTOR: o pulso que arma a Catedral inteira.
 *
 * Mesma regra do Ressonante, na escala da nave: cada cristal ao alcance
 * descarrega pelas aberturas coladas nele. A carga sai com origem de inimigo,
 * entao machuca OUTROS inimigos parados no lugar errado tambem — a cadeia e do
 * mundo, nao dele.
 *
 * O contra-jogo mora no que o pulso NAO faz: cristal quebrado antes nao canta.
 * E como a Catedral tambem e a luz e o recurso do setor, esvazia-la e uma
 * decisao com preco, e nao uma otimizacao.
 */
const archcantorPulse = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const w = state.config.width;
  const h = state.config.height;
  const r = ARCHCANTOR_PULSE_RADIUS;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  const charged = new Set<number>();
  let armed = 0;
  for (let dy = -r; dy <= r && armed < ARCHCANTOR_CRYSTAL_BUDGET; dy++) {
    for (let dx = -r; dx <= r && armed < ARCHCANTOR_CRYSTAL_BUDGET; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_CRYSTAL) continue;
      armed++;
      for (const n of [i - 1, i + 1, i - w, i + w]) {
        if (state.solid[n] === SOLID_NONE) charged.add(n);
      }
    }
  }
  if (charged.size > 0) {
    chargeCells(state, [...charged], events, { source: 'enemy', owner: enemy.id });
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: r });
};

/** Ha cristal ao alcance do canto? A rede vazia e o que o desarma. */
const archcantorHasNetwork = (state: SurvivalState, enemy: Entity): boolean => {
  const w = state.config.width;
  const r = ARCHCANTOR_PULSE_RADIUS;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= state.config.height - 1) continue;
      if (state.solid[y * w + x] === SOLID_CRYSTAL) return true;
    }
  }
  return false;
};

/**
 * LEVIATA DO LENCOL: o Devorador do outro elemento.
 *
 * Mesma gramatica — mergulha, preve, emerge — com duas diferencas que sao o
 * encontro: ele so anda e so emerge por superficie CONDUTIVA, e o que o para
 * nao e negar o chao, e eletrificar a agua. O atordoamento sai da regra
 * generica de descarga que ja existe; o preco e o meio ficar mortal para quem
 * o parou.
 */
const leviathanStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  dt: number,
  events: SemanticEvent[],
): void => {
  const w = state.config.width;
  if (enemy.mood === DEVOURER_SURFACED) {
    if (state.tick >= enemy.nextActionAt) {
      enemy.mood = DEVOURER_BURROWED;
      enemy.nextActionAt = state.tick + LEVIATHAN_DIVE_MIN_TICKS;
      return;
    }
    if (!player) return;
    const toward = normalized(player.x - enemy.x, player.y - enemy.y);
    enemy.facing = { ...toward };
    const def = ARCHETYPES.sheet_leviathan;
    if (distTo(enemy, player) < enemy.radius + player.radius + 0.2 && state.tick >= enemy.contactReadyAt) {
      enemy.contactReadyAt = state.tick + def.contactCooldown;
      startAction(state, enemy, 'contact', toward, 6, 4, events, player.id);
      return;
    }
    moveEntity(state, enemy, toward.x * LEVIATHAN_SURFACE_SPEED * dt, toward.y * LEVIATHAN_SURFACE_SPEED * dt);
    return;
  }

  if (!player) return;
  const toward = normalized(player.x - enemy.x, player.y - enemy.y);
  enemy.facing = { ...toward };
  // Submerso ele anda pela LAMINA, e nao pelo chao: passos que continuem em
  // agua. Sem lamina para onde ir ele guarda a margem — que e exatamente a
  // leitura que o jogador precisa ter dele.
  const step = LEVIATHAN_SWIM_SPEED * dt;
  const wet = (mx: number, my: number): boolean => {
    const i = Math.floor(enemy.y + my) * w + Math.floor(enemy.x + mx);
    return i >= 0 && i < state.surface.length && isConductiveSurface(state.surface[i]);
  };
  const sx = toward.x * step;
  const sy = toward.y * step;
  if (wet(sx, sy)) moveEntity(state, enemy, sx, sy);
  else if (wet(sx, 0)) moveEntity(state, enemy, sx, 0);
  else if (wet(0, sy)) moveEntity(state, enemy, 0, sy);

  if (state.tick < enemy.nextActionAt) return;
  const leadX = player.x + player.vx * LEVIATHAN_LEAD_SECONDS;
  const leadY = player.y + player.vy * LEVIATHAN_LEAD_SECONDS;
  const spot = leviathanBreachSpot(state, Math.floor(leadX), Math.floor(leadY));
  if (spot < 0) {
    // Sem agua sob o alvo ele nao tem por onde subir. Nao e um contra-jogo
    // ativo como o vidro do Devorador — e o terreno seco do proprio Aquifero,
    // e saber onde ele NAO alcanca e metade de atravessar o setor.
    enemy.nextActionAt = state.tick + LEVIATHAN_DIVE_MIN_TICKS;
    return;
  }
  enemy.x = (spot % w) + 0.5;
  enemy.y = Math.floor(spot / w) + 0.5;
  startAction(state, enemy, 'erupt', toward, LEVIATHAN_BREACH_WINDUP_TICKS, 6, events, player.id);
};

/** Agua aberta mais proxima do ponto mirado, ou -1. Varredura em anel fixa. */
const leviathanBreachSpot = (state: SurvivalState, cx: number, cy: number): number => {
  const w = state.config.width;
  const h = state.config.height;
  for (let r = 0; r <= LEVIATHAN_BREACH_SEARCH; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        if (state.solid[i] !== SOLID_NONE) continue;
        if (!isConductiveSurface(state.surface[i])) continue;
        return i;
      }
    }
  }
  return -1;
};

/**
 * PULMAO-MATRIZ: o orgao que faz a Fenda respirar.
 *
 * Mesma respiracao do Fole, na escala da camara. Inspirando, LIMPA gas num raio
 * grande — e abre uma janela de rota que nao existia. Expelindo, sopra uma
 * coluna larga na direcao do jogador.
 *
 * A janela de dano e o jogador que abre: gas aceso encostado nele durante a
 * expiracao queima a coluna inteira de volta. Custa transformar parte da arena
 * em fogo, e e por isso que e uma decisao.
 */
const lungMatrixStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  events: SemanticEvent[],
): void => {
  const w = state.config.width;
  const h = state.config.height;
  const phase = Math.floor(state.tick / LUNG_MATRIX_CYCLE_TICKS) % 2;
  enemy.mood = phase === 0 ? LUNG_INHALING : LUNG_EXHALING;

  if (state.tick >= enemy.nextActionAt) {
    enemy.nextActionAt = state.tick + LUNG_MATRIX_BREATH_INTERVAL_TICKS;
    if (enemy.mood === LUNG_INHALING) {
      const r = LUNG_MATRIX_INHALE_RADIUS;
      const cx = Math.floor(enemy.x);
      const cy = Math.floor(enemy.y);
      let taken = 0;
      for (let dy = -r; dy <= r && taken < LUNG_MATRIX_INHALE_PER_BREATH; dy++) {
        for (let dx = -r; dx <= r && taken < LUNG_MATRIX_INHALE_PER_BREATH; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          if (state.surface[i] !== SURF_GAS) continue;
          setSurface(state, i, SURF_NONE, 0);
          taken++;
        }
      }
    } else {
      const dir = player ? normalized(player.x - enemy.x, player.y - enemy.y) : enemy.facing;
      enemy.facing = { ...dir };
      const side = { x: -dir.y, y: dir.x };
      for (let step = 1; step <= LUNG_MATRIX_EXHALE_LENGTH; step++) {
        let blocked = false;
        for (let lane = -LUNG_MATRIX_EXHALE_WIDTH; lane <= LUNG_MATRIX_EXHALE_WIDTH; lane++) {
          const x = Math.floor(enemy.x + dir.x * step + side.x * lane);
          const y = Math.floor(enemy.y + dir.y * step + side.y * lane);
          if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
          const i = y * w + x;
          if (state.solid[i] !== SOLID_NONE) {
            if (lane === 0) blocked = true;
            continue;
          }
          if (state.surface[i] === SURF_NONE) setSurface(state, i, SURF_GAS, GAS_LIFE_TICKS);
        }
        if (blocked) break;
      }
      // E o RETORNO: fogo encostado nele enquanto expele sobe pela coluna. O
      // jogador acende a nuvem, e a nuvem e continua ate a boca do pulmao.
      if (state.tick >= enemy.rangedReadyAt && lungMatrixBurning(state, enemy)) {
        enemy.rangedReadyAt = state.tick + LUNG_MATRIX_BREATH_INTERVAL_TICKS * 3;
        damageEntity(state, enemy, LUNG_MATRIX_BURN_DAMAGE, events, {
          kind: 'explosion',
          source: 'player',
        });
        markDiscovery(state.stats, DISCOVERY_LUNG_IGNITED);
        events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: 2 });
      }
    }
  }
  if (player) enemy.facing = normalized(player.x - enemy.x, player.y - enemy.y);
};

/** Ha fogo colado na boca do pulmao? (as quatro arestas, como a propagacao) */
const lungMatrixBurning = (state: SurvivalState, enemy: Entity): boolean => {
  const w = state.config.width;
  const i = cellUnder(state, enemy);
  for (const n of [i, i - 1, i + 1, i - w, i + w]) {
    if (n < 0 || n >= state.surface.length) continue;
    if (state.surface[n] === SURF_FIRE) return true;
  }
  return false;
};

/**
 * CORACAO DA FORNALHA: a sala inteira e o chefe.
 *
 * Alterna superaquecimento (blindado; setores da arena acendem em sequencia) e
 * resfriamento (aberto). O jogador nao escolhe quando bater — escolhe onde
 * estar quando puder.
 *
 * O SETOR que acende gira com o relogio, e nao por sorteio: a sequencia e
 * aprendivel, e aprender a sequencia e a diferenca entre atravessar a sala e
 * ser pego por ela.
 */
const furnaceHeartStep = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const phase = Math.floor(state.tick / FURNACE_HEART_CYCLE_TICKS) % 2;
  enemy.mood = phase === 0 ? FURNACE_OVERHEATING : FURNACE_COOLING;
  if (enemy.mood !== FURNACE_OVERHEATING) return;
  if (state.tick < enemy.nextActionAt) return;
  enemy.nextActionAt = state.tick + FURNACE_HEART_WAVE_INTERVAL_TICKS;

  const w = state.config.width;
  const r = FURNACE_HEART_WAVE_RADIUS;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  // O setor gira uma fracao de volta por onda. Deterministico e legivel: o
  // jogador ve para onde a chama esta indo e anda contra ela.
  const heading = (state.tick / FURNACE_HEART_WAVE_INTERVAL_TICKS) * 0.7;
  const dirX = Math.cos(heading);
  const dirY = Math.sin(heading);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r || d2 < 4) continue;
      const len = Math.sqrt(d2);
      if ((dx / len) * dirX + (dy / len) * dirY < Math.cos(FURNACE_HEART_WAVE_ARC)) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) continue;
      // `igniteCell` primeiro: cada materia tem a propria resposta ao calor, e
      // o Coracao nao e a excecao que atropela a tabela. So chao sem resposta
      // recebe brasa direto.
      if (!igniteCell(state, i, events) && state.surface[i] === SURF_NONE) {
        setSurface(state, i, SURF_EMBER, 240);
      }
    }
  }
  events.push({ t: 'beam_line', x: enemy.x, y: enemy.y, dx: dirX, dy: dirY, length: r, powered: true });
};

/**
 * RAINHA DA GEADA: a couraça dela e o estrato.
 *
 * Enquanto houver gelo em volta, o dano quase nao entra; derreter o lago a
 * expoe. E a agua que sobra e condutiva — quem a revela transforma o chao em
 * algo que a descarga atravessa nos dois sentidos.
 *
 * O congelamento refaz o lago (e devolve a couraça), e os Espectros saem do
 * GELO em volta, e nao dela: sao extensoes do estrato, nao filhotes.
 */
const frostQueenIceAround = (state: SurvivalState, enemy: Entity): number => {
  const w = state.config.width;
  const r = FROST_QUEEN_ICE_RADIUS;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  let ice = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
      if (state.surface[y * w + x] === SURF_ICE) ice++;
    }
  }
  return ice;
};

const frostQueenFreeze = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const w = state.config.width;
  const r = FROST_QUEEN_FREEZE_RADIUS;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) continue;
      // Congela agua e chao nu; NAO apaga fogo vivo. Apagar o incendio que o
      // jogador acendeu desfaria a acao dele — a mesma regra da Supernova.
      const surf = state.surface[i];
      if (surf === SURF_FIRE) continue;
      if (surf === SURF_NONE || isConductiveSurface(surf)) setSurface(state, i, SURF_ICE, 0);
    }
  }
  // Os Espectros saem do gelo, em volta dela.
  for (let k = 0; k < FROST_QUEEN_WRAITHS; k++) {
    const angle = (k / FROST_QUEEN_WRAITHS) * Math.PI * 2;
    const wx = Math.floor(enemy.x + Math.cos(angle) * 3);
    const wy = Math.floor(enemy.y + Math.sin(angle) * 3);
    if (wx < 1 || wy < 1 || wx >= w - 1 || wy >= state.config.height - 1) continue;
    if (state.solid[wy * w + wx] !== SOLID_NONE) continue;
    if (state.enemies.length >= MAX_ENEMIES) break;
    const wraith = spawnEnemy(state, 'frost_wraith', wx, wy, false);
    // Extensoes, e nao uma matilha: nascem parciais e caem depressa.
    wraith.maxHp = Math.max(1, Math.floor(wraith.maxHp * FROST_QUEEN_WRAITH_HP_FRACTION));
    wraith.hp = wraith.maxHp;
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: r });
};

/**
 * MAGNETARCA: a polaridade decide o que e perigoso.
 *
 * ATRAINDO, ele te puxa e a proximidade cobra. REPELINDO, ele te empurra e a
 * distancia cobra. Nao ha posicao segura permanente — ha uma FAIXA, e ela troca
 * de lado a cada ciclo.
 *
 * O deslocamento e por PASSOS pequenos com colisao, como o eletroima do
 * Coveiro: a quina no caminho continua sendo o contra-jogo geometrico do campo,
 * e o jogador nao integra velocidade, entao impulso aqui seria apagado no mesmo
 * tick.
 */
const magnetarchStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  events: SemanticEvent[],
): void => {
  const phase = Math.floor(state.tick / MAGNETARCH_CYCLE_TICKS) % 2;
  enemy.mood = phase === 0 ? MAGNET_ATTRACT : MAGNET_REPEL;
  if (!player) return;
  const dist = distTo(enemy, player);
  enemy.facing = normalized(player.x - enemy.x, player.y - enemy.y);
  if (dist > MAGNETARCH_FIELD_RANGE) return;

  const pull = enemy.mood === MAGNET_ATTRACT ? 1 : -1;
  const dir = normalized((enemy.x - player.x) * pull, (enemy.y - player.y) * pull);
  moveEntity(state, player, dir.x * MAGNETARCH_PULL_STEP, dir.y * MAGNETARCH_PULL_STEP);

  if (state.tick < enemy.rangedReadyAt) return;
  enemy.rangedReadyAt = state.tick + MAGNETARCH_FIELD_TICK_INTERVAL;
  if (enemy.mood === MAGNET_ATTRACT && dist < MAGNETARCH_CRUSH_RANGE) {
    damageEntity(state, player, MAGNETARCH_CRUSH_DAMAGE, events, {
      kind: 'enemy_contact',
      archetype: 'magnetarch',
      elite: enemy.elite,
    });
    events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: MAGNETARCH_CRUSH_RANGE });
  } else if (enemy.mood === MAGNET_REPEL && dist > MAGNETARCH_TETHER_RANGE) {
    damageEntity(state, player, MAGNETARCH_TETHER_DAMAGE, events, {
      kind: 'enemy_contact',
      archetype: 'magnetarch',
      elite: enemy.elite,
    });
    events.push({ t: 'pulse', x: player.x, y: player.y, radius: 1.4 });
  } else {
    // Dentro do campo e fora das duas bordas: o jogador ACHOU a faixa. E a
    // unica das seis Descobertas que marca uma ausencia de dano — porque aqui
    // o entendimento e exatamente nao ter sido cobrado.
    markDiscovery(state.stats, DISCOVERY_MAGNET_BANDED);
  }
};

/**
 * A EMERGENCIA do Leviata: ele rompe a lamina sob o alvo.
 *
 * Nao abre sumidouro como o Devorador — nao ha o que desabar debaixo de agua.
 * O que ele faz e DESLOCAR: o golpe espalha a lamina para os lados, e a poca
 * cresce. Cada emergencia deixa o Aquifero um pouco mais condutivo, o que
 * torna eletrifica-lo mais tentador e mais perigoso ao mesmo tempo.
 */
const leviathanBreach = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const w = state.config.width;
  const r = Math.ceil(LEVIATHAN_BREACH_RADIUS);
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > LEVIATHAN_BREACH_RADIUS * LEVIATHAN_BREACH_RADIUS) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) continue;
      // Agua deslocada cobre chao nu e cinza; nao apaga fogo do jogador nem
      // desfaz gelo — as duas coisas sao decisoes de alguem.
      if (state.surface[i] === SURF_NONE || state.surface[i] === SURF_SCORCHED) {
        setSurface(state, i, SURF_WATER, 0);
      }
    }
  }
  for (const player of state.players) {
    if (!player.alive || !state.playerExtras[player.slot ?? 0].joined) continue;
    if (distTo(enemy, player) > LEVIATHAN_BREACH_RADIUS) continue;
    damageEntity(state, player, LEVIATHAN_BREACH_DAMAGE, events, {
      kind: 'enemy_contact',
      archetype: 'sheet_leviathan',
      elite: enemy.elite,
    });
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: LEVIATHAN_BREACH_RADIUS });
  enemy.mood = DEVOURER_SURFACED;
  enemy.nextActionAt = state.tick + LEVIATHAN_SURFACE_TICKS;
};

/** O chefe ainda tem esta arma? (o modulo dela nao foi arrancado) */
const hasModule = (state: SurvivalState, module: number): boolean =>
  (state.bossRuntime.modulesLost & (1 << module)) === 0;

/**
 * Solta os modulos conforme a vida cai. Ordem fixa, do maior alcance para o
 * menor: e ensinavel, e faz o cerco em volta do chefe ir FECHANDO.
 *
 * Soltar nao tira a arma — o modulo continua pendurado e funcionando. O que
 * muda e que agora um Coveiro consegue engatar o eletroima nele.
 */
const diamandisShedModules = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const fraction = enemy.hp / enemy.maxHp;
  for (let m = 0; m < DIAMANDIS_MODULE_COUNT; m++) {
    const bit = 1 << m;
    if ((state.bossRuntime.modulesExposed & bit) !== 0) continue;
    if (fraction > DIAMANDIS_MODULE_EXPOSE_AT[m]) continue;
    state.bossRuntime.modulesExposed |= bit;
    events.push({ t: 'boss_module', x: enemy.x, y: enemy.y, module: m, state: 'exposed' });
  }
};

/**
 * O modulo solto que um Coveiro ainda pode arrancar, ou -1.
 *
 * "Ainda pode" exclui os ja arrancados E os que outro Coveiro ja engatou: sem
 * a segunda checagem, os tres Coveiros de uma galeria ferrifera convergiam
 * todos para a mesma peca e dois deles ficavam parados em cima do chefe sem
 * nada para fazer. A varredura e por indice crescente, deterministica.
 */
const claimableModule = (state: SurvivalState, undertaker: Entity): number => {
  for (let m = 0; m < DIAMANDIS_MODULE_COUNT; m++) {
    const bit = 1 << m;
    if ((state.bossRuntime.modulesExposed & bit) === 0) continue;
    if ((state.bossRuntime.modulesLost & bit) !== 0) continue;
    const claimed = state.enemies.some(
      (e) => e.alive && e.archetype === 'undertaker' && e !== undertaker && e.mood === m + 1,
    );
    if (!claimed) return m;
  }
  return -1;
};

/**
 * O PASSO DO COVEIRO SUCATEIRO: ele larga o jogador e vai buscar a peca.
 *
 * Devolve `true` quando assumiu o tick — o Coveiro so volta a caçar gente
 * quando nao ha nada solto para recolher. Isso e caracterizacao, e nao um
 * favor ao jogador: ele foi construido para recolher automatos abatidos, e
 * entre um Prospector de pe e uma carcaça de escavadeira ele escolhe a
 * carcaça. Toda vez.
 *
 * `mood` guarda o modulo reivindicado (m + 1, para 0 continuar significando
 * "nenhum"), e `contactReadyAt` guarda se ele ja esta CARREGANDO. Nenhum campo
 * novo na entidade: os dois viajam no snapshot e entram no resync, e um chefe
 * opcional nao justifica engordar todo inimigo do jogo.
 */
const undertakerSalvageStep = (
  state: SurvivalState,
  enemy: Entity,
  dt: number,
  events: SemanticEvent[],
): boolean => {
  const carrying = (enemy.mood ?? 0) > 0 && (state.bossRuntime.modulesLost & (1 << (enemy.mood! - 1))) !== 0;
  const w = state.config.width;
  const h = state.config.height;

  if (carrying) {
    // CARREGANDO: ele vai para a borda mais proxima e sai do mapa com a peca.
    // O caminho e reto de proposito — ele nao esta fugindo do jogador, esta
    // cumprindo uma rota de entrega, e a linha reta e o que torna o intercepto
    // possivel: da para ver para onde ele vai e cortar caminho.
    const toLeft = enemy.x;
    const toRight = w - enemy.x;
    const toTop = enemy.y;
    const toBottom = h - enemy.y;
    const best = Math.min(toLeft, toRight, toTop, toBottom);
    const dir =
      best === toLeft ? { x: -1, y: 0 }
      : best === toRight ? { x: 1, y: 0 }
      : best === toTop ? { x: 0, y: -1 }
      : { x: 0, y: 1 };
    enemy.facing = { ...dir };
    const speed = ARCHETYPES.undertaker.speed * surfaceSpeedMul(state, enemy);
    const moved = moveEntity(state, enemy, dir.x * speed * dt, dir.y * speed * dt);
    // Ele ABRE caminho ate a borda, e isso nao e um detalhe de conveniencia:
    // um carregador que trava na primeira rocha nunca chega a lugar nenhum, e
    // a escolha inteira desmonta — "deixar trabalhar" viraria "espere, ele vai
    // ficar preso e voce mata depois". Com a saida possivel, o preco de deixar
    // a peca sair e real, e o intercepto vira decisao de rota.
    //
    // Em linha reta, e nao contornando: e o que torna o corte de caminho
    // legivel. Da para ver para onde ele vai.
    if (moved.blockCell) {
      const { x: bx, y: by } = moved.blockCell;
      const opened = breakSolid(state, bx, by, events) || ripSolid(state, bx, by, events);
      if (!opened) {
        // MINERIO e cristal ele nao come — sao recurso do jogador, e vale aqui
        // a mesma regra da broca. Contorna deslizando pelo eixo
        // perpendicular, sempre para o mesmo lado primeiro (deterministico).
        //
        // Sem este desvio a rota morria contra o primeiro veio: medido na
        // seed 404, o carregador parava em x=74 de um mapa de 96 e ficava ali
        // pelo resto da run. "Deixar trabalhar" virava "espere, ele empaca" —
        // e a escolha inteira desmontava, porque o preco de nao interceptar
        // nunca chegava a ser cobrado.
        const perp = { x: -dir.y, y: dir.x };
        const slid = moveEntity(state, enemy, perp.x * speed * dt, perp.y * speed * dt);
        if (slid.blockedX || slid.blockedY) {
          moveEntity(state, enemy, -perp.x * speed * dt, -perp.y * speed * dt);
        }
      }
    }
    // FORA DE ALCANCE: a borda do mapa, ou longe o bastante da carcaça para a
    // peca ter saido da luta. Ver UNDERTAKER_SALVAGE_ESCAPE_DIST.
    const carcass = state.enemies.find((e) => e.archetype === 'diamandis');
    const farFromFight =
      carcass !== undefined && distTo(enemy, carcass) > UNDERTAKER_SALVAGE_ESCAPE_DIST;
    if (farFromFight || enemy.x < 2 || enemy.y < 2 || enemy.x > w - 2 || enemy.y > h - 2) {
      // Saiu do mapa. A peca foi junto, e com ela a recompensa dela.
      events.push({
        t: 'boss_module',
        x: enemy.x,
        y: enemy.y,
        module: enemy.mood! - 1,
        state: 'lost',
      });
      enemy.alive = false;
      // NAO passa por `damageEntity`: ninguem o abateu, ele foi embora. Contar
      // isto como abate creditaria ao jogador um kill que ele nao fez — e, pior,
      // o registro do bestiario diria que ele resolveu um problema que na
      // verdade escapou.
    }
    return true;
  }

  const boss = state.enemies.find((e) => e.alive && e.archetype === 'diamandis');
  if (!boss) {
    enemy.mood = 0;
    return false;
  }
  const claimed = (enemy.mood ?? 0) > 0 ? enemy.mood! - 1 : claimableModule(state, enemy);
  if (claimed < 0) {
    enemy.mood = 0;
    return false;
  }
  if (distTo(enemy, boss) > UNDERTAKER_SALVAGE_RANGE) {
    enemy.mood = 0;
    return false;
  }
  enemy.mood = claimed + 1;

  const toward = normalized(boss.x - enemy.x, boss.y - enemy.y);
  enemy.facing = { ...toward };
  if (distTo(enemy, boss) <= UNDERTAKER_SALVAGE_REACH) {
    if (state.tick >= enemy.rangedReadyAt) {
      enemy.rangedReadyAt = state.tick + UNDERTAKER_SALVAGE_WINDUP_TICKS + 20;
      startAction(state, enemy, 'haul', toward, UNDERTAKER_SALVAGE_WINDUP_TICKS, 6, events, boss.id);
    }
    return true;
  }
  const speed = ARCHETYPES.undertaker.speed * surfaceSpeedMul(state, enemy);
  moveEntity(state, enemy, toward.x * speed * dt, toward.y * speed * dt);
  return true;
};

/**
 * O COLAPSO DO REATOR, uma vez, abaixo de metade da vida.
 *
 * Brasa em volta dele — a fissura que ja existe no jogo, com a regra que ja
 * existe: nao machuca por pisar, SEGURA o calor da arma. A luta continua
 * sendo sobre posicao, e o mapa e que fica caro.
 */
const diamandisReactorCollapse = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const w = state.config.width;
  const r = DIAMANDIS_REACTOR_EMBER_RADIUS;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy;
      // ANEL, e nao disco: o centro fica pisavel para a luta nao virar "fique
      // longe e espere". O reator vaza para os lados, e o jogador ainda pode
      // escolher entrar.
      if (d2 > r * r || d2 < (r - 2) * (r - 2)) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE || state.surface[i] !== SURF_NONE) continue;
      setSurface(state, i, SURF_EMBER, DIAMANDIS_REACTOR_EMBER_TICKS);
    }
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: r });
};

/**
 * Gasta a velocidade SOLTA de um inimigo — perambular, impulso de investida,
 * empurrao — e a amortece um pouco.
 *
 * Existe como funcao propria porque tem DOIS chamadores que nao se parecem: o
 * fluxo normal de IA e a janela de recuperacao de uma acao autoritativa. O
 * impulso da investida do guardian nasce no `release` e antes ficava preso ali,
 * porque `advanceAction` devolve `true` ate `endsAt` e o `continue` pulava o
 * unico lugar que consumia `vx/vy`. O telegrafo terminava com o bicho parado e a
 * investida so saia oito ticks depois — o jogador lia o aviso e era acertado
 * pelo golpe que ja tinha esquivado.
 *
 * `updateFacing` e false quando quem chama tem um rumo melhor que a velocidade:
 * durante uma acao o rumo esta congelado no telegrafo de proposito, e o cavalo em
 * perseguicao acumula a curva dele por angulo.
 */
const driftByVelocity = (
  state: SurvivalState,
  enemy: Entity,
  dt: number,
  events: SemanticEvent[],
  updateFacing: boolean,
): void => {
  if (Math.hypot(enemy.vx, enemy.vy) <= 0.05) return;
  // Movimento por VELOCIDADE tambem tem de atualizar o rumo.
  //
  // So o movimento por `dirX/dirY` atualizava, entao um inimigo perambulando
  // andava para um lado com o sprite virado para outro. O cliente compensava
  // isso adivinhando o rumo pelo deslocamento OBSERVADO — e a adivinhacao
  // quebra exatamente quando a colisao zera um dos eixos, porque ai o
  // deslocamento aponta para um quadrante que a criatura nunca escolheu.
  // Com o rumo correto na simulacao, o cliente nao precisa adivinhar.
  if (updateFacing) enemy.facing = normalized(enemy.vx, enemy.vy);
  const moved = moveEntity(state, enemy, enemy.vx * dt, enemy.vy * dt);
  if (moved.blockCell && crushesWalls(enemy)) {
    breakSolid(state, moved.blockCell.x, moved.blockCell.y, events);
  }
  const decay = enemy.archetype === 'guardian' ? 0.92 : 0.82;
  enemy.vx *= decay;
  enemy.vy *= decay;
};

export const updateEnemies = (state: SurvivalState, events: SemanticEvent[]): void => {
  const dt = 1 / TICK_HZ;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    // A cura do bispo roda ANTES do portao de acao, e nao dentro do ramo de IA.
    // Ela e uma propriedade do chao, nao uma decisao dele: suspende-la durante
    // cada golpe ou cada atordoamento ensinaria ao jogador uma janela que nao
    // existe — "acertei na hora certa" em vez de "ele estava no lugar errado".
    const onFungus = enemy.archetype === 'bishop' && bishopRegen(state, enemy, events);
    if (advanceAction(state, enemy, events)) {
      if (!enemy.alive) continue;
      // Cavalo e Diamandis sao conduzidos passo a passo (a recuperacao E a
      // acao); todo o resto gasta aqui o impulso que o `release` deixou — ver
      // `driftByVelocity`.
      if (enemy.archetype === 'fungal_horse') horseChargeStride(state, enemy, events);
      else if (enemy.archetype === 'diamandis') diamandisDrillStride(state, enemy, events);
      // O ARCO do Devorador entra aqui pela mesma razao dos dois acima: durante
      // o voo a ACAO conduz o corpo. Gated no humor porque a outra acao dele —
      // o telegrafo da decolagem — e justamente o momento em que ele NAO se
      // mexe, e um passo de voo ali o arrastaria durante o proprio aviso.
      else if (enemy.archetype === 'white_devourer' && enemy.mood === DEVOURER_AIRBORNE) {
        devourerLeapStride(state, enemy, dt, events);
      } else driftByVelocity(state, enemy, dt, events, false);
      // A varredura do feixe roda DURANTE o telegrafo: e ela que promete a
      // linha, e o cliente redesenha a cada emissao porque o chefe continua
      // girando devagar enquanto mede.
      if (
        enemy.archetype === 'diamandis' &&
        enemy.action?.kind === 'beam' &&
        enemy.action.phase === 'windup' &&
        state.tick % 4 === 0
      ) {
        fireProspectingBeam(state, enemy, enemy.action.direction, false, events);
      }
      continue;
    }
    if (enemy.stunnedUntil > state.tick) continue;

    const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
    const player = nearestTarget(state, enemy.x, enemy.y);
    const dist = player ? distTo(enemy, player) : Infinity;

    // O MINER e o unico inimigo que decide o que fazer com voce a partir do que
    // VOCE trouxe, e nao da distancia. Sai do fluxo comum inteiro: passivo, ele
    // simplesmente nao participa da simulacao de combate.
    if (enemy.archetype === 'miner') {
      settleMinerMood(state, enemy, events);
      if (enemy.mood === MINER_MOOD_PASSIVE || !player) continue;

      if (enemy.mood === MINER_MOOD_FLEEING) {
        // Larga a carga e recua pelos tuneis, na velocidade do jogador:
        // perseguir custa tempo de verdade, que e o preco do minerio que ele
        // estava levando para uma grade que nao existe mais.
        const away = normalized(enemy.x - player.x, enemy.y - player.y);
        enemy.facing = { ...away };
        const fled = moveEntity(
          state,
          enemy,
          away.x * MINER_FLEE_SPEED * dt * surfaceSpeedMul(state, enemy),
          away.y * MINER_FLEE_SPEED * dt * surfaceSpeedMul(state, enemy)
        );
        // Encurralado, ele desliza pela parede em vez de travar de frente para
        // ela. Um NPC preso num canto vibrando le como bug, e nao como medo.
        if (fled.blockedX || fled.blockedY) {
          moveEntity(
            state,
            enemy,
            (fled.blockedX ? -away.y : 0) * MINER_FLEE_SPEED * dt,
            (fled.blockedY ? -away.x : 0) * MINER_FLEE_SPEED * dt
          );
        }
        continue;
      }

      // Enfurecido: vem para cima e golpeia em area. Sem ataque a distancia e
      // sem quebrar parede — ele e um humano com uma picareta, nao um chefe.
      const toward = normalized(player.x - enemy.x, player.y - enemy.y);
      enemy.facing = { ...toward };
      if (dist < MINER_CLEAVE_RADIUS && state.tick >= enemy.contactReadyAt) {
        enemy.contactReadyAt = state.tick + MINER_CLEAVE_COOLDOWN_TICKS;
        startAction(state, enemy, 'slam', toward, MINER_CLEAVE_WINDUP_TICKS, 8, events, player.id);
        continue;
      }
      moveEntity(
        state,
        enemy,
        toward.x * MINER_RAGE_SPEED * dt * surfaceSpeedMul(state, enemy),
        toward.y * MINER_RAGE_SPEED * dt * surfaceSpeedMul(state, enemy)
      );
      continue;
    }
    // COVEIRO SUCATEIRO: se ha peca solta para recolher, e isso que ele faz.
    // Roda antes do fluxo comum porque ele LARGA o jogador para trabalhar —
    // ver `undertakerSalvageStep`.
    if (enemy.archetype === 'undertaker' && undertakerSalvageStep(state, enemy, dt, events)) {
      continue;
    }

    // Espreitadores e Fole tem fluxo proprio, como o Miner: o comportamento
    // deles nao e "perseguir e bater", e o fluxo comum so os deformaria.
    if (enemy.archetype === 'mud_lamprey' || enemy.archetype === 'frost_wraith') {
      lurkerStep(state, enemy, player, dist, dt, events);
      continue;
    }
    if (enemy.archetype === 'bellows') {
      bellowsStep(state, enemy, player, dist, dt, events);
      continue;
    }
    if (enemy.archetype === 'white_devourer') {
      devourerStep(state, enemy, player, dt, events);
      continue;
    }
    // Os chefes de estrato: cada um opera a alavanca do proprio bioma, e
    // nenhum deles e "perseguir e bater" — mesmo motivo do Miner e do Fole.
    if (enemy.archetype === 'sheet_leviathan') {
      leviathanStep(state, enemy, player, dt, events);
      continue;
    }
    if (enemy.archetype === 'lung_matrix') {
      lungMatrixStep(state, enemy, player, events);
      continue;
    }
    if (enemy.archetype === 'furnace_heart') {
      furnaceHeartStep(state, enemy, events);
      continue;
    }
    if (enemy.archetype === 'magnetarch') {
      magnetarchStep(state, enemy, player, events);
      continue;
    }
    // O Escoriaceo usa o fluxo comum; so a postura termica e propria.
    if (enemy.archetype === 'scoriac') settleScoriacHeat(state, enemy);

    // Chefe de camara ACORDADO nunca perde o alvo. Ele e o clima da sala, nao
    // um bicho que patrulha: sair do raio dele nao pode ser uma forma de
    // vencer. Vale para o Guardiao e para o Diamandis — os dois guardam o
    // Nucleo, e os dois tem golpes de alcance MAIOR que o proprio aggro, o que
    // sem isto os deixava mirando de um raio em que nunca decidem nada.
    const bossHunting = guardsTheCore(enemy) && state.bossRuntime.awake;
    const aggro =
      player !== null &&
      (bossHunting ||
        dist <= def.aggroRange + (enemy.elite ? 3 : 0) ||
        state.tick < enemy.alertedUntil);

    if (guardsTheCore(enemy) && !state.bossRuntime.awake) {
      // O alerta TAMBEM acorda. Sem isto, `aggro` ficava verdadeiro por dano mas
      // o portao logo abaixo devolvia `continue`: o chefe levava tiro de 8 tiles
      // sem se mexer, cada tiro renovando um alerta que nao servia para nada.
      // Era exatamente a morte sem retaliacao que o aggro por dano existe para
      // impedir, preservada no unico inimigo em que ela mais doi.
      // O gatilho "o Nucleo saiu do pedestal" SAIU daqui, e a razao e que ele
      // deixou de poder acontecer: desde que o pedestal passou a comecar selado
      // pelo proprio chefe, ninguem toca no Nucleo com o dono de pe. Manter a
      // condicao seria documentacao de uma ordem de eventos impossivel.
      if (dist < 7 || state.tick < enemy.alertedUntil) {
        state.bossRuntime.awake = true;
        events.push({ t: 'boss_awake' });
      } else continue;
    }

    let dirX = 0;
    let dirY = 0;
    const speed =
      def.speed *
      (enemy.elite ? 1.12 : 1) *
      surfaceSpeedMul(state, enemy) *
      (enemy.archetype === 'scoriac' && enemy.mood === SCORIAC_HOT ? SCORIAC_HOT_SPEED_SCALE : 1);

    if (aggro && player) {
      const toward = normalized(player.x - enemy.x, player.y - enemy.y);
      dirX = toward.x;
      dirY = toward.y;
      if (enemy.archetype === 'guardian') {
        const steer = guardianSteering(state, enemy, player.x, player.y, events);
        dirX = steer.x;
        dirY = steer.y;
      }

      // O TELL do bispo.
      //
      // Ferido, ele abandona a perseguicao e corre para o tapete de fungo mais
      // proximo — e la se cura mais rapido do que o tiro base tira. O contra-jogo
      // nao esta escrito em lugar nenhum: esta no fato de o proprio chefe apontar
      // para o que o mantem vivo toda vez que ele se machuca. Queimar a arena e a
      // conclusao que o jogador tira sozinho depois de ve-lo fugir duas vezes.
      const retreating =
        enemy.archetype === 'bishop' &&
        !onFungus &&
        enemy.hp < enemy.maxHp * BISHOP_RETREAT_HP_FRACTION;
      if (enemy.archetype === 'bishop' && !retreating) {
        // Fora de retirada (inteiro, ou ja de pe no tapete) a janela de busca
        // desarma. `rangedReadyAt` e o unico relogio ocioso do bispo desde que
        // ele deixou o cuspe generico — aqui ele guarda o "prazo para pisar em
        // fungo", no mesmo espirito do "quente ate" do Escoriaceo.
        enemy.rangedReadyAt = 0;
      }
      if (retreating) {
        // A regra antiga era "so ha Supernova se NENHUM fungo aparecer na
        // varredura de 14 tiles" — e uma unica celula detectavel atras de uma
        // parede bloqueava o ataque para sempre: ele recuava eternamente para
        // um tapete que nunca ia alcancar. A janela mede a coisa certa: ele
        // CONSEGUIU pisar em fungo? `onFungus` desarma (o ramo acima); o prazo
        // vencido dispara, com refugio a vista ou nao.
        if (enemy.rangedReadyAt === 0) {
          enemy.rangedReadyAt = state.tick + BISHOP_NOVA_SEEK_TICKS;
        }
        const refuge = nearestFungal(state, enemy);
        if (
          (refuge === null || state.tick >= enemy.rangedReadyAt) &&
          state.tick >= enemy.nextActionAt
        ) {
          // Perdeu o chao — sem refugio nenhum, ou com a janela vencida sem
          // ter pisado em fungo. A Supernova replanta o tapete NO RELEASE:
          // o jogador vive a sequencia como causa e efeito (queimei, ele
          // fugiu, nao chegou, plantou).
          enemy.nextActionAt = state.tick + BISHOP_NOVA_COOLDOWN_TICKS;
          enemy.rangedReadyAt = 0;
          startAction(state, enemy, 'pulse', toward, BISHOP_NOVA_WINDUP_TICKS, 10, events, player.id);
          continue;
        }
        if (refuge) {
          const flee = normalized(refuge.x + 0.5 - enemy.x, refuge.y + 0.5 - enemy.y);
          dirX = flee.x;
          dirY = flee.y;
        }
      }

      // A Supernova tambem e a resposta do Bispo a distancia EM LUTA NORMAL —
      // ele nao cospe gosma; um chefe do chao responde com o chao. Jogador
      // dentro do raio e recarga pronta: o telegrafo radial de 1,5 s sobe, e
      // sair do disco e a resposta. Nao dispara em retirada: uma acao no meio
      // da fuga apagaria o tell (ele pareceria manobrar, nao correr para um
      // lugar especifico).
      if (
        enemy.archetype === 'bishop' &&
        !retreating &&
        state.tick >= enemy.nextActionAt &&
        dist <= BISHOP_NOVA_RADIUS
      ) {
        enemy.nextActionAt = state.tick + BISHOP_NOVA_COOLDOWN_TICKS;
        startAction(state, enemy, 'pulse', toward, BISHOP_NOVA_WINDUP_TICKS, 10, events, player.id);
        continue;
      }

      // A investida exige LINHA DE VISAO na hora de comecar.
      //
      // A direcao congela no windup e nao se corrige mais — e o que torna o
      // telegrafo de 1,3 s uma informacao util em vez de um aviso de algo
      // inevitavel. Sem a checagem, o cavalo dispararia contra uma parede que
      // esta entre os dois e a acao inteira viraria ruido.
      if (
        enemy.archetype === 'fungal_horse' &&
        state.tick >= enemy.rangedReadyAt &&
        dist >= HORSE_CHARGE_MIN_RANGE &&
        dist <= HORSE_CHARGE_MAX_RANGE &&
        hasLineOfSight(state, enemy.x, enemy.y, player.x, player.y)
      ) {
        enemy.rangedReadyAt = state.tick + HORSE_CHARGE_COOLDOWN_TICKS;
        startAction(state, enemy, 'charge', toward, HORSE_CHARGE_WINDUP_TICKS, HORSE_CHARGE_TICKS, events, player.id);
        continue;
      }

      // Os dois bombardeiros compartilham o gatilho: a silhueta e a leitura
      // sao as mesmas de proposito, e so a materia que sobra difere.
      if ((enemy.archetype === 'bomber' || enemy.archetype === 'sulfur_bomber') && dist < 2.05) {
        startAction(state, enemy, 'detonate', toward, 12, 4, events, player.id);
        continue;
      }

      // COVEIRO: o eletroima. Carrega longo, e no release ARRASTA o alvo.
      //
      // A faixa tem minimo e maximo: colado ele nao puxa (nao ha para onde
      // trazer — prensa direto pelo contato comum), e longe demais o campo
      // nao alcanca. Exige LINHA DE VISAO na hora de comecar, pela mesma
      // razao da investida do Cavalo: um puxao que atravessa parede seria
      // dano sem contra-jogo, e a quina no caminho E o contra-jogo.
      if (
        enemy.archetype === 'undertaker' &&
        state.tick >= enemy.rangedReadyAt &&
        dist >= UNDERTAKER_PULL_MIN_RANGE &&
        dist <= UNDERTAKER_PULL_RANGE &&
        hasLineOfSight(state, enemy.x, enemy.y, player.x, player.y)
      ) {
        enemy.rangedReadyAt = state.tick + UNDERTAKER_PULL_COOLDOWN_TICKS;
        startAction(state, enemy, 'haul', toward, UNDERTAKER_PULL_WINDUP_TICKS, 6, events, player.id);
        continue;
      }

      // Ressonante: com o jogador no alcance da vibracao e cristal por perto,
      // ele arma a sala. Sem cristal em volta ele e so um corpo lento — a sala
      // esvaziada E o contra-jogo, entao a checagem tem de ser real.
      if (
        enemy.archetype === 'resonant' &&
        state.tick >= enemy.rangedReadyAt &&
        dist <= RESONANT_PULSE_RADIUS + 1.5 &&
        hasCrystalNear(state, enemy)
      ) {
        enemy.rangedReadyAt = state.tick + RESONANT_COOLDOWN_TICKS;
        startAction(state, enemy, 'pulse', toward, RESONANT_WINDUP_TICKS, 8, events, player.id);
        continue;
      }

      // DIAMANDIS: tres ferramentas, escolhidas por DISTANCIA — ele nao tem
      // rodizio, tem uma obra a fazer e usa o instrumento que cabe.
      //
      //   longe  -> broca: fixa o rumo e atravessa a arena;
      //   medio  -> demolicao: marca o chao e implode;
      //   perto  -> feixe: varre a linha e depois a energiza.
      //
      // A ordem da checagem e do mais longe para o mais perto porque as faixas
      // se sobrepoem de proposito: na borda, quem manda e o golpe que cobre o
      // espaco maior, e nunca uma escolha que dependa da ordem de leitura.
      if (enemy.archetype === 'diamandis') {
        const reactorDown = (state.bossRuntime.phasesFired & BOSS_PHASE_REACTOR) !== 0;
        const cadence = reactorDown ? DIAMANDIS_REACTOR_CADENCE_SCALE : 1;
        // A broca NAO exige linha de visao, e e a unica acao telegrafada do
        // jogo que nao exige. Exigir seria anular a mecanica: ela existe
        // justamente para a cobertura deixar de valer — o Corcel precisa de
        // visada porque a investida dele se perde numa parede, e a do
        // Diamandis a COME. O que a mantem justa continua sendo o 1,8 s
        // parado antes de sair.
        if (
          hasModule(state, BOSS_MODULE_DRILL) &&
          state.tick >= enemy.nextActionAt &&
          dist >= DIAMANDIS_DRILL_MIN_RANGE &&
          dist <= DIAMANDIS_DRILL_MAX_RANGE
        ) {
          enemy.nextActionAt = state.tick + Math.round(DIAMANDIS_DRILL_COOLDOWN_TICKS * cadence);
          startAction(
            state,
            enemy,
            'drill',
            toward,
            DIAMANDIS_DRILL_WINDUP_TICKS,
            DIAMANDIS_DRILL_TICKS,
            events,
            player.id,
          );
          continue;
        }
        if (
          hasModule(state, BOSS_MODULE_TOWER) &&
          state.tick >= enemy.rangedReadyAt &&
          dist >= DIAMANDIS_DEMOLISH_MIN_RANGE &&
          dist <= DIAMANDIS_DEMOLISH_RANGE
        ) {
          enemy.rangedReadyAt = state.tick + Math.round(DIAMANDIS_DEMOLISH_COOLDOWN_TICKS * cadence);
          startAction(
            state,
            enemy,
            'demolish',
            toward,
            DIAMANDIS_DEMOLISH_WINDUP_TICKS,
            8,
            events,
            player.id,
          );
          // As marcas nascem AGORA, com a posicao que o alvo tem agora: e o
          // instante do telegrafo que elas congelam, e sair dali e a resposta.
          markDemolition(state, enemy, player, state.tick + DIAMANDIS_DEMOLISH_WINDUP_TICKS, events);
          continue;
        }
        // O feixe MORRE no colapso do reator: e o primeiro sistema a cair
        // quando a alimentacao entra em colapso, e e o que faz a segunda fase
        // ser outra luta em vez da mesma com numeros piores.
        if (
          !reactorDown &&
          hasModule(state, BOSS_MODULE_SCANNER) &&
          state.tick >= enemy.contactReadyAt &&
          dist <= DIAMANDIS_BEAM_LENGTH &&
          hasLineOfSight(state, enemy.x, enemy.y, player.x, player.y)
        ) {
          enemy.contactReadyAt = state.tick + DIAMANDIS_BEAM_COOLDOWN_TICKS;
          startAction(state, enemy, 'beam', toward, DIAMANDIS_BEAM_WINDUP_TICKS, 10, events, player.id);
          continue;
        }
      }

      // ARQUICANTOR: canta, e a Catedral responde. Sem cristal ao alcance ele
      // nao tem quem responda — a sala esvaziada E o contra-jogo, entao a
      // checagem tem de ser real.
      if (
        enemy.archetype === 'archcantor' &&
        state.tick >= enemy.rangedReadyAt &&
        dist <= ARCHCANTOR_PULSE_RADIUS + 1.5 &&
        archcantorHasNetwork(state, enemy)
      ) {
        enemy.rangedReadyAt = state.tick + ARCHCANTOR_COOLDOWN_TICKS;
        startAction(state, enemy, 'pulse', toward, ARCHCANTOR_WINDUP_TICKS, 10, events, player.id);
        continue;
      }

      // RAINHA DA GEADA: refaz o lago e solta os Espectros dele.
      if (
        enemy.archetype === 'frost_queen' &&
        state.tick >= enemy.rangedReadyAt &&
        dist <= FROST_QUEEN_FREEZE_RADIUS + 3
      ) {
        enemy.rangedReadyAt = state.tick + FROST_QUEEN_FREEZE_COOLDOWN_TICKS;
        startAction(state, enemy, 'freeze', toward, FROST_QUEEN_FREEZE_WINDUP_TICKS, 8, events, player.id);
        continue;
      }

      // Bruiser: arranca a parede e joga.
      //
      // Ele era o unico sem NENHUMA resposta a distancia, a metade da velocidade
      // do jogador — contra quem recua, nunca encostava, e mais HP so alongaria
      // a mesma luta inofensiva. A municao sai do MUNDO: o bloco arrancado some
      // da arena, entao a cobertura de quem esta atras dela pode virar o proprio
      // projetil que vem. Sem parede ao alcance ele nao tem o que jogar e volta
      // a ser o perseguidor lento — em sala aberta a ameaca dele e outra.
      if (
        enemy.archetype === 'bruiser' &&
        state.tick >= enemy.rangedReadyAt &&
        dist >= BRUISER_HURL_MIN_RANGE &&
        dist <= BRUISER_HURL_MAX_RANGE
      ) {
        const ammo = findRippable(state, enemy);
        if (ammo && ripSolid(state, ammo.x, ammo.y, events)) {
          enemy.rangedReadyAt = state.tick + BRUISER_HURL_COOLDOWN_TICKS;
          startAction(state, enemy, 'hurl', toward, BRUISER_HURL_WINDUP_TICKS, 6, events, player.id);
          continue;
        }
      }

      // O ramo de projetil generico. So Spitter (cuspe) e Guardiao (Salva
      // Litoclasta) passam por aqui: o Bispo saiu de vez — a resposta a
      // distancia dele e a Supernova, decidida la em cima.
      if (
        (enemy.archetype === 'spitter' || enemy.archetype === 'guardian') &&
        state.tick >= enemy.rangedReadyAt
      ) {
        const rangedDistance = enemy.archetype === 'spitter' ? 5.5 : 6.5;
        if (dist <= rangedDistance) {
          const windup = enemy.archetype === 'spitter' ? 6 : 10;
          enemy.rangedReadyAt =
            state.tick + (enemy.archetype === 'spitter' ? 56 : GUARDIAN_SALVO_COOLDOWN_TICKS);
          startAction(state, enemy, 'ranged', toward, windup, 5, events, player.id);
          if (enemy.archetype === 'guardian') {
            // `mood` conta as salvas — o unico campo livre dele, no mesmo
            // espirito do relogio emprestado do Escoriaceo. Na segunda fase
            // (abaixo de 50%), salvas impares viram RAJADA: leque para negar
            // espaco, rajada para perseguir movimento, alternando.
            enemy.mood = (enemy.mood ?? 0) + 1;
            const enraged = enemy.hp < enemy.maxHp * 0.5;
            if (enraged && enemy.mood % 2 === 1 && enemy.action) {
              enemy.action.salvo = GUARDIAN_VOLLEY_SHOTS - 1;
            }
          }
          continue;
        }
      }

      const contactRange = enemy.radius + player.radius + 0.18;
      if (
        dist < contactRange &&
        state.tick >= enemy.contactReadyAt &&
        enemy.archetype !== 'bomber' &&
        enemy.archetype !== 'sulfur_bomber'
      ) {
        // O Coveiro prensa: golpe pesado, telegrafo de golpe pesado. E o
        // "porradao" que o puxao existe para tornar possivel.
        const heavy =
          enemy.archetype === 'guardian' ||
          enemy.archetype === 'bishop' ||
          enemy.archetype === 'undertaker';
        const windup = heavy ? 7 : enemy.archetype === 'bruiser' ? 5 : 3;
        enemy.contactReadyAt = state.tick + def.contactCooldown;
        startAction(state, enemy, heavy ? 'slam' : 'contact', toward, windup, 4, events, player.id);
        continue;
      }

      if (enemy.archetype === 'spitter' && dist < 5) {
        dirX = -dirX;
        dirY = -dirY;
      }
      if (enemy.archetype === 'stalker') {
        const side = enemy.id % 2 === 0 ? 1 : -1;
        const ox = dirX;
        dirX += -dirY * 0.45 * side;
        dirY += ox * 0.45 * side;
        const flank = normalized(dirX, dirY);
        dirX = flank.x;
        dirY = flank.y;
        const aheadX = enemy.x + dirX * 0.8;
        const aheadY = enemy.y + dirY * 0.8;
        const ai = Math.floor(aheadY) * state.config.width + Math.floor(aheadX);
        if (ai >= 0 && ai < state.surface.length && state.surface[ai] === SURF_FIRE) {
          const temp = dirX;
          dirX = -dirY;
          dirY = temp;
        }
      }
      if (enemy.archetype === 'guardian' && state.tick >= enemy.nextActionAt && dist > 2.2) {
        enemy.nextActionAt = state.tick + 100;
        startAction(state, enemy, 'charge', toward, 8, 8, events, player.id);
        continue;
      }
    } else if (state.tick >= enemy.nextActionAt) {
      enemy.nextActionAt = state.tick + 40 + state.rng.nextInt(60);
      const angle = state.rng.nextFloat01() * Math.PI * 2;
      enemy.vx = Math.cos(angle) * def.speed * 0.35;
      enemy.vy = Math.sin(angle) * def.speed * 0.35;
    }

    // O cavalo em perseguicao NAO tem o rumo sobrescrito pela velocidade residual.
    //
    // O rumo dele e um acumulador: a curva abaixo soma um passo de
    // `HORSE_TURN_RATE` por tick em cima de `enemy.facing`, e e essa soma que
    // descreve o arco. Enquanto sobra velocidade de perambular ou de um empurrao,
    // reescrever `facing` pela velocidade jogava o acumulador de volta ao ponto de
    // partida todo tick — o cavalo repetia eternamente o mesmo primeiro passo de
    // curva e so comecava a virar de verdade quando a residual caia abaixo do
    // limiar, uma dezena de ticks depois. Quem estava sendo perseguido via o
    // bicho correr reto por uma tangente que ele nunca escolheu.
    const horseSteering = enemy.archetype === 'fungal_horse' && (dirX !== 0 || dirY !== 0);
    driftByVelocity(state, enemy, dt, events, !horseSteering);

    // O cavalo NAO vira no lugar.
    //
    // Todos os outros inimigos apontam para o jogador e andam naquela direcao no
    // mesmo tick. Num bicho de 2 tiles isso le como sprite sendo arrastado, e nao
    // como corpo correndo — e foi exatamente o que apareceu na primeira versao.
    // Fechando a curva aos poucos ele descreve um ARCO, que e o que da ao jogador
    // a chance de sair pelo lado de dentro dela.
    //
    // Vale so fora da investida: a investida ja congela a direcao no windup, e
    // suavizar por cima disso faria o cavalo desviar do proprio telegrafo.
    // Gira por ANGULO, e nao interpolando os dois vetores.
    //
    // Misturar `facing` com o alvo e normalizar parecia equivalente e nao e: com
    // os dois exatamente opostos, a mistura continua no MESMO eixo e a
    // normalizacao devolve o vetor original. O cavalo simplesmente nao virava —
    // e so quando quem estava atras dele era o jogador, que e o caso em que a
    // curva importa. Limitar o passo angular nao tem esse ponto cego.
    if (enemy.archetype === 'fungal_horse' && (dirX !== 0 || dirY !== 0)) {
      const current = Math.atan2(enemy.facing.y, enemy.facing.x);
      let delta = Math.atan2(dirY, dirX) - current;
      // Para o menor lado. Sem isto, virar de +170 para -170 graus daria a volta
      // inteira por fora em vez dos 20 graus que realmente separam os dois.
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const stepped = current + Math.max(-HORSE_TURN_RATE, Math.min(HORSE_TURN_RATE, delta));
      dirX = Math.cos(stepped);
      dirY = Math.sin(stepped);
    }

    if (dirX !== 0 || dirY !== 0) {
      enemy.facing.x = dirX;
      enemy.facing.y = dirY;
      const moved = moveEntity(state, enemy, dirX * speed * dt, dirY * speed * dt);
      if (moved.blockCell && crushesWalls(enemy)) {
        breakSolid(state, moved.blockCell.x, moved.blockCell.y, events);
      }
      // NAO existe mais um segundo empurrao no eixo livre quando o outro trava.
      //
      // Ele existia para "ajudar o inimigo a nao grudar na parede", e era
      // desnecessario: `moveEntity` ja resolve os eixos em separado, entao o eixo
      // livre SEMPRE anda inteiro e o deslizamento ja acontecia sozinho. O que o
      // empurrao extra fazia era somar 60% por cima do que ja tinha andado.
      //
      // Medido: um spitter colado numa parede, perseguindo em diagonal, andava a
      // 114% da propria velocidade. Raspar parede era mais rapido que correr em
      // campo aberto — o mesmo tipo de erro que o jogador reportou no movimento
      // dele, do outro lado da tela.
    }

    if (enemy.elite) {
      const i = cellUnder(state, enemy);
      if (state.surface[i] === SURF_FUNGAL) igniteCell(state, i, events);
    }
  }

  // O DIAMANDIS tem a propria fase de uma vez: o reator vaza abaixo da metade.
  const diamandis = state.enemies.find((e) => e.archetype === 'diamandis');
  if (diamandis && diamandis.alive) diamandisShedModules(state, diamandis, events);
  if (
    diamandis &&
    diamandis.alive &&
    diamandis.hp < diamandis.maxHp * DIAMANDIS_REACTOR_HP_FRACTION &&
    (state.bossRuntime.phasesFired & BOSS_PHASE_REACTOR) === 0
  ) {
    state.bossRuntime.phasesFired |= BOSS_PHASE_REACTOR;
    diamandisReactorCollapse(state, diamandis, events);
  }

  const guardian = state.enemies.find((e) => e.archetype === 'guardian');
  if (!guardian || !guardian.alive) return;
  const enraged = guardian.hp < guardian.maxHp * 0.5;

  if (enraged && (state.bossRuntime.phasesFired & BOSS_PHASE_SUMMON) === 0) {
    state.bossRuntime.phasesFired |= BOSS_PHASE_SUMMON;
    // Em anel, e nao dois dos lados: saindo todos da mesma linha, o jogador
    // resolvia os quatro com um recuo so.
    const around = [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ];
    for (let k = 0; k < GUARDIAN_SUMMON_COUNT; k++) {
      const [dx, dy] = around[k % around.length];
      spawnEnemy(state, 'stalker', Math.floor(guardian.x) + dx, Math.floor(guardian.y) + dy, false);
    }
  }

  // O cerco espera o jogador estar DENTRO do raio.
  //
  // Fechado em volta do guardiao com o jogador longe, o efeito seria o oposto do
  // pretendido: trancaria o chefe e libertaria quem devia estar preso. Por isso
  // e uma tentativa por tick enquanto ele estiver enfurecido, e nao um evento
  // unico no instante em que a vida cruza a metade.
  if (enraged && !state.bossRuntime.arenaClosed) {
    const near = state.players.find(
      (p) =>
        p.alive &&
        !state.playerExtras[p.slot ?? 0].downed &&
        Math.max(Math.abs(p.x - guardian.x), Math.abs(p.y - guardian.y)) < GUARDIAN_ARENA_RADIUS - 1
    );
    if (near) {
      const placed = closeArena(
        state,
        Math.floor(guardian.x),
        Math.floor(guardian.y),
        GUARDIAN_ARENA_RADIUS,
        GUARDIAN_ARENA_EXITS,
        events
      );
      if (placed > 0) state.bossRuntime.arenaClosed = true;
    }
  }
};

export const applyExplosionDamage = (
  state: SurvivalState,
  ex: number,
  ey: number,
  radius: number,
  events: SemanticEvent[],
  playerDamageScale = 1,
  /**
   * De quem foi a explosao.
   *
   * E a informacao mais valiosa de toda a tabela de causas: morrer da propria
   * detonacao num corredor fechado e a morte de DECISAO que o design quer que
   * aconteca, e sem este campo ela chegaria ao jogador indistinguivel de um
   * bomber que ele nunca viu.
   */
  source: EffectOrigin['source'] = 'environment'
): void => {
  const joined = state.players.filter((p) => state.playerExtras[p.slot ?? 0].joined);
  for (const ent of [...joined, ...state.enemies]) {
    if (!ent.alive) continue;
    const d = Math.hypot(ent.x - ex, ent.y - ey);
    if (d <= radius + ent.radius) {
      const scale = ent.kind === 'player' ? playerDamageScale : 1;
      damageEntity(
        state,
        ent,
        EXPLOSION_DAMAGE * Math.max(0.35, 1 - d / (radius + 0.001)) * scale,
        events,
        { kind: 'explosion', source }
      );
    }
  }
};
