import {
  ALERT_TICKS,
  BIOFLUID_SLOW,
  WITNESS_RANGE,
  ARCHCANTOR_COOLDOWN_TICKS,
  ARCHCANTOR_IDLE_NOTE_INTERVAL_TICKS,
  DEVOURER_BURROW_CUE_INTERVAL_TICKS,
  GUARDIAN_STEP_INTERVAL_TICKS,
  GUARDIAN_STRAIN_INTERVAL_TICKS,
  LEVIATHAN_CALL_INTERVAL_TICKS,
  LUNG_MATRIX_HOLD_TICKS,
  ARCHCANTOR_CRYSTAL_BUDGET,
  ARCHCANTOR_CHAIN_REACH,
  ARCHCANTOR_CHAIN_LAYERS,
  ARCHCANTOR_CHAIN_STEP_TICKS,
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
  FURNACE_HEART_WAVE_TURN,
  FURNACE_HEART_BURN_TICKS,
  FURNACE_HEART_WAVE_WARNING_WAVES,
  FURNACE_HEART_CYCLONE_CAP,
  FURNACE_HEART_CYCLONE_TTL_TICKS,
  FURNACE_HEART_CYCLONE_RADIUS,
  FURNACE_HEART_CYCLONE_DAMAGE,
  FURNACE_HEART_CYCLONE_SPEED,
  FURNACE_HEART_CYCLONE_INTERVAL_TICKS,
  FURNACE_HEART_STALACTITE_SPREAD,
  FURNACE_HEART_STALACTITES_PER_DROP,
  FURNACE_HEART_STALACTITE_RADIUS,
  FURNACE_HEART_STALACTITE_DAMAGE,
  FURNACE_HEART_STALACTITE_WARNING_TICKS,
  FURNACE_HEART_STALACTITE_INTERVAL_TICKS,
  FURNACE_HEART_UNSTABLE_HP,
  FURNACE_HEART_OVERHEAT_HP,
  FURNACE_HEART_BROOD_CAP,
  FURNACE_HEART_BROOD_PER_WAVE,
  FURNACE_HEART_WAVE_DAMAGE,
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
  LEVIATHAN_SURGE_COOLDOWN_TICKS,
  LEVIATHAN_SURGE_LENGTH,
  LEVIATHAN_SURGE_WIDTH,
  LEVIATHAN_DELUGE_SPEED_SCALE,
  DELUGE_HP_FRACTION,
  DELUGE_WINDUP_TICKS,
  PROSPECTOR_HEAD_HEIGHT,
  LEVIATHAN_SHOCK_WINDUP_TICKS,
  LEVIATHAN_SHOCK_RECOVERY_TICKS,
  LEVIATHAN_SHOCK_COOLDOWN_TICKS,
  LEVIATHAN_SHOCK_DAMAGE,
  LEVIATHAN_PROTECTIVE_BUBBLE_RADIUS,
  DIVER_BOSS_AGGRO_RANGE,
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
  DEVOURER_BROOD_RING,
  DEVOURER_BROOD_SHY,
  DEVOURER_BROOD_SPREAD,
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
  DEVOURER_REPEAT_MIN_GAP,
  DEVOURER_SLAM_DAMAGE,
  DEVOURER_SLAM_RADIUS,
  DEVOURER_LEAPS_PER_CYCLE,
  DEVOURER_BURST_SPENT,
  DEVOURER_MAW_SETTLE_TICKS,
  DEVOURER_MAW_TICKS,
  DEVOURER_MAW_BITE_DAMAGE,
  DEVOURER_MAW_BITE_RADIUS,
  DEVOURER_MAW_PULL_STEP,
  DEVOURER_STALK_CIRCLE,
  DEVOURER_STALK_RANGE,
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
  DIAMANDIS_DEMOLISH_LEAD_SECONDS,
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
  DIAMANDIS_SALVAGE_CREW,
  DIAMANDIS_SALVAGE_CREW_CAP,
  DIAMANDIS_SALVAGE_CREW_RING,
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
  BISHOP_NOVA_TRAVEL_TICKS,
  BISHOP_NOVA_SEEK_TICKS,
  BISHOP_NOVA_WINDUP_TICKS,
  BISHOP_FUNGAL_ARMOR,
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
import {
  breakSolid,
  canRip,
  chargeCells,
  closeArena,
  delugeDepth,
  delugeFront,
  explodeAt,
  igniteCell,
  isConductiveCell,
  isConductiveSurface,
  meltIce,
  openArena,
  ripSolid,
  setSurface,
} from './cells.js';
import { findPath, hasLineOfSight } from './pathing.js';
import { isBossArchetype } from './bosses.js';
import { mawPull, mawReach } from './maw.js';
import { markSectorBossDown, runDepth } from './depth.js';
import { addDamageTenths, markDiscovery, recordKill } from './stats.js';
import {
  BELLOWS_EXHALING,
  BELLOWS_INHALING,
  DEVOURER_AIRBORNE,
  DEVOURER_BURROWED,
  DEVOURER_MAW,
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
  BOSS_PHASE_UNSTABLE,
  BOSS_PHASE_DELUGE,
  BOSS_PHASE_OVERHEAT,
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
  BossAbility,
  DamageCause,
  EffectOrigin,
  Entity,
  EntityAction,
  EntityActionKind,
  EnemyArchetype,
  SemanticEvent,
  SimMessageKey,
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
  stalker: {
    hp: 26,
    speed: 5.2,
    radius: 0.32,
    contactDamage: 8,
    contactCooldown: 10,
    aggroRange: 9,
  },
  // 160 e nao 95: com 95 ele morria em 1,7 s de fogo sustentado, o que dava
  // tempo para exatamente UM arremesso — a mecanica nova mal existia. Aqui vida
  // e o portao de quantas vezes ela acontece, e nao um jeito de alongar uma luta
  // inofensiva (que e por que o guardiao NAO ganha vida).
  bruiser: {
    hp: 160,
    speed: 2.3,
    radius: 0.46,
    contactDamage: 18,
    contactCooldown: 16,
    aggroRange: 7,
  },
  spitter: {
    hp: 30,
    speed: 2.8,
    radius: 0.34,
    contactDamage: 6,
    contactCooldown: 14,
    aggroRange: 9,
  },
  bomber: { hp: 18, speed: 3.7, radius: 0.3, contactDamage: 4, contactCooldown: 10, aggroRange: 9 },
  guardian: {
    hp: 420,
    speed: 2.1,
    radius: 0.68,
    contactDamage: 24,
    contactCooldown: 14,
    aggroRange: 7,
  },
  // Vida MENOR que a do guardiao de proposito. A dificuldade do bispo nao mora
  // na barra: em cima do fungo ele se cura mais rapido do que se leva dano, e
  // fora dele cai depressa. Somar vida grande a cura seria cobrar as duas coisas
  // pelo mesmo problema e transformar a luta em espera.
  bishop: {
    hp: BISHOP_HP,
    speed: 2.6,
    radius: 0.6,
    contactDamage: 20,
    contactCooldown: 14,
    aggroRange: 10,
  },
  // Alcance de aggro alto e velocidade alta porque a ameaca dele e CHEGAR: um
  // cavalo que espera o jogador entrar num raio pequeno nunca teria distancia
  // para investir, e a investida e o bicho inteiro.
  fungal_horse: {
    hp: HORSE_HP,
    speed: 4.4,
    radius: 0.44,
    contactDamage: 14,
    contactCooldown: 12,
    aggroRange: 13,
  },
  // Corpo GRANDE (raio 0,46, entre o bruiser e o guardiao) e vida BAIXA.
  //
  // A combinacao e deliberada e diz o que ele e: uma maquina de carga de 2,5 m
  // que nunca foi construida para lutar. Ele nao e um desafio de combate, e uma
  // DECISAO — quem decidir destrui-lo consegue, sempre, e o custo nunca foi a
  // luta. Subir a vida junto com o tamanho transformaria a decisao num
  // orcamento de municao, que e outra coisa.
  miner: {
    hp: MINER_HP,
    speed: MINER_RAGE_SPEED,
    radius: 0.46,
    contactDamage: 6,
    contactCooldown: 18,
    aggroRange: MINER_NOTICE_RANGE,
  },
  // ------------------------------------------------------------------------
  // Bestiario de assinatura (um por estrato; ver constants.ts).
  // ------------------------------------------------------------------------
  // Lento e parrudo de proposito: a ameaca dele nao e alcancar ninguem, e o
  // ESPACO que os cristais armados negam. Matar e facil; matar DE PERTO, entre
  // cristais carregando, e a decisao.
  resonant: {
    hp: 95,
    speed: 1.6,
    radius: 0.44,
    contactDamage: 10,
    contactCooldown: 16,
    aggroRange: 10,
  },
  // Rapida NA AGUA (a lentidao da agua nao vale para ela — e o elemento dela).
  // Vida baixa: a defesa e nao estar visivel, nao ser um saco de pancada.
  mud_lamprey: {
    hp: 55,
    speed: 3.6,
    radius: 0.4,
    contactDamage: 16,
    contactCooldown: 14,
    aggroRange: 11,
  },
  // A NINHADA do Devorador. Todos os numeros de ameaca sao zero, e isso e o
  // desenho e nao um esboco por preencher: um ponto de vida (qualquer coisa
  // mata), dano de contato zero (ele nao pode machucar nem por acidente) e
  // alcance de aggro zero (ele nao persegue ninguem — ele segue a mae).
  //
  // O raio e o menor do jogo de proposito. Ele decide duas coisas alem do
  // desenho: o quanto o filhote se afasta dos irmaos, e o quao facil e pisar
  // nele. As duas querem o mesmo numero pequeno.
  devourer_brood: {
    hp: 1,
    speed: 3.2,
    radius: 0.17,
    contactDamage: 0,
    contactCooldown: 999,
    aggroRange: 0,
  },
  // Corpo largo, quase parado: ele e um orgao do bioma, nao um cacador. O
  // perigo dele e ONDE o gas passa a estar, nunca a perseguicao.
  bellows: {
    hp: 80,
    speed: 1.7,
    radius: 0.5,
    contactDamage: 10,
    contactCooldown: 16,
    aggroRange: 9,
  },
  // Vida media com couraça que corta mais da metade do dano: frio, ele demora
  // como um bruiser; quente, morre rapido — e corre atras da troca.
  scoriac: {
    hp: 130,
    speed: 2.4,
    radius: 0.44,
    contactDamage: 16,
    contactCooldown: 14,
    aggroRange: 8,
  },
  frost_wraith: {
    hp: 48,
    speed: 3.8,
    radius: 0.36,
    contactDamage: 14,
    contactCooldown: 12,
    aggroRange: 11,
  },
  // Mesmo chassi do Spore Bomber (vida baixa, corre e estoura): trocar os
  // numeros faria dele outro inimigo, e ele e o MESMO inimigo com outra
  // quimica. O que muda esta na morte — gas no lugar de esporo.
  sulfur_bomber: {
    hp: 18,
    speed: 3.7,
    radius: 0.3,
    contactDamage: 4,
    contactCooldown: 10,
    aggroRange: 9,
  },
  // Lento e pesado: ele nao precisa te alcancar, ele te TRAZ. Vida alta de
  // bruiser porque o encontro tem de durar o bastante para o puxao acontecer
  // pelo menos duas vezes — uma so seria um susto, nao uma regra aprendida.
  undertaker: {
    hp: 145,
    speed: 1.9,
    radius: 0.5,
    contactDamage: 12,
    contactCooldown: 16,
    aggroRange: UNDERTAKER_PULL_RANGE,
  },
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
    aggroRange: DIVER_BOSS_AGGRO_RANGE,
  },
  // ------------------------------------------------------------------------
  // Chefes de estrato: um dono por geologia. Ver constants.ts.
  // ------------------------------------------------------------------------
  // Lento e pesado: ele nao persegue, ele CANTA e a sala responde. 1,7 e nao
  // 1,2 porque "lento" precisa continuar significando "voce escolhe a
  // distancia", e nao "voce anda para tras e o encontro acaba": a 1,2 ele
  // perdia terreno para o jogador em toda troca de tiro, e o canto so alcanca
  // quem ainda esta na nave.
  archcantor: {
    hp: ARCHCANTOR_HP,
    speed: 1.7,
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
    aggroRange: DIVER_BOSS_AGGRO_RANGE,
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

/**
 * O CORPO cabe aqui? Nao a celula do centro — o circulo inteiro.
 *
 * Exportada porque a geracao de mundo precisa da MESMA pergunta que o
 * movimento faz. Um nascimento conferido so pela celula do centro pode por
 * um canto do circulo dentro da pedra, e dali `moveEntity` nao tira mais:
 * todo passo que sairia ja comeca bloqueado.
 */
export const circleBlocked = (state: SurvivalState, x: number, y: number, r: number): boolean =>
  isSolidAt(state, x - r, y - r) ||
  isSolidAt(state, x + r, y - r) ||
  isSolidAt(state, x - r, y + r) ||
  isSolidAt(state, x + r, y + r);

export const moveEntity = (
  state: SurvivalState,
  ent: Entity,
  dx: number,
  dy: number,
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
  cause: DamageCause = { kind: 'unknown' },
  /**
   * Dano por tick do chao cobrando presenca (so `applyCellHazards` liga).
   * Distinto da causa: a varredura da Fornalha fere com {kind:'fire'} e NAO e
   * hazard — e pancada de chefe, e o audio a trata como tal.
   */
  hazard = false,
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
    events.push(
      hazard
        ? { t: 'hit', x: ent.x, y: ent.y, amount: scaled, target: ent.id, hazard: true }
        : { t: 'hit', x: ent.x, y: ent.y, amount: scaled, target: ent.id },
    );
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
    if (frostQueenIceAround(state, ent) >= FROST_QUEEN_ICE_THRESHOLD) {
      amount *= FROST_QUEEN_ICE_ARMOR;
      // O tiro ABSORVIDO tem de ser ouvido como absorvido: e a unica coisa que
      // diz ao jogador que a barra nao esta mexendo por causa do gelo, e nao
      // por causa da mira. Nao no dano por tick do chao — isso e pressao, nao
      // um tiro que a couraça engoliu.
      if (!hazard) {
        events.push({
          t: 'boss_state',
          archetype: 'frost_queen',
          state: 'armor_hit',
          x: ent.x,
          y: ent.y,
        });
      }
    } else markDiscovery(state.stats, DISCOVERY_QUEEN_THAWED);
  }
  // Dano RECEBIDO com voz propria, nos dois chefes em que o que sai do corpo
  // nao e um gemido: o Guardiao solta lasca, o Pulmao vaza como um fole
  // furado. `hazard` fora pelo mesmo motivo da couraça da Rainha.
  if (!hazard && ent.archetype === 'guardian') {
    events.push({ t: 'boss_state', archetype: 'guardian', state: 'chip', x: ent.x, y: ent.y });
  }
  if (!hazard && ent.archetype === 'lung_matrix') {
    events.push({ t: 'boss_state', archetype: 'lung_matrix', state: 'wound', x: ent.x, y: ent.y });
  }
  if (ent.archetype === 'archcantor' && !archcantorHasNetwork(state, ent)) {
    amount *= ARCHCANTOR_SILENT_ARMOR;
    markDiscovery(state.stats, DISCOVERY_CATHEDRAL_SILENCED);
  }
  // O Bispo CONECTADO ao tapete. A mesma familia das de cima e pelo mesmo
  // motivo: a defesa do chefe e o estrato dele, e ela cai quando o chao cai.
  //
  // A cura sozinha ja devia bastar, e a conta diz que quase basta — mas "quase"
  // e o que o playtest encontrou: com burst e modulos dava para vencer o tapete
  // no proprio tapete, e ai o quebra-cabeca territorial deixava de precisar ser
  // resolvido. A reducao e pequena de proposito (15%): ela nao existe para
  // segurar dano, existe para fechar a fresta por onde o atrito passava. Sobre
  // fungo aquecido — o instante em que o jogador acende o chao — ela some
  // junto com a cura, e as duas voltam a existir se o tapete voltar.
  if (ent.archetype === 'bishop' && state.surface[cellUnder(state, ent)] === SURF_FUNGAL) {
    amount *= BISHOP_FUNGAL_ARMOR;
  }
  const attributable =
    cause.kind === 'player_shot' ||
    ((cause.kind === 'explosion' || cause.kind === 'discharge') && cause.source === 'player');
  if (attributable) {
    state.stats.damageDealtTenths = addDamageTenths(
      state.stats.damageDealtTenths,
      Math.min(amount, ent.hp),
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
  if (ent.archetype === 'sheet_leviathan') {
    state.bossRuntime.protectiveBubbles = [];
    state.bossRuntime.leviathanShockAt = -1;
    ent.action = undefined;
  }
  // A NINHADA nao entra na contagem de abates. O total alimenta o PLACAR, e
  // catorze filhotes inofensivos por camara seriam pontos de graca para quem
  // pisasse neles — um placar em que esmagar filhote rende mais que enfrentar o
  // chefe esta medindo a coisa errada. O evento de morte continua indo; o que
  // nao vai e o credito.
  if (ent.archetype !== 'devourer_brood') recordKill(state.stats, ent.archetype as EnemyArchetype);
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
  // O Coracao leva o calor embora com ele.
  //
  // FORA da guarda do selo de setor, e a distincao importa: esfriar a sala e
  // propriedade da morte DELE, e nao da quebra do selo. Amarrar as duas faria o
  // alivio depender de ele ser o dono do setor — o que ele sempre e hoje, e o
  // "hoje" e exatamente o tipo de coisa que envelhece calado.
  if (ent.archetype === 'furnace_heart') furnaceHeartCooldown(state, ent, events);
  // A MAE CAIU: a ninhada vai junto. Ver `devourerBroodEnds` — sem isto, o que
  // sobra na camara limpa sao catorze filhotes orfaos ocupando vaga do teto de
  // inimigos e parando bala.
  if (ent.archetype === 'white_devourer') devourerBroodEnds(state, events);
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
  elite: boolean,
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
  cause.kind === 'fire' ||
  cause.kind === 'gas' ||
  cause.kind === 'spores' ||
  // Saturacao e o caso mais puro da lista: nao ha nuvem em que pisar, e o
  // "chao" que cobra presenca e o setor inteiro. Ficar de fora faria dela o
  // unico dano ambiental imune a selagem que o jogador COMPRA para aguentar
  // ambiente — o upgrade valeria contra a fumaca e nao contra o ar.
  cause.kind === 'contamination';

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
  maxLeadSeconds: number,
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

/**
 * Que HABILIDADE DE CHEFE uma acao telegrafada e, para quem a executa.
 *
 * `null` quando o ator nao e chefe, ou quando a acao nao e um golpe que se
 * anuncia (o arco do Devorador ja foi anunciado pela decolagem). A mesma acao
 * vira habilidades diferentes conforme o corpo — `erupt` e a emergencia do
 * Devorador E a rompida do Leviata; `pulse` e o canto do Arquicantor E a
 * Supernova do Bispo — e e exatamente por isso que o cliente nao pode
 * adivinhar a partir de `action_start`.
 */
const bossAbilityOfAction = (enemy: Entity, action: EntityActionKind): BossAbility | null => {
  const archetype = enemy.archetype as EnemyArchetype;
  if (!isBossArchetype(archetype)) return null;
  switch (action) {
    case 'ranged':
      return 'salvo';
    case 'slam':
      return 'slam';
    case 'charge':
      return 'charge';
    case 'contact':
      return 'contact';
    case 'pulse':
      return archetype === 'archcantor' ? 'song' : 'nova';
    case 'drill':
    case 'demolish':
    case 'beam':
    case 'freeze':
    case 'massive_shock':
      return action;
    case 'erupt':
      return archetype === 'sheet_leviathan' ? 'breach' : 'erupt';
    default:
      return null;
  }
};

const startAction = (
  state: SurvivalState,
  enemy: Entity,
  action: EntityActionKind,
  direction: Vec2,
  windupTicks: number,
  recoveryTicks: number,
  events: SemanticEvent[],
  target?: number,
  /** Ver `boss_windup.intensity`. So os chefes o preenchem, e nem todos. */
  intensity?: number,
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
    archetype: enemy.archetype as EnemyArchetype,
    x: enemy.x,
    y: enemy.y,
    dx: direction.x,
    dy: direction.y,
    startTick: state.tick,
    releaseTick: releaseAt,
    endTick: releaseAt + recoveryTicks,
  });
  // A PREPARACAO de um chefe e um evento proprio, alem do `action_start`: o
  // renderer continua lendo a pose pelo generico; o audio le a assinatura
  // por este. Os dois saem no mesmo tick, e o cliente cala o telegrafo
  // generico quando ve `archetype` de chefe — ver cues.ts.
  const ability = bossAbilityOfAction(enemy, action);
  if (ability) {
    events.push({
      t: 'boss_windup',
      archetype: enemy.archetype as EnemyArchetype,
      ability,
      x: enemy.x,
      y: enemy.y,
      dx: direction.x,
      dy: direction.y,
      releaseTick: releaseAt,
      ...(intensity !== undefined ? { intensity } : {}),
    });
  }
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
        GUARDIAN_ROCK_FLIGHT_TILES / GUARDIAN_ROCK_SPEED,
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
  // A salva e marcada NA FRENTE do alvo, e nao em cima dele.
  //
  // Este e o anti-kite do Diamandis, e ele e de CONTROLE DE ARENA e nao de
  // velocidade — ele continua sendo uma maquina de 1,5 tile/s, porque a
  // fantasia dele e peso e nao perseguicao. O que muda e o que ele nega: antes
  // as tres cargas caíam na posicao presente do jogador, e um jogador em
  // movimento circular ja tinha saido de todas elas antes mesmo do fim do
  // telegrafo. Andar em circulo derrotava o golpe sem exigir uma decisao.
  //
  // Com a antecipacao, a salva cai onde a rota VAI passar: continuar na rota
  // custa, e sair da rota e a decisao. Um jogador PARADO nao e punido por
  // estar parado — a antecipacao de um alvo parado e o proprio lugar dele, que
  // e onde a salva caía antes. O golpe passou a cobrar movimento previsivel,
  // que e exatamente o que o kite e.
  const lead = {
    x: target.vx * DIAMANDIS_DEMOLISH_LEAD_SECONDS,
    y: target.vy * DIAMANDIS_DEMOLISH_LEAD_SECONDS,
  };
  const aimX = target.x + lead.x;
  const aimY = target.y + lead.y;
  const toward = normalized(aimX - enemy.x, aimY - enemy.y);
  // Perpendicular ao eixo chefe->alvo: as laterais abrem o corredor de fuga
  // para os LADOS, e nao para tras (recuar em linha reta ja e o reflexo de
  // todo mundo, e um golpe que so pune o reflexo nao ensina nada).
  const side = { x: -toward.y, y: toward.x };
  state.bossRuntime.blastCells = [];
  for (let k = 0; k < DIAMANDIS_DEMOLISH_CHARGES; k++) {
    const offset = (k - (DIAMANDIS_DEMOLISH_CHARGES - 1) / 2) * DIAMANDIS_DEMOLISH_SPREAD;
    const bx = Math.floor(aimX + side.x * offset);
    const by = Math.floor(aimY + side.y * offset);
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
  const target =
    action.target === undefined
      ? null
      : (state.players.find(
          (p) => p.id === action.target && p.alive && !state.playerExtras[p.slot ?? 0].downed,
        ) ?? null);

  // A EXECUCAO do golpe de um chefe, antes das consequencias (a explosao, a
  // descarga, o `hit`) que o ramo especifico produz: o "aconteceu agora" e
  // um evento, e o que ele causou no mundo sao outros.
  const bossAbility = bossAbilityOfAction(enemy, action.kind);
  if (bossAbility) {
    events.push({
      t: 'boss_attack',
      archetype: enemy.archetype as EnemyArchetype,
      ability: bossAbility,
      x: enemy.x,
      y: enemy.y,
      dx: action.direction.x,
      dy: action.direction.y,
      // O canto do Arquicantor carrega o tamanho da rede que vai responder:
      // e a diferenca entre uma frase que resolve e um tritono.
      ...(enemy.archetype === 'archcantor'
        ? { intensity: archcantorSongIntensity(state, enemy) }
        : {}),
    });
  }

  if (action.kind === 'pulse') {
    if (enemy.archetype === 'resonant') resonantPulse(state, enemy, events);
    else if (enemy.archetype === 'archcantor') archcantorPulse(state, enemy, events);
    else bishopNova(state, enemy, events);
    return;
  }
  if (action.kind === 'demolish') {
    const w = state.config.width;
    for (const cell of state.bossRuntime.blastCells) {
      explodeAt(
        state,
        (cell % w) + 0.5,
        Math.floor(cell / w) + 0.5,
        DIAMANDIS_DEMOLISH_RADIUS,
        events,
        {
          source: 'enemy',
          owner: enemy.id,
        },
      );
    }
    state.bossRuntime.blastCells = [];
    return;
  }
  if (action.kind === 'erupt') {
    if (enemy.archetype === 'sheet_leviathan') leviathanBreach(state, enemy, events);
    else devourerErupt(state, enemy, events);
    return;
  }
  if (action.kind === 'massive_shock') {
    leviathanMassiveDischarge(state, enemy, events);
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
    events.push({
      t: 'shot',
      x: enemy.x,
      y: enemy.y,
      dx: action.direction.x,
      dy: action.direction.y,
      owner: enemy.id,
    });
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
        BRUISER_HURL_FLIGHT_TILES / BRUISER_HURL_SPEED,
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
    events.push({
      t: 'shot',
      x: enemy.x,
      y: enemy.y,
      dx: action.direction.x,
      dy: action.direction.y,
      owner: enemy.id,
    });
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
      const moved = moveEntity(
        state,
        target,
        pull.x * UNDERTAKER_PULL_STEP,
        pull.y * UNDERTAKER_PULL_STEP,
      );
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
      enemy.archetype === 'undertaker' ? UNDERTAKER_SLAM_DAMAGE : def.contactDamage * 1.2;
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
  if (state.tick >= action.releaseAt && action.phase === 'windup')
    releaseAction(state, enemy, events);
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
export const findRippable = (
  state: SurvivalState,
  ent: Entity,
): { x: number; y: number } | null => {
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
  events: SemanticEvent[],
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
    for (const [ox, oy] of alongX
      ? [
          [0, 0],
          [0, -1],
          [0, 1],
        ]
      : [
          [0, 0],
          [-1, 0],
          [1, 0],
        ]) {
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
    events.push({
      t: 'heal',
      x: enemy.x,
      y: enemy.y,
      entity: enemy.id,
      amount: BISHOP_REGEN_PER_TICK * 4,
    });
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
  // O release nao PLANTA nada: ele so abre a onda. Quem planta e
  // `bishopNovaStride`, anel por anel, enquanto a frente atravessa a sala.
  //
  // A diferenca nao e estetica. Um disco que aparecia inteiro num tick dizia
  // "apareceu mais um pouco de fungo perto dele"; uma frente que sai do corpo e
  // vem por cima do jogador plantando atras de si diz "eu limpei a arena, e ele
  // acabou de retomar a arena". A segunda frase e o encontro; a primeira era um
  // efeito colateral do encontro.
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: 1.5 });
};

/**
 * A FRENTE da Supernova, anel por anel.
 *
 * Conduzida pelo relogio da propria acao — a mesma tecnica do arco do Devorador
 * e da broca do Diamandis — e nao por um campo novo de estado. Isso importa
 * mais aqui do que nos outros dois: a acao ja viaja no snapshot e ja entra no
 * hash, entao a onda reproduz igual num cliente que reconectou no meio dela, e
 * nao ha um segundo relogio para dessincronizar do primeiro.
 *
 * O Bispo fica PARADO enquanto ela sai (este ramo nao chama `driftByVelocity`),
 * e isso e leitura: a supernova e a coisa que ele faz, nao algo que acontece
 * enquanto ele continua andando.
 *
 * A frente e mais rapida que o jogador de proposito — nao da para correr dela
 * depois que saiu. O que da para fazer e nao estar la, e e para isso que serve
 * o telegrafo radial de dois segundos que veio antes.
 */
const bishopNovaStride = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const action = enemy.action;
  if (!action) return;
  // O ultimo tick EXECUTADO e `endsAt - 1`, e nao `endsAt`: `advanceAction`
  // limpa a acao e devolve `false` assim que `tick >= endsAt`, entao a frente
  // nunca chega a rodar no instante final.
  //
  // Dividir pelo vao cheio fazia o ultimo passo parar em 25/26 do percurso — a
  // faixa externa do disco (de ~8,65 a 9) nunca recebia fungo nem dano, e a
  // borda que o telegrafo prometeu era mentira. Normalizar pelos passos que de
  // fato acontecem fecha o disco exatamente no raio anunciado.
  const steps = Math.max(1, action.endsAt - action.releaseAt - 1);
  const before = (state.tick - 1 - action.releaseAt) / steps;
  const now = (state.tick - action.releaseAt) / steps;
  const r0 = Math.max(0, before) * BISHOP_NOVA_RADIUS;
  const r1 = Math.min(1, now) * BISHOP_NOVA_RADIUS;
  if (r1 <= r0) return;

  const w = state.config.width;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  const box = Math.ceil(r1);
  for (let dy = -box; dy <= box; dy++) {
    for (let dx = -box; dx <= box; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < r0 || d > r1) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) continue;
      // Nao planta sobre fogo vivo nem sobre fungo que ja existe: plantar
      // dentro da chama apagaria o incendio que o jogador acabou de acender, e
      // transformaria a acao dele em nada. O fungo cresce onde o fogo ja
      // passou, e nao por cima dele.
      if (state.surface[i] === SURF_FIRE || state.surface[i] === SURF_FUNGAL) continue;
      setSurface(state, i, SURF_FUNGAL, BISHOP_NOVA_FUNGAL_TICKS);
    }
  }

  // O dano e da PASSAGEM do anel, e cada corpo so pode ser atravessado uma vez:
  // a frente cresce monotonicamente e ninguem corre para fora a 6,9 tiles/s,
  // entao a faixa [r0, r1) cobra de cada um exatamente na volta em que o
  // alcanca. Sem lista de atingidos, sem campo novo, sem golpe repetido.
  for (const player of state.players) {
    if (!player.alive || !state.playerExtras[player.slot ?? 0].joined) continue;
    const d = distTo(enemy, player);
    if (d < r0 || d > r1) continue;
    damageEntity(state, player, BISHOP_NOVA_DAMAGE, events, {
      kind: 'enemy_contact',
      archetype: 'bishop',
      elite: enemy.elite,
    });
    // Sobreviver a Supernova destrava o documento que diz que ela nunca foi um
    // ataque. Le `hp > 0` e nao `alive`: quem chegou a zero ainda esta vivo
    // neste instante — `resolveDownedAndDeaths` roda depois, no fim do tick — e
    // marcar ali daria a descoberta a quem justamente nao sobreviveu.
    if (player.hp > 0 && !state.playerExtras[player.slot ?? 0].downed) {
      markDiscovery(state.stats, DISCOVERY_BISHOP_NOVA_SURVIVED);
    }
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: r1 });
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
  events: SemanticEvent[],
): void => {
  const isLamprey = enemy.archetype === 'mud_lamprey';
  const w = state.config.width;
  const inElement = (i: number): boolean =>
    i >= 0 &&
    i < state.surface.length &&
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
      player.id,
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
  events: SemanticEvent[],
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
  if (
    victim &&
    state.tick >= enemy.contactReadyAt &&
    distTo(enemy, victim) < enemy.radius + victim.radius + 0.35
  ) {
    enemy.contactReadyAt = state.tick + ARCHETYPES.fungal_horse.contactCooldown;
    damageEntity(
      state,
      victim,
      ARCHETYPES.fungal_horse.contactDamage * (enemy.elite ? 1.4 : 1),
      events,
      {
        kind: 'enemy_contact',
        archetype: 'fungal_horse',
        elite: enemy.elite,
      },
    );
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
  if (trailX < 0 || trailY < 0 || trailX >= state.config.width || trailY >= state.config.height)
    return;
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
const diamandisDrillStride = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): void => {
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
  if (
    victim &&
    state.tick >= enemy.contactReadyAt &&
    distTo(enemy, victim) < enemy.radius + victim.radius + 0.4
  ) {
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
 * O chefe de mergulho ja NOTOU alguem? Vale para o Devorador e para o Leviata.
 *
 * Os dois tem passo proprio (`devourerStep`, `leviathanStep`) e por isso saem
 * do portao de aggro comum — e sair dele significava, na pratica, nao ter
 * portao nenhum. Eles cacavam desde o tick zero, do outro lado do setor,
 * atravessando parede e agua atras de um jogador que ainda estava descendo. O
 * relato de playtest e literal: "logo no comeco da fase ele ja chega em mim".
 * Nao era um bug de salto, era um chefe sem estado de repouso.
 *
 * O portao devolve o repouso e cobra o mesmo preco dos outros dois chefes de
 * camara: aproximar-se acorda, e levar tiro tambem (`alertedUntil`) — um chefe
 * que pudesse ser abatido de longe sem reagir seria pior do que um que nunca
 * dorme.
 *
 * E acordar NAO e atacar. O primeiro golpe fica devendo um mergulho inteiro,
 * porque `nextActionAt` nasce em zero e sem isto a emergencia saia no proprio
 * tick em que ele notou o jogador: o encontro comecava com uma cratera na cara
 * de quem nunca tinha visto o rastro. A regra do encontro e que a faixa de
 * areia (ou a ondulacao) avise ANTES — inclusive na primeira vez.
 */
const diverEngaged = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity,
  leadTicks: number,
  events: SemanticEvent[],
): boolean => {
  if (state.bossRuntime.awake) return true;
  const def = ARCHETYPES[enemy.archetype as EnemyArchetype];
  if (distTo(enemy, player) > def.aggroRange && state.tick >= enemy.alertedUntil) return false;
  state.bossRuntime.awake = true;
  enemy.nextActionAt = Math.max(enemy.nextActionAt, state.tick + leadTicks);
  events.push({
    t: 'boss_awake',
    archetype: enemy.archetype as EnemyArchetype,
    x: enemy.x,
    y: enemy.y,
  });
  return true;
};

/**
 * O passo de UMA MINHOQUINHA.
 *
 * Ela nao ataca, nao persegue e nao tem acao nenhuma no repertorio. O que ela
 * faz sao tres coisas, nesta ordem de prioridade: fugir do Prospector, nao
 * encostar nos irmaos, e voltar para perto da mae.
 *
 * A ordem e o comportamento inteiro. Com a mae primeiro, o bando atravessaria o
 * jogador para chegar nela; com a separacao primeiro, ela se espalharia em vez
 * de fugir. Fuga na frente e o que faz o chao ABRIR na frente de quem anda e
 * fechar atras — que e a unica coisa que um bicho inofensivo pode fazer para
 * parecer vivo.
 *
 * Nada disto usa `moveEntity`: parede nao vale para eles pelo mesmo motivo que
 * nao vale para a mae — eles vivem NA areia, nao sobre ela. O que os limita e a
 * moldura do mapa.
 */
const broodStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  dt: number,
): void => {
  let mx = 0;
  let my = 0;

  // 1. FUGIR. O peso cresce quanto mais perto o Prospector esta, entao um
  //    filhote encurralado corre mais que um que so viu o vulto passar.
  if (player && player.alive) {
    const d = distTo(enemy, player);
    if (d < DEVOURER_BROOD_SHY && d > 0.0001) {
      const away = normalized(enemy.x - player.x, enemy.y - player.y);
      const urge = 1 - d / DEVOURER_BROOD_SHY;
      mx += away.x * urge * 2.2;
      my += away.y * urge * 2.2;
    }
  }

  // 2. NAO ENCOSTAR NO IRMAO. E o "sem overlap": catorze corpos mirando o mesmo
  //    anel se amontoariam num arco so, e um cordao de contas nao e um bando.
  //
  //    O laco e sobre TODA a fauna e nao so sobre a ninhada — um filhote
  //    tambem nao tem por que ficar dentro de um stalker — mas o chefe fica de
  //    fora: a mae e para onde eles vao, e empurra-los para longe dela
  //    cancelaria o proprio comportamento que os define.
  for (const other of state.enemies) {
    if (other === enemy || !other.alive) continue;
    if (isBossArchetype(other.archetype)) continue;
    const dx = enemy.x - other.x;
    const dy = enemy.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d >= DEVOURER_BROOD_SPREAD || d <= 0.0001) continue;
    const push = (DEVOURER_BROOD_SPREAD - d) / DEVOURER_BROOD_SPREAD;
    mx += (dx / d) * push * 1.6;
    my += (dy / d) * push * 1.6;
  }

  // 3. A MAE. Um ANEL e nao um ponto, pela mesma razao da espreita do chefe:
  //    mirar o centro sem distancia de parada faz o corpo oscilar em cima do
  //    alvo, e aqui seriam catorze corpos oscilando no mesmo ponto.
  const mother = state.enemies.find((e) => e.alive && e.archetype === 'white_devourer');
  if (mother) {
    const span = distTo(enemy, mother);
    if (span > 0.0001) {
      const toward = normalized(mother.x - enemy.x, mother.y - enemy.y);
      // Positivo puxa para dentro, negativo empurra para fora: um so numero
      // resolve "longe demais" e "perto demais".
      const gap = Math.max(-1, Math.min(1, (span - DEVOURER_BROOD_RING) * 0.6));
      mx += toward.x * gap;
      my += toward.y * gap;
      // Uma volta lenta em torno dela, com o sentido saindo do id — a mesma
      // regra da espreita, e pelo mesmo motivo: sorteio nao sobrevive a uma
      // sala de co-op nem a uma re-simulacao de replay.
      const spin = enemy.id % 2 === 0 ? 1 : -1;
      mx += -toward.y * spin * 0.35;
      my += toward.x * spin * 0.35;
    }
  }

  const w = state.config.width;
  const len = Math.hypot(mx, my);
  if (len >= 0.0001) {
    const step = ARCHETYPES.devourer_brood.speed * dt;
    enemy.facing = { x: mx / len, y: my / len };
    // COM COLISAO, ao contrario da mae. Ela atravessa solido porque esta por
    // BAIXO dele — e o unico corpo do jogo que faz isso, e e por isso que
    // persegui-la nao e uma resposta. Os filhotes estao na superficie: um
    // filhote dentro da rocha e invisivel e nao pode ser pisado, e "podem ser
    // esmagados" e metade do que eles sao.
    moveEntity(state, enemy, (mx / len) * step, (my / len) * step);
  }
};

/**
 * Quantas vezes a separacao varre os pares por tick.
 *
 * Uma varredura resolve cada par que ela visita, mas nao o CONJUNTO: separar A
 * de B pode empurrar A para dentro de C, e C ja foi visitado. Duas varreduras a
 * mais desfazem o que a primeira criou, e a partir da terceira nao ha mais o que
 * desfazer nas densidades que este bando alcanca — medido em duzentos ticks do
 * ninho de verdade, com a mae puxando todos para o mesmo anel.
 *
 * Nao e um laco ate convergir: um monte suficientemente denso nao TEM solucao
 * (catorze corpos nao cabem num circulo de 0,34), e um laco assim gastaria o
 * tick inteiro tentando. Tres passadas e o que resolve o caso real; o
 * patologico nao acontece porque o nascimento espalha os corpos em espiral.
 */
const BROOD_SEPARATION_PASSES = 3;

/**
 * A NINHADA ACABA COM A MAE.
 *
 * Nao e zelo de limpeza: e a frase que a propria ninhada ja dizia e que o
 * codigo nao cumpria. O comentario do nascimento afirma "ela nasce com a mae,
 * existe so onde ela existe e some do mapa junto com ela", e a segunda metade
 * era falsa — morto o Devorador, catorze filhotes ficavam orfaos numa camara
 * limpa, ocupando vaga do teto de inimigos e parando bala, sem nada para
 * seguir.
 *
 * Eles MORREM, e nao desaparecem. O evento de morte de cada um vira o punhado
 * de particulas de sempre, e o que o jogador ve no instante em que o chefe cai
 * e a ninhada inteira se desfazendo junto — que e a unica leitura possivel de
 * uma coisa que so existia porque ela existia.
 *
 * Sem `damageEntity` pela mesma razao do pisao: isto nao e um abate. Nenhum
 * deles entra na contagem, aqui como la.
 */
const devourerBroodEnds = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (const b of state.enemies) {
    if (!b.alive || b.archetype !== 'devourer_brood') continue;
    b.hp = 0;
    b.alive = false;
    events.push({
      t: 'death',
      x: b.x,
      y: b.y,
      entity: b.id,
      archetype: b.archetype,
      facingX: b.facing.x,
      facingY: b.facing.y,
      tick: state.tick,
    });
  }
};

/**
 * SEPARA A NINHADA, depois que todos ja andaram.
 *
 * Roda no fim de `updateEnemies` e nao dentro do passo de cada filhote, e a
 * diferenca e o que faz a promessa valer. Dentro do passo, quem anda DEPOIS
 * volta a entrar no irmao que ja tinha sido resolvido — medido no ninho de
 * verdade, dois filhotes terminavam o tick 105 a 0,306 de uma distancia minima
 * de 0,34. Nao adianta corrigir a aritmetica de um par se o par pode ser
 * desfeito no mesmo tick por um terceiro que ainda nem se mexeu.
 *
 * Cada par e visitado UMA vez (`b.id > a.id`) e os DOIS corpos se movem meia
 * penetracao a partir da mesma medida. A versao anterior movia so um deles,
 * contando com a visita reciproca para a outra metade, e a conta nao fecha: na
 * segunda visita a penetracao ja encolheu para p/2 e o segundo corpo move p/4,
 * sobrando p/4.
 */
/** O corpo cabe nesse ponto? (dentro da moldura e fora da rocha) */
const free = (state: SurvivalState, ent: Entity, x: number, y: number): boolean =>
  x >= 1.5 &&
  y >= 1.5 &&
  x <= state.config.width - 1.5 &&
  y <= state.config.height - 1.5 &&
  !circleBlocked(state, x, y, ent.radius);

const separateBrood = (state: SurvivalState): void => {
  const nest = state.enemies.filter((e) => e.alive && e.archetype === 'devourer_brood');
  if (nest.length < 2) return;
  for (let pass = 0; pass < BROOD_SEPARATION_PASSES; pass++) {
    for (let i = 0; i < nest.length; i++) {
      for (let j = i + 1; j < nest.length; j++) {
        const a = nest[i];
        const b = nest[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (d >= min) continue;
        // Coincidentes por completo (o mesmo ponto de partida, ou um empurrao
        // que os alinhou): sem direcao para separar, a paridade do id decide —
        // o mesmo recurso que o sentido da volta ja usa, e pela mesma razao de
        // sala de co-op.
        const nx = d > 0.0001 ? dx / d : a.id % 2 === 0 ? 1 : -1;
        const ny = d > 0.0001 ? dy / d : 0;
        const half = (min - d) * 0.5;
        // O EMPURRAO RESPEITA A ROCHA. Estas atribuicoes sao diretas — nao
        // passam por `moveEntity` — e sem a checagem elas desfaziam a garantia
        // que o passo tinha acabado de dar: encostado numa quina, um filhote
        // separado do irmao ia parar DENTRO da parede, onde ninguem pode pisar
        // nele. "Podem ser esmagados" e metade do que eles sao.
        //
        // Quando um dos lados esbarra, o outro leva o deslocamento INTEIRO: a
        // separacao continua acontecendo, so que toda para o lado que tem
        // espaco. Com os dois presos nao ha para onde ir, e um tick sobreposto
        // encostado na parede e melhor que um corpo enterrado nela.
        const aFree = free(state, a, a.x + nx * half, a.y + ny * half);
        const bFree = free(state, b, b.x - nx * half, b.y - ny * half);
        const aStep = aFree ? (bFree ? half : min - d) : 0;
        const bStep = bFree ? (aFree ? half : min - d) : 0;
        if (aStep > 0 && free(state, a, a.x + nx * aStep, a.y + ny * aStep)) {
          a.x = a.x + nx * aStep;
          a.y = a.y + ny * aStep;
        }
        if (bStep > 0 && free(state, b, b.x - nx * bStep, b.y - ny * bStep)) {
          b.x = b.x - nx * bStep;
          b.y = b.y - ny * bStep;
        }
      }
    }
  }
};

/**
 * PISADO. O filhote que ficou debaixo de um pe morre, e morre em silencio.
 *
 * Sem `damageEntity`: ele nao tem dano a receber, nao ha numero para mostrar e
 * — sobretudo — isto NAO E UMA MORTE CONTABILIZAVEL. `recordKill` alimenta o
 * total de abates, e o total de abates alimenta o placar; catorze bichinhos
 * inofensivos por camara virariam pontos de graca para quem pisasse neles, e um
 * placar em que esmagar filhote rende mais que enfrentar o chefe esta medindo a
 * coisa errada.
 *
 * O evento de morte continua indo: e dele que sai o punhado de particulas, e o
 * jogador precisa VER que pisou em alguma coisa.
 */
const crushBrood = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): boolean => {
  for (const player of state.players) {
    if (!player.alive || !state.playerExtras[player.slot ?? 0].joined) continue;
    if (distTo(enemy, player) > enemy.radius + player.radius) continue;
    enemy.hp = 0;
    enemy.alive = false;
    events.push({
      t: 'death',
      x: enemy.x,
      y: enemy.y,
      entity: enemy.id,
      archetype: enemy.archetype,
      facingX: enemy.facing.x,
      facingY: enemy.facing.y,
      tick: state.tick,
    });
    return true;
  }
  return false;
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

  // A BOCA nao chega aqui: ela roda em `devourerMawTick`, antes dos portoes de
  // acao e de atordoamento de `updateEnemies`. Este ramo nao existe de
  // proposito — duplicar a chamada aqui faria a succao rodar duas vezes por
  // tick em todo tick que nao fosse atordoado.

  // MERGULHADO. Ele nao colide e nao e alcancado pelo terreno: esta POR BAIXO
  // dele. O que fica na superficie e a faixa de silica solta — o aviso de por
  // onde ele anda, e ao mesmo tempo a materia que o contra-jogo consome.
  if (!player) return;
  if (!diverEngaged(state, enemy, player, DEVOURER_BURROW_MIN_TICKS, events)) return;
  const span = distTo(enemy, player);
  // A DIRECAO DEGENERA quando ele pousa em cima do alvo, e isso nao e hipotese:
  // a queda do arco e MIRADA no jogador, entao o corpo comeca o mergulho
  // seguinte a distancia zero dele com alguma regularidade. Ali
  // `normalized(0, 0)` devolve (0, 0), e um passo multiplicado por (0, 0) e
  // parado — o chefe ficaria plantado dentro do jogador para sempre, sem rastro
  // e sem nunca voltar a sair.
  //
  // E o mesmo defeito que o arco ja teve (ver DEVOURER_LEAP_TURN) e a mesma
  // cura: quando nao ha de onde tirar uma direcao, usar a ultima valida.
  const toward =
    span > 0.0001
      ? normalized(player.x - enemy.x, player.y - enemy.y)
      : normalized(enemy.facing.x, enemy.facing.y);
  const step = DEVOURER_BURROW_SPEED * dt;

  // ELE ESPREITA, e nao persegue ate encostar.
  //
  // A versao anterior mirava a posicao do jogador sem distancia de parada, e o
  // resultado era medivel: a distancia estabilizava em 0,10 tile e oscilava
  // entre 0,10 e 0,13 a cada tick, com o chefe vibrando em cima dos pes do
  // Prospector. O relato de playtest foi exatamente isso — "fica dancando ao
  // redor dele".
  //
  // O ciclo dele ja pedia o contrario: o arco so le como arco a partir de
  // DEVOURER_LEAP_MIN_RANGE, e colado no alvo a decolagem tem de recuar por
  // baixo antes de subir. Perseguir ate zero brigava com o proprio salto.
  //
  // Agora o passo se divide em duas partes. A RADIAL corrige o erro de
  // distancia ate DEVOURER_STALK_RANGE — aproxima quando esta longe, afasta
  // quando esta perto demais — e nunca gasta mais que o proprio erro, senao ele
  // ultrapassaria o anel e voltaria a oscilar, so que num raio maior. O que
  // sobra do passo vai para a TANGENTE, e e ela que o mantem circulando: um
  // verme parado embaixo da areia nao deixa rastro, e o rastro e o unico aviso
  // que este chefe da.
  const gap = span - DEVOURER_STALK_RANGE;
  const radial = Math.max(-step, Math.min(step, gap));
  // O que sobrou do passo depois de corrigir a distancia, com teto: perto do
  // anel quase tudo vira volta, longe dele quase tudo vira aproximacao.
  const orbit = Math.sqrt(Math.max(0, step * step - radial * radial)) * DEVOURER_STALK_CIRCLE;
  // O SENTIDO da volta sai do id do corpo, e nao de um sorteio: ele tem de ser
  // o mesmo nas duas pontas de uma sala de co-op, e o mesmo em toda re-simulacao
  // de um replay.
  const spin = enemy.id % 2 === 0 ? 1 : -1;
  const side = { x: -toward.y * spin, y: toward.x * spin };
  const moveX = toward.x * radial + side.x * orbit;
  const moveY = toward.y * radial + side.y * orbit;
  const travel = Math.hypot(moveX, moveY);

  // A CARA SEGUE O MOVIMENTO, e nao o alvo.
  //
  // Ela apontava para o jogador (`toward`), e no anel de espreita isso e quase
  // perpendicular a marcha: chegando a `DEVOURER_STALK_RANGE` o erro de
  // distancia zera, a componente radial some e o passo inteiro vira tangente.
  // O chefe andava de lado com o rosto virado para o alvo.
  //
  // Isso sempre foi errado e passou a ser VISIVEL com o corpo segmentado. O
  // cliente escolhe a direcao do sprite da cabeca pela `facing` autoritativa e
  // deriva a tangente dos aneis da TRAJETORIA — quer dizer que a cabeca
  // encontrava um pescoco perpendicular a ela, exatamente na costura que o
  // corpo novo existe para esconder.
  //
  // O recuo continua sendo `toward`, e so quando nao ha marcha de onde tirar
  // uma direcao: um corpo parado precisa continuar olhando para algum lugar.
  const heading = travel > 0.0001 ? { x: moveX / travel, y: moveY / travel } : toward;
  enemy.facing = { ...heading };

  // Sem `moveEntity`: parede nao vale por baixo. Ele e o unico corpo do jogo
  // que atravessa solido, e e por isso que perseguir nao e uma resposta a ele.
  enemy.x = Math.max(1.5, Math.min(w - 1.5, enemy.x + moveX));
  enemy.y = Math.max(1.5, Math.min(state.config.height - 1.5, enemy.y + moveY));

  // O RASTRO: silica solta na faixa por onde passou, so em chao aberto e limpo.
  // Nao pinta por cima de nada — nem de fogo, nem de agua, nem do proprio
  // vidro: sobrescrever o vidro apagaria o contra-jogo do jogador com o
  // proprio corpo do chefe.
  //
  // A FAIXA E PERPENDICULAR A MARCHA, e nao a `side`.
  //
  // `side` e a tangente da orbita, e no anel de espreita ela E a direcao do
  // passo — as tres faixas caiam uma na frente da outra, em cima do proprio
  // caminho, e a banda de tres tiles que este rastro promete virava uma linha
  // de um. Nao e so feio: o rastro e o unico aviso deste chefe e a area que o
  // jogador tem para vitrificar antes de a boca abrir, entao a largura dele e
  // mecanica.
  const lane =
    travel > 0.0001 ? { x: -moveY / travel, y: moveX / travel } : { x: -toward.y, y: toward.x };
  for (let l = -DEVOURER_TRAIL_WIDTH; l <= DEVOURER_TRAIL_WIDTH; l++) {
    const tx = Math.floor(enemy.x + lane.x * l);
    const ty = Math.floor(enemy.y + lane.y * l);
    if (tx < 1 || ty < 1 || tx >= w - 1 || ty >= state.config.height - 1) continue;
    const i = ty * w + tx;
    if (state.solid[i] !== SOLID_NONE) continue;
    if (state.surface[i] !== SURF_NONE && state.surface[i] !== SURF_SCORCHED) continue;
    setSurface(state, i, SURF_SILT, 0);
  }

  // O DESLOCAMENTO sob a silica, como som: duas vezes por segundo, com a
  // posicao do corpo. E a faixa de areia para quem esta olhando para outro
  // lugar — o atrito passa de um lado a outro do estereo conforme a rota.
  if (
    state.bossRuntime.awake &&
    travel > 0.0001 &&
    state.tick % DEVOURER_BURROW_CUE_INTERVAL_TICKS === 0
  ) {
    events.push({
      t: 'boss_state',
      archetype: 'white_devourer',
      state: 'burrow',
      x: enemy.x,
      y: enemy.y,
    });
  }

  if (state.tick < enemy.nextActionAt) return;

  // A RAJADA ACABOU: o que vem depois da espera nao e outro arco, e a BOCA.
  //
  // A conta de arcos e o unico estado que separa os dois desfechos, e ela ja
  // existia: `devourerLand` a decrementa no POUSO, e um relogio mais longo
  // quando ela zera. Aqui so se le o que ela diz.
  if (state.bossRuntime.leapsLeft === DEVOURER_BURST_SPENT) {
    devourerOpenMaw(state, enemy, events);
    return;
  }

  // A EMERGENCIA. Ele mira onde o jogador VAI estar, e nao onde esta: o alvo
  // parado e o unico que a antecipacao erra, e isso e de proposito — quem le o
  // rastro e para de correr em linha reta ja esta jogando contra ele.
  const leadX = player.x + player.vx * DEVOURER_LEAD_SECONDS;
  const leadY = player.y + player.vy * DEVOURER_LEAD_SECONDS;
  // A cratera ANTERIOR e o que a mira tem de evitar: `leapToX/Y` guarda onde o
  // ultimo arco caiu, e repetir o tile e o que fazia tres arcos lerem como um
  // ataque piscando.
  //
  // A guarda de (0,0) e o unico jeito de dizer "ainda nao houve arco nenhum"
  // sem inventar um campo: nenhuma queda real pode cair ali, porque a busca de
  // ponto recusa a moldura do mapa (x < 1, y < 1). Sem ela, o zero de um
  // encontro que acabou de comecar viraria uma zona proibida no canto do mapa.
  const previous =
    state.bossRuntime.leapToX !== 0 || state.bossRuntime.leapToY !== 0
      ? { x: state.bossRuntime.leapToX, y: state.bossRuntime.leapToY, gap: DEVOURER_REPEAT_MIN_GAP }
      : null;
  const spot = devourerSurfacingSpot(
    state,
    Math.floor(leadX),
    Math.floor(leadY),
    DEVOURER_ERUPT_SEARCH,
    previous,
  );
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
  const reach = Math.min(DEVOURER_LEAP_MAX_RANGE, Math.max(DEVOURER_LEAP_MIN_RANGE, span));
  return devourerSurfacingSpot(
    state,
    Math.floor(landX + dir.x * reach),
    Math.floor(landY + dir.y * reach),
    DEVOURER_LAUNCH_SEARCH,
    // A DECOLAGEM NAO PODE CAIR PERTO DA QUEDA, e sem esta recusa ela caía.
    //
    // A busca aceita qualquer celula ate `DEVOURER_LAUNCH_SEARCH` aneis do ponto
    // ideal, e anel e distancia de Chebyshev: o anel 3 tem canto a 4,24 tiles.
    // Com o ideal no minimo (5), isso deixava a decolagem chegar a 0,76 do
    // ponto de queda — medido em playtest a 1,41 tile. Um arco desse tamanho e
    // o "salto de comprimento zero" que este chefe ja teve uma vez, e o
    // DEVOURER_LEAP_TURN foi posto justamente para ele nao voltar.
    //
    // Pior que feio: era um furo no contra-jogo. Vitrificar em volta empurra a
    // decolagem para longe — e essa e a segunda alavanca do vidro —, mas a
    // busca podia recuar para uma nadinha de areia colada no alvo e saltar dali
    // mesmo assim, com o disco inteiro vitrificado em volta.
    //
    // A recusa e a MESMA que separa as crateras de uma rajada, com outro raio:
    // o anel seguinte continua sendo consultado, entao ele acha uma decolagem
    // valida mais longe em vez de cancelar o arco.
    { x: landX, y: landY, gap: DEVOURER_LEAP_MIN_RANGE },
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
  devourerSlam(state, enemy, events);
  // A rajada decide o que vem depois da cratera. Ainda ha salto na conta: ele
  // mergulha de novo por pouco tempo e arma o proximo arco. Acabou: a BOCA abre.
  //
  // O decremento acontece aqui, no pouso, e nao na decolagem — um arco que o
  // vidro negou nunca chegou a ser um ataque, e cobrar da conta um salto que
  // nao aconteceu deixaria o jogador ganhar a janela sem ter esquivado nada.
  state.bossRuntime.leapsLeft -= 1;
  // Em todo caso ele volta para BAIXO. O que muda e quanto tempo ele fica la:
  // com arco na conta, o vao entre os golpes; sem arco nenhum, o tempo de o
  // corpo inteiro entrar na areia mais o silencio antes de o chao abrir.
  //
  // A boca NAO abre mais aqui, e essa e a mudanca. Ela abria no tick do
  // terceiro pouso — o corpo caia e a cratera dentada ja estava no mesmo quadro
  // —, e o jogador nao tinha como separar "ele pousou" de "a janela abriu",
  // duas coisas que pedem respostas opostas: sair de perto, e chegar perto.
  // Agora quem a abre e o ramo mergulhado, quando o relogio abaixo vence.
  enemy.mood = DEVOURER_BURROWED;
  if (state.bossRuntime.leapsLeft > 0) {
    enemy.nextActionAt = state.tick + DEVOURER_HOP_GAP_TICKS;
    return;
  }
  // A rajada acabou, e a conta passa a DIZER isso — ver DEVOURER_BURST_SPENT.
  // Zero nao serviria: zero e o que um chefe recem-nascido tem, e a decolagem
  // ja o trata como "comece uma rajada inteira".
  state.bossRuntime.leapsLeft = DEVOURER_BURST_SPENT;
  enemy.nextActionAt = state.tick + DEVOURER_MAW_SETTLE_TICKS;
};

/**
 * O CHAO SE ABRE. Chamada de um so lugar: o fim da espera do ramo mergulhado.
 *
 * Ele nao para de espreitar durante a espera, e isso e deliberado — a boca abre
 * onde ele CHEGOU, e nao onde o terceiro arco caiu. O que a faixa de silica
 * conta enquanto ele cava e exatamente a pergunta que a janela vai cobrar:
 * "onde ele esta agora?". Se ela abrisse sempre na ultima cratera, o rastro dos
 * ultimos dois segundos nao diria nada.
 */
const devourerOpenMaw = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  enemy.mood = DEVOURER_MAW;
  enemy.nextActionAt = state.tick + DEVOURER_MAW_TICKS;
  // O instante em que a boca abriu. Dele saem o alcance da sucao, a areia ja
  // engolida e o desenho do vortice no cliente — as duas pontas integram a
  // mesma rampa a partir deste unico numero (ver `maw.ts`).
  state.bossRuntime.mawOpenedAt = state.tick;
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: DEVOURER_ERUPT_RADIUS });
  // A boca e as duas coisas ao mesmo tempo, e as duas viajam: o golpe (o
  // vortice que arrasta) e a JANELA DE DANO (o corpo fora do elemento dele).
  events.push({
    t: 'boss_state',
    archetype: 'white_devourer',
    state: 'maw_open',
    x: enemy.x,
    y: enemy.y,
  });
  events.push({
    t: 'boss_vulnerable',
    archetype: 'white_devourer',
    x: enemy.x,
    y: enemy.y,
    open: true,
  });
};

/**
 * UM TICK DE BOCA ABERTA: engolir areia, arrastar corpos, devorar quem chegou.
 *
 * A ordem importa e e esta. A areia primeiro porque ela e o TELEGRAFO: o chao
 * limpo que sobra desenha o alcance do tick, e desenhar depois de arrastar
 * mostraria o aviso um tick atrasado em relacao a coisa que ele avisa. A
 * mordida por ultimo porque ela le a posicao JA arrastada — quem foi puxado
 * para dentro da garganta neste tick e comido neste tick, e nao no seguinte.
 *
 * Ele nao se mexe em nenhum ramo. A boca nao persegue: ela espera, e o mundo e
 * que anda ate ela.
 */
/**
 * A JANELA INTEIRA de boca aberta, incluindo o fim dela.
 *
 * Existe separada de `devourerStep` porque nao pode ser chamada de la: o fluxo
 * de IA fica atras de dois portoes (acao em curso, e atordoamento), e a boca
 * nao pode ficar atras de nenhum dos dois. Ver a chamada em `updateEnemies`,
 * onde o motivo esta escrito.
 */
export const devourerMawTick = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): void => {
  if (state.tick >= enemy.nextActionAt) {
    // A boca FECHA, e ele volta para baixo com a rajada recomposta.
    enemy.mood = DEVOURER_BURROWED;
    state.bossRuntime.mawOpenedAt = -1;
    state.bossRuntime.leapsLeft = DEVOURER_LEAPS_PER_CYCLE;
    enemy.nextActionAt = state.tick + DEVOURER_BURROW_MIN_TICKS;
    events.push({
      t: 'boss_state',
      archetype: 'white_devourer',
      state: 'maw_close',
      x: enemy.x,
      y: enemy.y,
    });
    events.push({
      t: 'boss_vulnerable',
      archetype: 'white_devourer',
      x: enemy.x,
      y: enemy.y,
      open: false,
    });
    return;
  }
  devourerMawStep(state, enemy, events);
};

const devourerMawStep = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const opened = state.bossRuntime.mawOpenedAt;
  const reach = mawReach(state.tick, opened);
  if (reach <= 0) return;

  devourerMawIntake(state, enemy, reach);

  // TUDO e puxado, e o "tudo" e literal: jogador e bicho, com a mesma conta.
  //
  // Incluir a fauna nao e enfeite tematico — e o que impede a janela de virar
  // uma armadilha unilateral. O jogador que arrasta um bando para dentro do
  // raio da boca resolve os dois problemas de uma vez, e essa jogada so existe
  // porque a sucao nao pergunta de quem e o corpo. Chefes ficam de fora: uma
  // camara com dois donos e um caso que este jogo nao tem, e o unico efeito de
  // permitir seria um Devorador se arrastando para dentro de si mesmo.
  for (const victim of state.players) {
    if (!victim.alive || !state.playerExtras[victim.slot ?? 0].joined) continue;
    devourerMawDrag(state, enemy, victim, reach);
  }
  for (const victim of state.enemies) {
    if (!victim.alive || victim === enemy || isBossArchetype(victim.archetype)) continue;
    devourerMawDrag(state, enemy, victim, reach);
  }

  // A GARGANTA so cobra depois de EXISTIR. Enquanto o alcance nao chegou ao raio
  // dela, a boca ainda esta se abrindo e o centro e uma cratera como qualquer
  // outra — que e o que ele acabou de ser.
  //
  // Isto nao e uma folga de bondade, e a correcao de um caso que sem ela seria
  // fatal e injusto: a queda do arco e mirada NO JOGADOR, entao a janela abre
  // com o corpo dele em cima do centro. Uma garganta valendo desde o primeiro
  // tick mataria, sem sinal e sem tempo de resposta, exatamente quem acabou de
  // levar a cratera — e a unica licao possivel seria "nao esteja onde o chefe
  // decidiu cair", que nao e uma licao.
  //
  // O vao que sobra e o primeiro segundo da janela: tempo de sair de cima do
  // centro andando, com o anel do vortice crescendo a vista para dizer que ele
  // vem.
  if (reach >= DEVOURER_MAW_BITE_RADIUS) devourerMawBite(state, enemy, events);
};

/**
 * A AREIA SENDO SUGADA: toda silica solta dentro do alcance vira chao limpo.
 *
 * Isto e o desenho do raio, feito com a materia do proprio estrato. A borda
 * entre areia e chao limpo diz — sem HUD, sem numero e sem uma linha de cliente
 * — exatamente ate onde a sucao chega neste tick, e como o alcance cresce com o
 * tempo, a borda que avanca pelo chao E o cronometro: ela toca os pes do
 * jogador no mesmo tick em que a sucao o alcanca.
 *
 * Sem cota por tick, e a ausencia dela e o ponto: quem paga o ritmo e o
 * ALCANCE. Um segundo relogio por cima so poderia atrasar a borda em relacao a
 * sucao que ela promete desenhar, que e a unica coisa que este efeito nao pode
 * fazer.
 *
 * E ela come de verdade: silica engolida nao vitrifica mais. Quem guardou o
 * rastro do verme "para depois" descobre que depois ele foi comido — e essa e a
 * pressao que impede o contra-jogo de ser adiado de graca. O VIDRO nao e
 * tocado, pela regra de sempre: o chefe nao desfaz a decisao do jogador.
 */
const devourerMawIntake = (state: SurvivalState, enemy: Entity, reach: number): void => {
  const w = state.config.width;
  const h = state.config.height;
  const r = Math.ceil(reach);
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      if (Math.hypot(x + 0.5 - enemy.x, y + 0.5 - enemy.y) > reach) continue;
      const i = y * w + x;
      if (state.surface[i] !== SURF_SILT) continue;
      setSurface(state, i, SURF_NONE, 0);
    }
  }
};

/**
 * UM CORPO sendo arrastado por um tick.
 *
 * Em sub-passos com colisao, como o eletroima do Coveiro e pelo mesmo motivo:
 * um puxao resolvido de uma vez atravessaria parede, e quem tem uma quina entre
 * si e a boca precisa parar NELA. Cobertura e a unica saida da garganta que nao
 * gasta esquiva, e ela so existe se cada passo do arrasto perguntar ao terreno.
 *
 * O chao consultado e o da VITIMA e nao o do caminho: vidro segura os pes de
 * quem esta em cima dele (DEVOURER_MAW_GLASS_GRIP), e e por isso que vitrificar
 * antes da janela e a resposta a este golpe.
 */
const devourerMawDrag = (
  state: SurvivalState,
  enemy: Entity,
  victim: Entity,
  reach: number,
): void => {
  const dist = distTo(enemy, victim);
  if (dist > reach || dist <= 0.0001) return;
  const w = state.config.width;
  const fx = Math.floor(victim.x);
  const fy = Math.floor(victim.y);
  const onGlass =
    fx >= 0 &&
    fy >= 0 &&
    fx < w &&
    fy < state.config.height &&
    state.surface[fy * w + fx] === SURF_GLASS;
  const speed = mawPull(dist, state.tick, state.bossRuntime.mawOpenedAt, onGlass);
  if (speed <= 0) return;
  const travel = speed / TICK_HZ;
  const dir = normalized(enemy.x - victim.x, enemy.y - victim.y);
  const steps = Math.max(1, Math.ceil(travel / DEVOURER_MAW_PULL_STEP));
  const step = travel / steps;
  for (let s = 0; s < steps; s++) {
    const moved = moveEntity(state, victim, dir.x * step, dir.y * step);
    // Um eixo travado ja encerra o arrasto. Testar os dois juntos deixaria o
    // corpo raspar na parede contornando obstaculo curto ate a garganta — a
    // quina deixaria de proteger justamente no caso comum. Mesma correcao que o
    // eletroima do Coveiro ja levou.
    if (moved.blockedX || moved.blockedY) break;
  }
};

/**
 * A GARGANTA: dali para dentro nao ha corpo, ha boca.
 *
 * Cobrada uma vez por tick e para todo mundo — jogador e bicho —, com a mesma
 * sentenca. DEVOURER_MAW_BITE_DAMAGE e o dobro da vida cheia do Prospector de
 * proposito: a boca precisa ser uma REGRA e nao um risco calculavel, senao
 * atravessar a garganta com vida cheia vira mais barato que reposicionar e o
 * golpe inteiro degenera num dano a mais.
 *
 * Ninguem chega aqui de surpresa. O caminho ate a garganta e segundos de
 * arrasto, com a areia inteira apontando para onde e a linha do sem-volta
 * anunciada muito antes — e sobre vidro, ou atras de uma quina, ele nunca se
 * fecha.
 */
const devourerMawBite = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  const cause: DamageCause = {
    kind: 'enemy_contact',
    archetype: 'white_devourer',
    elite: enemy.elite,
  };
  for (const victim of state.players) {
    if (!victim.alive || !state.playerExtras[victim.slot ?? 0].joined) continue;
    if (distTo(enemy, victim) > DEVOURER_MAW_BITE_RADIUS) continue;
    damageEntity(state, victim, DEVOURER_MAW_BITE_DAMAGE, events, cause);
  }
  for (const victim of state.enemies) {
    if (!victim.alive || victim === enemy || isBossArchetype(victim.archetype)) continue;
    if (distTo(enemy, victim) > DEVOURER_MAW_BITE_RADIUS) continue;
    damageEntity(state, victim, DEVOURER_MAW_BITE_DAMAGE, events, cause);
  }
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
  avoid: { x: number; y: number; gap: number } | null = null,
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
        // A CRATERA ANTERIOR nao serve de novo. Sem esta recusa, um alvo parado
        // fazia os tres arcos da rajada caírem quase no mesmo tile: a mira sai
        // da posicao prevista do jogador, e um jogador que nao anda tem sempre
        // a mesma posicao prevista. Tres crateras empilhadas nao sao tres
        // ataques, sao um ataque piscando — e foi assim que o playtest leu
        // ("fica pulando que nem um louco").
        //
        // Recusar aqui, e nao no chamador, e o que garante que a busca CONTINUE
        // em vez de desistir: o anel seguinte e consultado normalmente, entao
        // ele acha outro ponto perto em vez de cancelar o arco.
        if (avoid && Math.hypot(x + 0.5 - avoid.x, y + 0.5 - avoid.y) < avoid.gap) continue;
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
 * A ONDA DE CHOQUE do pouso: o anel de fora da cratera.
 *
 * Separada de `devourerCrater` por duas razoes, e as duas sao de comportamento.
 *
 * Ela e SO do pouso. A decolagem chama a cratera e nao chama esta: sair da
 * areia empurra o chao para os lados, desabar com seis tiles de corpo e outra
 * coisa — e e a unica das duas que o jogador ve chegando, entao e a unica que
 * pode cobrar mais caro sem virar dano nao anunciado.
 *
 * E ela nao toca no CHAO. A cratera revira a superficie (fragil que cede, areia
 * onde havia rocha limpa) e isso e mecanica, nao enfeite: cada tile que ela
 * transforma em areia e um tile onde a boca vai agarrar de verdade mais tarde,
 * porque o vidro e que solta. Espalhar essa transformacao por um anel 40% maior
 * mudaria o contra-jogo da janela inteira de lado. O que a onda faz e o que uma
 * onda faz: bate em quem esta em pe perto dela.
 *
 * Quem ja levou a cratera nao leva esta. Nao e um segundo golpe empilhado no
 * mesmo tick — e o degrau de FORA do mesmo golpe, e um jogador tem de sair
 * daqui com um numero na tela, nao com dois.
 */
const devourerSlam = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  for (const player of state.players) {
    if (!player.alive || !state.playerExtras[player.slot ?? 0].joined) continue;
    const d = distTo(enemy, player);
    if (d <= DEVOURER_ERUPT_RADIUS || d > DEVOURER_SLAM_RADIUS) continue;
    damageEntity(state, player, DEVOURER_SLAM_DAMAGE, events, {
      kind: 'enemy_contact',
      archetype: 'white_devourer',
      elite: enemy.elite,
    });
  }
  // O pulso largo, para o cliente desenhar o alcance de verdade. A cratera ja
  // empurrou o dela; este e o anel de fora, e sem ele o efeito na tela ficaria
  // menor que a area que machucou — que e a pior forma de um ataque mentir.
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: DEVOURER_SLAM_RADIUS });
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
/**
 * A REDE, em camadas: quem o canto alcanca DIRETO, e quem os cristais passam
 * adiante.
 *
 * A versao anterior lia um disco e parava nele, e era esse o defeito do
 * encontro: com o canto morrendo em nove tiles e o bolt do Prospector chegando
 * a dezoito, existia uma faixa inteira em que o jogador matava um chefe de 620
 * de vida sem que nada na sala respondesse. Ele nao estava dificil nem facil —
 * ele estava fora da propria mecanica.
 *
 * Agora o alcance nao e do CHEFE, e da CATEDRAL. Os cristais ao redor dele sao
 * a camada zero; cada um deles passa o canto aos cristais vizinhos, e assim por
 * diante. Uma nave conectada responde inteira a um canto que comecou no meio
 * dela, e e por isso que a promessa "a Catedral responde" so agora e verdade.
 *
 * E o contra-jogo fica melhor em vez de pior, que e o teste de um alcance maior
 * estar certo: quebrar cristal deixou de ser so "menos um cristal" e passou a
 * ser CORTAR A CADEIA — um vao aberto no lugar certo desliga tudo o que vinha
 * depois dele. O jogador escolhe entre gastar tiro apagando a nave (que e a luz
 * e o recurso do setor) ou lutar dentro dela.
 *
 * A busca e por indice crescente dentro de cada camada: duas maquinas da mesma
 * sala precisam armar os MESMOS cristais na mesma ordem.
 */
const archcantorChain = (state: SurvivalState, enemy: Entity): number[][] => {
  const w = state.config.width;
  const h = state.config.height;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  const seen = new Set<number>();
  const layers: number[][] = [];

  const seeds: number[] = [];
  const r = ARCHCANTOR_PULSE_RADIUS;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_CRYSTAL || seen.has(i)) continue;
      // O TETO vale desde a camada zero.
      //
      // Ele so aparecia no laco das camadas seguintes, e as seeds entravam sem
      // consulta: numa Catedral densa o release sozinho armava muito mais que o
      // orcamento — justamente no caso em que o orcamento existe para proteger,
      // porque cada cristal armado carrega as quatro aberturas coladas nele.
      if (seen.size >= ARCHCANTOR_CRYSTAL_BUDGET) continue;
      seen.add(i);
      seeds.push(i);
    }
  }
  if (seeds.length === 0) return layers;
  layers.push(seeds);

  const reach = ARCHCANTOR_CHAIN_REACH;
  while (layers.length < ARCHCANTOR_CHAIN_LAYERS && seen.size < ARCHCANTOR_CRYSTAL_BUDGET) {
    const frontier = layers[layers.length - 1];
    const next: number[] = [];
    for (const cell of frontier) {
      if (seen.size >= ARCHCANTOR_CRYSTAL_BUDGET) break;
      const fx = cell % w;
      const fy = (cell - fx) / w;
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const x = fx + dx;
          const y = fy + dy;
          if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
          const i = y * w + x;
          if (state.solid[i] !== SOLID_CRYSTAL || seen.has(i)) continue;
          if (seen.size >= ARCHCANTOR_CRYSTAL_BUDGET) continue;
          seen.add(i);
          next.push(i);
        }
      }
    }
    if (next.length === 0) break;
    layers.push(next);
  }
  return layers;
};

/** As aberturas coladas nos cristais de uma camada — o que de fato descarrega. */
const archcantorLayerCells = (state: SurvivalState, layer: readonly number[]): number[] => {
  const w = state.config.width;
  const charged = new Set<number>();
  for (const i of layer) {
    for (const n of [i - 1, i + 1, i - w, i + w]) {
      if (n < 0 || n >= state.solid.length) continue;
      if (state.solid[n] === SOLID_NONE) charged.add(n);
    }
  }
  return [...charged];
};

/**
 * Quao GRANDE e a frase que vai sair: a fracao das camadas que a rede
 * alcanca. Viaja em `boss_windup`/`boss_attack.intensity` para o cliente
 * escolher entre a frase que resolve e o tritono — uma Catedral quase vazia
 * canta curto; uma cheia canta a nave inteira, e o som tem de prometer isso.
 */
const archcantorSongIntensity = (state: SurvivalState, enemy: Entity): number =>
  Math.min(1, archcantorChain(state, enemy).length / ARCHCANTOR_CHAIN_LAYERS);

const archcantorPulse = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  // O release descarrega so a camada ZERO — os cristais que o corpo dele
  // alcanca. As de fora saem uma por vez em `archcantorChainStride`, e e isso
  // que faz o canto ler como ONDA atravessando a nave em vez de um estouro
  // simultaneo: da para ver a descarga vindo, e da para correr contra ela.
  const layers = archcantorChain(state, enemy);
  if (layers.length > 0) {
    const cells = archcantorLayerCells(state, layers[0]);
    if (cells.length > 0) chargeCells(state, cells, events, { source: 'enemy', owner: enemy.id });
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: ARCHCANTOR_PULSE_RADIUS });
};

/**
 * A ONDA: uma camada de cristal por passo, para fora.
 *
 * Conduzida pelo relogio da acao, como a frente da Supernova e pelo mesmo
 * motivo — a acao ja viaja no snapshot e ja entra no hash, entao a onda
 * reproduz igual num cliente que reconectou no meio dela.
 *
 * A camada e recalculada a cada passo em vez de guardada, e isso e mecanica e
 * nao economia: um cristal quebrado NO MEIO da onda deixa de passar o canto
 * adiante naquele mesmo instante. Cortar a cadeia com a descarga ja a caminho e
 * a jogada mais cara e mais bonita que a Catedral permite.
 */
const archcantorChainStride = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): void => {
  const action = enemy.action;
  if (!action) return;
  const elapsed = state.tick - action.releaseAt;
  if (elapsed <= 0 || elapsed % ARCHCANTOR_CHAIN_STEP_TICKS !== 0) return;
  const layer = elapsed / ARCHCANTOR_CHAIN_STEP_TICKS;
  const layers = archcantorChain(state, enemy);
  if (layer >= layers.length) return;
  const cells = archcantorLayerCells(state, layers[layer]);
  if (cells.length === 0) return;
  chargeCells(state, cells, events, { source: 'enemy', owner: enemy.id });
  // CADA CAMADA que responde e uma nota do acorde. A posicao e a de um
  // cristal da camada (o primeiro), para o som andar pela nave junto com a
  // onda; `intensity` cai com a distancia do corpo — a camada de fora e a
  // nota mais fraca, e e a que o jogador consegue cortar a tempo.
  const w = state.config.width;
  events.push({
    t: 'boss_state',
    archetype: 'archcantor',
    state: 'resonance',
    x: (cells[0] % w) + 0.5,
    y: Math.floor(cells[0] / w) + 0.5,
    intensity: 1 - layer / ARCHCANTOR_CHAIN_LAYERS,
  });
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
type ProtectiveBubble = { x: number; y: number; radius: number };

const bubblePositionValid = (
  state: SurvivalState,
  boss: Entity,
  bubble: ProtectiveBubble,
  placed: readonly ProtectiveBubble[],
  reachable: ReadonlySet<number>,
): boolean => {
  const w = state.config.width;
  const h = state.config.height;
  if (bubble.x < 2 || bubble.y < 2 || bubble.x >= w - 2 || bubble.y >= h - 2) return false;
  if (Math.hypot(bubble.x - boss.x, bubble.y - boss.y) < boss.radius + bubble.radius + 0.65)
    return false;
  if (
    placed.some(
      (other) =>
        Math.hypot(bubble.x - other.x, bubble.y - other.y) < bubble.radius + other.radius + 0.5,
    )
  )
    return false;
  if (!reachable.has(Math.floor(bubble.y) * w + Math.floor(bubble.x))) return false;
  for (
    let y = Math.floor(bubble.y - bubble.radius);
    y <= Math.floor(bubble.y + bubble.radius);
    y++
  ) {
    for (
      let x = Math.floor(bubble.x - bubble.radius);
      x <= Math.floor(bubble.x + bubble.radius);
      x++
    ) {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      if (
        Math.hypot(x + 0.5 - bubble.x, y + 0.5 - bubble.y) <= bubble.radius &&
        state.solid[y * w + x] !== SOLID_NONE
      )
        return false;
    }
  }
  return (
    delugeDepth(state, Math.floor(bubble.y) * w + Math.floor(bubble.x)) >= PROSPECTOR_HEAD_HEIGHT
  );
};

/**
 * Dois abrigos deterministas e deliberadamente assimetricos: o primeiro tende
 * a ficar longe do chefe; o segundo, mais perto dele. A rotacao sai da seed e
 * da sequencia do golpe, sem Math.random e sem quebrar replay/network.
 */
const protectiveBubblePositions = (state: SurvivalState, boss: Entity): ProtectiveBubble[] => {
  const out: ProtectiveBubble[] = [];
  const w = state.config.width;
  const reachable = new Set<number>();
  const queue: number[] = [];
  for (const player of state.players) {
    const extra = state.playerExtras[player.slot ?? 0];
    if (!player.alive || !extra.joined || extra.downed) continue;
    const cell = Math.floor(player.y) * w + Math.floor(player.x);
    if (!reachable.has(cell)) {
      reachable.add(cell);
      queue.push(cell);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const x = cell % w;
    const y = Math.floor(cell / w);
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= state.config.height - 1) continue;
      const next = ny * w + nx;
      if (reachable.has(next) || state.solid[next] !== SOLID_NONE) continue;
      reachable.add(next);
      queue.push(next);
    }
  }
  const base =
    (((state.config.seed ^ (state.bossRuntime.leviathanShockSeq * 0x9e3779b9)) >>> 0) % 6283) /
    1000;
  const rings = [6.2, 3.4];
  for (let slot = 0; slot < 2; slot++) {
    for (let n = 0; n < 40; n++) {
      const angle = base + slot * 2.17 + n * 2.399963;
      const radius = rings[slot] + ((n % 5) - 2) * 0.35;
      const bubble = {
        x: Math.floor(boss.x + Math.cos(angle) * radius) + 0.5,
        y: Math.floor(boss.y + Math.sin(angle) * radius) + 0.5,
        radius: LEVIATHAN_PROTECTIVE_BUBBLE_RADIUS,
      };
      if (!bubblePositionValid(state, boss, bubble, out, reachable)) continue;
      out.push(bubble);
      break;
    }
  }
  // Arenas muito recortadas: busca exaustiva, ainda determinista, garante o par.
  for (let i = 0; out.length < 2 && i < state.surface.length; i++) {
    const idx = (i * 97 + state.bossRuntime.leviathanShockSeq * 53) % state.surface.length;
    const bubble = {
      x: (idx % w) + 0.5,
      y: Math.floor(idx / w) + 0.5,
      radius: LEVIATHAN_PROTECTIVE_BUBBLE_RADIUS,
    };
    if (bubblePositionValid(state, boss, bubble, out, reachable)) out.push(bubble);
  }
  return out;
};

const playerProtectedByBubble = (player: Entity, bubble: ProtectiveBubble): boolean =>
  Math.hypot(player.x - bubble.x, player.y - bubble.y) + player.radius <= bubble.radius;

const leviathanMassiveDischarge = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): void => {
  const bubbles = state.bossRuntime.protectiveBubbles.map((bubble) => ({ ...bubble }));
  for (const player of state.players) {
    const extra = state.playerExtras[player.slot ?? 0];
    if (!player.alive || !extra.joined || extra.downed) continue;
    if (!bubbles.some((bubble) => playerProtectedByBubble(player, bubble))) {
      damageEntity(state, player, LEVIATHAN_SHOCK_DAMAGE, events, { kind: 'leviathan_discharge' });
    }
  }
  events.push({
    t: 'leviathan_discharge',
    x: enemy.x,
    y: enemy.y,
    radius: Math.hypot(state.config.width, state.config.height),
    bubbles,
  });
  state.bossRuntime.protectiveBubbles = [];
  state.bossRuntime.leviathanShockAt = -1;
  state.bossRuntime.leviathanShockRecoverAt = state.tick + LEVIATHAN_SHOCK_COOLDOWN_TICKS;
  // A RECUPERACAO: bolhas escapando e um chamado quebrado, descendente. E o
  // "o mundo mudou" da descarga — ela ja passou, e ele esta gasto.
  events.push({
    t: 'boss_state',
    archetype: 'sheet_leviathan',
    state: 'recover',
    x: enemy.x,
    y: enemy.y,
  });
};

const startLeviathanMassiveShock = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): boolean => {
  if (
    state.bossRuntime.leviathanShockAt >= 0 ||
    state.tick < state.bossRuntime.leviathanShockRecoverAt
  )
    return false;
  state.bossRuntime.leviathanShockSeq++;
  const bubbles = protectiveBubblePositions(state, enemy);
  if (bubbles.length !== 2) return false;
  state.bossRuntime.protectiveBubbles = bubbles;
  state.bossRuntime.leviathanShockAt = state.tick + LEVIATHAN_SHOCK_WINDUP_TICKS;
  startAction(
    state,
    enemy,
    'massive_shock',
    enemy.facing,
    LEVIATHAN_SHOCK_WINDUP_TICKS,
    LEVIATHAN_SHOCK_RECOVERY_TICKS,
    events,
  );
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: 5 });
  return true;
};

const leviathanStep = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity | null,
  dt: number,
  events: SemanticEvent[],
): void => {
  const w = state.config.width;
  // O DILUVIO e a primeira coisa que ele consulta, e nao um ramo do mergulho:
  // uma carta que muda o mapa nao pode ficar esperando a fase certa do ciclo
  // para sair. Cruzou o limiar com o encontro em curso, ela sai.
  if (player && state.bossRuntime.awake) leviathanDeluge(state, enemy, events);
  if (
    player &&
    delugeDepth(state, Math.floor(player.y) * w + Math.floor(player.x)) >= PROSPECTOR_HEAD_HEIGHT
  ) {
    if (startLeviathanMassiveShock(state, enemy, events)) return;
  }
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
    if (
      distTo(enemy, player) < enemy.radius + player.radius + 0.2 &&
      state.tick >= enemy.contactReadyAt
    ) {
      enemy.contactReadyAt = state.tick + def.contactCooldown;
      startAction(state, enemy, 'contact', toward, 6, 4, events, player.id);
      return;
    }
    moveEntity(
      state,
      enemy,
      toward.x * LEVIATHAN_SURFACE_SPEED * dt,
      toward.y * LEVIATHAN_SURFACE_SPEED * dt,
    );
    return;
  }

  if (!player) return;
  if (!diverEngaged(state, enemy, player, LEVIATHAN_DIVE_MIN_TICKS, events)) return;
  // A PRESENCA: chamados longos, graves e espacados, de algo enorme
  // navegando fora da camera. O canto CALA durante a carga da descarga — o
  // silencio subito e parte do aviso, e por isso o portao esta aqui e nao no
  // cliente.
  if (state.bossRuntime.leviathanShockAt < 0 && state.tick % LEVIATHAN_CALL_INTERVAL_TICKS === 0) {
    events.push({
      t: 'boss_state',
      archetype: 'sheet_leviathan',
      state: 'call',
      x: enemy.x,
      y: enemy.y,
    });
  }
  const toward = normalized(player.x - enemy.x, player.y - enemy.y);
  enemy.facing = { ...toward };
  // Submerso ele anda pela LAMINA, e nao pelo chao: passos que continuem em
  // agua. Sem lamina para onde ir ele guarda a margem — que e exatamente a
  // leitura que o jogador precisa ter dele.
  // Submerso no proprio elemento, ele desliza um pouco mais rapido — e nada em
  // QUALQUER lugar, que e o presente de verdade do Diluvio.
  const step =
    LEVIATHAN_SWIM_SPEED * dt * (delugeFront(state) >= 0 ? LEVIATHAN_DELUGE_SPEED_SCALE : 1);
  const wet = (mx: number, my: number): boolean => {
    const i = Math.floor(enemy.y + my) * w + Math.floor(enemy.x + mx);
    return i >= 0 && i < state.surface.length && isConductiveCell(state, i);
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
    //
    // Metade, e nao a luta inteira: negada a emergencia, ele EMPURRA a lamina
    // para o lado do alvo. Ver `leviathanSurge`.
    enemy.nextActionAt = state.tick + LEVIATHAN_DIVE_MIN_TICKS;
    leviathanSurge(state, enemy, player, events);
    return;
  }
  enemy.x = (spot % w) + 0.5;
  enemy.y = Math.floor(spot / w) + 0.5;
  startAction(state, enemy, 'erupt', toward, LEVIATHAN_BREACH_WINDUP_TICKS, 6, events, player.id);
};

/**
 * A ENCHENTE: negada a emergencia, o lencol AVANCA.
 *
 * O que ela conserta: sem ela, chao seco nao atrasava o Leviata, apagava o
 * Leviata. Ele so anda e so emerge por superficie condutiva, entao um jogador
 * de pe em rocha seca fora do alcance da lamina nao tinha o que esquivar —
 * ficava atirando num chefe de 800 de vida sem uma unica resposta possivel. O
 * playtest resumiu em duas palavras: facil de kitar.
 *
 * O que ela NAO e: um golpe. Ela nao causa dano, nao tem telegrafo e nao mira.
 * Ela move a FRONTEIRA — o refugio de agora e o territorio dele daqui a pouco,
 * e a pressao que isso cria e a de ter de continuar recuando para um mapa que
 * esta encolhendo. Um chefe de aquifero avanca alagando; e o unico verbo que
 * ele tem.
 *
 * O preco e simetrico e e o que a mantem justa: a agua dele conduz nos dois
 * sentidos. Quem deixa a enchente chegar recebe junto o chao em que a propria
 * descarga o atordoa — a mesma materia e a ameaca e a ferramenta.
 *
 * Pinta so sobre chao limpo ou cinza, pela mesma regra do rastro do Devorador:
 * um chefe que sobrescrevesse gelo, fogo ou vidro estaria apagando decisao do
 * jogador com o proprio corpo.
 */
/**
 * O DILUVIO: a carta unica do Leviata, e a virada do encontro.
 *
 * Uma vez, sob PRESSAO — e a ordem importa. A primeira metade da luta e
 * territorial: chao seco o atrasa, a enchente incremental avanca tile a tile, e
 * o jogador aprende que o mapa e o assunto. O Diluvio e a resposta do Aquifero
 * a quem venceu esse jogo: ele para de disputar margem e levanta o lencol
 * inteiro. Depois dele nao ha margem, e a pergunta do encontro troca de "onde
 * ele NAO alcanca" para "de onde eu solto a corrente".
 *
 * E ele NAO e so um buff. Quem alaga o setor inteiro entrega ao jogador um
 * condutor do tamanho do setor inteiro — e o Leviata e o unico chefe do jogo
 * que a propria descarga atordoa. A carta que o liberta e a mesma que o expoe;
 * o que decide quem ganha o troco e a distancia (ver DELUGE_SHOCK_FULL_RANGE).
 *
 * `phasesFired` guarda que ela ja saiu: uma fase de uma vez nao volta atras nem
 * se o chefe for curado, e o bit ja viaja no snapshot e ja entra no hash.
 */
const leviathanDeluge = (state: SurvivalState, enemy: Entity, events: SemanticEvent[]): void => {
  if ((state.bossRuntime.phasesFired & BOSS_PHASE_DELUGE) !== 0) return;
  if (enemy.maxHp <= 0 || enemy.hp / enemy.maxHp > DELUGE_HP_FRACTION) return;
  state.bossRuntime.phasesFired |= BOSS_PHASE_DELUGE;
  // A subida comeca DEPOIS do telegrafo: `delugeAt` no futuro deixa
  // `delugeFront` negativo ate la, entao a regra e a apresentacao concordam
  // sozinhas sobre o instante em que o setor comeca a submergir.
  state.bossRuntime.delugeAt = state.tick + DELUGE_WINDUP_TICKS;
  state.bossRuntime.delugeX = enemy.x;
  state.bossRuntime.delugeY = enemy.y;
  events.push({
    t: 'boss_phase',
    archetype: 'sheet_leviathan',
    phase: BOSS_PHASE_DELUGE,
    x: enemy.x,
    y: enemy.y,
  });
  events.push({ t: 'message', key: 'sim.delugeRising' });
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: 4 });
  // O INICIO do Diluvio e uma preparacao: a agua so comeca a subir em
  // `delugeAt`, e o que se ouve ate la e o chamado ascendente e o
  // deslocamento de agua — um som continuo, nao uma serie de respingos.
  events.push({
    t: 'boss_windup',
    archetype: 'sheet_leviathan',
    ability: 'deluge',
    x: enemy.x,
    y: enemy.y,
    releaseTick: state.bossRuntime.delugeAt,
  });
};

/** Ordem FIXA de vizinhanca: o que torna a frente da enchente determinista. */
const NEIGHBORS4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const leviathanSurge = (
  state: SurvivalState,
  enemy: Entity,
  player: Entity,
  events: SemanticEvent[],
): void => {
  if (state.tick < enemy.rangedReadyAt) return;
  enemy.rangedReadyAt = state.tick + LEVIATHAN_SURGE_COOLDOWN_TICKS;
  const w = state.config.width;
  const h = state.config.height;
  const dir = normalized(player.x - enemy.x, player.y - enemy.y);
  let raised = 0;
  // A lamina avanca por CONECTIVIDADE, e nao por distancia.
  //
  // A primeira versao tracava faixas retas e so pulava a celula solida; a
  // segunda interrompia a faixa na parede. As duas vazavam, e a segunda vazava
  // de um jeito instrutivo: com o eixo chefe->alvo na diagonal, o deslocamento
  // perpendicular da faixa ja punha a origem dela quase em cima da parede, e o
  // primeiro passo caía do outro lado sem nunca amostrar a coluna solida. Uma
  // parede transversal fechada nao segurava nada — e o chefe depois emergia
  // atras dela, no unico lugar que o jogador tinha escolhido por ser
  // inalcancavel.
  //
  // Uma frente em largura a partir do CORPO dele nao tem esse buraco: cada
  // celula so entra se um vizinho aberto ja estiver molhado, que e como agua
  // anda de verdade. O corredor (a frente do eixo, dentro da meia-largura) e o
  // que a mantem uma investida dirigida em vez de uma bolha.
  //
  // Deterministica: a fronteira e um array em ordem de insercao e os vizinhos
  // saem em ordem fixa. Duas maquinas da mesma sala alagam as MESMAS celulas.
  const sx = Math.floor(enemy.x);
  const sy = Math.floor(enemy.y);
  const seen = new Set<number>([sy * w + sx]);
  let frontier = [sy * w + sx];
  for (let step = 1; step <= LEVIATHAN_SURGE_LENGTH && frontier.length > 0; step++) {
    const next: number[] = [];
    for (const cell of frontier) {
      const cx = cell % w;
      const cy = (cell - cx) / w;
      for (const [dx, dy] of NEIGHBORS4) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        if (seen.has(i)) continue;
        if (state.solid[i] !== SOLID_NONE) continue;
        const ox = x + 0.5 - enemy.x;
        const oy = y + 0.5 - enemy.y;
        if (ox * dir.x + oy * dir.y <= 0) continue;
        if (Math.abs(ox * -dir.y + oy * dir.x) > LEVIATHAN_SURGE_WIDTH) continue;
        seen.add(i);
        next.push(i);
        // Superficie ocupada nao recebe agua, mas CONDUZ a frente adiante: uma
        // poca de biofluido no caminho nao e uma barragem.
        if (state.surface[i] !== SURF_NONE && state.surface[i] !== SURF_SCORCHED) continue;
        // AGUA NATIVA (timer zero), e nao agua com contagem regressiva.
        //
        // Agua com timer tem semantica fechada no motor: e agua DERRETIDA DE
        // GELO, e `stepCells` a devolve como `SURF_ICE` quando a contagem
        // acaba. Reutiliza-la aqui teria feito a enchente virar gelo permanente
        // no Aquifero — e gelo nao e condutivo, ou seja, a correcao teria
        // acabado desligando o Leviata de novo, setenta segundos depois e longe
        // da causa.
        //
        // A lamina que sobe e a mesma materia de que os lagos do estrato sao
        // feitos, e lago nao tem prazo. O que limita a enchente nao e um
        // relogio, e a propria condicao que a dispara: ela so sai quando a
        // emergencia foi NEGADA, e para no instante em que a agua alcanca o
        // alvo. Ela avanca ate resolver o problema dela e nao um metro alem.
        setSurface(state, i, SURF_WATER, 0);
        raised++;
      }
    }
    frontier = next;
  }
  // So anuncia o que ACONTECEU: uma investida contra uma parede nao levantou
  // lamina nenhuma, e um pulso ali prometeria ao jogador um avanco que ele nao
  // vai encontrar no chao.
  if (raised > 0) events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: 2.5 });
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
        // `isConductiveCell` e nao `isConductiveSurface`: depois do Diluvio o
        // setor inteiro e lamina, e ele emerge onde quiser. E exatamente essa a
        // virada que a carta unica dele compra.
        if (!isConductiveCell(state, i)) continue;
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
  const wasInhaling = enemy.mood === LUNG_INHALING;
  enemy.mood = phase === 0 ? LUNG_INHALING : LUNG_EXHALING;

  // O CICLO RESPIRATORIO como eventos: a virada para expirar (a membrana
  // abre), a virada para inspirar (a valvula fecha) e o pulmao CHEIO — a
  // pausa de pressao pouco antes do jato. Nenhum dos tres muda a mecanica;
  // os tres sao o relogio da luta, dito em voz alta. A virada e comparada
  // com o humor ANTERIOR e nao com o relogio, para o primeiro tick de um
  // corpo recem-nascido nao anunciar uma transicao que nao houve.
  const inhaling = enemy.mood === LUNG_INHALING;
  if (inhaling !== wasInhaling) {
    events.push({
      t: 'boss_state',
      archetype: 'lung_matrix',
      state: inhaling ? 'inhale' : 'exhale',
      x: enemy.x,
      y: enemy.y,
    });
  } else if (
    inhaling &&
    state.tick % LUNG_MATRIX_CYCLE_TICKS === LUNG_MATRIX_CYCLE_TICKS - LUNG_MATRIX_HOLD_TICKS
  ) {
    events.push({
      t: 'boss_state',
      archetype: 'lung_matrix',
      state: 'hold',
      x: enemy.x,
      y: enemy.y,
    });
  }

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
        // A expiracao ACESA e a unica janela de dano que o jogador abre: soa
        // como vulnerabilidade, nao como a explosao comum.
        events.push({
          t: 'boss_vulnerable',
          archetype: 'lung_matrix',
          x: enemy.x,
          y: enemy.y,
          open: true,
        });
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
  const wasOverheating = enemy.mood === FURNACE_OVERHEATING;
  enemy.mood = furnaceOverheatingAt(state.tick) ? FURNACE_OVERHEATING : FURNACE_COOLING;
  // A VIRADA da blindagem e a informacao central do encontro ("bata agora"),
  // e ela viaja como evento porque o instante importa: um cliente lendo o
  // humor no snapshot comecaria a apresentacao do resfriamento com o atraso
  // da rede. `open` = esfriou = a janela de dano abriu.
  const overheating = enemy.mood === FURNACE_OVERHEATING;
  if (overheating !== wasOverheating) {
    events.push({
      t: 'boss_vulnerable',
      archetype: 'furnace_heart',
      x: enemy.x,
      y: enemy.y,
      open: !overheating,
    });
  }
  // O AVISO da cunha: o setor que vai queimar daqui a WARNING_WAVES ondas
  // (1,8 s), no rumo que a mesma conta do cliente desenha. Sai no relogio
  // das ondas e tambem DURANTE o resfriamento — as primeiras ondas de cada
  // superaquecimento sao avisadas antes de ele comecar, exatamente como a
  // cunha visual ja faz — e so quando a onda prometida existe (`warnFires`).
  if (state.tick % FURNACE_HEART_WAVE_INTERVAL_TICKS === 0) {
    const sweep = furnaceSweepAt(enemy.x, enemy.y, state.tick);
    if (sweep.warnFires) {
      events.push({
        t: 'boss_windup',
        archetype: 'furnace_heart',
        ability: 'wave',
        x: enemy.x,
        y: enemy.y,
        dx: sweep.warnDx,
        dy: sweep.warnDy,
        releaseTick:
          state.tick + FURNACE_HEART_WAVE_WARNING_WAVES * FURNACE_HEART_WAVE_INTERVAL_TICKS,
      });
    }
  }
  // A escalada roda ANTES do ciclo: os dois limiares mudam o que este mesmo
  // tick faz, e o colapso continua acontecendo durante o RESFRIAMENTO — o teto
  // nao para de cair so porque a blindagem dele abriu.
  furnaceHeartEscalate(state, enemy, events);
  if (furnaceOverheated(state)) furnaceHeartCollapse(state, enemy, events);
  if (furnaceUnstable(state)) furnaceHeartCyclones(state, enemy, events);

  if (enemy.mood !== FURNACE_OVERHEATING) return;

  // A NINHADA sai no primeiro tick de cada superaquecimento.
  //
  // O instante e derivado do relogio, e nao de um contador guardado: o ciclo ja
  // e `tick / CYCLE_TICKS`, entao a virada e exata e nenhum campo novo precisa
  // entrar no hash. As posicoes tambem sao geometria pura — nada aqui consome
  // `state.rng`, senao duas maquinas com a mesma seed divergiriam na primeira
  // ninhada.
  if (state.tick % (FURNACE_HEART_CYCLE_TICKS * 2) === 0) {
    furnaceHeartBrood(state, enemy);
  }

  if (state.tick < enemy.nextActionAt) return;
  enemy.nextActionAt = state.tick + FURNACE_HEART_WAVE_INTERVAL_TICKS;

  const w = state.config.width;
  const r = FURNACE_HEART_WAVE_RADIUS;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  // O setor gira uma fracao de volta por onda. Deterministico e legivel: o
  // jogador ve para onde a chama esta indo e anda contra ela. A MESMA conta
  // roda no cliente para desenhar a cunha de aviso — ver `furnaceSweepAt`.
  const sweep = furnaceSweepAt(enemy.x, enemy.y, state.tick);
  const dirX = sweep.dx;
  const dirY = sweep.dy;
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
      const surf = state.surface[i];
      // `igniteCell` primeiro: cada materia tem a propria resposta ao calor, e
      // o Coracao nao e a excecao que atropela a tabela — gas estoura, fungo
      // seca, gelo derrete, silica vitrifica.
      //
      // A CINZA e a excecao, e ela e a correcao central do encontro. Na
      // Fornalha cinza e carvao, e `igniteCell` a devolve como fogo de 110
      // ticks; com o setor voltando por cima da propria cinza a cada volta,
      // isso fechava um ciclo que se alimentava sozinho e a camara inteira
      // virava fogo permanente em menos de um minuto. Era literalmente o
      // relato: nao havia como distinguir chao perigoso de chao seguro, porque
      // nao havia mais chao seguro.
      //
      // A varredura reacende a cinza — ela precisa, senao a mecanica morreria
      // apos a primeira volta com o disco todo apagado —, mas com o
      // COMBUSTIVEL DELA, que dura 1,3 s. O carvao de 110 ticks continua
      // valendo para explosao, sopro e chama do JOGADOR, onde ele e uma
      // decisao, e nao um efeito automatico do chefe sobre a propria sala.
      if (surf !== SURF_SCORCHED && igniteCell(state, i, events)) continue;
      if (surf === SURF_NONE || surf === SURF_SCORCHED || surf === SURF_EMBER) {
        setSurface(state, i, SURF_FIRE, FURNACE_HEART_BURN_TICKS);
      }
    }
  }
  // O calor cobra NA PASSAGEM, e nao so de quem fica parado na brasa depois.
  //
  // Sem isto a varredura era uma promessa que so se cumpria para quem parasse
  // em cima dela: quem atravessava o setor no instante em que ele acendia nao
  // levava nada, e atravessar era o movimento obvio. O dano fecha a leitura —
  // "escolha onde estar quando puder" precisa de um preco por estar no lugar
  // errado.
  for (const player of state.players) {
    const extra = state.playerExtras[player.slot ?? 0];
    if (!player.alive || !extra.joined || extra.downed) continue;
    const px = player.x - enemy.x;
    const py = player.y - enemy.y;
    const len = Math.hypot(px, py);
    if (len < 2 || len > r) continue;
    if ((px / len) * dirX + (py / len) * dirY < Math.cos(FURNACE_HEART_WAVE_ARC)) continue;
    damageEntity(state, player, FURNACE_HEART_WAVE_DAMAGE, events, { kind: 'fire' });
  }

  events.push({
    t: 'beam_line',
    x: enemy.x,
    y: enemy.y,
    dx: dirX,
    dy: dirY,
    length: r,
    powered: true,
  });
  // A ONDA em si: combustao larga, no rumo do setor que acendeu.
  events.push({
    t: 'boss_attack',
    archetype: 'furnace_heart',
    ability: 'wave',
    x: enemy.x,
    y: enemy.y,
    dx: dirX,
    dy: dirY,
  });
};

/**
 * O ciclo de blindagem do Coracao, como funcao PURA do tick.
 *
 * Ele sempre foi derivado do relogio, mas ficava embutido no passo do chefe. Sai
 * para fora porque o AVISO precisa perguntar pelo futuro: "no instante que estou
 * anunciando, ele ainda vai estar superaquecido?".
 */
export const furnaceOverheatingAt = (tick: number): boolean =>
  Math.floor(tick / FURNACE_HEART_CYCLE_TICKS) % 2 === 0;

export type FurnaceSweep = {
  /** Centro do setor — o corpo do chefe. */
  x: number;
  y: number;
  /** Rumo do setor que QUEIMA agora. */
  dx: number;
  dy: number;
  /** Rumo do setor que vai queimar daqui a `FURNACE_HEART_WAVE_WARNING_WAVES`. */
  warnDx: number;
  warnDy: number;
  /**
   * A onda anunciada VAI mesmo acontecer?
   *
   * Falso no fim do superaquecimento, quando o instante avisado ja cai no
   * resfriamento — e ali o Coracao nao produz onda nenhuma. Um aviso que some
   * sem se cumprir e pior que nenhum aviso: ele ensina uma informacao falsa, que
   * e exatamente o defeito que esta cunha existe para corrigir. O cliente
   * esconde a cunha quando isto e falso.
   */
  warnFires: boolean;
  /** Meia-abertura do setor, em radianos, e o alcance. */
  arc: number;
  radius: number;
};

/**
 * A GEOMETRIA da varredura, derivada so de (posicao, tick).
 *
 * Existe para o cliente poder desenhar o AVISO, e a escolha de deriva-la em
 * vez de transmiti-la e o que torna o aviso possivel de graca: a cunha nao
 * entra no snapshot, nao entra no hash e nao pode dessincronizar, porque as
 * duas pontas fazem a mesma conta a partir do mesmo tick. Um cliente que
 * reconecta no meio do encontro ja sabe onde a chama esta e onde ela vai estar,
 * sem ter recebido evento nenhum.
 *
 * O que o cliente pinta com isto sao os dois estados que o chao nao consegue
 * dizer sozinho: a cunha que ESTA queimando e a cunha que VAI queimar. O
 * terceiro estado — onde ja passou — o proprio chao diz, porque fogo expirado
 * vira cinza e cinza e a superficie mais escura do jogo.
 */
export const furnaceSweepAt = (x: number, y: number, tick: number): FurnaceSweep => {
  const wave = tick / FURNACE_HEART_WAVE_INTERVAL_TICKS;
  const heading = wave * FURNACE_HEART_WAVE_TURN;
  const lead = FURNACE_HEART_WAVE_WARNING_WAVES * FURNACE_HEART_WAVE_INTERVAL_TICKS;
  const warn = heading + FURNACE_HEART_WAVE_TURN * FURNACE_HEART_WAVE_WARNING_WAVES;
  return {
    x,
    y,
    dx: Math.cos(heading),
    dy: Math.sin(heading),
    warnDx: Math.cos(warn),
    warnDy: Math.sin(warn),
    // O aviso so vale se a onda anunciada existir. Nos ultimos 36 ticks do
    // superaquecimento o instante avisado ja caiu no resfriamento, e ali nao ha
    // varredura: prometer fogo que nao vem ensina o jogador a fugir de lugar
    // nenhum, e essa cunha existe justamente para o chao parar de mentir.
    warnFires: furnaceOverheatingAt(tick + lead),
    arc: FURNACE_HEART_WAVE_ARC,
    radius: FURNACE_HEART_WAVE_RADIUS,
  };
};

/**
 * Os Escoriaceos que a Fornalha manda quando esquenta.
 *
 * Em ANEL, pelo mesmo motivo da matilha do Guardiao: saindo todos da mesma
 * linha, o jogador resolve a leva inteira com um recuo so. O anel e maior que o
 * do Guardiao porque o Coracao nao persegue — quem tem de atravessar a sala e
 * o bicho, e nascer colado no chefe entregaria os dois no mesmo tiro.
 *
 * O teto conta os Escoriaceos VIVOS: um jogador que limpa a leva anterior ganha
 * a proxima inteira, e um que ignora acumula pressao ate o teto e para. E o
 * mesmo contrato do resto do bestiario — densidade nao vira castigo.
 */
const FURNACE_BROOD_RING: readonly (readonly [number, number])[] = [
  [-5, 0],
  [5, 0],
  [0, -5],
  [0, 5],
  [-4, -4],
  [4, 4],
];

/**
 * O COLAPSO TERMICO, em duas fases de uma vez.
 *
 * Roda ANTES da varredura e do ciclo, e nao depois: os dois limiares mudam o
 * que a varredura faz naquele mesmo tick, e checar depois atrasaria a
 * escalada em um tick de cada vez ate ninguem notar que ela esta atrasada.
 *
 * As duas sao `phasesFired`, a mesma bitmask da matilha do Guardiao e do
 * reator do Diamandis: elas disparam UMA vez e nao voltam atras nem se o
 * chefe for curado. Uma escada que desce nao e uma escada.
 */
const furnaceHeartEscalate = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): void => {
  const fraction = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
  const fire = (bit: number, message: SimMessageKey): void => {
    if ((state.bossRuntime.phasesFired & bit) !== 0) return;
    state.bossRuntime.phasesFired |= bit;
    events.push({
      t: 'boss_phase',
      archetype: 'furnace_heart',
      phase: bit,
      x: enemy.x,
      y: enemy.y,
    });
    events.push({ t: 'message', key: message });
  };
  if (fraction <= FURNACE_HEART_OVERHEAT_HP) fire(BOSS_PHASE_OVERHEAT, 'sim.ceilingCollapsing');
  // A instabilidade NAO espera o colapso ser anunciado: um golpe que leve o
  // chefe de 50% a 8% acende as duas no mesmo tick, e o jogador ve as duas
  // acontecerem. Esconder a primeira porque a segunda chegou junto apagaria a
  // leitura de que ele passou por ela.
  if (fraction <= FURNACE_HEART_UNSTABLE_HP) fire(BOSS_PHASE_UNSTABLE, 'sim.furnaceUnstable');
};

/** O colapso ja comecou? */
const furnaceOverheated = (state: SurvivalState): boolean =>
  (state.bossRuntime.phasesFired & BOSS_PHASE_OVERHEAT) !== 0;

const furnaceUnstable = (state: SurvivalState): boolean =>
  (state.bossRuntime.phasesFired & BOSS_PHASE_UNSTABLE) !== 0;

/**
 * Ruido inteiro puro, no espirito de `sectorSeed`.
 *
 * As estalactites NAO consomem `state.rng`. Poderiam — o sorteio de
 * contaminacao consome —, e seria errado por um motivo especifico: elas caem
 * dezenas de vezes por encontro, e cada tirada deslocaria a sequencia da run
 * inteira. Duas partidas com a mesma seed passariam a divergir em tudo o que
 * vem depois de um chefe conforme o jogador demorasse mais ou menos para
 * mata-lo. Derivar de (seed, tick, indice) da a mesma imprevisibilidade sem
 * tocar no gerador da run.
 */
const furnaceNoise = (a: number, b: number, c: number): number => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (b + 0x165667b1), 0xc2b2ae35);
  h = Math.imul(h ^ (c + 0x27d4eb2f), 0x27d4eb2f);
  return (h ^ (h >>> 15)) >>> 0;
};

/**
 * O TETO CEDE: marca estalactites perto de quem esta na sala.
 *
 * Perto, e nunca EM CIMA: marcar a celula do jogador transformaria o aviso numa
 * taxa sobre ficar parado, e ficar parado ja e punido pela varredura. O que a
 * queda cobra e o espaco em volta — ela tira rota, que e o que uma camara
 * desabando faz.
 */
const furnaceHeartCollapse = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): void => {
  if (state.tick % FURNACE_HEART_STALACTITE_INTERVAL_TICKS !== 0) return;
  const w = state.config.width;
  const h = state.config.height;
  // A instabilidade DOBRA a leva: a mesma mecanica, com a sala ja pior.
  const count = FURNACE_HEART_STALACTITES_PER_DROP * (furnaceUnstable(state) ? 2 : 1);
  const targets = state.players.filter((p) => {
    const extra = state.playerExtras[p.slot ?? 0];
    return p.alive && extra.joined && !extra.downed;
  });
  if (targets.length === 0) return;

  for (let k = 0; k < count; k++) {
    const target = targets[k % targets.length];
    const noise = furnaceNoise(state.config.seed, state.tick, k);
    const spread = FURNACE_HEART_STALACTITE_SPREAD;
    const dx = (noise % (spread * 2 + 1)) - spread;
    const dy = (Math.floor(noise / 64) % (spread * 2 + 1)) - spread;
    const x = Math.floor(target.x) + dx;
    const y = Math.floor(target.y) + dy;
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    // So onde ha teto para cair: uma estalactite nascendo dentro da rocha nao
    // tem de onde vir, e o aviso ficaria invisivel sob a parede.
    if (state.solid[y * w + x] !== SOLID_NONE) continue;
    const at = state.tick + FURNACE_HEART_STALACTITE_WARNING_TICKS;
    state.bossRuntime.collapseCells.push({ idx: y * w + x, at });
    events.push({
      t: 'stalactite',
      x: x + 0.5,
      y: y + 0.5,
      radius: FURNACE_HEART_STALACTITE_RADIUS,
      fireTick: at,
    });
  }
  void enemy;
};

/** As estalactites que chegaram a hora. Roda sempre, mesmo sem o chefe em campo. */
export const stepCollapse = (state: SurvivalState, events: SemanticEvent[]): void => {
  const pending = state.bossRuntime.collapseCells;
  if (pending.length === 0) return;
  const w = state.config.width;
  let write = 0;
  for (let read = 0; read < pending.length; read++) {
    const cell = pending[read];
    if (state.tick < cell.at) {
      pending[write++] = cell;
      continue;
    }
    const cx = (cell.idx % w) + 0.5;
    const cy = Math.floor(cell.idx / w) + 0.5;
    for (const player of state.players) {
      const extra = state.playerExtras[player.slot ?? 0];
      if (!player.alive || !extra.joined || extra.downed) continue;
      if (Math.hypot(player.x - cx, player.y - cy) > FURNACE_HEART_STALACTITE_RADIUS) continue;
      damageEntity(state, player, FURNACE_HEART_STALACTITE_DAMAGE, events, {
        kind: 'enemy_contact',
        archetype: 'furnace_heart',
        elite: false,
      });
    }
    // A pedra chega quente: o impacto deixa brasa. E o que faz a queda somar
    // ao problema do chao em vez de ser um evento isolado que passa.
    const i = cell.idx;
    if (state.solid[i] === SOLID_NONE && !igniteCell(state, i, events)) {
      if (state.surface[i] === SURF_NONE) setSurface(state, i, SURF_EMBER, 180);
    }
    events.push({ t: 'pulse', x: cx, y: cy, radius: FURNACE_HEART_STALACTITE_RADIUS });
  }
  pending.length = write;
};

/**
 * CICLONES: a sala deixa de ser terreno neutro.
 *
 * Saem do CORPO do chefe e vao para fora em rumos espalhados — nascer longe
 * dele os desligaria da causa, e a leitura "ele esta se desfazendo" depende de
 * o fogo vir dele.
 */
const furnaceHeartCyclones = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): void => {
  if (state.tick % FURNACE_HEART_CYCLONE_INTERVAL_TICKS !== 0) return;
  let alive = 0;
  for (const proj of state.projectiles) if (proj.kind === 'cyclone') alive++;
  if (alive >= FURNACE_HEART_CYCLONE_CAP) return;

  const noise = furnaceNoise(state.config.seed, state.tick, 0);
  const base = (noise % 360) * (Math.PI / 180);
  const spawn = Math.min(FURNACE_HEART_CYCLONE_CAP - alive, 2);
  for (let k = 0; k < spawn; k++) {
    const angle = base + (k * Math.PI * 2) / spawn;
    state.projectiles.push({
      kind: 'cyclone',
      id: state.nextEntityId++,
      owner: enemy.id,
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * FURNACE_HEART_CYCLONE_SPEED,
      vy: Math.sin(angle) * FURNACE_HEART_CYCLONE_SPEED,
      damage: FURNACE_HEART_CYCLONE_DAMAGE,
      radius: FURNACE_HEART_CYCLONE_RADIUS,
      hostile: true,
      leavesBiofluid: false,
      distanceTravelled: 0,
      ttl: FURNACE_HEART_CYCLONE_TTL_TICKS,
      hits: [],
    });
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: 2 });
};

/**
 * A SALA ESFRIA quando o Coracao cai.
 *
 * Apaga brasa e fogo da camara, dissolve os ciclones e cancela as estalactites
 * ja marcadas. E autoritativo e nao apresentacao: um cliente que apagasse o
 * fogo sozinho desenharia chao seguro sobre celulas que ainda queimam, e o
 * parceiro do co-op morreria num lugar que a tela dele mostrava apagado.
 *
 * A estalactite JA MARCADA some junto. Cobrar uma queda anunciada por um chefe
 * que nao existe mais e a definicao de dano sem dono.
 */
export const furnaceHeartCooldown = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): void => {
  const w = state.config.width;
  const h = state.config.height;
  const r = FURNACE_HEART_WAVE_RADIUS;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const i = y * w + x;
      if (state.surface[i] === SURF_EMBER || state.surface[i] === SURF_FIRE) {
        setSurface(state, i, SURF_NONE, 0);
      }
    }
  }
  state.projectiles = state.projectiles.filter((proj) => proj.kind !== 'cyclone');
  state.bossRuntime.collapseCells.length = 0;
  events.push({ t: 'furnace_cooled', x: enemy.x, y: enemy.y, radius: r });
  events.push({ t: 'message', key: 'sim.furnaceCooled' });
};

const furnaceHeartBrood = (state: SurvivalState, enemy: Entity): void => {
  let alive = 0;
  for (const other of state.enemies) {
    if (other.alive && other.archetype === 'scoriac') alive++;
  }
  // A PRIMEIRA FASE ENSINA, e ensinar exige espaco de atencao.
  //
  // Antes do colapso a ninhada e de UM, e so quando nao ha nenhum vivo. O
  // Escoriaceo ja e caro por desenho — couraça que corta 55% do dano e so abre
  // com calor, e que o acelera quando abre —, entao dois em campo durante a
  // unica janela de vulnerabilidade do chefe transformavam o encontro numa
  // luta contra a escolta com o Coracao fazendo barulho ao fundo. O playtest
  // nao passou dos 50% de vida dele: a fase que devia ensinar onde ficar, como
  // ler a onda e quando bater ja cobrava o que a luta inteira ia cobrar.
  //
  // Depois do colapso a regra afrouxa para a cadencia normal. Ai a sala ja foi
  // aprendida, e acumular pressao e exatamente o ponto da escada.
  const teaching = !furnaceOverheated(state);
  if (teaching && alive > 0) return;
  const quota = teaching ? 1 : FURNACE_HEART_BROOD_PER_WAVE;
  const cap = teaching ? 1 : FURNACE_HEART_BROOD_CAP;
  const w = state.config.width;
  const h = state.config.height;
  let placed = 0;
  for (let k = 0; k < FURNACE_BROOD_RING.length; k++) {
    if (placed >= quota) return;
    if (alive + placed >= cap) return;
    if (state.enemies.length >= MAX_ENEMIES) return;
    // A leva gira junto com a varredura: duas levas seguidas nao saem das
    // mesmas quatro casas, e a sala nao vira um padrao decorado.
    const cycle = Math.floor(state.tick / (FURNACE_HEART_CYCLE_TICKS * 2));
    const [dx, dy] = FURNACE_BROOD_RING[(k + cycle) % FURNACE_BROOD_RING.length];
    const x = Math.floor(enemy.x) + dx;
    const y = Math.floor(enemy.y) + dy;
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    if (state.solid[y * w + x] !== SOLID_NONE) continue;
    spawnEnemy(state, 'scoriac', x, y, false);
    placed++;
  }
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
  let risen = 0;
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
    risen++;
  }
  events.push({ t: 'pulse', x: enemy.x, y: enemy.y, radius: r });
  // Os Espectros SAINDO do gelo sao a consequencia do congelamento, e soam
  // como tal — so quando algum de fato saiu.
  if (risen > 0) {
    events.push({
      t: 'boss_state',
      archetype: 'frost_queen',
      state: 'wraiths',
      x: enemy.x,
      y: enemy.y,
    });
  }
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
  const wasAttracting = enemy.mood === MAGNET_ATTRACT;
  enemy.mood = phase === 0 ? MAGNET_ATTRACT : MAGNET_REPEL;
  // A TROCA DE POLARIDADE e a unica coisa que o jogador precisa saber sem
  // olhar para o HUD nem para o chefe: atracao e repulsao pedem respostas
  // opostas. Comparada com o humor anterior, pelo mesmo motivo do Pulmao.
  const attracting = enemy.mood === MAGNET_ATTRACT;
  if (attracting !== wasAttracting) {
    events.push({
      t: 'boss_state',
      archetype: 'magnetarch',
      state: attracting ? 'attract' : 'repel',
      x: enemy.x,
      y: enemy.y,
    });
  }
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
    events.push({
      t: 'boss_attack',
      archetype: 'magnetarch',
      ability: 'crush',
      x: enemy.x,
      y: enemy.y,
    });
  } else if (enemy.mood === MAGNET_REPEL && dist > MAGNETARCH_TETHER_RANGE) {
    damageEntity(state, player, MAGNETARCH_TETHER_DAMAGE, events, {
      kind: 'enemy_contact',
      archetype: 'magnetarch',
      elite: enemy.elite,
    });
    events.push({ t: 'pulse', x: player.x, y: player.y, radius: 1.4 });
    // O arco de retorno soa ONDE fecha — no jogador, longe do corpo.
    events.push({
      t: 'boss_attack',
      archetype: 'magnetarch',
      ability: 'tether',
      x: player.x,
      y: player.y,
    });
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
  const h = state.config.height;
  const cx = Math.floor(enemy.x);
  const cy = Math.floor(enemy.y);
  // A poca cresce por CONECTIVIDADE, pela mesma razao da enchente: o esguicho
  // carimbava um disco e so pulava a celula solida, entao a agua deslocada
  // aparecia do outro lado de uma parede que ela nunca atravessou. Isso nao era
  // so estranho de olhar — era uma cadeia: aquela agua virava ponto de
  // emergencia valido, e o chefe passava a romper o chao atras da barreira que
  // o jogador tinha escolhido justamente por ser inalcancavel.
  const start = cy * w + cx;
  const seen = new Set<number>([start]);
  let frontier = [start];
  const splash = (i: number): void => {
    // Agua deslocada cobre chao nu e cinza; nao apaga fogo do jogador nem
    // desfaz gelo — as duas coisas sao decisoes de alguem.
    if (state.surface[i] === SURF_NONE || state.surface[i] === SURF_SCORCHED) {
      setSurface(state, i, SURF_WATER, 0);
    }
  };
  if (state.solid[start] === SOLID_NONE) splash(start);
  for (let step = 1; step <= LEVIATHAN_BREACH_RADIUS && frontier.length > 0; step++) {
    const next: number[] = [];
    for (const cell of frontier) {
      const fx = cell % w;
      const fy = (cell - fx) / w;
      for (const [dx, dy] of NEIGHBORS4) {
        const x = fx + dx;
        const y = fy + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        if (seen.has(i) || state.solid[i] !== SOLID_NONE) continue;
        if (Math.hypot(x + 0.5 - enemy.x, y + 0.5 - enemy.y) > LEVIATHAN_BREACH_RADIUS) continue;
        seen.add(i);
        next.push(i);
        splash(i);
      }
    }
    frontier = next;
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
const diamandisShedModules = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): void => {
  const fraction = enemy.hp / enemy.maxHp;
  for (let m = 0; m < DIAMANDIS_MODULE_COUNT; m++) {
    const bit = 1 << m;
    if ((state.bossRuntime.modulesExposed & bit) !== 0) continue;
    if (fraction > DIAMANDIS_MODULE_EXPOSE_AT[m]) continue;
    state.bossRuntime.modulesExposed |= bit;
    events.push({ t: 'boss_module', x: enemy.x, y: enemy.y, module: m, state: 'exposed' });
    diamandisCallSalvageCrew(state, enemy);
  }
};

/**
 * Onde a equipe de resgate entra em campo. Anel FIXO, como a ninhada do
 * Coracao, e pelo mesmo motivo: nada aqui pode consumir `state.rng`, senao duas
 * maquinas com a mesma seed divergiriam da primeira peca solta em diante.
 *
 * Oito rumos e nao quatro porque eles chegam DEPOIS do jogador ja ter escolhido
 * um lado da carcaça para atacar: com quatro pontos cardeais, metade das
 * exposicoes os fazia nascer todos atras dele, e a outra metade, todos de
 * frente. Espalhar e o que faz "tem um Coveiro chegando" ser uma informacao
 * sobre a rota dele, e nao sobre a sorte.
 */
const DIAMANDIS_CREW_RING: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7, 0.7],
  [-0.7, -0.7],
  [0.7, -0.7],
  [-0.7, 0.7],
];

/**
 * O modulo se soltou, e a sucata CHAMA.
 *
 * O Coveiro e fauna do Estrato Ferrifero; o Diamandis nasce onde a Cicatriz
 * Aurix domina, e as duas coisas quase nunca coincidem. Resultado medido em
 * playtest: o encontro inteiro sem um unico Coveiro, e a escolha mais
 * interessante da luta — deixar arrancar a peca (a arma some, a recompensa
 * pode ir junto) ou defender o chefe que esta tentando te matar — nunca chegou
 * a existir, porque nao havia quem arrancasse.
 *
 * Eles nao sao minions e nao entram do lado de ninguem: continuam executando o
 * trabalho para o qual foram deixados no subsolo, que e recolher sucata de
 * automato abatido. O Diamandis so ainda nao esta abatido. `undertakerSalvage-
 * Step` cuida do resto sem uma linha nova — a mecanica ja existia inteira e o
 * que faltava era populacao.
 *
 * O anel e LARGO (11 tiles): eles tem de atravessar a camara para chegar a
 * peca, e essa travessia e o aviso. Nascer colados na carcaça entregaria os
 * dois no mesmo tiro e transformaria a chegada num susto em vez de uma rota.
 */
const diamandisCallSalvageCrew = (state: SurvivalState, enemy: Entity): void => {
  let alive = 0;
  for (const other of state.enemies) {
    if (other.alive && other.archetype === 'undertaker') alive++;
  }
  const w = state.config.width;
  const h = state.config.height;
  const r = DIAMANDIS_SALVAGE_CREW_RING;
  // O rumo inicial gira com o modulo: a segunda equipe nao repete a rota da
  // primeira, e a terceira nao repete a segunda.
  const turn = state.bossRuntime.modulesExposed;
  let placed = 0;
  for (let k = 0; k < DIAMANDIS_CREW_RING.length; k++) {
    if (placed >= DIAMANDIS_SALVAGE_CREW) return;
    if (alive + placed >= DIAMANDIS_SALVAGE_CREW_CAP) return;
    if (state.enemies.length >= MAX_ENEMIES) return;
    const [ux, uy] = DIAMANDIS_CREW_RING[(k + turn) % DIAMANDIS_CREW_RING.length];
    const x = Math.floor(enemy.x + ux * r);
    const y = Math.floor(enemy.y + uy * r);
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    if (state.solid[y * w + x] !== SOLID_NONE) continue;
    spawnEnemy(state, 'undertaker', x, y, false);
    placed++;
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
  const carrying =
    (enemy.mood ?? 0) > 0 && (state.bossRuntime.modulesLost & (1 << (enemy.mood! - 1))) !== 0;
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
      best === toLeft
        ? { x: -1, y: 0 }
        : best === toRight
          ? { x: 1, y: 0 }
          : best === toTop
            ? { x: 0, y: -1 }
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
      startAction(
        state,
        enemy,
        'haul',
        toward,
        UNDERTAKER_SALVAGE_WINDUP_TICKS,
        6,
        events,
        boss.id,
      );
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
const diamandisReactorCollapse = (
  state: SurvivalState,
  enemy: Entity,
  events: SemanticEvent[],
): void => {
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
  const leviathan = state.enemies.find(
    (enemy) => enemy.alive && enemy.archetype === 'sheet_leviathan',
  );
  const livePlayer = state.players.some((player) => {
    const extra = state.playerExtras[player.slot ?? 0];
    return player.alive && extra.joined && !extra.downed;
  });
  if (!leviathan || !livePlayer) {
    state.bossRuntime.protectiveBubbles = [];
    state.bossRuntime.leviathanShockAt = -1;
    if (leviathan?.action?.kind === 'massive_shock') {
      leviathan.action = undefined;
      events.push({ t: 'action_end', entity: leviathan.id });
    }
  } else if (
    leviathan.action?.kind === 'massive_shock' &&
    leviathan.action.phase === 'windup' &&
    state.bossRuntime.protectiveBubbles.length !== 2
  ) {
    state.bossRuntime.protectiveBubbles = protectiveBubblePositions(state, leviathan);
  }
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    // A cura do bispo roda ANTES do portao de acao, e nao dentro do ramo de IA.
    // Ela e uma propriedade do chao, nao uma decisao dele: suspende-la durante
    // cada golpe ou cada atordoamento ensinaria ao jogador uma janela que nao
    // existe — "acertei na hora certa" em vez de "ele estava no lugar errado".
    const onFungus = enemy.archetype === 'bishop' && bishopRegen(state, enemy, events);
    // A BOCA DO DEVORADOR roda ANTES dos dois portoes — o de acao e o de
    // atordoamento — pela mesma razao da cura do Bispo logo acima: ela nao e uma
    // decisao dele, e o ESTADO em que ele esta.
    //
    // O portao de atordoamento e o que torna isto obrigatorio, e nao uma
    // preferencia de arrumacao. Corrente atordoa por 1,2 s e o Devorador nao
    // esta em `isStoneEnemy`: com a boca dentro do fluxo de IA, um unico tiro
    // condutivo desligava succao, refeicao de areia e mordida por 24 ticks —
    // enquanto `mawOpenedAt` e `nextActionAt`, que sao ticks ABSOLUTOS,
    // continuavam correndo. O jogador ficava com a janela sem o preco dela, e o
    // vortice seguia desenhado no chao prometendo uma succao que nao acontecia.
    // Isto e a TORRE de volta, comprada por um modulo, e e exatamente o que este
    // encontro deixou de ser.
    //
    // Interromper tambem nao faria sentido do outro lado: a boca nao e um
    // telegrafo de golpe, e a JANELA DE DANO do chefe. Atordoar para encurtar a
    // propria janela de dano nao e uma jogada — e o `continue` diz o resto, que
    // e que de boca aberta ele nao faz mais nada nenhum.
    if (enemy.archetype === 'white_devourer' && enemy.mood === DEVOURER_MAW) {
      enemy.action = undefined;
      devourerMawTick(state, enemy, events);
      continue;
    }
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
      }
      // A FRENTE da Supernova, pela mesma razao dos tres acima: durante a
      // recuperacao a acao e que conduz o efeito. Ele fica parado enquanto ela
      // sai, e ficar parado e a leitura — a supernova e a coisa que ele faz.
      else if (
        enemy.archetype === 'bishop' &&
        enemy.action?.kind === 'pulse' &&
        enemy.action.phase !== 'windup'
      ) {
        bishopNovaStride(state, enemy, events);
      }
      // A ONDA do Arquicantor, pela mesma razao: o canto atravessa a nave
      // camada por camada durante a recuperacao.
      else if (
        enemy.archetype === 'archcantor' &&
        enemy.action?.kind === 'pulse' &&
        enemy.action.phase !== 'windup'
      ) {
        archcantorChainStride(state, enemy, events);
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
          away.y * MINER_FLEE_SPEED * dt * surfaceSpeedMul(state, enemy),
        );
        // Encurralado, ele desliza pela parede em vez de travar de frente para
        // ela. Um NPC preso num canto vibrando le como bug, e nao como medo.
        if (fled.blockedX || fled.blockedY) {
          moveEntity(
            state,
            enemy,
            (fled.blockedX ? -away.y : 0) * MINER_FLEE_SPEED * dt,
            (fled.blockedY ? -away.x : 0) * MINER_FLEE_SPEED * dt,
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
        toward.y * MINER_RAGE_SPEED * dt * surfaceSpeedMul(state, enemy),
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
    // A NINHADA. Fluxo proprio como o Miner e o Fole, e por um motivo mais
    // forte que o deles: o fluxo comum e "perseguir e bater", e este bicho nao
    // faz nenhuma das duas. Passa-lo por la lhe daria uma acao de contato — ou
    // seja, dano — que a definicao dele proibe.
    if (enemy.archetype === 'devourer_brood') {
      if (!crushBrood(state, enemy, events)) broodStep(state, enemy, player, dt);
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
        events.push({
          t: 'boss_awake',
          archetype: enemy.archetype as EnemyArchetype,
          x: enemy.x,
          y: enemy.y,
        });
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
          startAction(
            state,
            enemy,
            'pulse',
            toward,
            BISHOP_NOVA_WINDUP_TICKS,
            BISHOP_NOVA_TRAVEL_TICKS,
            events,
            player.id,
          );
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
        startAction(
          state,
          enemy,
          'pulse',
          toward,
          BISHOP_NOVA_WINDUP_TICKS,
          BISHOP_NOVA_TRAVEL_TICKS,
          events,
          player.id,
        );
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
        startAction(
          state,
          enemy,
          'charge',
          toward,
          HORSE_CHARGE_WINDUP_TICKS,
          HORSE_CHARGE_TICKS,
          events,
          player.id,
        );
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
        startAction(
          state,
          enemy,
          'haul',
          toward,
          UNDERTAKER_PULL_WINDUP_TICKS,
          6,
          events,
          player.id,
        );
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
          enemy.rangedReadyAt =
            state.tick + Math.round(DIAMANDIS_DEMOLISH_COOLDOWN_TICKS * cadence);
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
          markDemolition(
            state,
            enemy,
            player,
            state.tick + DIAMANDIS_DEMOLISH_WINDUP_TICKS,
            events,
          );
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
          startAction(
            state,
            enemy,
            'beam',
            toward,
            DIAMANDIS_BEAM_WINDUP_TICKS,
            10,
            events,
            player.id,
          );
          continue;
        }
      }

      // ARQUICANTOR: canta, e a Catedral responde. Sem cristal ao alcance ele
      // nao tem quem responda — a sala esvaziada E o contra-jogo, entao a
      // checagem tem de ser real.
      if (enemy.archetype === 'archcantor') {
        // A NOTA ISOLADA entre um canto e outro: presenca, nao ameaca. So
        // com rede — uma Catedral em silencio nao tem quem afinar.
        if (
          state.tick % ARCHCANTOR_IDLE_NOTE_INTERVAL_TICKS === 0 &&
          !state.bossRuntime.archcantorSilent
        ) {
          events.push({
            t: 'boss_state',
            archetype: 'archcantor',
            state: 'idle_note',
            x: enemy.x,
            y: enemy.y,
          });
        }
        if (
          state.tick >= enemy.rangedReadyAt &&
          dist <= ARCHCANTOR_PULSE_RADIUS + 1.5 &&
          archcantorHasNetwork(state, enemy)
        ) {
          enemy.rangedReadyAt = state.tick + ARCHCANTOR_COOLDOWN_TICKS;
          startAction(
            state,
            enemy,
            'pulse',
            toward,
            ARCHCANTOR_WINDUP_TICKS,
            ARCHCANTOR_CHAIN_LAYERS * ARCHCANTOR_CHAIN_STEP_TICKS,
            events,
            player.id,
            archcantorSongIntensity(state, enemy),
          );
          continue;
        }
      }

      // RAINHA DA GEADA: refaz o lago e solta os Espectros dele.
      if (
        enemy.archetype === 'frost_queen' &&
        state.tick >= enemy.rangedReadyAt &&
        dist <= FROST_QUEEN_FREEZE_RADIUS + 3
      ) {
        enemy.rangedReadyAt = state.tick + FROST_QUEEN_FREEZE_COOLDOWN_TICKS;
        startAction(
          state,
          enemy,
          'freeze',
          toward,
          FROST_QUEEN_FREEZE_WINDUP_TICKS,
          8,
          events,
          player.id,
        );
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
          startAction(
            state,
            enemy,
            'hurl',
            toward,
            BRUISER_HURL_WINDUP_TICKS,
            6,
            events,
            player.id,
          );
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
      // O PASSO do Guardiao: peso no chao a cada tile, enquanto anda. E o
      // unico chefe cuja presenca e um corpo pesado se deslocando, e o passo
      // e o que faz um chefe atras da parede ser ouvido antes de ser visto.
      if (enemy.archetype === 'guardian' && state.tick % GUARDIAN_STEP_INTERVAL_TICKS === 0) {
        events.push({
          t: 'boss_state',
          archetype: 'guardian',
          state: 'step',
          x: enemy.x,
          y: enemy.y,
        });
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

  // A NINHADA SE DESEMBARALHA aqui, com todo mundo ja parado no lugar deste
  // tick. Ver `separateBrood`: dentro do passo individual nao ha como garantir
  // nada, porque quem anda depois desfaz o que foi resolvido antes.
  //
  // E AQUI, logo depois do laco, e nao no fim da funcao: o que vem abaixo sao as
  // fases do Diamandis e do Guardiao, e a do Guardiao SAI DA FUNCAO quando nao
  // ha Guardiao vivo (`if (!guardian || !guardian.alive) return`). Posta la, a
  // separacao nunca rodava na camara do Devorador — que e a unica onde existe
  // ninhada. O teste continuou reprovando com o mesmo numero, no mesmo tick, e
  // foi isso que denunciou.
  separateBrood(state);

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
    // A "falha operacional": a fase e um evento como a da Fornalha ja era.
    events.push({
      t: 'boss_phase',
      archetype: 'diamandis',
      phase: BOSS_PHASE_REACTOR,
      x: diamandis.x,
      y: diamandis.y,
    });
    diamandisReactorCollapse(state, diamandis, events);
  }

  // As duas blindagens que so existiam DENTRO do funil de dano viram
  // transicao aqui, uma vez por tick: a Catedral calando (o Arquicantor
  // fragil) e o lago da Rainha derretendo (a couraça caindo). A memoria fica
  // em `bossRuntime` porque as duas sao recomputadas da grade e nao ha outro
  // jeito de saber que ESTE tick e o da virada.
  const archcantor = state.enemies.find((e) => e.archetype === 'archcantor' && e.alive);
  if (archcantor) {
    const silent = !archcantorHasNetwork(state, archcantor);
    if (silent !== state.bossRuntime.archcantorSilent) {
      state.bossRuntime.archcantorSilent = silent;
      events.push({
        t: 'boss_vulnerable',
        archetype: 'archcantor',
        x: archcantor.x,
        y: archcantor.y,
        open: silent,
      });
    }
  }
  const queen = state.enemies.find((e) => e.archetype === 'frost_queen' && e.alive);
  if (queen) {
    const armored = frostQueenIceAround(state, queen) >= FROST_QUEEN_ICE_THRESHOLD ? 1 : 0;
    const before = state.bossRuntime.frostArmored;
    state.bossRuntime.frostArmored = armored;
    // A primeira leitura nao e uma transicao: um encontro que comecasse
    // anunciando "a couraça caiu" estaria mentindo sobre um gelo que nunca
    // existiu.
    if (before >= 0 && before !== armored) {
      events.push({
        t: 'boss_vulnerable',
        archetype: 'frost_queen',
        x: queen.x,
        y: queen.y,
        open: armored === 0,
      });
    }
  }

  const guardian = state.enemies.find((e) => e.archetype === 'guardian');
  if (!guardian || !guardian.alive) return;
  const enraged = guardian.hp < guardian.maxHp * 0.5;

  // A ESTRUTURA CEDENDO: na fase final o corpo range, esparso e continuo.
  // Ele nao fala e nao canta — desloca massa, e a massa esta rachando.
  if (enraged && state.tick % GUARDIAN_STRAIN_INTERVAL_TICKS === 0) {
    events.push({
      t: 'boss_state',
      archetype: 'guardian',
      state: 'strain',
      x: guardian.x,
      y: guardian.y,
    });
  }

  if (enraged && (state.bossRuntime.phasesFired & BOSS_PHASE_SUMMON) === 0) {
    state.bossRuntime.phasesFired |= BOSS_PHASE_SUMMON;
    events.push({
      t: 'boss_phase',
      archetype: 'guardian',
      phase: BOSS_PHASE_SUMMON,
      x: guardian.x,
      y: guardian.y,
    });
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
        Math.max(Math.abs(p.x - guardian.x), Math.abs(p.y - guardian.y)) <
          GUARDIAN_ARENA_RADIUS - 1,
    );
    if (near) {
      const placed = closeArena(
        state,
        Math.floor(guardian.x),
        Math.floor(guardian.y),
        GUARDIAN_ARENA_RADIUS,
        GUARDIAN_ARENA_EXITS,
        events,
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
  source: EffectOrigin['source'] = 'environment',
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
        { kind: 'explosion', source },
      );
    }
  }
};
