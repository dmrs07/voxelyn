// Simulacao autoritativa: tempo em ticks inteiros a 20 Hz.
export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;

export const WORLD_W = 96;
export const WORLD_H = 96;
export const CHUNK = 16;
export const CHUNKS_X = WORLD_W / CHUNK;
export const CHUNKS_Y = WORLD_H / CHUNK;

// Camada solida (paredes / vazio).
export const SOLID_NONE = 0;
export const SOLID_ROCK = 1;
export const SOLID_FRAGILE = 2;
export const SOLID_ORE = 3;
export const SOLID_CRYSTAL = 4;
// Estados intermediarios: existem para o jogador VER o material mudando antes
// de ceder. Sem o estagio visivel, corrosao e rachadura viram morte invisivel,
// que e justamente o que o design proibe.
export const SOLID_FRAGILE_WEAK = 5; // frágil corroído, cede ao proximo toque
export const SOLID_ORE_SPENT = 6; // veio esgotado ou contaminado: nao conduz
export const SOLID_CRYSTAL_DULL = 7; // cristal opaco: nao emite luz nem descarrega
export const SOLID_ORE_CHIPPED = 8; // veio ja lascado, a um golpe de esgotar

// Camada de superficie (o que cobre o chao de uma celula aberta).
//
// Os IDs antigos permanecem estaveis porque viajam nos diffs de chunk. Os dois
// estados novos entram no fim:
// - SPORES e a nuvem organica deixada pelo Spore Bomber;
// - FUNGAL_HEATED e o tapete umido secando/fumegando antes de pegar fogo.
export const SURF_NONE = 0;
export const SURF_FUNGAL = 1;
export const SURF_BIOFLUID = 2;
export const SURF_GAS = 3;
export const SURF_FIRE = 4;
export const SURF_SCORCHED = 5;
export const SURF_SPORES = 6;
export const SURF_FUNGAL_HEATED = 7;

// Orcamentos por tick (degradacao previsivel via fila deterministica).
export const BUDGET_REACTING_CELLS = 4096;
export const BUDGET_DISCHARGE_CELLS = 256;
export const MAX_PROJECTILES = 96;
export const MAX_ENEMIES = 48;

// Cadencia da simulacao celular (a cada N ticks).
export const CELL_STEP_INTERVAL = 3;

export const FIRE_FUEL_TICKS = 46;
export const FIRE_DAMAGE_PER_TICK = 2.2;

// Fungo e biomassa umida: primeiro seca/fumega, depois queima por mais tempo.
export const FUNGAL_HEAT_TICKS = 36; // ~1,8 s ate a ignicao a 20 Hz
export const FUNGAL_HEAT_IMPACT_TICKS = 12; // calor direto acelera a secagem
export const FUNGAL_FIRE_FUEL_TICKS = 72; // ~3,6 s de combustao lenta

// Gas sulfurico: permanece no ambiente, mas ao acender vira apenas um flash
// curto. A explosao direta continua sendo tratada por impactSurface.
export const GAS_LIFE_TICKS = 220;
export const GAS_DAMAGE_PER_TICK = 0.55;
export const GAS_SPREAD_CHANCE = 0.14;
export const GAS_FLASH_TICKS = 8; // ~0,4 s antes de sumir

// Esporos: nuvem organica localizada do bomber. Machuca, nao difunde como gas e
// desaparece sozinha; fogo a esteriliza numa combustao curta, sem explosao.
export const SPORE_LIFE_TICKS = 180;
export const SPORE_DAMAGE_PER_TICK = 0.55;
export const SPORE_BURN_TICKS = 18;

export const FIRE_SPREAD_BIOFLUID = 0.85;
export const BIOFLUID_SLOW = 0.55;
export const DISCHARGE_DAMAGE = 26;
export const DISCHARGE_TICKS = 6;
/** Controle direto do Conductive em alvos organicos: 1,2 s a 20 Hz. */
export const CONDUCTIVE_STUN_TICKS = Math.round(1.2 * TICK_HZ);

// Propagacao por material solido. Orcamentos separados do biofluido porque um
// veio de minerio atravessa a sala inteira e nao pode custar um tick.
export const BUDGET_VEIN_CELLS = 64;
export const BUDGET_RESONANCE_CELLS = 24;


export const PLAYER_HP = 100;
export const PLAYER_SPEED = 4.6; // tiles/s
export const PLAYER_RADIUS = 0.34;
export const DODGE_SPEED = 11;
export const DODGE_TICKS = 4; // impulso
export const DODGE_IFRAME_TICKS = 7;
export const DODGE_COOLDOWN_TICKS = 18;

export const HEAT_PER_SHOT = 9;
export const HEAT_MAX = 100;
export const HEAT_DECAY_PER_TICK = 1.15;
export const OVERHEAT_LOCK_TICKS = 36;
export const OVERHEAT_SELF_DAMAGE = 6;

/**
 * Quanto tempo um inimigo caça depois de levar dano, independente da distancia.
 *
 * Quatro segundos e o bastante para ele SAIR do lugar e vir na sua direcao —
 * um bruiser a 2.3 tiles/s anda ~9 tiles nesse tempo, mais que o proprio raio
 * de aggro. Nao e infinito de proposito: quem atira e foge continua conseguindo
 * quebrar o contato, so nao de graça.
 */
export const ALERT_TICKS = 4 * TICK_HZ;

/**
 * Arremesso de bloco do bruiser.
 *
 * Ele era o unico inimigo sem NENHUMA resposta a distancia, andando a metade da
 * velocidade do jogador: contra alguem que recua ele simplesmente nunca
 * encostava. O arremesso existe para isso, e o windup e longo porque a ameaca
 * tem de ser vista e evitada — a promessa do jogo e morrer por decisao
 * arriscada, nunca por algo que nao deu para ler.
 */
export const BRUISER_HURL_WINDUP_TICKS = 16; // ~0,8 s de telegrafo
export const BRUISER_HURL_COOLDOWN_TICKS = 70; // ~3,5 s
export const BRUISER_HURL_MIN_RANGE = 2.6;
export const BRUISER_HURL_MAX_RANGE = 9;
/**
 * Velocidade da pedra: quase o DOBRO da do jogador (4,6).
 *
 * A primeira tentativa foi 6 — "mais lento que o cuspe, da para desviar" — e
 * media zero acerto contra quem foge em linha reta: a 6 contra 4,6 a pedra se
 * aproxima 1,4 tile/s e nunca chega. Contra alvo em fuga, projetil so ameaca se
 * for claramente mais rapido que o alvo. O que torna o arremesso justo nao e a
 * lentidao da pedra, e o telegrafo de 0,8 s antes dela sair.
 */
export const BRUISER_HURL_SPEED = 9;
/**
 * Distancia que a pedra voa, em tiles — deliberadamente MAIOR que o alcance em
 * que o arremesso e decidido.
 *
 * Derivar o alcance de voo do alcance de decisao (9) parecia obvio e nao
 * funcionava: durante os 0,8 s de telegrafo um jogador em fuga corre quase 4
 * tiles, entao no instante do lancamento ele ja esta ALEM do alcance de
 * decisao. Medido, a pedra morria a meio caminho e o arremesso acertava zero
 * contra quem simplesmente segurava o botao de andar para tras. O excedente e a
 * margem para alvo em movimento.
 */
export const BRUISER_HURL_FLIGHT_TILES = 20;
export const BRUISER_HURL_DAMAGE = 22;
/** Corpo fisico do bloco arremessado, maior que cuspe/bolt. */
export const BRUISER_ROCK_RADIUS = 0.46;
/** A pancada interrompe o Prospector por 1,2 s. */
export const BRUISER_ROCK_STUN_TICKS = Math.round(1.2 * TICK_HZ);
/** Vida do bruiser: ver ARCHETYPES. 95 dava 1,7 s de vida — um arremesso so. */
/** Raio de busca, em celulas, do bloco que ele arranca para usar como municao. */
export const BRUISER_HURL_REACH = 3;

/**
 * De quantos em quantos ticks o guardiao recalcula a rota.
 *
 * Meio segundo: o alvo anda no maximo ~2 tiles nesse intervalo, e a busca e a
 * coisa mais cara que a simulacao faz por criatura. Recalcular a cada tick
 * gastaria vinte vezes mais para mudar quase nada na rota.
 */
export const GUARDIAN_PATH_INTERVAL_TICKS = 10;

/**
 * Cerco da segunda fase do guardiao.
 *
 * Raio 7 da uma sala de 15x15: espaco para desviar e usar o terreno, e pouco
 * para vencer andando para tras. As saidas sao poucas de proposito — elas
 * existem para que haja escolha ("abro caminho ou encaro?"), nao para que fugir
 * seja o plano obvio.
 *
 * Quatro invocados e nao dois porque o stalker anda a 5,2 contra os 4,6 do
 * jogador: dentro de um espaco fechado, sao eles que punem quem fica so
 * circulando. O guardiao segura o centro; eles cobram a orbita.
 */
export const GUARDIAN_ARENA_RADIUS = 7;
export const GUARDIAN_ARENA_EXITS = 2;
export const GUARDIAN_SUMMON_COUNT = 4;

export const BOLT_SPEED = 13; // tiles/s
export const BOLT_DAMAGE = 14;
export const BOLT_COOLDOWN_TICKS = 5;

export const ABILITY_COOLDOWN_TICKS = 120; // pulso cinetico
export const ABILITY_RADIUS = 2.6;
export const ABILITY_KNOCKBACK = 3.2;

export const PURGE_CELL_HEAL = 18;
export const PURGE_CELL_RADIUS = 3;

export const EXPLOSION_RADIUS = 2.4;
export const EXPLOSION_DAMAGE = 42;
/**
 * Quanto do proprio estrago o jogador leva de volta. Era 0.35 — um desconto de
 * 65% que tirava o risco justamente de onde ele devia estar: detonar uma nuvem
 * de enxofre colado na parede era quase de graca, e "o mundo e o inimigo
 * principal" nao sobrevive a isso. Metade do desconto, metade do dano: o numero
 * agora e legivel de cabeca no meio da luta.
 */
export const PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE = 0.5;
export const EXPLOSIVE_ARM_DISTANCE = 2.25;
export const RETURN_DISC_MAX_DISTANCE = 8;
export const RETURN_DISC_SPEED = 11;
export const SALVAGE_SCAN_TICKS = 6 * TICK_HZ;

export const CONTAMINATION_PER_TICK = 1 / (TICK_HZ * 60 * 14); // ~14 min ate 1.0
export const VENT_BASE_INTERVAL_TICKS = 160;

export const ENEMY_MIN_SPAWN_DIST = 12;
export const GUARDIAN_HP = 420;

// Co-op: estado abatido, revive e extracao coletiva.
export const MAX_PLAYERS = 2;
export const BLEEDOUT_TICKS = 20 * TICK_HZ; // ~20s abatido antes de morrer
export const REVIVE_RADIUS = 1.5;
export const REVIVE_HP_FRACTION = 0.35;
export const EXTRACT_RADIUS = 3;

export const RUN_SEED_MIX = 0x9e3779b9;
