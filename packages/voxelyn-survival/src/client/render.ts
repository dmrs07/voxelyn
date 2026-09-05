import {
  depthIntensity,
  LEYLINE_CHARGE_TICKS,
  LEYLINE_NODE_INTERACT_RADIUS,
  SOLID_CRYSTAL,
  SOLID_CRYSTAL_DULL,
  SOLID_FRAGILE,
  SOLID_FRAGILE_WEAK,
  SOLID_LEYLINE,
  SOLID_LEYLINE_NODE,
  SOLID_NONE,
  SOLID_ROCK,
  SOLID_ORE,
  SOLID_ORE_CHIPPED,
  SOLID_ORE_SPENT,
  SURF_BIOFLUID,
  SURF_FIRE,
  MINER_MOOD_ENRAGED,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_NONE,
  SURF_SCORCHED,
  SURF_SPORES,
  SURF_WATER,
  SURF_EMBER,
  SURF_ICE,
  SURF_ICE_CRACKED,
  SURF_ICE_FRACTURED,
  SURF_ICE_CRITICAL,
  SURF_DEEP_WATER,
  BOSS_PHASE_DELUGE,
  SURF_GLASS,
  SURF_RAIL,
  SURF_SILT,
  SURF_RAIL_V,
  DEVOURER_AIRBORNE,
  DEVOURER_BURROWED,
  DEVOURER_MAW,
  DEVOURER_MAW_BITE_RADIUS,
  mawReach,
  CANARY_DEAD_AT,
  CONTAMINATION_WAVES,
  TICK_HZ,
  LURKER_HIDDEN,
  BOSS_PHASE_OVERHEAT,
  DIAMANDIS_DEMOLISH_RADIUS,
  DIAMANDIS_DEMOLISH_WINDUP_TICKS,
  FURNACE_HEART_STALACTITE_RADIUS,
  FURNACE_HEART_STALACTITE_WARNING_TICKS,
  BOSS_PHASE_UNSTABLE,
  ABILITY_RADIUS,
  FREEZE_MAX,
  FREEZE_THAW_LAYER,
  freezeFraction,
  FROST_QUEEN_FREEZE_RADIUS,
  HEAT_MAX,
  PURGE_CELL_HEAL,
  PURGE_CELL_RADIUS,
  MINIGUN_SPIN_FIRE_AT,
  MINIGUN_SPIN_MAX,
  RICOCHET_BOUNCES,
  liveProjectileModules,
  moduleHasCapacity,
  countCoresTaken,
  furnaceSweepAt,
  isDeluged,
  delugeFront,
  delugeDepth,
  isPipe,
  FURNACE_OVERHEATING,
  WELL_OFFER_REACH,
  LEVIATHAN_LID_RADIUS,
  LEVIATHAN_PROBE_DEEPEN_WINDUP_TICKS,
  LEVIATHAN_PROBE_WINDUP_TICKS,
  LEVIATHAN_SHOCK_WINDUP_TICKS,
  bubbleShellRadius,
  insideAnyBubble,
  leviathanPosture,
  leviathanTargetable,
} from '@voxelyn/survival-sim';
import {
  LEVIATHAN_HEAD_MASS_RADIUS,
  LEVIATHAN_MASS_RADIUS,
  leviathanPieceFrame,
  LEVIATHAN_SINK_PX,
  LeviathanBodies,
  leviathanSubmersions,
  type LeviathanBodyHead,
  type LeviathanBodyNode,
} from './leviathan-body';
import { AIM_JOYSTICK_RADIUS, MOVE_JOYSTICK_RADIUS, type InputState } from './input';
import type {
  AbilityId,
  ActiveModule,
  Entity,
  ModuleId,
  OccupationId,
  RunSummary,
  SemanticEvent,
  StratumId,
  SurvivalState,
} from '@voxelyn/survival-sim';
import {
  ATLAS_SCALE,
  SpriteBank,
  SurfaceBank,
  TerrainBank,
  deriveAnim,
  type EntityAnimState,
  PropBank,
} from './sprites';
import { MAW_CLOUDS, MAW_NO_RETURN_RADIUS, MAW_STREAKS, mawCloud, mawStreak } from './maw-vortex';
import {
  DevourerSpines,
  DEVOURER_BELOW_ANCHOR_PX,
  DEVOURER_HIDDEN_PX,
  devourerHeadLiftPx,
  devourerHeadShows,
  devourerSubmergence,
  type SpineNode,
} from './devourer-spine';
import { VoxelParticles, frameDeltaMs, hitMaterialOf } from './particles';
import { DAMAGE_FAN, damageAlpha, damageScale, drawDamageNumber } from './damage-text';
import { ProjectileView, SMALL_PROJECTILE_RADIUS } from './projectiles';
import { EntityPresentation } from './presentation';
import { HEAT_WARN_AT } from './audio/ambience';
import { PRESETS, type QualityLevel, type QualityPreset } from './settings';
import { TouchIconBank } from './touch-icons';
import { addFlash, flashPower, pruneFlashes, type Flash } from './flash';
import {
  FROST_BURST_MS,
  frostBurst,
  frostBurstFrame,
  pieceGrow,
  type FrostBurst,
} from './frost-burst';
import {
  frostCracks,
  frostPieces,
  frostShell,
  frostTint,
  thermalPulse,
  type FrostPiece,
} from './frost-shell';
import { takeFrostHint } from './frost-hints';

/** Altura do Prospector, em raios de corpo, para a geada e a estatua. */
const FROST_BODY_HEIGHT = 3.8;
import {
  LEAP_PEAK_PX,
  leapHeight,
  leapProgress,
  leapShadowAlpha,
  leapShadowScale,
} from './leap-arc';
import {
  applyBossModuleMark,
  bossModuleNameKey,
  bossModulePresentation,
  type BossModuleMark,
} from './boss-module-presentation';
import { DIAMANDIS_LINES, diamandisLineFor } from './audio/boss-voice-lines';
import { drawGroundShadow, drawVoxel, type FaceRamp } from './voxel-draw';
import { COMBAT_PLANE_TILES, heightToScreenPx } from './combat-plane';
import { drawEmissiveHalo } from './emissive-halo';
import {
  FACE_LEFT,
  FACE_RIGHT,
  FACE_TOP,
  LIGHT_NEUTRAL,
  LightField,
  bounceOf,
  type Bounce,
  type WorldLight,
} from './lighting';
import { DEVOURER_BROOD_ATLAS, DEVOURER_COIL_ATLAS, type FaceLighting, type Tint } from './sprites';
import {
  CHASSIS_RESPONSE,
  CREATURE_RESPONSE,
  PROP_RESPONSE,
  solidResponse,
  surfaceResponse,
} from './material-response';
import { drawVoxelEntity } from './voxel-fallback';
import { modulePresentation } from './module-presentation';
import { cachePropChain, choiceSourceTier, dataIntegrityPercent } from './salvage-presentation';
import { cacheLocatorLayout, lerpBearingDeg, locatorTargets } from './cache-locator';
import { drawCacheLocator } from './cache-locator-draw';
import {
  choiceBootPhase,
  drawCrtOverlay,
  drawModuleChoiceCard,
  drawRecoveryTerminal,
  salvageTerminalLayout,
} from './salvage-choice-presentation';
import { abilityPresentation } from './ability-presentation';
import { rewardFlightPosition, type Rect, type SafeInsets } from './module-layout';
import { CasingField } from './casings';
import { MinigunViews } from './minigun-view';
import { ModulePropField, type PropOrigin } from './module-props';
import { chassisFault, drawShortArc } from './chassis-fault';
import { drawBatteryGlyph } from './battery-glyph';
import {
  RouteMemory,
  drawSurveyHud,
  drawSurveyWorld,
  hasSurvey,
  surveyHudHeight,
} from './survey-overlay';
import {
  HUD_OBJECTIVE_FONT,
  HUD_OBJECTIVE_MAX_LINES,
  hpGhostStep,
  hudObjectiveMaxWidth,
  hudDense,
  hudPanelLayout,
  hudScale,
  wrapHudText,
  type HudRect,
} from './hud-layout';
import {
  TargetMotion,
  combatTuningOf,
  drawCombatSenseWorld,
  hasCombatSense,
} from './combat-assist';
import {
  describeCause,
  describeOutcome,
  formatSeed,
  nextStarHint,
  cargoNote,
  reputationNote,
  summaryLines,
} from './run-summary';
import {
  ACTIONS_UNITS,
  TOP_GAP_UNITS,
  layoutEndActions,
  type EndActionRegions,
} from './run-end-actions';
import {
  STARS_UNITS,
  STAR_COUNT,
  STAR_TOP_GAP_UNITS,
  socketAlpha,
  starRowLayout,
  starStamp,
  strikeProgress,
  sweepProgress,
} from './run-stars';
import {
  entryAtlasChain,
  objectiveAtlasChain,
  objectiveLightSpec,
  objectivePropName,
  objectiveViewOf,
} from './objective-prop';
import { placeDecor, propStillValid, sectorRupture, type DecorativeProp } from './decor';
import { CEILING_ALPHA, decorAtlasName, drawDecorProp } from './decor-draw';
import { drawPipeSpill, drawWallEdgeDetail } from './edge-detail';
import { decayTrail, trailAge, trailTtlMs, updateTrail, type LurkerTrail } from './lurker-trail';
import { t } from './i18n';
import {
  deathEchoReadout,
  deathEchoReadoutRegion,
  emptyDeathEchoFrame,
  type DeathEchoFrame,
} from './death-echo-presentation';
import { carcassVariant } from './death-echo-carcass';
import {
  deathEchoTraceDuration,
  decodeDeathEchoTracePoint,
  type PlacedDeathEcho,
} from '@voxelyn/survival-protocol';

/**
 * SOLID_* -> indice em BLOCK_KINDS do atlas de terreno. Tabela explicita em vez
 * de cadeia de ternarios: com oito materiais a cadeia vira uma linha ilegivel e
 * um material novo passa despercebido.
 */
const TERRAIN_KIND_INDEX: Record<number, number> = {
  [SOLID_ROCK]: 0,
  [SOLID_FRAGILE]: 1,
  [SOLID_ORE]: 2,
  [SOLID_CRYSTAL]: 3,
  [SOLID_FRAGILE_WEAK]: 4,
  [SOLID_ORE_SPENT]: 5,
  [SOLID_CRYSTAL_DULL]: 6,
  [SOLID_ORE_CHIPPED]: 7,
  // Leylines: universais como minerio e cristal (linguagem mecanica), entao
  // vivem na tabela e nao na pele por estrato. Indices 15/16 do atlas v5.
  [SOLID_LEYLINE]: 15,
  [SOLID_LEYLINE_NODE]: 16,
};

/**
 * A PELE da rocha comum por estrato: indices 8..13 do atlas de terreno.
 *
 * So a rocha comum troca de pele — fragil, minerio e cristal sao linguagem
 * mecanica e ficam identicos em todo bioma. O basalto usa o indice 0
 * historico: as Galerias sao o mapa original ate no pixel. A simulacao nao
 * sabe disto (SOLID_ROCK continua um ID so); e leitura de LUGAR, e lugar e
 * apresentacao.
 */
const STRATUM_ROCK_KIND = {
  basalt: 0,
  prismatic: 8,
  aquifer: 9,
  sulfur: 10,
  furnace: 11,
  silica: 12,
  glacial: 13,
  ferric: 14,
} as const satisfies Record<StratumId, number>;

/** Indice do bloco no atlas, dado o solido e o estrato do setor. */
export const terrainKindIndexFor = (solid: number, stratum: StratumId): number =>
  solid === SOLID_ROCK ? STRATUM_ROCK_KIND[stratum] : (TERRAIN_KIND_INDEX[solid] ?? 0);

/**
 * SURF_* -> indice em SURFACE_KINDS do atlas de chao. Pela mesma razao da tabela
 * acima: a cadeia de ifs que existia aqui tratava tres dos seis casos e deixava
 * os outros caindo no ramo da rocha nua sem que nada acusasse.
 */
export const SURFACE_KIND_INDEX: Record<number, number> = {
  [SURF_NONE]: 0,
  [SURF_FUNGAL]: 1,
  [SURF_BIOFLUID]: 2,
  [SURF_GAS]: 3,
  [SURF_FIRE]: 4,
  [SURF_SCORCHED]: 5,
  [SURF_SPORES]: 6,
  [SURF_FUNGAL_HEATED]: 7,
  [SURF_WATER]: 8,
  [SURF_EMBER]: 9,
  [SURF_ICE]: 10,
  [SURF_RAIL]: 11,
  [SURF_RAIL_V]: 12,
  [SURF_SILT]: 13,
  [SURF_GLASS]: 14,
  // O ciclo de rachaduras da Cripta e o buraco. No fim da lista, como o atlas.
  [SURF_ICE_CRACKED]: 15,
  [SURF_ICE_FRACTURED]: 16,
  [SURF_ICE_CRITICAL]: 17,
  [SURF_DEEP_WATER]: 18,
};

/**
 * A AGUA PROFUNDA NATIVA DO AQUIFERO no atlas de crostas: o mesmo id de
 * superficie (`SURF_DEEP_WATER`), outro tile. Escolhido por (superficie,
 * estrato) e nao por id, porque a simulacao nao distingue as duas aguas — e
 * nao deve: afogam igual, conduzem igual. O que muda e de onde vieram, e isso
 * o estrato diz: na Cripta todo nucleo profundo e um buraco de placa (a borda
 * de gelo quebrado diz de onde veio); no Aquifero e o miolo de uma bacia, sem
 * gelo nenhum, mais negro e sem moldura por tile.
 */
export const AQUIFER_DEEP_WATER_KIND = 19;

export const surfaceKindIndex = (surf: number, stratum: string): number | undefined =>
  surf === SURF_DEEP_WATER && stratum === 'aquifer'
    ? AQUIFER_DEEP_WATER_KIND
    : SURFACE_KIND_INDEX[surf];

/**
 * Cor de recuo por superficie, para quando o atlas ainda nao carregou ou falhou.
 *
 * Nao e a arte: e o minimo para o jogador nao pisar num gas invisivel enquanto a
 * imagem nao chega. A arte de verdade e o voxel do atlas.
 */
export const SURFACE_FALLBACK: Record<number, string> = {
  [SURF_FUNGAL]: '#1f3d33',
  [SURF_BIOFLUID]: '#2f6b4f',
  // Amarelo-esverdeado, e da paleta mestra: o oliva anterior nao existia nela e
  // apontava para o lado errado agora que a crosta de gas e enxofre.
  [SURF_GAS]: '#a8e63c',
  [SURF_FIRE]: '#ff7a2f',
  [SURF_SCORCHED]: '#0b0e14',
  [SURF_SPORES]: '#66c28a',
  [SURF_FUNGAL_HEATED]: '#6e4a33',
  // Azul da familia da rocha: a agua e escura com reflexos frios, e o verde
  // continua reservado ao biofluido.
  [SURF_WATER]: '#2e3a4d',
  // Brasa: laranja queimado, distinto do fogo vivo — perigo termico visivel
  // mesmo sem o atlas.
  [SURF_EMBER]: '#b3541e',
  // Gelo: o cinza-azulado palido da paleta (mist).
  [SURF_ICE]: '#7b8ba3',
  // Trilho: ferrugem — o jogador precisa ver a LINHA mesmo sem atlas,
  // porque pisar nela arma a armadilha.
  [SURF_RAIL]: '#6e4a33',
  [SURF_RAIL_V]: '#6e4a33',
  // Silica solta: areia palida. Tem de ser LIDA de longe — e o rastro do
  // Devorador, ou seja, o aviso de por onde ele anda por baixo.
  [SURF_SILT]: '#c9b48c',
  // Vidro: quase branco, frio. A leitura pretendida e "isto aqui esta selado",
  // e o contraste com a areia e o que conta a historia sozinho.
  [SURF_GLASS]: '#dfe9f2',
  // O CICLO DE RACHADURAS, escurecendo degrau a degrau a partir do gelo
  // (#7b8ba3). Sem o atlas nao ha forma nenhuma para ler — so resta a
  // luminancia —, e o que o recuo precisa entregar e a ORDEM: quanto mais
  // escura a celula, mais perto de ceder. Nao e a arte; e o minimo para nao se
  // pisar num buraco invisivel enquanto a imagem nao chega.
  [SURF_ICE_CRACKED]: '#6c7d94',
  [SURF_ICE_FRACTURED]: '#5a6b81',
  [SURF_ICE_CRITICAL]: '#44536b',
  // O buraco: mais escuro que a agua rasa (#2e3a4d) e que qualquer gelo. O
  // unico chao do jogo em que entrar mata sem golpe nenhum.
  [SURF_DEEP_WATER]: '#141b28',
};

/** A cor de recuo da agua profunda do AQUIFERO: mais negra que a da Cripta. */
export const AQUIFER_DEEP_WATER_FALLBACK = '#0b1119';

export const surfaceFallbackColor = (surf: number, stratum: string): string | undefined =>
  surf === SURF_DEEP_WATER && stratum === 'aquifer'
    ? AQUIFER_DEEP_WATER_FALLBACK
    : SURFACE_FALLBACK[surf];

/**
 * Nomes dos estratos e ocupacoes, por chave de catalogo.
 *
 * Tabelas explicitas em vez de `t('biome.' + id)`: a concatenacao passaria no
 * runtime e escaparia do tipo `MessageKey` — uma chave nova sem traducao so
 * apareceria na tela do jogador, como texto cru. Assim, um estrato novo sem
 * entrada aqui quebra a COMPILACAO, que e onde o esquecimento deve doer.
 */
const STRATUM_LABEL_KEY = {
  basalt: 'biome.stratum.basalt',
  prismatic: 'biome.stratum.prismatic',
  aquifer: 'biome.stratum.aquifer',
  sulfur: 'biome.stratum.sulfur',
  furnace: 'biome.stratum.furnace',
  silica: 'biome.stratum.silica',
  glacial: 'biome.stratum.glacial',
  ferric: 'biome.stratum.ferric',
} as const satisfies Record<StratumId, string>;

const OCCUPATION_LABEL_KEY = {
  mycelial: 'biome.occupation.mycelial',
  aurix: 'biome.occupation.aurix',
} as const satisfies Record<Exclude<OccupationId, 'none'>, string>;

/** "CATEDRAL PRISMÁTICA · CICATRIZ AURIX", ou so o estrato quando limpa. */
export const biomeLabel = (stratum: StratumId, occupation: OccupationId): string => {
  const base = t(STRATUM_LABEL_KEY[stratum]);
  if (occupation === 'none') return base;
  return `${base} · ${t(OCCUPATION_LABEL_KEY[occupation])}`;
};

/**
 * O VEU de cor de cada estrato: a luz ambiente que faz um setor parecer OUTRO
 * LUGAR no primeiro relance, antes de qualquer materia no chao.
 *
 * Veio direto de playtest: o Aquifero inteiro lia como "a caverna de sempre,
 * so que com agua", porque as paredes — a maior parte dos pixels da tela — sao
 * o mesmo atlas em todo estrato. Multiplicar o atlas de terreno por estrato
 * custaria sete vezes o orcamento de textura; um veu em tela cheia custa UM
 * fillRect por quadro e muda a leitura do setor inteiro.
 *
 * Regras:
 * - `basalt` NAO tem veu. As Galerias sao o mapa original, e a promessa de
 *   preservacao vale para os pixels tambem — e um veu ausente e a referencia
 *   contra a qual os outros leem como "outro lugar".
 * - Alfa baixo e composicao `overlay` de proposito: o veu desloca o MATIZ sem
 *   comer contraste. Telegrafo, gas e fogo continuam legiveis por baixo — a
 *   promessa "morte sempre anunciada" nao pode ser paga em atmosfera.
 * - Aplicado sobre mundo e entidades, ANTES de particulas, numeros de dano e
 *   HUD: aviso e interface ficam nitidos por cima da atmosfera.
 */
const BIOME_VEIL = {
  basalt: null,
  prismatic: { color: '#8f7aff', alpha: 0.11 },
  aquifer: { color: '#1e5a8a', alpha: 0.2 },
  sulfur: { color: '#a8e63c', alpha: 0.11 },
  furnace: { color: '#ff7a2f', alpha: 0.13 },
  silica: { color: '#b8a98f', alpha: 0.14 },
  glacial: { color: '#9fc2e8', alpha: 0.17 },
  // Ferrifero: oxido — quente e metalico, distinto do laranja vivo da Fornalha.
  ferric: { color: '#b3541e', alpha: 0.12 },
} as const satisfies Record<StratumId, { color: string; alpha: number } | null>;

const drawBiomeVeil = (
  ctx: CanvasRenderingContext2D,
  stratum: StratumId,
  vw: number,
  vh: number,
): void => {
  const veil = BIOME_VEIL[stratum];
  if (!veil) return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = veil.alpha;
  ctx.fillStyle = veil.color;
  ctx.fillRect(0, 0, vw, vh);
  ctx.restore();
};

/**
 * Os raios dos lobos de uma nuvem de silica, como fracao do raio dela.
 *
 * Tres passos e o minimo para a mancha perder o contorno; mais que isso custa
 * um `fill` por nuvem sem mudar a leitura, e as nuvens ja escalam com o preset
 * de qualidade junto com os riscos.
 */
const CLOUD_LOBES = [1, 0.68, 0.36] as const;

/**
 * O TREMOR das duas travessias do Devorador: a areia se abrindo e a areia se
 * fechando.
 *
 * As duas nao pesam igual, e por isso sao dois numeros. Sair e um movimento de
 * BAIXO PARA CIMA — o chao cede e ele passa — e o jogador ja tem 1,2 s de
 * telegrafo antes dele. Entrar e seis tiles de corpo desabando de um arco de um
 * tile de altura, e e a unica das duas que cobra dano num raio maior que a
 * cabeca (ver DEVOURER_SLAM_RADIUS). O tremor conta essa diferenca sem uma
 * linha de interface.
 *
 * Medidos contra os que ja existem nesta lamina: a detonacao do jogador tem 5,
 * a virada do Coracao 7, o desabamento da Ruptura 9. O pouso do chefe entra
 * entre a virada e o desabamento; a decolagem, logo abaixo da detonacao.
 */
/**
 * Os dois eixos dos quadros da ninhada, e a cadencia da ondulacao dela.
 *
 * Duplicados do gerador de atlas (`entities.mjs`) porque o manifest publica a
 * CONTAGEM total de quadros e nao como ela se fatora — 18 quadros nao dizem
 * sozinhos se sao tres variantes de seis fases ou seis de tres. Ha um teste que
 * cobra a igualdade dos dois lados.
 *
 * 110 ms por fase da uma volta em 0,66 s: rapido o bastante para o bicho parecer
 * nervoso, devagar o bastante para nao virar cintilacao num sprite de 12 px.
 */
/**
 * Quantos ticks desde o pouso, ou `null` se este cliente nao viu o pouso.
 *
 * A distincao entre "zero ticks" e "nao vi" e a razao de existir: as duas viram
 * profundidades opostas (`0` = ainda na superficie, `null` = sumido), e um
 * `?? 0` no lugar disto desenharia meio verme boiando para todo mundo que
 * entrasse na sala com o chefe ja enterrado.
 */
const landedAgo = (landedAt: number | undefined, tick: number): number | null =>
  landedAt === undefined ? null : tick - landedAt;

export const BROOD_VARIANTS = 3;
export const BROOD_PHASES = 6;
const BROOD_FRAME_MS = 110;

const DEVOURER_DIVE_SHAKE = { power: 8, ms: 360 } as const;
const DEVOURER_BREACH_SHAKE = { power: 4, ms: 240 } as const;

export const TILE_W = 32;
export const TILE_H = 16;
const WALL_H = 14;

/**
 * As teclas dos dois botoes da tela de fim.
 *
 * Cromo neutro de lingua — a tecla R e R em qualquer catalogo, como o serial do
 * documento — e por isso constantes, e nao chaves. Ficam em variavel tambem
 * porque a varredura de texto solto le `fillText('...')` como prosa fora do
 * catalogo, e ela esta certa em ler: a excecao e que precisa ser explicita.
 * Precisam bater com o que `input.ts` escuta.
 */
const KEY_RESTART = 'R';
const KEY_TERMINAL = 'T';

/**
 * O que muda entre um chamador e outro da tela de fim.
 *
 * `actions` existe por causa da arena de chefes: la a tela de fim da simulacao
 * e desenhada ATRAS do proprio resultado da ferramenta, em HTML, e o laco da
 * arena nao le nem o toque nem as teclas R/T. Desenhar os dois botoes ali seria
 * oferecer duas saidas que nao levam a lugar nenhum — pior do que nao oferecer
 * nenhuma, porque um botao promete que funciona.
 */
export type EndScreenOptions = { input?: InputState; actions?: boolean };

/**
 * Os glifos da nota. Simbolos, nao prosa: nenhuma lingua tem outra estrela.
 * Em variavel pela mesma razao das teclas — a varredura de texto solto le
 * `fillText('...')` como frase fora do catalogo, e ela esta certa em ler.
 */
const STAR_FILLED = '★';
const STAR_EMPTY = '☆';

/**
 * Quem pediu menos movimento recebe a mesma INFORMACAO sem a animacao — nunca
 * menos informacao. Lido a cada consulta, e nao uma vez na carga: o jogador
 * pode ligar a preferencia no sistema com o jogo aberto.
 */
const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export type ModuleHudMetrics = { size: number; gap: number };

/** Mantem todos os modulos visiveis dentro da largura compacta do painel. */
export const moduleHudMetrics = (
  count: number,
  availableWidth: number,
  maxSize = 30,
): ModuleHudMetrics => {
  const normalizedCount = Math.max(0, Math.floor(count));
  const minSize = Math.min(24, maxSize);
  if (normalizedCount <= 0) return { size: maxSize, gap: 7 };
  if (normalizedCount === 1) {
    return { size: Math.max(minSize, Math.min(maxSize, availableWidth)), gap: 0 };
  }

  const baseGap = 7;
  const size = Math.max(
    minSize,
    Math.min(
      maxSize,
      Math.floor((availableWidth - baseGap * (normalizedCount - 1)) / normalizedCount),
    ),
  );
  const remaining = Math.max(0, availableWidth - size * normalizedCount);
  const gap = Math.max(3, Math.min(baseGap, remaining / (normalizedCount - 1)));
  return { size, gap };
};

/** A cor do acento de uma notificacao: o que ela significa antes de ser lida. */
export type HudMessageTone = 'info' | 'good' | 'warn' | 'voice';

/**
 * O tom de uma mensagem que a SIMULACAO manda pela chave. A simulacao nao
 * sabe de cor; quem desenha decide, pelo que a chave conta: recusa, perigo e
 * perda avisam; circuito fechado, parceiro de pe e Nucleo na mao sao boas.
 */
export const simMessageTone = (key: string): HudMessageTone => {
  if (/contamination|Sealed|revive|waitAt|Dropped|Collapsed|ceiling|Siege/i.test(key)) {
    return 'warn';
  }
  if (/Revived|Closed|coreTaken/i.test(key)) return 'good';
  return 'info';
};

/** O teal da Aurix, para a legenda das falas do Diamandis. Ver AX.teal no painel de carga. */
const VOICE_CAPTION_COLOR = '#4fd6c9';

// Paleta da art bible (docs/art/voxelyn-survival-art-bible.md)
const PAL = {
  dark: '#0b0e14',
  rockShadow: '#1d2430',
  rock: '#2e3a4d',
  rockLight: '#46566e',
  /** O cinza-azulado palido da paleta mestra: gelo, e a espuma que ele levanta. */
  mist: '#7b8ba3',
  rust: '#6e4a33',
  bone: '#b8a98f',
  fungusDark: '#1f3d33',
  fungus: '#2f6b4f',
  fungusLight: '#66c28a',
  biolum: '#59f2c2',
  acid: '#a8e63c',
  fire: '#ff7a2f',
  blood: '#d93b4c',
  electric: '#7ab8ff',
  loot: '#ffd166',
  player: '#e8f1ff',
};

/**
 * O `spark` que existia aqui saiu junto com a descarga: eram duas linhas
 * tracadas com `Math.random()` a cada quadro, e a descarga agora e voxel — sobre
 * a poca, na grade, e a partir das mesmas celulas que o evento carrega.
 *
 * O `ring` sobreviveu porque nao e materia: e o contorno curto de esquiva e de
 * morte, feedback de leitura imediata sobre a propria entidade. Explosao e pulso
 * — os dois casos em que o anel representava MATERIA sendo lancada — passaram a
 * ser voxels de verdade em VoxelParticles.ring.
 */
export type Fx =
  | {
      kind: 'ring';
      x: number;
      y: number;
      r: number;
      maxR: number;
      color: string;
      life: number;
      maxLife: number;
    }
  | {
      /**
       * A coroa de estilhacos do congelamento da Rainha: lascas em pe abrindo
       * em circulo completo e riscos de po correndo pelo chao. A geometria vem
       * pronta de `frost-burst.ts` (pura, semeada pelo evento) e aqui so se
       * desenha — o unico efeito 2D que sobrou junto ao anel, e por decisao:
       * uma lasca de gelo e uma LAMINA fina inclinada, e um cubo de voxel nao
       * tem como ler assim.
       */
      kind: 'frostBurst';
      x: number;
      y: number;
      burst: FrostBurst;
      life: number;
      maxLife: number;
    }
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      color: string;
      life: number;
      maxLife: number;
      /**
       * Deslocamento lateral em tiles, para acertos seguidos no mesmo alvo nao
       * empilharem no mesmo pixel. Sem ele, uma rajada em cima de um inimigo
       * desenha cinco numeros exatamente sobrepostos e o resultado nao e um
       * numero grande — e um borrao que nao se le.
       */
      offsetX: number;
      /** Escala do texto: golpe forte, numero maior. */
      scale: number;
    };

export type CameraShake = { power: number; until: number };

/**
 * Comprimento maximo da faixa de mira, em tiles.
 *
 * NAO e o alcance do tiro: o bolt viaja 13 tiles/s por 1,4 s, ou seja mais de 18
 * tiles, e uma faixa desse tamanho atravessaria a tela inteira e viraria o
 * elemento mais chamativo do jogo. Sete tiles cobrem a distancia em que o
 * jogador de fato escolhe alvo e ainda mostram a parede que vai interromper o
 * tiro. A faixa promete DIRECAO e LARGURA, nunca alcance — e por isso ela se
 * apaga no fim em vez de terminar num traco reto, que leria como "para aqui".
 */
export const AIM_LANE_LENGTH = 7;
/** Passo do raycast da faixa, em tiles. Um quarto de tile nao pula parede. */
const AIM_LANE_STEP = 0.25;
/**
 * Intensidade da faixa com o gatilho SOLTO — o estado permanente do desktop.
 *
 * O preco de uma faixa que nunca sai da tela e ela precisar ser lida de canto de
 * olho e nunca disputar atencao com o que se move. Um terco e o ponto em que ela
 * ainda diz rumo e parede sobre a rocha escura, e ja nao puxa o olho: a
 * confirmacao vem no aperto, quando ela abre inteira.
 */
export const IDLE_AIM_LANE_ALPHA = 0.34;

/**
 * Piso de luz da caverna: o preto do fundo, e nao zero.
 *
 * Estava embutido em `brightness` como um literal. Publicado porque o corte de
 * visibilidade (`b <= 0.045`) esta a um cabelo dele, e os dois numeros precisam
 * ser lidos juntos: acima do piso a celula existe, no piso ela some.
 */
const AMBIENT_FLOOR = 0.04;

/**
 * Altura padrao de uma fonte de luz acima do chao, em tiles.
 *
 * A lanterna do chassi, o marcador do objetivo e os clarões de evento saem mais
 * ou menos da altura do peito de quem os provocou. E dela que sai o `N.L` do
 * piso: uma fonte rasteira ilumina forte logo abaixo de si e passa a RASPAR
 * conforme se afasta, que e a razao fisica de uma poca de fogo acender um
 * circulo pequeno e intenso em vez de um disco chapado do tamanho do alcance.
 */
const LAMP_HEIGHT = 0.7;

/** A luz que um projetil emite, ou null para o que nao brilha. */
type ProjectileLightSpec = { r: number; power: number; hex: string };

/**
 * O TIRO COMO FONTE DE LUZ.
 *
 * Cada peca acende na propria cor, que e a mesma com que ela e desenhada — o
 * estilhaco do jogador em biolum, o cuspe acido em verde, o explosivo armado em
 * ambar (a mesma troca de rampa que avisa que ele ja pode detonar), a pedra do
 * Britador na eletricidade do nucleo que a arrancou.
 *
 * Raios CURTOS de proposito. O que se quer e o corredor piscando enquanto o
 * tiro passa, e nao um jogo iluminado por munição: uma luz de raio grande em
 * cada projetil apagaria o escuro, que e a materia-prima do jogo inteiro.
 */
const projectileLightSpec = (projectile: {
  kind?: string;
  hostile: boolean;
  modules?: { explosive?: { armAfterDistance: number } };
  distanceTravelled?: number;
}): ProjectileLightSpec | null => {
  if (projectile.kind === 'return_disc') return { r: 1.6, power: 0.34, hex: PAL.loot };
  if (projectile.kind === 'rock') return { r: 1.4, power: 0.26, hex: PAL.electric };
  if (projectile.kind === 'seeker') return { r: 2.1, power: 0.44, hex: '#ffa63f' };
  // FLECHETTE: a luz mais fraca do arsenal, e a razao e aritmetica. Com a
  // Minigun na cadencia maxima ha ate quinze balas vivas ao mesmo tempo; se
  // cada uma acendesse como um estilhaco comum (raio 1,8), a arma
  // sozinha apagaria o escuro que e a materia-prima do jogo. Um sexto do raio
  // e menos de um terco da potencia: as quinze somadas custam pouco mais que
  // um bolt, e o que sobra e o corredor CINTILANDO enquanto o muro passa, que
  // e exatamente o que a arma deve parecer.
  if (projectile.kind === 'flechette') return { r: 0.62, power: 0.12, hex: PAL.biolum };
  if (projectile.hostile) return { r: 1.5, power: 0.3, hex: PAL.acid };
  const armed =
    projectile.modules?.explosive &&
    (projectile.distanceTravelled ?? 0) >= projectile.modules.explosive.armAfterDistance;
  if (armed) return { r: 2.4, power: 0.55, hex: '#ffa63f' };
  return { r: 1.8, power: 0.4, hex: PAL.biolum };
};

/** Um trecho reto da faixa: comeco, fim e o rumo unitario entre os dois. */
export type AimLaneLeg = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  nx: number;
  ny: number;
  length: number;
};

/**
 * O trajeto que a faixa de mira desenha, ja com os rebotes.
 *
 * Sem Ricochete a resposta e um trecho so, que para na primeira pedra. Com ele,
 * a faixa segue ate o ULTIMO quique — que e a unica leitura util do modulo: um
 * tiro que rebate so vale a pena se der para escolher a parede, e escolher a
 * parede exige ver para onde ela devolve.
 *
 * A reflexao repete a da simulacao a letra (`bounceOffSolid`): espelha no eixo
 * por onde o tiro ENTROU na celula solida e retoma da posicao anterior. Deduzir
 * de outro jeito daria uma faixa que aponta para um lugar e um projetil que vai
 * para outro, e uma previsao errada e pior do que nenhuma.
 *
 * O QUE ELA NAO PROMETE: a simulacao so rebate no que NAO cedeu — parede
 * quebrada absorve o tiro em vez de devolve-lo. Prever isso exigiria saber a
 * vida do material, e a faixa passaria a mentir de um jeito novo (apagar o
 * quique num bloco que aguentou). Ela desenha a geometria do rebote supondo que
 * a parede segura, que e o caso da rocha — a esmagadora maioria das paredes.
 *
 * Pura e exportada: o teste confere o angulo de saida sem precisar de canvas.
 */
export const aimLanePath = (
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  isSolid: (x: number, y: number) => boolean,
  bounces = 0,
  maxLength = AIM_LANE_LENGTH,
): AimLaneLeg[] => {
  const initial = Math.hypot(dirX, dirY);
  if (initial < 1e-6) return [];

  const legs: AimLaneLeg[] = [];
  let x = originX;
  let y = originY;
  let nx = dirX / initial;
  let ny = dirY / initial;
  // O alcance e do TIRO, e nao de cada trecho: os rebotes repartem os mesmos
  // sete tiles. Um tiro que rebate nao viaja mais longe por rebater.
  let budget = maxLength;
  let left = Math.max(0, Math.floor(bounces));

  for (;;) {
    let travelled = 0;
    let hitX = 0;
    let hitY = 0;
    let blocked = false;
    for (let d = AIM_LANE_STEP; d <= budget + 1e-9; d += AIM_LANE_STEP) {
      const px = x + nx * d;
      const py = y + ny * d;
      if (isSolid(px, py)) {
        blocked = true;
        hitX = px;
        hitY = py;
        break;
      }
      travelled = d;
    }

    legs.push({
      x0: x,
      y0: y,
      x1: x + nx * travelled,
      y1: y + ny * travelled,
      nx,
      ny,
      length: travelled,
    });
    budget -= travelled;
    if (!blocked || left === 0 || budget <= AIM_LANE_STEP) break;

    // Espelha no eixo por onde ENTROU na celula, exatamente como a simulacao.
    const prevX = x + nx * travelled;
    const prevY = y + ny * travelled;
    const enteredX = Math.floor(prevX) !== Math.floor(hitX);
    const enteredY = Math.floor(prevY) !== Math.floor(hitY);
    if (enteredX) nx = -nx;
    if (enteredY) ny = -ny;
    if (!enteredX && !enteredY) {
      if (Math.abs(nx) >= Math.abs(ny)) nx = -nx;
      else ny = -ny;
    }
    x = prevX;
    y = prevY;
    left--;
  }

  return legs;
};

/** Ate onde a faixa alcanca em linha reta. Atalho para o caso sem rebote. */
export const aimLaneReach = (
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  isSolid: (x: number, y: number) => boolean,
  maxLength = AIM_LANE_LENGTH,
): number => {
  const [first] = aimLanePath(originX, originY, dirX, dirY, isSolid, 0, maxLength);
  return first?.length ?? 0;
};

/**
 * Opacidade do gas, num dos QUATRO niveis que a art bible permite.
 *
 * A regra (art bible §2) e alpha binario 0 ou 255 em tudo, com uma excecao
 * nomeada para efeitos — gases e luz — que podem usar 64, 128, 192 ou 255. O
 * gas cai exatamente nessa excecao, mas os niveis sao QUANTIZADOS: nao vale
 * qualquer fracao. O valor esta escrito como `192 / 255` de proposito, para o
 * numero permitido ficar visivel na propria expressao em vez de virar um
 * decimal solto que ninguem consegue conferir de cabeca.
 *
 * 192 e nao 128 porque o gas MACHUCA: ele tem de ser lido como perigo em menos
 * de 200 ms, sobre pedra escura e na penumbra em que o jogo se passa. Na metade
 * da escala ele se confunde com o proprio chao justamente nas celulas mal
 * iluminadas, que sao as que o jogador atravessa correndo.
 *
 * O alfa e aplicado no DESENHO, nao assado no PNG. Isso mantem o atlas com
 * alpha binario — util porque a mesma peca serve a outros usos — mas tem um
 * custo que vale registrar: o validador de sprites NAO ve este numero, entao
 * nada aqui e verificado automaticamente contra a regra acima.
 */
export const GAS_ALPHA = 192 / 255;

/** Faces da carga eletrica que corre pela poca: topo quase branco sobre azul. */
const CHARGE_RAMP: FaceRamp = ['#e8f1ff', '#7ab8ff', '#2e3a4d'];

/** Posicoes puras dos dois arcos de stun; mesma entidade/tick, mesma leitura em todo cliente. */
export const stunIndicatorOffsets = (
  entityId: number,
  tick: number,
): readonly [number, number][] => {
  const phase = ((tick + entityId * 3) % 8) * (Math.PI / 4);
  return [
    [Math.cos(phase), Math.sin(phase) * 0.45],
    [Math.cos(phase + Math.PI), Math.sin(phase + Math.PI) * 0.45],
  ];
};

const drawStunIndicator = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  z: number,
  entityId: number,
  tick: number,
): void => {
  const lift = size * 2.25 + 6 * z;
  for (const [ox, oy] of stunIndicatorOffsets(entityId, tick)) {
    drawVoxel(ctx, sx + ox * size * 0.75, sy - lift + oy * size, Math.max(2, 2.6 * z), CHARGE_RAMP);
  }
};

/**
 * A perturbacao de superficie de um espreitador oculto (Lampreia sob a agua,
 * Espectro sob o gelo). E TUDO o que aparece dele enquanto `mood` diz
 * escondido: a promessa dos dois biomas e que a posicao se le pela lamina, e
 * nao pelo corpo.
 *
 * Na agua, aneis concentricos que nascem no centro e se dissipam — a ondulacao
 * que a spec descreve. No gelo, rachaduras curtas irradiando, pulsando de leve.
 * Fase e geometria saem do id e do relogio, nunca de sorteio: as duas maquinas
 * de uma sala de co-op desenham a mesma perturbacao no mesmo lugar.
 */
/** Raio da marca da Sondagem no chao, em tiles: o raio de dano. */
const PROBE_MARK_RADIUS = 1.7;

/**
 * A LINHA D'AGUA de um sprite do Leviata: onde recortar e quanto descer.
 *
 * A linha e um pouco ACIMA do pe da ancora (o corpo boia com o ventre na
 * agua, nao de pe sobre ela), e a descida completa e a altura util do quadro:
 * a 100% nao sobra um pixel acima da linha. `null` fora da agua.
 */
const leviathanWaterDip = (
  submersion: number,
  sy: number,
  spriteZoom: number,
): { line: number; drop: number } | null => {
  if (submersion <= 0) return null;
  return {
    line: sy + 6 * spriteZoom,
    drop: Math.min(1, submersion) * LEVIATHAN_SINK_PX * spriteZoom,
  };
};

/**
 * A MASSA de um posto do Leviata por baixo da lamina: uma elipse escura sem
 * borda, no plano do chao, na projecao isometrica de um disco de `radius`
 * tiles (a mesma conta do anel das bolhas). O centro e quase opaco e a orla
 * some no nada — uma sombra com contorno seria um objeto; sem contorno e
 * profundidade.
 */
const drawLeviathanMass = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  radius: number,
  z: number,
  alpha: number,
): void => {
  if (alpha <= 0.01) return;
  const rx = radius * TILE_W * 0.5 * Math.SQRT2 * z;
  const ry = radius * TILE_H * 0.5 * Math.SQRT2 * z;
  if (rx < 1 || ry < 1) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1, ry / rx);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0, `rgba(1,3,9,${alpha})`);
  grad.addColorStop(0.5, `rgba(1,3,9,${alpha * 0.7})`);
  grad.addColorStop(1, 'rgba(1,3,9,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** O veu de quem esta debaixo da lamina do Diluvio: azul, apagado, sem detalhe. */
const UNDERWATER_TINT: Tint = { color: 'rgba(38,92,132,0.55)', alpha: 0.55 };

/**
 * Um corpo CORTADO pela lamina do Diluvio: acima da linha d'agua ele e
 * desenhado como e; abaixo dela, azul e apagado; e a linha ganha a ondulacao.
 *
 * E o que faz o NIVEL da agua existir na tela. A lamina e um veu translucido
 * sobre o chao, e um veu nao tem altura: o jogador via o Prospector nitido
 * numa sala que a simulacao dizia estar tres tiles debaixo d'agua, e nao
 * tinha como saber ate onde a agua chegava — nem que o chao sob ela tinha
 * buracos. Com todo corpo cortado na mesma altura, a linha d'agua vira uma
 * referencia que atravessa a cena: e ela que diz "a agua esta na cintura" ou
 * "passou da cabeca".
 *
 * `draw` recebe o tint a usar (o de baixo substitui o do corpo: a agua vence
 * a marcacao de elite ou de geada) e devolve se o sprite existia.
 */
const drawCutByWaterline = (
  ctx: CanvasRenderingContext2D,
  lineY: number,
  sx: number,
  rippleWidth: number,
  z: number,
  nowMs: number,
  draw: (tint: Tint | undefined) => boolean,
): boolean => {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, Math.max(0, lineY));
  ctx.clip();
  const drew = draw(undefined);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, lineY, w, Math.max(0, h - lineY));
  ctx.clip();
  ctx.globalAlpha *= 0.78;
  draw(UNDERWATER_TINT);
  ctx.restore();
  drawWaterlineRipple(ctx, sx, lineY, rippleWidth, z, nowMs, 0.5);
  return drew;
};

/**
 * A ONDULACAO onde um corpo corta a superficie: dois aneis rasos defasados e
 * um traco claro na linha. Mais forte no meio da travessia, nula nas pontas.
 */
const drawWaterlineRipple = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  lineY: number,
  width: number,
  z: number,
  nowMs: number,
  submersion: number,
): void => {
  const strength = Math.sin(Math.max(0, Math.min(1, submersion)) * Math.PI);
  if (strength <= 0.02) return;
  ctx.save();
  for (const offset of [0, 0.5]) {
    const phase = (((nowMs / 700 + offset) % 1) + 1) % 1;
    const r = width * (0.6 + phase * 0.8);
    ctx.strokeStyle = `rgba(150,200,240,${(0.35 * strength * (1 - phase)).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, z);
    ctx.beginPath();
    ctx.ellipse(sx, lineY, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(210,235,255,${(0.28 * strength).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(sx, lineY, width * 0.7, Math.max(1, 1.2 * z), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/**
 * A MARCA DA SONDAGEM ABISSAL: aneis escuros que se contraem para o centro,
 * o miolo escurecendo (o chao encharcando) e, na que afunda a poca, um anel
 * tracejado por fora. Le sem cor: e a UNICA marca do jogo em que os aneis
 * fecham para dentro.
 */
const drawProbeMark = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  radius: number,
  progress: number,
  z: number,
  nowMs: number,
  deepen: boolean,
): void => {
  const ISO = Math.SQRT2;
  const rx = radius * TILE_W * 0.5 * ISO * z;
  const ry = radius * TILE_H * 0.5 * ISO * z;
  ctx.save();
  // O chao encharcando: o miolo escurece com o progresso.
  ctx.fillStyle = `rgba(12,22,38,${(0.15 + progress * 0.45).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tres aneis contraindo, defasados: sempre ha um fechando.
  for (let k = 0; k < 3; k++) {
    const phase = (((nowMs / (900 - progress * 450) + k / 3) % 1) + 1) % 1;
    const scale = 1.7 - phase * 0.9;
    ctx.strokeStyle = `rgba(8,16,30,${(0.35 + phase * 0.5).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, (deepen ? 2.4 : 1.4) * z);
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * scale, ry * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(200,225,245,${(0.12 + phase * 0.25).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, z * 0.6);
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * scale * 0.96, ry * scale * 0.96, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // O anel do raio real, fixo: ate onde a coluna cobra.
  ctx.strokeStyle = `rgba(230,240,255,${(0.35 + progress * 0.4).toFixed(3)})`;
  ctx.lineWidth = Math.max(1, z);
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (deepen) {
    ctx.setLineDash([5 * z, 4 * z]);
    ctx.lineDashOffset = nowMs / 25;
    ctx.strokeStyle = `rgba(230,240,255,${(0.4 + progress * 0.4).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.5, 1.6 * z);
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * 1.25, ry * 1.25, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * A POCA EM EBULICAO: o borbulhar crescente no destino do Leviata — aneis
 * expandindo cada vez mais depressa e um clarao baixo no centro, na
 * intensidade que a chegada dele impoe.
 */
const drawPoolBoil = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  intensity: number,
  z: number,
  nowMs: number,
): void => {
  const ISO = Math.SQRT2;
  const base = (1.2 + intensity * 1.2) * TILE_W * 0.5 * ISO * z;
  ctx.save();
  const rings = 2 + Math.round(intensity * 3);
  for (let k = 0; k < rings; k++) {
    const phase = (((nowMs / (800 - intensity * 450) + k / rings) % 1) + 1) % 1;
    const r = base * (0.3 + phase);
    ctx.strokeStyle = `rgba(170,215,245,${(0.5 * intensity * (1 - phase)).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, (1 + intensity) * z);
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(sx, sy, 1, sx, sy, base * 0.6);
  glow.addColorStop(0, `rgba(120,190,240,${(0.25 * intensity).toFixed(3)})`);
  glow.addColorStop(1, 'rgba(120,190,240,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(sx, sy, base * 0.6, base * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawLurkerDisturbance = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  z: number,
  nowMs: number,
  entityId: number,
  inWater: boolean,
  facing: { x: number; y: number } = { x: 1, y: 0 },
): void => {
  const seed = (Math.imul(entityId, 2654435761) >>> 0) % 1000;
  if (inWater) {
    // Dois aneis defasados meio ciclo: sempre ha um visivel, nenhum pisca.
    for (const offset of [0, 0.5]) {
      const phase = (((nowMs / 900 + seed / 1000 + offset) % 1) + 1) % 1;
      const r = size * (0.5 + phase * 1.6);
      ctx.strokeStyle = `rgba(122,184,255,${(0.4 * (1 - phase)).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, z);
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  // GELO: A NEVOA DE GEADA. O Espectro escondido nao e um corpo, e um volume
  // baixo e difuso navegando sobre a lamina — forma irregular (nunca uma placa
  // retangular), bordas dissolvendo em voxels soltos, cristais suspensos por
  // dentro, um brilho ciano muito sutil no centro, e riscos de condensacao
  // marcando a DIRECAO. O volume e largo o bastante para dizer "algo se move
  // aqui" sem entregar uma hitbox pixel-perfect: e a promessa do bioma, a
  // posicao se le pela lamina e nao pelo corpo.
  drawFrostMist(ctx, sx, sy, size, z, nowMs, seed, facing, 1);
};

/**
 * A nevoa de geada em si — usada viva (na posicao atual) e no rastro, onde
 * `fade` a apaga. Tudo sai da semente e do relogio: sem sorteio, para o co-op
 * ver a mesma nevoa no mesmo lugar.
 */
const drawFrostMist = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  z: number,
  nowMs: number,
  seed: number,
  facing: { x: number; y: number },
  fade: number,
): void => {
  const hash = (i: number): number =>
    ((Math.imul(seed + i * 7919, 2654435761) >>> 0) % 1000) / 1000;
  const breath = 0.85 + 0.15 * Math.sin(nowMs / 620 + seed);
  const rx = size * 2.2 * breath;
  const ry = size * 1.1 * breath;
  // O brilho ciano no centro: fraco de proposito. E o que separa a nevoa de
  // uma mancha do chao, e nao uma lanterna.
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, rx * 0.8);
  glow.addColorStop(0, `rgba(122,184,255,${(0.26 * fade).toFixed(3)})`);
  glow.addColorStop(1, 'rgba(122,184,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // O volume: lobulos difusos em posicoes semeadas, deslizando devagar. Nove
  // discos de alpha baixo somam uma forma irregular com bordas que somem.
  for (let i = 0; i < 9; i++) {
    const a = hash(i) * Math.PI * 2 + nowMs / (2600 + hash(i + 20) * 1400);
    const d = 0.25 + hash(i + 40) * 0.7;
    const px = sx + Math.cos(a) * rx * d;
    const py = sy + Math.sin(a) * ry * d;
    const r = size * (0.32 + hash(i + 60) * 0.3);
    const lobe = ctx.createRadialGradient(px, py, 0, px, py, r);
    lobe.addColorStop(0, `rgba(210,226,246,${(0.36 * fade).toFixed(3)})`);
    lobe.addColorStop(1, 'rgba(210,226,246,0)');
    ctx.fillStyle = lobe;
    ctx.beginPath();
    ctx.ellipse(px, py, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // As bordas dissolvendo: voxels soltos, em dithering, na periferia.
  const dot = Math.max(1, z * 0.9);
  ctx.fillStyle = `rgba(232,241,255,${(0.5 * fade).toFixed(3)})`;
  for (let i = 0; i < 14; i++) {
    const a = hash(i + 80) * Math.PI * 2;
    const d = 0.85 + hash(i + 100) * 0.35 + 0.08 * Math.sin(nowMs / 700 + i);
    ctx.fillRect(
      sx + Math.cos(a) * rx * d - dot / 2,
      sy + Math.sin(a) * ry * d - dot / 2,
      dot,
      dot,
    );
  }
  // Cristais suspensos por dentro: poucos, brilhantes, subindo e descendo.
  ctx.fillStyle = `rgba(244,249,255,${(0.9 * fade).toFixed(3)})`;
  for (let i = 0; i < 4; i++) {
    const a = hash(i + 120) * Math.PI * 2;
    const d = 0.2 + hash(i + 140) * 0.5;
    const bob = Math.sin(nowMs / 520 + i * 1.7) * size * 0.18;
    const c = Math.max(1, z * 1.2);
    ctx.fillRect(
      sx + Math.cos(a) * rx * d - c / 2,
      sy + Math.sin(a) * ry * d - size * 0.35 + bob - c / 2,
      c,
      c,
    );
  }
  // A condensacao marca a direcao: riscos de geada ATRAS do movimento, na
  // projecao 2:1 do rumo.
  const fx = facing.x - facing.y;
  const fy = (facing.x + facing.y) * 0.5;
  const flen = Math.hypot(fx, fy) || 1;
  ctx.strokeStyle = `rgba(184,200,224,${(0.45 * fade).toFixed(3)})`;
  ctx.lineWidth = Math.max(1, z * 0.7);
  for (let i = 0; i < 3; i++) {
    const side = (i - 1) * size * 0.45;
    const x0 = sx - (fx / flen) * size * 0.4 + (-fy / flen) * side;
    const y0 = sy - (fy / flen) * size * 0.2 + (fx / flen) * side * 0.5;
    const len = size * (0.9 + hash(i + 160) * 0.6);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 - (fx / flen) * len, y0 - (fy / flen) * len * 0.5);
    ctx.stroke();
  }
};

/**
 * Uma PEGADA do rastro de espreitador (ver lurker-trail.ts): a versao que
 * desbota da perturbacao viva. Na agua, um anel que se abre e dissipa; no
 * gelo, duas rachaduras FIXAS que so perdem contraste — rachadura nao
 * desfaz. A geometria sai da posicao quantizada da pegada: as duas maquinas
 * de um co-op desenham o mesmo risco no mesmo lugar.
 */
const drawLurkerTrailPoint = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  z: number,
  age: number,
  inWater: boolean,
): void => {
  const fade = 1 - age;
  if (fade <= 0) return;
  if (inWater) {
    const r = size * (0.45 + age * 1.3);
    ctx.strokeStyle = `rgba(122,184,255,${(0.26 * fade).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, z * 0.8);
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  // Gelo: a nevoa que ficou para tras, apagando — mais estreita que a viva,
  // para o rastro ler como esteira e nao como um segundo corpo.
  const seed =
    (Math.imul(Math.round(sx * 3) + Math.imul(Math.round(sy * 3), 131), 2654435761) >>> 0) % 628;
  drawFrostMist(ctx, sx, sy, size * 0.55, z, 0, seed, { x: 1, y: 0 }, fade * 0.7);
};

/**
 * O visor do parceiro: a luz que sobra dele quando o corpo apaga.
 *
 * Desenhado SEMPRE, iluminado ou nao. Sob a luz ele e um acento que separa o
 * parceiro do jogador local num relance; no breu ele e o unico sinal, e por isso
 * o halo cresce quando a luz cai — a `allyVisorGlow` faz essa conta.
 */
const drawAllyVisor = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  z: number,
  nowMs: number,
  light: number,
): void => {
  const glow = allyVisorGlow(light);
  const cy = sy - size * 1.55;
  const breath = 0.72 + Math.sin(nowMs * 0.004) * 0.14;
  ctx.save();
  ctx.globalAlpha = breath * (0.32 + (1 - allyBodyAlpha(light)) * 0.34);
  ctx.fillStyle = PAL.biolum;
  ctx.beginPath();
  ctx.ellipse(sx, cy, size * glow, size * glow * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PAL.biolum;
  const visor = Math.max(2, size * 0.34);
  ctx.fillRect(
    Math.round(sx - visor / 2),
    Math.round(cy - visor / 2),
    visor,
    Math.max(2, visor * 0.6),
  );
};

const drawModuleGlyph = (
  ctx: CanvasRenderingContext2D,
  id: ModuleId,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void => {
  const u = Math.max(1, Math.floor(size / 8));
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, u);
  if (id === 'piercing') {
    ctx.fillRect(cx - 4 * u, cy - u, 7 * u, 2 * u);
    ctx.beginPath();
    ctx.moveTo(cx + 4 * u, cy);
    ctx.lineTo(cx + u, cy - 3 * u);
    ctx.lineTo(cx + u, cy + 3 * u);
    ctx.fill();
  } else if (id === 'conductive') {
    ctx.beginPath();
    ctx.moveTo(cx - u, cy - 4 * u);
    ctx.lineTo(cx + 2 * u, cy - u);
    ctx.lineTo(cx, cy - u);
    ctx.lineTo(cx + u, cy + 4 * u);
    ctx.lineTo(cx - 3 * u, cy + u);
    ctx.lineTo(cx - u, cy + u);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'explosive') {
    ctx.fillRect(cx - 2 * u, cy - 2 * u, 4 * u, 4 * u);
    for (const [dx, dy] of [
      [0, -5],
      [0, 5],
      [-5, 0],
      [5, 0],
      [-4, -4],
      [4, -4],
      [-4, 4],
      [4, 4],
    ]) {
      ctx.fillRect(cx + dx * u - u / 2, cy + dy * u - u / 2, u, u);
    }
  } else if (id === 'siphon') {
    // Onda serpenteante com a cabeca cheia: o mesmo disparo em S do cartucho
    // (module-hardware.ts), para HUD e terminal dizerem a mesma coisa.
    ctx.lineWidth = Math.max(1.5, u * 1.4);
    ctx.beginPath();
    ctx.moveTo(cx - 4 * u, cy + 2 * u);
    ctx.quadraticCurveTo(cx - 2 * u, cy - 4 * u, cx, cy);
    ctx.quadraticCurveTo(cx + 2 * u, cy + 4 * u, cx + 4 * u, cy - u);
    ctx.stroke();
    ctx.fillRect(cx + 3 * u, cy - 3 * u, 2 * u, 2 * u);
  } else if (id === 'ricochet') {
    ctx.beginPath();
    ctx.moveTo(cx - 4 * u, cy + 3 * u);
    ctx.lineTo(cx, cy - 2 * u);
    ctx.lineTo(cx + 4 * u, cy + 2 * u);
    ctx.stroke();
    ctx.fillRect(cx + 2 * u, cy, 3 * u, u);
  } else if (id === 'minigun') {
    // Caixa de municao a esquerda + toco de cano a direita, a mesma leitura do
    // cartucho: a MUNICAO e a peca, e o cano e um toco.
    //
    // Vinte e dois pixels nao comportam as aletas do motor nem a ventoinha, e
    // tentar reproduzi-las daria ruido. O que sobrevive nesta escala e a
    // PROPORCAO — um bloco alto contra um toco baixo —, e ela e o que separa o
    // glifo do perfurante (tubo unico e comprido) e do disco (circulo).
    ctx.strokeRect(cx - 4.5 * u, cy - 4 * u, 5 * u, 8 * u);
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - 3.5 * u, cy - 2.5 * u + i * 2 * u, 3 * u, u);
    ctx.fillRect(cx + 0.5 * u, cy - 1.5 * u, 4 * u, 3 * u);
    ctx.fillRect(cx + 4.5 * u, cy - 0.5 * u, u, u);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 2 * u, Math.PI * 0.25, Math.PI * 1.75);
    ctx.stroke();
  }
};

/**
 * O glifo da carga: um hexagono mineral, e nao uma moeda.
 *
 * Moeda redonda diria "dinheiro", e a carga nao e dinheiro dentro da run — e
 * pedra que o Prospector arrancou e ainda pode perder. O hexagono e o mesmo
 * simbolo que a Matriz usa na superficie, entao a lasca que sobe do chao e o
 * numero do menu sao visivelmente a mesma coisa.
 */
const drawOreGlyph = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void => {
  const r = size * 0.42;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.11);
  ctx.stroke();
  ctx.restore();
};

const wrapMeasuredText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
};

export const deathEchoBodyAlpha = (light: number): number =>
  light <= 0.05 ? 0 : Math.min(1, 0.15 + Math.max(0, light) * 0.85);

/**
 * Quanto do PARCEIRO a luz do mundo revela.
 *
 * Antes ele era desenhado inteiro, com brilho fixo, atravessando o escuro que
 * esconde todo o resto — o co-op enxergava mais mapa do que o solo pela simples
 * presença de um segundo corpo. Agora o corpo obedece à mesma regra das paredes
 * e das criaturas, e o que sobra no escuro é o visor: uma luz que diz ONDE o
 * parceiro está sem dizer o que há em volta dele.
 */
export const allyBodyAlpha = (light: number): number => {
  const visible = (light - 0.16) / 0.4;
  return Math.max(0, Math.min(1, visible));
};

/**
 * O tamanho do halo do visor, em múltiplos do corpo.
 *
 * Cresce conforme a luz some: iluminado, o visor é um detalhe do sprite; no
 * breu, é a única marca do parceiro e precisa ser encontrável de longe.
 */
export const allyVisorGlow = (light: number): number => 1.6 - allyBodyAlpha(light) * 0.75;

/**
 * A BATIDA DO CORACAO, em amplitude de tremor.
 *
 * Duas gaussianas por ciclo — a sistole forte e a diastole a 38% do caminho,
 * mais fraca — e nao um seno. Um tremor senoidal le como motor ligado; o que
 * este precisa dizer e que ha um corpo batendo do outro lado da sala, e o
 * ouvido humano reconhece o par tum-TA antes de reconhecer qualquer outra
 * coisa.
 *
 * A instabilidade acelera E aprofunda a mesma batida, porque e o mesmo coracao
 * piorando: um segundo ritmo diria "outra coisa comecou", e nao "isto esta
 * acabando".
 *
 * Devolve 0 quando nenhuma fase esta ativa — o chamador nem soma.
 */
/**
 * Duracao do aviso e raio de cada marca, IMPORTADOS da simulacao.
 *
 * O estado autoritativo carrega a celula e o relogio de vencimento; a duracao
 * da janela e o raio sao propriedade do golpe e ja moram na sim. Copia-los
 * aqui a mao seria criar dois numeros com a obrigacao de continuarem iguais —
 * e o primeiro rebalanceamento desenharia o anel fechando na hora errada, que
 * e o unico jeito de um telegrafo mentir sem parecer quebrado.
 */
const STALACTITE_LEAD_TICKS = FURNACE_HEART_STALACTITE_WARNING_TICKS;
const BLAST_LEAD_TICKS = DIAMANDIS_DEMOLISH_WINDUP_TICKS;
const STALACTITE_RADIUS = FURNACE_HEART_STALACTITE_RADIUS;
const BLAST_RADIUS = DIAMANDIS_DEMOLISH_RADIUS;

/**
 * A cor que o corpo do Coracao ganha durante o colapso.
 *
 * Pulsa no MESMO relogio do tremor (`heartbeatShake`) de proposito: o corpo
 * clareando junto com a camara tremendo e uma informacao so, contada duas
 * vezes — se as duas batessem fora de fase, o jogador leria duas ameacas.
 *
 * O colapso e vermelho de forja; a instabilidade sobe para o branco-amarelo do
 * `beam`, que e a mesma cor da base do ciclone. Quando ele comeca a cuspir
 * ciclones, o corpo dele ja e da cor deles.
 */
/**
 * As fases que estao ACONTECENDO agora.
 *
 * `phasesFired` e memoria: ela guarda que o chefe cruzou os 45% e nunca apaga,
 * porque uma fase de uma vez nao volta atras. O que a apresentacao quer e
 * outra coisa — a camara ainda esta desabando? — e a resposta depende de o
 * dono dela continuar de pe. Sem este filtro a sala tremeria para sempre
 * depois do abate, que e o oposto exato do alivio que o abate promete.
 */
/**
 * As marcas de chao PENDENTES, derivadas do estado autoritativo.
 *
 * Do ESTADO e nao dos eventos, e a diferenca e a unica que importa aqui: um
 * cliente que reconecta no meio da janela de aviso nunca recebeu o evento que
 * criou a marca, e a queda cobra dele do mesmo jeito. Derivar por quadro custa
 * uma varredura de duas listas quase sempre vazias e fecha o buraco inteiro —
 * sem latch, sem poda e sem uma marca de outro mundo sobrevivendo a descida.
 *
 * A Salva do Diamandis guarda as celulas em `blastCells` mas o RELOGIO dela na
 * acao do chefe, entao ele entra por fora (`blastAt`).
 */
export type GroundMarker = {
  x: number;
  y: number;
  radius: number;
  fireTick: number;
  kind: 'blast' | 'stalactite' | 'probe';
  /** Sondagem que AFUNDA a poca: o aviso mais pesado. */
  deepen?: boolean;
};

export const pendingGroundMarkers = (state: {
  config: { width: number };
  bossRuntime: {
    collapseCells: readonly { idx: number; at: number }[];
    blastCells: readonly number[];
    leviathanProbeCell?: number;
    leviathanProbeDeepen?: boolean;
  };
  enemies: readonly { alive: boolean; action?: { kind: string; releaseAt: number } }[];
}): GroundMarker[] => {
  const w = state.config.width;
  const out: GroundMarker[] = [];
  // A SONDAGEM ABISSAL do Leviata: a celula viaja no `bossRuntime` e o relogio
  // na acao dele — o mesmo contrato da Salva. Quem reconecta no meio do aviso
  // le a marca daqui, sem ter recebido o `probe_marker`.
  const probeCell = state.bossRuntime.leviathanProbeCell ?? -1;
  if (probeCell >= 0) {
    const at = state.enemies.find((e) => e.alive && e.action?.kind === 'probe')?.action?.releaseAt;
    if (at !== undefined) {
      out.push({
        x: (probeCell % w) + 0.5,
        y: Math.floor(probeCell / w) + 0.5,
        radius: PROBE_MARK_RADIUS,
        fireTick: at,
        kind: 'probe',
        deepen: state.bossRuntime.leviathanProbeDeepen ?? false,
      });
    }
  }
  for (const cell of state.bossRuntime.collapseCells) {
    out.push({
      x: (cell.idx % w) + 0.5,
      y: Math.floor(cell.idx / w) + 0.5,
      radius: STALACTITE_RADIUS,
      fireTick: cell.at,
      kind: 'stalactite',
    });
  }
  if (state.bossRuntime.blastCells.length > 0) {
    const at = state.enemies.find((e) => e.alive && e.action?.kind === 'demolish')?.action
      ?.releaseAt;
    // Sem relogio nao ha aviso possivel: meia marca (onde, mas nao quando) e
    // pior que nenhuma, porque ela para de comunicar urgencia e continua
    // ocupando o chao.
    if (at !== undefined) {
      for (const idx of state.bossRuntime.blastCells) {
        out.push({
          x: (idx % w) + 0.5,
          y: Math.floor(idx / w) + 0.5,
          radius: BLAST_RADIUS,
          fireTick: at,
          kind: 'blast',
        });
      }
    }
  }
  return out;
};

export const livePhasesOf = (state: {
  enemies: readonly { archetype: string; alive: boolean }[];
  bossRuntime: { phasesFired: number };
}): number =>
  state.enemies.some((e) => e.alive && e.archetype === 'furnace_heart')
    ? state.bossRuntime.phasesFired
    : 0;

export const furnaceBodyTint = (
  phases: number,
  nowMs: number,
): { color: string; alpha: number } | undefined => {
  const beat = heartbeatShake(phases, nowMs);
  if ((phases & (BOSS_PHASE_OVERHEAT | BOSS_PHASE_UNSTABLE)) === 0) return undefined;
  const unstable = (phases & BOSS_PHASE_UNSTABLE) !== 0;
  // A batida vale ate ~1,55 na sistole; normalizada, ela vira o quanto o corpo
  // clareia acima do piso quente.
  const swell = Math.min(1, beat / (unstable ? 3.4 : 2.1));
  const alpha = (unstable ? 0.5 : 0.34) + swell * 0.22;
  const color = unstable ? '255,233,184' : '217,59,76';
  return { color: `rgba(${color},${alpha.toFixed(3)})`, alpha };
};

export const heartbeatShake = (phases: number, nowMs: number): number => {
  const overheat = (phases & BOSS_PHASE_OVERHEAT) !== 0;
  const unstable = (phases & BOSS_PHASE_UNSTABLE) !== 0;
  if (!overheat && !unstable) return 0;
  const periodMs = unstable ? 620 : 900;
  const peak = unstable ? 3.4 : 2.1;
  const t = (nowMs % periodMs) / periodMs;
  const pulse = (at: number, width: number): number =>
    Math.exp(-((t - at) * (t - at)) / (2 * width * width));
  return peak * (pulse(0, 0.045) + 0.55 * pulse(0.38, 0.05));
};

export class SurvivalRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  zoom = 2;
  fxList: Fx[] = [];
  flashes: Flash[] = [];
  shake: CameraShake = { power: 0, until: 0 };
  /**
   * As NOTIFICACOES centrais. `tone` escolhe a cor do acento (bom, aviso,
   * neutro); `shownAt` e o instante em que a mensagem apareceu de fato, para a
   * entrada suave — preenchido no primeiro quadro em que ela e desenhada.
   *
   * O que entra aqui e PESSOAL ou do MUNDO, nunca do parceiro: um modulo que
   * se esgotou nele, um Eco que ele assimilou, o cano dele que travou, a
   * recusa que o poco deu a ele — nada disso muda uma decisao deste jogador,
   * e no co-op os dois clientes recebem os mesmos eventos. Cada `case` que
   * empurra mensagem decide pelo `slot` do evento.
   */
  messages: Array<{
    text: string;
    startsAt?: number;
    until: number;
    tone?: HudMessageTone;
    shownAt?: number;
  }> = [];
  readonly sprites = new SpriteBank();
  readonly terrain = new TerrainBank();
  readonly surfaces = new SurfaceBank();
  readonly props = new PropBank();
  readonly particles = new VoxelParticles();
  readonly projectileView = new ProjectileView();
  /**
   * O latao da Minigun. Apresentacao pura, com anel de reuso e teto por
   * jogador — ver `casings.ts`. Vive no renderer e nao no `VoxelParticles`
   * porque uma capsula nao e uma particula: ela gira, quica um numero
   * DECLARADO de vezes e assenta, e o sistema de particulas nao tem nenhuma
   * dessas tres coisas.
   */
  readonly casings = new CasingField();
  /**
   * Os cartuchos voando para dentro e para fora do Prospector. Generico: vale
   * para os sete modulos, nao so para a Minigun. Ver `module-props.ts`.
   */
  readonly moduleProps = new ModulePropField();
  /**
   * A rotacao do canhao COMO O CLIENTE A CONHECE, por slot.
   *
   * Existe pelo parceiro remoto: o snapshot dele nao carrega `minigun`, e sem
   * isto o Prospector do outro apareceria com a arma parada cuspindo dezesseis
   * balas por segundo. Ver `minigun-view.ts` — a rampa e reconstruida das
   * transicoes com as constantes da propria simulacao, e o slot local
   * sobrescreve tudo com o valor autoritativo.
   */
  private readonly minigunViews = new MinigunViews();
  /**
   * Onde o card de cada modulo do terminal foi desenhado por ultimo.
   *
   * Medido no DESENHO e nao recalculado: o layout depende da viewport, do
   * modo de toque e das margens seguras, e uma segunda conta divergiria da
   * primeira em alguma tela — o cartucho sairia voando de um ponto vazio.
   * Sobrevive ao fechamento do painel de proposito: o `module_selected` chega
   * no tick seguinte ao toque, quando o painel ja sumiu.
   */
  private readonly choiceCardCenters = new Map<ModuleId, { x: number; y: number; at: number }>();
  /**
   * Modulos que acabaram e ainda nao foram cuspidos.
   *
   * O `module_expired` chega em `ingestEvents`, que roda FORA do desenho e nao
   * tem estado: a posicao e o rumo do Prospector que perdeu a peca so existem
   * no quadro seguinte. Enfileirar aqui e resolver la e o que evita a
   * alternativa — obrigar a simulacao a carregar coordenadas num evento que
   * so serve para animar.
   */
  private pendingEjections: Array<{ module: ModuleId; slot: number; at: number }> = [];
  /** Sal incremental das capsulas: duas rajadas iguais nao caem no mesmo lugar. */
  private casingSalt = 0;
  /**
   * A grade de luz do quadro. Vive na instancia e nao na funcao de desenho
   * porque ela REAPROVEITA o buffer: alocar vinte mil floats por quadro
   * entregaria ao coletor de lixo exatamente o orcamento que o espalhamento
   * economizou.
   */
  private readonly lightField = new LightField();
  /** Relogio do ultimo frame, para o passo de FX vir do tempo real. */
  private lastFrameMs = 0;
  /**
   * Arquetipo de cada entidade viva, para o respingo do acerto saber de que
   * materia o alvo e feito.
   *
   * O evento `hit` carrega so `target`, e `ingestEvents` roda fora do render,
   * sem acesso ao estado — daí o mapa. Fica no maximo um quadro desatualizado,
   * o que e irrelevante para escolher a cor de um caco, e nao custa nada:
   * atualizar um Map ja existente por entidade visivel e ruido perto do resto
   * do laco.
   */
  private readonly archetypeById = new Map<number, string>();
  /** Decoracao do setor atual, derivada por seed. Ver decor.ts. */
  private decor: DecorativeProp[] = [];
  private decorKey = '';
  /** Rastro dos espreitadores ocultos, por id. Ver lurker-trail.ts. */
  private readonly lurkerTrails = new Map<number, LurkerTrail>();
  /**
   * O CORPO do Devorador, por id: dez aneis pendurados no rastro da cabeca.
   *
   * Estado de desenho e nao de jogo — a simulacao move so a cabeca e so ela
   * colide. Vive aqui pela mesma razao dos rastros acima: a forma do corpo AGORA
   * depende de por onde a cabeca andou, e isso e uma coisa que so quem viu os
   * quadros anteriores sabe. Ver devourer-spine.ts.
   */
  private readonly devourerSpines = new DevourerSpines();
  /** Os corpos dos Leviatas em cena (ver leviathan-body.ts). */
  private readonly leviathanBodies = new LeviathanBodies();
  /**
   * Se o Devorador estava NO AR no ultimo quadro, por id.
   *
   * O tremor das travessias sai daqui e nao de um evento, e a escolha e de
   * camada: uma sacudida de camera e apresentacao pura, e a transicao que a
   * dispara ja e observavel no humor que o snapshot carrega. Um evento novo so
   * para isso engordaria o fio com um dado que o cliente ja tem.
   *
   * `undefined` significa "primeiro quadro deste chefe": nao ha transicao a
   * anunciar, e sem esta distincao o chefe sacudiria a tela ao aparecer.
   */
  private readonly devourerAloft = new Map<number, boolean>();
  /**
   * O TICK EM QUE CADA DEVORADOR POUSOU, para medir a descida dele.
   *
   * E a unica peca do mergulho que nao viaja no snapshot, e nao ha o que
   * mandar: o pouso e a AUSENCIA da acao de salto, e o instante em que ela
   * some ja e visivel dos dois lados. Guardar aqui e o mesmo que `devourerAloft`
   * ja faz para o tremor — o cliente olha a mesma transicao uma vez so.
   *
   * Quem entra na sala com o chefe ja enterrado nao tem entrada aqui, e o recuo
   * de `devourerSubmergence` e SUMIDO: ver o porque la.
   */
  private readonly devourerLandedAt = new Map<number, number>();
  /** A Ruptura do setor atual (ou null), cacheada junto com a decoracao. */
  private rupture: { x: number; y: number } | null = null;
  /** Proxima posicao do leque de numeros de dano. */
  private damageFanIndex = 0;
  /**
   * Quem afundou NESTE lote de eventos.
   *
   * Existe por causa da ordem: `ice_fall` chega antes do `death` do mesmo
   * Prospector, e o ramo de `death` precisa saber que aquela morte ja tem
   * apresentacao propria para nao carimbar o anel vermelho generico por cima do
   * buraco. Limpo no comeco de cada lote — a memoria nao atravessa quadros.
   */
  private readonly plungedThisTick = new Set<number>();
  private readonly touchIcons = new TouchIconBank();
  private readonly animStates = new Map<number, EntityAnimState>();
  private readonly presentation = new EntityPresentation();
  private readonly modulePulseUntil = new Map<ModuleId, number>();
  /**
   * Peças do Diamandis marcadas no chao, por indice de peça.
   *
   * Indexado pela PEÇA e nao pela posicao: a mesma broca pode soltar, ser
   * arrancada, cair noutro canto e ser arrancada de novo, e cada transicao move
   * a marca em vez de acrescentar mais uma. Ver applyBossModuleMark.
   */
  private readonly bossModuleMarks = new Map<number, BossModuleMark>();
  private safeArea: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  private pendingRewardOrigin: { slot: number; x: number; y: number } | null = null;
  private rewardFlight: {
    worldX: number;
    worldY: number;
    startedAt: number;
    durationMs: number;
    startScreen?: { x: number; y: number };
  } | null = null;
  private choiceRevealAt = 0;
  /**
   * Estado do localizador de cofre: o bearing desenhado persegue o real pelo
   * MENOR arco (ver cache-locator.ts), entao o marcador nunca da meia-volta no
   * anel para andar dois graus. Trocar de alvo rearma sem suavizar.
   */
  private locatorBearing: number | null = null;
  private locatorSiteId: number | null = null;
  private locatorLastMs = 0;
  private purgePulseUntil = 0;
  /** Pulso do contador de carga, disparado por `ore_gained`. */
  private cargoPulseUntil = 0;
  /**
   * Carga AUTORITATIVA da run.
   *
   * Vem do snapshot (`cargoOre`) no online e de `stats.oreCollected` no solo. O
   * evento so ANIMA; quem diz o numero e o estado. Sem isso, quem reconecta veria
   * a carga zerada e decidiria extrair com o numero errado na tela.
   */
  private cargoOre = 0;
  /**
   * Onde o contador de carga foi desenhado por ultimo, em pixels de tela.
   *
   * Medido no desenho e nao recalculado no voo: a largura do painel depende da
   * viewport e o texto depende do idioma e do numero, entao qualquer segunda
   * conta divergiria da primeira em alguma tela.
   */
  private cargoCounterX = 0;
  /**
   * A geometria do painel de status, do ULTIMO quadro desenhado. E dela que a
   * caixa-preta reserva espaco e que os voos (lasca, Purga, cartucho) tiram o
   * alvo — nenhum deles refaz a conta de `hud-layout.ts`.
   */
  private hudPanelRect: HudRect | null = null;
  private hudPurgeGlyph = { x: 30, y: 68 };
  private hudResourcesGlyphY = 68;
  private hudModuleAnchor = { x: 39, y: 95 };
  private hudLastMs = 0;
  /** O rastro da barra de HP (ver `hpGhostStep`). Negativo = ainda nao viu HP. */
  private hpGhost = 1;
  private hpLastFrac = -1;
  private hpHitAtMs = -1e9;
  private hpHitStrength = 0;
  /** A ultima diretiva desenhada, para o veu de "isto e novo" na troca. */
  private objectiveKey: string | null = null;
  private objectiveChangedAtMs = -1e9;
  private coresTakenSeen = -1;
  private coresChangedAtMs = -1e9;
  /** Quando o Prospector local gastou a ultima Celula de Purga. */
  private purgeUsedAtMs = -1e9;
  /** Quando a instrucao "segure disparo" foi repetida pela ultima vez (estatua). */
  private frostHoldNagAtMs = -1e9;
  /** Salões já atravessados neste setor, para SV-04. */
  private readonly route = new RouteMemory();
  /** Estimador de velocidade de alvo, para o marcador de antecipação (IA-03). */
  private readonly targetMotion = new TargetMotion();
  /** Quando o setor corrente começou, no relógio de quadro (SV-01). */
  private sectorEnteredAtMs = 0;
  private lastSector = 0;
  /**
   * Lascas em voo ate o contador.
   *
   * Lista, e nao slot unico como o `rewardFlight` da Purga: minerar rende varias
   * lascas em segundos, e um slot so faria cada nova apagar a anterior no ar. O
   * teto existe porque acima de meia duzia simultaneas o efeito deixa de ser
   * leitura e vira confete.
   */
  private cargoFlights: {
    worldX: number;
    worldY: number;
    startedAt: number;
    durationMs: number;
    amount: number;
    startScreen?: { x: number; y: number };
  }[] = [];
  private deathEchoes: DeathEchoFrame = emptyDeathEchoFrame();
  /**
   * O relogio da tela de fim: qual sumario esta na tela e desde quando.
   *
   * Vive no renderizador, e nao no laco, porque e uma propriedade da TELA e nao
   * da run — os dois modos (solo e co-op) desenham a mesma tela por caminhos
   * diferentes, e nenhum dos dois deveria ter de lembrar de zerar um cronometro
   * de animacao.
   */
  private endScreenKey = '';
  private endScreenAt = 0;
  quality: QualityPreset = PRESETS.high;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponivel');
    this.ctx = ctx;
    this.sprites.load();
    this.terrain.load();
    this.surfaces.load();
    this.props.load();
  }

  setQuality(level: QualityLevel): void {
    this.quality = PRESETS[level];
    // O halo dos emissivos e o primeiro enfeite a sair quando o aparelho nao
    // esta dando conta: e o unico efeito do banco de sprites que nao conta nada
    // ao jogador. O rebaixamento automatico do FpsGovernor passa por aqui.
    this.sprites.bloom = this.quality.bloom;
    this.resize();
  }

  setSafeArea(safeArea: SafeInsets): void {
    this.safeArea = { ...safeArea };
  }

  setDeathEchoes(frame: DeathEchoFrame): void {
    this.deathEchoes = frame;
  }

  isChoiceRevealReady(nowMs: number): boolean {
    return nowMs >= this.choiceRevealAt;
  }

  private animFor(
    id: number,
    x: number,
    y: number,
    hp: number,
    alive: boolean,
    nowMs: number,
  ): EntityAnimState {
    const next = deriveAnim(this.animStates.get(id), x, y, hp, alive, nowMs);
    this.animStates.set(id, next);
    return next;
  }

  resize(): void {
    const dpr = Math.min(this.quality.maxDpr, window.devicePixelRatio || 1); // DPR limitado por qualidade
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Tela pequena: o mundo encolhe um pouco para caber mais SALA na tela.
    // O zoom de 1,6 mostrava pouco mais que o Prospector e o que esta a
    // meia-duzia de tiles dele — num celular em pe, com o painel em cima e
    // os manches embaixo, era pouca caverna para decidir para onde ir. A mira
    // nao depende do zoom (screenToWorldAim le so a direcao), e o atlas ja
    // era desenhado fora de 2x nesta faixa.
    this.zoom = window.innerWidth < 700 || window.innerHeight < 520 ? 1.45 : 2;
  }

  /**
   * O PONTO DE TELA de onde a mira do mouse e medida.
   *
   * O personagem esta desenhado com os PES no centro da tela, e era dali que o
   * vetor da mira saia. So que ninguem aponta o cursor para os pes de um bicho:
   * aponta para o corpo dele, que esta desenhado acima do chao dele. Medir de
   * pe para corpo somava um deslocamento de tela que a projecao isometrica le
   * como DISTANCIA — o tiro saia sistematicamente por tras do alvo, e a
   * diferenca crescia quanto mais perto o alvo estava.
   *
   * Subir a origem para o plano de combate cancela esse erro: os dois extremos
   * do vetor passam a estar na mesma altura, e o que sobra e o rumo de chao
   * verdadeiro. E o mesmo plano em que o projetil e desenhado, entao o tiro
   * tambem passa VISUALMENTE por cima do cursor.
   */
  get aimAnchorLiftPx(): number {
    return heightToScreenPx(COMBAT_PLANE_TILES, TILE_H, this.zoom);
  }

  /** Consome eventos semanticos da sim e cria FX/mensagens/shake. */
  /**
   * Id da entidade do jogador LOCAL. Feedback de dano (cor do numero e shake da
   * camera) depende disto: no co-op o cliente do slot 1 tem id 2, e fixar 1
   * daria feedback de inimigo ao proprio dano e shake pelo dano do parceiro.
   */
  localPlayerId = 1;
  /** Largura do mundo, para converter indice de celula em (x,y) nos FX. */
  worldWidth = 96;

  setLocalPlayerId(id: number): void {
    this.localPlayerId = id;
  }

  /**
   * Esquece tudo o que a run ANTERIOR deixou na apresentacao.
   *
   * O renderer e um singleton e os ids de entidade recomecam do zero a cada run,
   * entao sem esta chamada a intencao de acao guardada para o id 7 do mundo que
   * acabou e aplicada ao id 7 do mundo novo. Como o `endTick` velho pode estar
   * centenas de ticks a frente do tick zero da run nova, o inimigo recem-nascido
   * aparecia executando um ataque que ninguem comecou, virado para um alvo que
   * nao existe, e ficava assim por muitos segundos.
   *
   * Vale para o solo e para o online pelo mesmo motivo: `createRun` e
   * `NetClient.resetSession` produzem os dois um mundo novo com ids reciclados.
   */
  resetRunPresentation(): void {
    this.presentation.reset();
    // Quem afundou na run anterior. Os ids de slot recomecam iguais, e sem a
    // limpeza a run nova nasceria com a morte do slot 0 ja marcada como queda —
    // o anel de morte sumiria do primeiro tombo comum.
    this.plungedThisTick.clear();
    // O latao e os cartuchos sao memoria da RUN: sem a limpeza, a run nova
    // comeca com o chao coberto pelas capsulas da anterior e com um cartucho
    // ejetado quicando numa sala que nunca o viu sair.
    this.casings.clear();
    this.moduleProps.clear();
    this.minigunViews.clear();
    this.choiceCardCenters.clear();
    this.pendingEjections = [];
    // Run nova na MESMA seed/setor nao muda o decorKey — mas os rastros sao
    // memoria da run, nao do mapa: sem isto, ids reciclados herdariam
    // pegadas velhas e as demais desenhariam orfas sobre a run nova.
    this.lurkerTrails.clear();
    this.devourerSpines.reset();
    this.leviathanBodies.reset();
    this.devourerAloft.clear();
    this.devourerLandedAt.clear();
    this.bossModuleMarks.clear();
    // O Levantamento e memoria da RUN pela mesma razao, e o detalhe que torna
    // isso obrigatorio: a run nova comeca no setor 1, como a anterior terminou.
    // `trackSector` compara NUMEROS e sairia cedo, deixando o beacon de SV-01
    // sem disparar e a memoria de rota mostrando os saloes da run passada.
    this.route.reset();
    this.lastSector = 0;
    this.sectorEnteredAtMs = 0;
    // A memoria do painel e da RUN: o rastro de HP da run passada desceria
    // sobre a barra cheia da nova, e a diretiva/Nucleos anunciariam "novo"
    // para o que e so o comeco de sempre.
    this.hpLastFrac = -1;
    this.hpHitAtMs = -1e9;
    this.objectiveKey = null;
    this.objectiveChangedAtMs = -1e9;
    this.coresTakenSeen = -1;
    this.coresChangedAtMs = -1e9;
    this.purgeUsedAtMs = -1e9;
    this.frostHoldNagAtMs = -1e9;
  }

  /**
   * `hex` tem padrao de FOGO porque a maioria dos clarões do jogo e combustao —
   * explosao, ignicao, jato, detonacao de modulo. Quem nao e (a descarga, o
   * pulso) declara a propria cor no ponto de chamada, que e onde a diferenca
   * pode ser lida junto do evento que a causou.
   */
  private addFlash(
    x: number,
    y: number,
    r: number,
    power: number,
    nowMs: number,
    durationMs: number,
    hex: string = PAL.fire,
  ): void {
    addFlash(this.flashes, { x, y, r, power, startedMs: nowMs, durationMs, hex });
  }

  /**
   * A carga AUTORITATIVA da run.
   *
   * Chamado a cada quadro no solo (do proprio estado) e a cada snapshot no
   * online (de `cargoOre`). O evento anima; isto corrige. E o que faz reconectar
   * no meio de uma run mostrar o numero certo em vez de zero.
   */
  setCargoOre(total: number): void {
    this.cargoOre = total;
  }

  /**
   * O relogio do setor, para o beacon de entrada.
   *
   * Detectado por MUDANCA de setor e nao por evento: `sector_entered` existe, mas
   * quem reconecta no meio de um setor nunca o recebe — e o beacon de um setor
   * que ja comecou nao deve disparar de novo. Comparar o numero cobre os dois.
   */
  private trackSector(state: SurvivalState, nowMs: number): void {
    if (state.sector === this.lastSector) return;
    this.lastSector = state.sector;
    this.sectorEnteredAtMs = nowMs;
    this.route.reset();
  }

  ingestEvents(events: SemanticEvent[], nowMs: number): void {
    this.presentation.ingest(events, nowMs);
    this.plungedThisTick.clear();
    // As particulas nascem dos MESMOS eventos autoritativos que os FX antigos.
    // O cliente nunca decide que houve explosao — so a desenha.
    this.particles.budget = this.quality.maxFx * 2;
    this.particles.ingest(events, this.worldWidth, this.quality.maxFx / PRESETS.high.maxFx);
    for (const ev of events) {
      // A LEGENDA de uma fala de chefe, pelo MESMO evento que toca a voz: a
      // tabela e uma so (boss-voice-lines.ts), entao o texto e o som nunca
      // discordam. Sobe como mensagem, no tom de voz, e some com a fala.
      const line = diamandisLineFor(ev);
      if (line) {
        const spec = DIAMANDIS_LINES[line];
        this.messages.push({ text: t(spec.key), until: nowMs + spec.holdMs, tone: 'voice' });
      }
      switch (ev.t) {
        case 'explosion':
          // O anel tracado que estava aqui virou materia voxel em
          // VoxelParticles.ring; o que sobra e a luz, que particula nenhuma
          // fornece — sem ela a explosao continua sendo desenhada sobre o preto.
          // O raio da luz passa do raio do estrago de proposito: o que ilumina
          // uma explosao nao e a bola de fogo, e o que ela revela em volta.
          this.addFlash(ev.x, ev.y, ev.radius * 2.6, 1, nowMs, 260);
          this.shake = { power: 5, until: nowMs + 220 };
          break;
        case 'discharge':
          // Uma luz so para a descarga inteira, no meio dela: uma por celula
          // seriam dezenas de luzes num quadro, e `brightness()` custa por luz
          // vezes celula visivel. O clarao azul e a informacao; a posicao exata
          // de cada carga ja esta desenhada no chao.
          if (ev.cells.length > 0) {
            let cx = 0;
            let cy = 0;
            for (const cell of ev.cells) {
              cx += (cell % this.worldWidth) + 0.5;
              cy += Math.floor(cell / this.worldWidth) + 0.5;
            }
            this.addFlash(
              cx / ev.cells.length,
              cy / ev.cells.length,
              5.5,
              0.95,
              nowMs,
              200,
              PAL.electric,
            );
          }
          break;
        case 'leviathan_discharge':
          // Sem strobe de tela inteira: um clarao largo mas curto no corpo, e
          // um clarao FRIO e menor em cada casca — os arcos contornam o abrigo
          // em vez de atravessa-lo, e o jogador la dentro ve a luz passar por
          // fora.
          this.addFlash(ev.x, ev.y, 14, 1.4, nowMs, 380, PAL.electric);
          for (const bubble of ev.bubbles) {
            this.addFlash(bubble.x, bubble.y, bubble.radius * 1.6, 0.5, nowMs, 300, PAL.mist);
          }
          this.shake = { power: 8, until: nowMs + 380 };
          break;
        case 'hit':
          // Respingo na materia do alvo. Descritivo: diz o que foi atingido,
          // nao que este tiro e o counter deste bicho (ver HIT_MATERIAL).
          this.particles.hit(
            ev.x,
            ev.y,
            hitMaterialOf(this.archetypeById.get(ev.target)),
            ev.amount,
            this.quality.maxFx / PRESETS.high.maxFx,
          );
          // O numero abre em leque a partir do ponto do golpe. A fase vem do
          // relogio e do alvo, nao de um sorteio: dois acertos no mesmo tick no
          // mesmo alvo ainda precisam cair em lugares diferentes, e o mesmo
          // acerto tem de sair igual nas duas maquinas de uma sala.
          this.damageFanIndex = (this.damageFanIndex + 1) % DAMAGE_FAN.length;
          this.fxList.push({
            kind: 'text',
            x: ev.x,
            y: ev.y,
            text: `${Math.round(ev.amount)}`,
            offsetX: DAMAGE_FAN[this.damageFanIndex],
            // Dano forte le maior. A raiz achata o crescimento: linear, um
            // golpe de 40 sairia sete vezes maior que um de 6 e taparia a tela.
            scale: damageScale(ev.amount),
            color: ev.target === this.localPlayerId ? PAL.blood : PAL.player,
            life: 550,
            maxLife: 550,
          });
          if (ev.target === this.localPlayerId) this.shake = { power: 3, until: nowMs + 120 };
          break;
        case 'death':
          // O ANEL VERMELHO e a linguagem de "isto morreu de dano". Quem afundou
          // nao morreu de dano — nao houve golpe, nao houve barra —, e o anel
          // por cima de um buraco contaria a historia errada em cima da unica
          // que importa. A apresentacao da queda ja saiu no `ice_fall` acima.
          if (this.plungedThisTick.has(ev.entity)) break;
          this.fxList.push({
            kind: 'ring',
            x: ev.x,
            y: ev.y,
            r: 0.1,
            maxR: 0.9,
            color: PAL.blood,
            life: 260,
            maxLife: 260,
          });
          break;
        case 'ice_crack':
          // O ESTALO tem tres pesos, e o peso e o aviso. Sem cor nova: o clarao
          // frio curto marca ONDE, e a duracao e a intensidade dizem QUANTO
          // falta. O estado em si ja mudou no chao pelo diff de chunk.
          this.addFlash(
            ev.x,
            ev.y,
            0.9 + ev.stage * 0.35,
            0.18 + ev.stage * 0.12,
            nowMs,
            90 + ev.stage * 50,
            PAL.mist,
          );
          if (ev.stage >= 3) this.shake = { power: 2, until: nowMs + 110 };
          break;
        case 'ice_collapse':
          // O chao cedeu: clarao frio largo e um tremor curto. O buraco em si e
          // superficie e se desenha sozinho.
          this.addFlash(ev.x, ev.y, 2.6, 0.7, nowMs, 260, PAL.electric);
          this.shake = { power: 5, until: nowMs + 220 };
          break;
        case 'ice_fall':
          // A QUEDA. O corpo afundando e desenhado pela camada de apresentacao
          // (ver `IcePlunge`); aqui fica so o que ela nao entrega — o baque na
          // camera e a marca de que este `death` ja tem dono. No Aquifero a
          // agua negra engole sem estilhaco: um clarao frio e curto no lugar,
          // e nenhum tremor de gelo quebrando.
          this.plungedThisTick.add(ev.slot + 1);
          if (ev.medium === 'water') {
            this.addFlash(ev.x, ev.y, 1.8, 0.35, nowMs, 320, PAL.mist);
            this.shake = { power: 4, until: nowMs + 220 };
          } else {
            this.shake = { power: 7, until: nowMs + 300 };
          }
          break;
        case 'ice_mend':
          // A ARENA RECOMPOSTA. Um clarao frio proporcional ao que voltou: a
          // Rainha refazendo o lago le como um pulso largo, e um buraco que
          // recongelou sozinho le como um estalo no lugar dele.
          this.addFlash(
            ev.x,
            ev.y,
            Math.max(1.4, ev.radius),
            ev.radius > 0 ? 0.9 : 0.4,
            nowMs,
            ev.radius > 0 ? 420 : 220,
            PAL.mist,
          );
          break;
        case 'boss_attack':
          if (ev.archetype === 'frost_queen' && ev.ability === 'freeze') {
            // O CONGELAMENTO: a coroa de estilhacos abrindo em volta dela, com
            // o alcance REAL da habilidade — e o clarao frio curto do lago
            // virando lamina de uma vez. O disco de geada, as lascas e os
            // riscos vivem no `fxList`; os cacos que voam sao voxel em
            // `VoxelParticles.ingest`, pelo mesmo evento.
            this.fxList.push({
              kind: 'frostBurst',
              x: ev.x,
              y: ev.y,
              burst: frostBurst(
                (Math.round(ev.x * 16) | 0) ^ ((Math.round(ev.y * 16) | 0) << 7) ^ 0x1ce,
                FROST_QUEEN_FREEZE_RADIUS,
              ),
              life: FROST_BURST_MS,
              maxLife: FROST_BURST_MS,
            });
            this.addFlash(ev.x, ev.y, FROST_QUEEN_FREEZE_RADIUS * 1.6, 1.1, nowMs, 320, PAL.player);
            this.shake = { power: 3, until: nowMs + 160 };
          }
          break;
        case 'pulse':
          // O pulso e CINETICO: desloca ar, nao queima. Luz branca — ele revela a sala
          // sem tingir nada, que e a diferenca visivel entre ele e uma detonacao.
          //
          // O raio vem do EVENTO. Ele sempre veio junto e este ramo o ignorava,
          // desenhando todo pulso do tamanho do do jogador — o que passou a
          // mentir quando a onda de choque do Devorador chegou, com quase o
          // dobro do alcance dela. Um efeito menor que a area que machucou e a
          // pior forma de um ataque enganar.
          this.addFlash(
            ev.x,
            ev.y,
            Math.max(ABILITY_RADIUS, ev.radius) * 2,
            0.75,
            nowMs,
            200,
            LIGHT_NEUTRAL,
          );
          break;
        case 'flame_cone': {
          // Cada emissao do canal ja chega com o jato pronto: as brasas nascem
          // em `particles.ingest` (que recebe estes mesmos eventos), voando do
          // bocal e morrendo no alcance REAL que a sim mediu por raio. Aqui fica
          // so o que particula nao fornece — a luz do fogo e um tremor curto,
          // brando porque o canal repete isto varias vezes por segundo. A chama
          // que fica no chao e superficie de verdade e se desenha sozinha.
          const lit = ev.reach.length > 0 ? Math.max(...ev.reach) : ev.range;
          this.addFlash(ev.x + ev.dx * lit * 0.4, ev.y + ev.dy * lit * 0.4, lit, 0.8, nowMs, 180);
          this.shake = { power: 1, until: nowMs + 80 };
          break;
        }
        case 'bolt_impact':
          // O clarao curto do plasma na parede; o burst em si e materia voxel
          // em VoxelParticles.ingest, como toda explosao desde o redesign.
          this.addFlash(ev.x, ev.y, 1.2, 0.7, nowMs, 150, PAL.biolum);
          break;
        case 'arc_chain': {
          // Um anel curto em cada salto. A LINHA entre eles nao e desenhada: o
          // arco ja resolveu tudo num tick, e um raio persistente prometeria uma
          // duracao que a simulacao nao tem.
          for (const hop of ev.hops) {
            this.fxList.push({
              kind: 'ring',
              x: hop.x,
              y: hop.y,
              r: 0.1,
              maxR: 0.8,
              color: PAL.electric,
              life: 220,
              maxLife: 220,
            });
          }
          break;
        }
        case 'well_offers':
          this.messages.push({
            text: t('toast.well.resonance'),
            until: nowMs + 3400,
            tone: 'info',
          });
          break;
        case 'ability_taken':
          // O clarao e do mundo (o poco acendeu); a frase e de quem assimilou.
          this.addFlash(ev.x, ev.y, 3, 0.9, nowMs, 320);
          if (ev.slot === this.localPlayerId - 1) {
            this.messages.push({
              text: t('toast.ability.assimilated', {
                ability: abilityPresentation(ev.ability).label,
              }),
              until: nowMs + 2600,
              tone: 'good',
            });
          }
          break;
        case 'dodge':
          this.fxList.push({
            kind: 'ring',
            x: ev.x,
            y: ev.y,
            r: 0.1,
            maxR: 0.6,
            color: PAL.player,
            life: 180,
            maxLife: 180,
          });
          break;
        case 'pickup_core':
          // Duas frases, e a distincao e o ponto: com Nucleo abaixo ainda, o
          // aviso NAO pode mandar voltar. Numa expedicao de G-04 o Nucleo do
          // setor 3 e o primeiro de dois, e "volte para a entrada" ali
          // encerraria a run que o jogador pagou para ver inteira.
          this.messages.push({
            text:
              ev.taken >= ev.total
                ? t('toast.core.taken')
                : t('toast.core.deeper', { taken: ev.taken, total: ev.total }),
            until: nowMs + 4200,
            tone: 'good',
          });
          this.shake = { power: 4, until: nowMs + 300 };
          break;
        case 'sector_entered':
          // A chegada anuncia ONDE o jogador entrou, nao so o numero: o bioma
          // muda o modo de atravessar o setor, e o nome e o primeiro aviso.
          this.messages.push({
            text: t('toast.sector.entered', {
              sector: ev.sector,
              biome: biomeLabel(ev.stratum, ev.occupation),
            }),
            until: nowMs + 3400,
          });
          break;
        case 'boss_awake':
          // O Diamandis se apresenta com a propria fala (legenda acima); o
          // aviso generico de despertar so nao faria sentido em cima dela.
          if (ev.archetype !== 'diamandis') {
            this.messages.push({
              text: t('toast.guardian.awake'),
              until: nowMs + 3000,
              tone: 'warn',
            });
          }
          this.shake = { power: 6, until: nowMs + 500 };
          break;
        case 'boss_phase':
          // O EVENTO so da o solavanco da virada. O estado continuo (o tremor
          // no ritmo do coracao, a pedra vermelha) sai de
          // `state.bossRuntime.phasesFired`, que e autoritativo e chega tanto
          // no solo quanto pelo `WorldFlags` de quem reconecta — latchear aqui
          // daria a quem entrou no meio do colapso uma camara parada.
          this.shake = { power: 7, until: nowMs + 700 };
          break;
        case 'furnace_cooled':
          // O alivio: o tremor para, as marcas somem e a sala escurece de uma
          // vez. O `addFlash` negativo nao existe, entao quem apaga e a
          // ausencia — o que fica e o silencio depois de dez minutos de brasa.
          this.shake = { power: 0, until: 0 };
          this.messages.push({
            text: t('toast.furnace.cooled'),
            until: nowMs + 3200,
            tone: 'good',
          });
          break;
        case 'boss_module': {
          // Um evento, quatro leituras. A tabela em boss-module-presentation.ts
          // decide cor, frase, clarao e se a peça fica marcada no chao — e a
          // marca so existe quando ha mesmo alguma coisa naquele ponto.
          const bm = bossModulePresentation(ev.state);
          this.messages.push({
            text: t(bm.toastKey, { module: t(bossModuleNameKey(ev.module)) }),
            until: nowMs + bm.toastMs,
          });
          this.addFlash(ev.x, ev.y, bm.flashRadius, bm.flashPower, nowMs, bm.flashMs);
          applyBossModuleMark(this.bossModuleMarks, ev, nowMs);
          break;
        }
        case 'module_charge_consumed':
          // O card que pulsa e o DESTE painel: a carga do parceiro nao mora aqui.
          if (ev.slot === this.localPlayerId - 1) {
            this.modulePulseUntil.set(ev.module, nowMs + 260);
          }
          break;
        case 'module_selected': {
          // A INCORPORACAO. A origem preferida e o card do terminal, que este
          // cliente acabou de desenhar; sem ela (parceiro remoto, cliente que
          // entrou no meio, resync) o voo cai no clarao curto sobre o proprio
          // jogador — a selecao ja aconteceu na simulacao e nao depende disto.
          const card = this.choiceCardCenters.get(ev.module);
          const origin: PropOrigin | null =
            card && nowMs - card.at < 4000 ? { space: 'screen', x: card.x, y: card.y } : null;
          this.moduleProps.install(ev.module, ev.slot, origin, ev.sourceSiteId, nowMs);
          this.choiceCardCenters.clear();
          break;
        }
        case 'module_expired':
          // A frase e de quem perdeu o modulo; a ejecao (abaixo) e do mundo —
          // o cartucho do parceiro cai no chao ao lado dele, e isso se ve.
          if (ev.slot === this.localPlayerId - 1) {
            this.messages.push({
              text: t('toast.module.expired', { module: modulePresentation(ev.module).label }),
              until: nowMs + 1800,
              tone: 'warn',
            });
          }
          // A EJECAO. Posicao e rumo vem do estado no proprio quadro do
          // desenho (`stepModuleProps`), porque o evento nao os carrega — e
          // nao deve: um evento cosmetico que exigisse posicao obrigaria a
          // simulacao a saber que existe animacao.
          this.pendingEjections.push({ module: ev.module, slot: ev.slot, at: nowMs });
          break;
        case 'minigun_spin':
          this.minigunViews.applySpin(ev.slot, ev.phase, ev.spin);
          break;
        case 'minigun_burst':
          this.minigunViews.applyBurst(ev.slot, ev.rounds, ev.spin, nowMs);
          // As capsulas nascem da rajada AGREGADA, e por isso o jogo cospe
          // logicamente mais balas do que desenha latao quando a carga aperta.
          // E a decisao certa: o olho le densidade, nao contagem.
          this.casings.emitBurst(
            ev.slot,
            ev.x,
            ev.y,
            ev.dx,
            ev.dy,
            ev.rounds,
            Math.imul(ev.slot + 1, 0x9e3779b9) ^
              Math.imul(ev.rounds, 0x85ebca6b) ^
              this.casingSalt++,
            this.quality.maxFx / PRESETS.high.maxFx,
          );
          break;
        case 'salvage_cache_opened':
          this.messages.push({
            text: t('toast.cache.opened'),
            until: nowMs + 2200,
            tone: 'good',
          });
          this.addFlash(ev.x, ev.y, 4.5, 0.9, nowMs, 300);
          if (ev.slot === this.localPlayerId - 1) {
            this.pendingRewardOrigin = { slot: ev.slot, x: ev.x + 0.5, y: ev.y + 0.5 };
            this.choiceRevealAt = Math.max(this.choiceRevealAt, nowMs + 920);
          }
          break;
        case 'ore_gained': {
          // O TOTAL vem do evento, e o estado autoritativo o corrige no proximo
          // quadro (`setCargoOre`). Os dois concordam quase sempre; quando nao
          // concordam — reconexao, resync — quem manda e o estado.
          this.cargoOre = ev.total;
          if (this.cargoFlights.length < 6) {
            this.cargoFlights.push({
              worldX: ev.x,
              worldY: ev.y,
              startedAt: nowMs,
              durationMs: 560,
              // `amount` e o que faz a carga do Minerador aparecer como "+6" e
              // nao como seis textos disputando o mesmo pixel.
              amount: ev.amount,
            });
          } else {
            // Estourou o teto: o numero ainda pulsa, so nao ha lasca sobrando
            // para desenhar. Perder a animacao e melhor que perder a leitura.
            this.cargoPulseUntil = nowMs + 320;
          }
          break;
        }
        case 'purge_cell_used': {
          // A PURGA e uma reinicializacao, nao uma cura: o chassi descarrega o
          // que estava travando os sistemas e volta a operar. Por isso a frente
          // e eletrica (fosforo e choque), nunca verde de "vida"; o corpo ganha
          // a varredura de reboot no proprio desenho; e a linha do painel diz
          // "sistemas restabelecidos", com o numero que a simulacao devolveu.
          const fxScale = this.quality.maxFx / PRESETS.high.maxFx;
          this.fxList.push({
            kind: 'ring',
            x: ev.x,
            y: ev.y,
            r: 0.2,
            maxR: PURGE_CELL_RADIUS * 2.1,
            color: PAL.biolum,
            life: 460,
            maxLife: 460,
          });
          this.addFlash(ev.x, ev.y, PURGE_CELL_RADIUS * 1.6, 0.85, nowMs, 380, PAL.biolum);
          this.particles.emitPurgeVent(ev.x, ev.y, PURGE_CELL_RADIUS, fxScale);
          if (ev.slot === this.localPlayerId - 1) {
            this.purgeUsedAtMs = nowMs;
            this.messages.push({
              text: t('toast.purge.used', { amount: PURGE_CELL_HEAL }),
              until: nowMs + 2400,
              tone: 'good',
            });
          }
          break;
        }
        case 'purge_cell_acquired':
          if (ev.slot === this.localPlayerId - 1) {
            const startsAt = nowMs + 220;
            this.messages.push({
              text: t('toast.purgeCell'),
              startsAt,
              until: startsAt + 2200,
              tone: 'good',
            });
            if (this.pendingRewardOrigin?.slot === ev.slot) {
              this.rewardFlight = {
                worldX: this.pendingRewardOrigin.x,
                worldY: this.pendingRewardOrigin.y,
                startedAt: startsAt,
                durationMs: 650,
              };
              this.pendingRewardOrigin = null;
            }
            this.choiceRevealAt = Math.max(this.choiceRevealAt, startsAt + 700);
          }
          break;
        case 'terminal_scan_complete':
          this.messages.push({
            text: t('toast.scan.complete'),
            until: nowMs + 2800,
            tone: 'good',
          });
          break;
        case 'overheat':
          if (ev.slot === this.localPlayerId - 1) {
            this.messages.push({ text: t('toast.overheat'), until: nowMs + 1600, tone: 'warn' });
          }
          break;
        // O CONGELAMENTO DO PROSPECTOR. O estado (medidor, latch) e lido do
        // `playerExtras` a cada quadro; os eventos so dao aos marcos um
        // instante em tempo real — o clarao, o tremor, a instrucao.
        case 'freeze_dose':
          this.addFlash(ev.x, ev.y, 1.4, 0.5, nowMs, 220, PAL.mist);
          if (
            ev.slot === this.localPlayerId - 1 &&
            ev.freeze < FREEZE_MAX &&
            takeFrostHint('partial')
          ) {
            this.messages.push({
              text: t('hint.freeze.partial'),
              until: nowMs + 2600,
              tone: 'info',
            });
          }
          break;
        case 'frostbite':
          this.addFlash(ev.x, ev.y, 2.4, 0.9, nowMs, 360, PAL.player);
          this.shake = { power: 3, until: nowMs + 180 };
          if (ev.slot === this.localPlayerId - 1) {
            const hint = takeFrostHint('frostbite');
            this.messages.push({
              text: t(hint ? 'hint.freeze.frostbite' : 'hud.freeze.hold'),
              until: nowMs + (hint ? 4200 : 2400),
              tone: 'warn',
            });
            this.frostHoldNagAtMs = nowMs;
          }
          break;
        case 'thermal_cycle':
          // O pulso do nucleo e o tremor vem do relogio da apresentacao; aqui
          // fica so um clarao laranja minusculo — o motor aceso sob o gelo.
          this.addFlash(ev.x, ev.y, 0.9, 0.35, nowMs, 140, PAL.fire);
          break;
        case 'frostbite_break':
          this.addFlash(ev.x, ev.y, 2.2, 1, nowMs, 300, PAL.player);
          this.shake = { power: 4, until: nowMs + 200 };
          if (ev.slot === this.localPlayerId - 1) {
            this.messages.push({
              text: t('toast.frostbite.break'),
              until: nowMs + 1400,
              tone: 'good',
            });
          }
          break;
        case 'message':
          // A simulacao manda a CHAVE, nunca a frase: ela roda tambem no
          // servidor (verificacao de replay), onde nao existe idioma de
          // jogador. Traduzir e trabalho de quem desenha. Com `slot`, a
          // mensagem e a resposta a UMA acao — so o autor dela a le.
          if (ev.slot === undefined || ev.slot === this.localPlayerId - 1) {
            this.messages.push({
              text: t(ev.key),
              until: nowMs + 3600,
              tone: simMessageTone(ev.key),
            });
          }
          break;
        default:
          break;
      }
    }
  }

  render(state: SurvivalState, alpha: number, input: InputState, nowMs: number): void {
    // Um mundo andando invalida a tela de fim anterior. Sem isto, uma descida
    // repetida na MESMA seed que termina na mesma fase e no mesmo tick produz a
    // mesma chave de sumario, e a nota da segunda morte apareceria ja carimbada
    // — a run inteira sem o unico momento em que a tela diz o que ela valeu.
    if (state.phase === 'running') this.endScreenKey = '';
    this.worldWidth = state.config.width; // FX por indice de celula seguem o mundo real
    void alpha;
    const ctx = this.ctx;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const z = this.zoom;
    const w = state.config.width;
    const h = state.config.height;
    const player = state.player;

    ctx.fillStyle = PAL.dark;
    ctx.fillRect(0, 0, vw, vh);

    let shakeX = 0;
    let shakeY = 0;
    if (nowMs < this.shake.until) {
      shakeX = (Math.random() - 0.5) * this.shake.power * this.quality.shakeScale;
      shakeY = (Math.random() - 0.5) * this.shake.power * this.quality.shakeScale;
    }
    const livePhases = livePhasesOf(state);
    // A FUMACA sai do corpo do chefe enquanto o colapso durar. Emitida no laco
    // de quadro e nao por evento: e um estado continuo, e um evento por baforada
    // encheria o wire com o que o cliente ja sabe derivar.
    if (livePhases !== 0) {
      const heart = state.enemies.find((e) => e.alive && e.archetype === 'furnace_heart');
      if (heart) {
        this.particles.emitFurnaceSmoke(
          heart.x,
          heart.y,
          nowMs,
          this.quality.maxFx / PRESETS.high.maxFx,
          (livePhases & BOSS_PHASE_UNSTABLE) !== 0,
        );
      }
    }
    // A BATIDA DO CORACAO: enquanto o colapso durar, a camara pulsa.
    //
    // Uma onda dupla — sistole curta e forte, diastole mais fraca logo atras —
    // e nao um seno: um tremor senoidal le como motor, e o que este tem de
    // dizer e que ha um corpo batendo do outro lado da sala. A instabilidade
    // acelera e aprofunda a mesma batida, porque e o mesmo coracao piorando.
    const beat = heartbeatShake(livePhases, nowMs);
    if (beat > 0) {
      const amp = beat * this.quality.shakeScale;
      shakeX += (Math.random() - 0.5) * amp;
      shakeY += (Math.random() - 0.5) * amp;
    }
    // teto de FX conforme qualidade (descarta os mais antigos)
    if (this.fxList.length > this.quality.maxFx) {
      this.fxList.splice(0, this.fxList.length - this.quality.maxFx);
    }

    const isoX = (x: number, y: number): number => (x - y) * (TILE_W / 2);
    const isoY = (x: number, y: number): number => (x + y) * (TILE_H / 2);
    const camX = isoX(player.x, player.y);
    const camY = isoY(player.x, player.y);
    const toScreen = (x: number, y: number): [number, number] => [
      (isoX(x, y) - camX) * z + vw / 2 + shakeX,
      (isoY(x, y) - camY) * z + vh / 2 + shakeY,
    ];

    // Luzes dinamicas visiveis. `corePos` e o poco nos setores intermediarios
    // e o Nucleo apenas no final; cada marcador recebe intensidade propria.
    const objectiveView = objectiveViewOf(state);
    const objectiveName = objectivePropName(objectiveView);
    // As luzes do quadro. A LANTERNA do chassi e branca de proposito: luz sem
    // cor ilumina e nao tinge, e se ela tingisse o mundo inteiro ganharia um veu
    // permanente — a cor deixaria de significar "ha uma fonte de fogo ali".
    const lights: WorldLight[] = [
      { x: player.x, y: player.y, r: 8.5, power: 1, hex: LIGHT_NEUTRAL, height: LAMP_HEIGHT },
    ];
    const objectiveLight = objectiveLightSpec(objectiveView);
    if (objectiveLight) {
      lights.push({
        x: state.corePos.x + 0.5,
        y: state.corePos.y + 0.5,
        r: objectiveLight.radius,
        power: objectiveLight.power,
        hex: PAL.biolum,
        height: LAMP_HEIGHT,
      });
    }

    // Clarões de explosao, descarga e pulso. Entram FORA do `if
    // (quality.dynamicLights)`: no preset baixo o jogo abre mao das luzes
    // permanentes de fogo e cristal, que sao ambientacao, mas nao da luz que
    // revela o que acabou de detonar ao lado do jogador — sao poucas, duram
    // fracao de segundo, e sem elas o preset baixo esconderia o perigo.
    this.flashes = pruneFlashes(this.flashes, nowMs);
    for (const f of this.flashes) {
      lights.push({
        x: f.x,
        y: f.y,
        r: f.r,
        power: flashPower(f, nowMs),
        hex: f.hex,
        height: LAMP_HEIGHT,
      });
    }

    const range = Math.ceil(vw / z / TILE_W + vh / z / TILE_H) + 4;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const x0 = Math.max(0, px - range);
    const x1 = Math.min(w - 1, px + range);
    const y0 = Math.max(0, py - range);
    const y1 = Math.min(h - 1, py + range);

    if (this.quality.dynamicLights) {
      // A FASE de cada celula de leyline, para a luz do laco abaixo. Dormente
      // ela e um brilho fraco constante — a linha e linguagem de orientacao e
      // precisa ser seguivel no escuro. Carregando, o pulso sobe ate o tick da
      // descarga: e O SINAL, o dano so existe porque esta luz veio antes. Em
      // refrataria a linha apaga — gastou — e a escuridao e a leitura.
      const routedNodeCells = new Set<number>();
      for (const node of state.leylineNodes) {
        if (node.routed) routedNodeCells.add(node.cell);
      }
      // A MESMA VEIA, mais carregada: a luz de repouso da rede escala com a
      // profundidade da descida. Quem atravessa a linhagem mineral ve a
      // Catedral clarear a cada estrato — e leitura de LUGAR, fora do hash,
      // e a CARGA nao muda: o telegrafo ja e o sinal maximo e escala-lo
      // diluiria o aviso.
      const veinDepth = Math.min(4, depthIntensity(state.sector));
      const leyPhase = new Map<number, number>();
      for (const seg of state.leylineSegments) {
        const charging = seg.dischargeAt > state.tick;
        const refractory = !charging && state.tick < seg.refractoryUntil;
        // 0 = dormente; 1 = refrataria; >1 = carregando (progresso 1..2).
        const phase = charging
          ? 2 - Math.min(1, (seg.dischargeAt - state.tick) / LEYLINE_CHARGE_TICKS)
          : refractory
            ? 1
            : 0;
        for (const cell of seg.cells) leyPhase.set(cell, phase);
      }
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * w + x;
          if (state.surface[i] === SURF_FIRE)
            lights.push({ x: x + 0.5, y: y + 0.5, r: 4, power: 0.8, hex: PAL.fire, height: 0.25 });
          else if (state.surface[i] === SURF_EMBER)
            lights.push({ x: x + 0.5, y: y + 0.5, r: 2, power: 0.3, hex: PAL.fire, height: 0.1 });
          // Apenas o cristal VIVO ilumina. Opacado pelo acido ele continua na
          // tela com a mesma silhueta, mas o mapa escurece — que e exatamente a
          // perda que o jogador tem de sentir.
          else if (state.solid[i] === SOLID_CRYSTAL)
            lights.push({
              x: x + 0.5,
              y: y + 0.5,
              r: 3.5,
              power: 0.55,
              hex: PAL.biolum,
              // Alto: o cristal e um BLOCO, e a luz dele sai do corpo inteiro —
              // e por isso que ele acende o topo das paredes vizinhas, e nao so
              // o chao ao pe delas.
              height: 0.9,
            });
          else if (state.solid[i] === SOLID_LEYLINE) {
            const phase = leyPhase.get(i) ?? 0;
            if (phase === 0) {
              // Dormente: cada TERCEIRA celula emite, num respiro lento. A
              // linha inteira acesa por igual viraria um letreiro; pontos
              // alternados leem como energia correndo por dentro.
              if ((x + y) % 3 === 0) {
                const breathe = 0.8 + 0.2 * Math.sin(nowMs / 900 + (x + y) * 0.7);
                lights.push({
                  x: x + 0.5,
                  y: y + 0.5,
                  r: 2,
                  power: 0.22 * breathe * (1 + 0.12 * veinDepth),
                  hex: PAL.electric,
                  height: 0.6,
                });
              }
            } else if (phase > 1) {
              // Carregando: TODA celula acende e o pulso sobe com o relogio.
              const t = phase - 1;
              const flicker = 0.85 + 0.15 * Math.sin(nowMs / 45);
              lights.push({
                x: x + 0.5,
                y: y + 0.5,
                r: 2.5 + t,
                power: (0.35 + 0.75 * t) * flicker,
                hex: PAL.electric,
                height: 0.6,
              });
            }
            // Refrataria: nenhuma luz. O segmento gastou, e a escuridao dele
            // e o aviso de que atirar de novo agora nao compra nada.
          } else if (state.solid[i] === SOLID_LEYLINE_NODE) {
            // A juncao nunca apaga: e o marco que separa segmentos, e o olho
            // precisa dela para ler onde um trecho termina. ROTEADA, ela
            // RESPIRA — um pulso lento e mais largo. Constante = fechada,
            // respirando = rele aberto: um bit, uma diferenca de luz.
            if (routedNodeCells.has(i)) {
              const breathe = (0.5 + 0.25 * Math.sin(nowMs / 600)) * (1 + 0.1 * veinDepth);
              lights.push({
                x: x + 0.5,
                y: y + 0.5,
                r: 3.2,
                power: breathe,
                hex: PAL.electric,
                height: 0.7,
              });
            } else {
              lights.push({
                x: x + 0.5,
                y: y + 0.5,
                r: 2.5,
                power: 0.4 * (1 + 0.1 * veinDepth),
                hex: PAL.electric,
                height: 0.7,
              });
            }
          }
        }
      }
      for (const c of state.charges) {
        lights.push({
          x: (c.idx % w) + 0.5,
          y: Math.floor(c.idx / w) + 0.5,
          r: 3,
          power: 0.9,
          hex: PAL.electric,
          height: 0.2,
        });
      }
      // O TIRO ACENDE O QUE ATRAVESSA.
      //
      // O objeto mais brilhante da tela — e o que o jogador dispara dezenas de
      // vezes por minuto — nao emitia um pixel de luz. Um estilhaco cruzando um
      // corredor escuro passava por cima de paredes que continuavam pretas, e a
      // arma parecia uma lanterna apontada para dentro.
      //
      // Raio curto e forca media: e um clarao que ACOMPANHA o voo, nao uma
      // lampada. E ele nasce na altura do plano de combate, que e onde o corpo
      // do projetil esta desenhado — a luz sai de onde a coisa esta.
      for (const projectile of state.projectiles) {
        const spec = projectileLightSpec(projectile);
        if (spec) {
          lights.push({
            x: projectile.x,
            y: projectile.y,
            r: spec.r,
            power: spec.power,
            hex: spec.hex,
            height: COMBAT_PLANE_TILES,
          });
        }
      }
    }

    // A GRADE DE LUZ do quadro, montada por ESPALHAMENTO.
    //
    // Antes, cada celula visivel percorria a lista inteira de luzes. Com fogo e
    // cristal empurrando uma luz por celula acesa, uma sala em chamas chegava a
    // centenas de luzes vezes vinte mil celulas. Aqui cada luz escreve nas
    // celulas do proprio raio, uma vez, e a consulta vira leitura de indice —
    // e a cor viaja junto no mesmo passe, praticamente de graca.
    this.lightField.begin(x0, y0, x1, y1);
    for (const light of lights) this.lightField.add(light);
    const field = this.lightField;

    /**
     * O escalar de sempre — o que escolhe o nivel de luz JA ASSADO no atlas.
     *
     * Continua sendo maximo com queda linear, letra por letra: os oito degraus
     * do atlas foram calibrados contra essa curva, e trocar a curva por baixo
     * deles re-iluminaria toda caverna do jogo como efeito colateral de
     * acrescentar cor. O piso de 0.04 e o preto do fundo da caverna.
     */
    const brightness = (x: number, y: number): number =>
      Math.max(AMBIENT_FLOOR, field.intensityAt(x, y));

    const shade = (hex: string, factor: number): string => {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.floor(((n >> 16) & 0xff) * factor);
      const g = Math.floor(((n >> 8) & 0xff) * factor);
      const bl = Math.floor((n & 0xff) * factor);
      return `rgb(${r},${g},${bl})`;
    };

    // O DILUVIO, resolvido UMA vez por quadro: o raio ja alcancado pela frente
    // e o centro de onde ela sobe. Negativo = nunca aconteceu, e o laco do chao
    // nem chega a perguntar por celula.
    const delugeR = delugeFront(state);
    const delugeCx = state.bossRuntime.delugeX;
    const delugeCy = state.bossRuntime.delugeY;

    /**
     * A luz que cai sobre um CORPO, pronta para o banco de sprites.
     *
     * Um sprite nao tem face nem normal por pixel — e um PNG assado. A normal
     * honesta para um corpo de pe e o TOPO: ele recebe o que a fonte manda de
     * cima, e o resto seria invencao. O que a luz precisa dizer sobre uma
     * criatura nao e de que lado ela e iluminada; e QUE ELA ESTA ILUMINADA — um
     * vulto que acende laranja quando a explosao estoura ao lado dele e
     * informacao de combate.
     *
     * Difuso e especular somados num tint so, porque o banco compoe uma vez: a
     * silhueta inteira e uma superficie, e separar as duas passadas nela nao
     * mudaria um pixel do resultado.
     */
    const bodyLight = (
      x: number,
      y: number,
      material: typeof CHASSIS_RESPONSE,
    ): { color: string; alpha: number } | undefined => {
      if (!field.hasChromaAt(x, y)) return undefined;
      const bounce = bounceOf(field.illuminationAt(x, y), FACE_TOP, material);
      if (!bounce) return undefined;
      return { color: bounce.color, alpha: Math.min(0.62, bounce.alpha + bounce.specular) };
    };

    /**
     * A MESMA luz, resolvida nas TRES faces que a projecao mostra.
     *
     * O sprite carrega a normal por pixel (o mapa de faces gerado junto com a
     * arte), entao a pergunta que se pode fazer por corpo deixou de ser "este
     * bicho esta iluminado?" e passou a ser a mesma que as paredes ja
     * respondiam: quanto CADA face recebe. A ordem — topo, esquerda, direita —
     * e a dos canais do mapa e a das rampas do rasterizador, e as tres tem de
     * continuar concordando.
     *
     * Devolve `undefined` quando nao ha cor na celula: sem isso, todo corpo do
     * jogo pagaria uma matriz de filtro por quadro para somar zero.
     */
    const bodyFaceLight = (
      x: number,
      y: number,
      material: typeof CHASSIS_RESPONSE,
    ): FaceLighting | undefined => {
      if (!field.hasChromaAt(x, y)) return undefined;
      const illumination = field.illuminationAt(x, y);
      const of = (normal: typeof FACE_TOP): { color: string; alpha: number } => {
        const bounce = bounceOf(illumination, normal, material);
        if (!bounce) return { color: 'rgb(0,0,0)', alpha: 0 };
        return {
          color: bounce.color,
          alpha: Math.min(0.7, bounce.alpha + bounce.specular),
        };
      };
      const faces: FaceLighting = [of(FACE_TOP), of(FACE_LEFT), of(FACE_RIGHT)];
      return faces.some((face) => face.alpha > 0.004) ? faces : undefined;
    };

    /**
     * Pinta a luz refletida por cima do material, em DUAS passadas.
     *
     * `lighter` e obrigatorio: luz SOMA. Composta por cima em `source-over`, a
     * cor apagaria o material em vez de acende-lo — e o que se veria seria um
     * adesivo colorido sobre a pedra, nao a pedra iluminada.
     *
     * A segunda passada e o especular, e ela usa a cor da FONTE em vez da do
     * material: e a diferenca entre gelo e rocha recebendo o mesmo clarao. Sai
     * inteira quando o material e fosco, que e a maioria deles.
     *
     * `paint` recebe a cor e desenha a forma da face — quem chama sabe se e um
     * losango de chao, um quadrilatero de parede ou um retangulo de sprite.
     */
    const paintBounce = (paint: (color: string) => void, bounce: Bounce): void => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (bounce.alpha > 0) {
        ctx.globalAlpha = bounce.alpha;
        paint(bounce.color);
      }
      if (bounce.specular > 0) {
        ctx.globalAlpha = bounce.specular;
        paint(bounce.specularColor);
      }
      ctx.restore();
    };

    const diamond = (sx: number, sy: number, fill: string): void => {
      const hw = (TILE_W / 2) * z;
      const hh = (TILE_H / 2) * z;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(sx, sy - hh);
      ctx.lineTo(sx + hw, sy);
      ctx.lineTo(sx, sy + hh);
      ctx.lineTo(sx - hw, sy);
      ctx.closePath();
      ctx.fill();
    };

    // passo 1: chao
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (state.solid[i] !== SOLID_NONE) continue;
        const b = brightness(x, y);
        if (b <= 0.045) continue;
        const [sx, sy] = toScreen(x + 0.5, y + 0.5);
        if (sx < -40 || sx > vw + 40 || sy < -40 || sy > vh + 40) continue;

        // Crosta voxel pre-renderizada: um drawImage no lugar do losango de cor
        // chapada mais o remendo translucido que vinha por cima dele. Gas, poca
        // e fogo eram as ultimas superficies do jogo pintadas com alpha, num
        // mundo que e facetado e de alpha binario em todo o resto.
        const surf = state.surface[i];
        // O gas NAO e desenhado aqui: o penacho e alto, e tudo que este passo
        // levanta acima do plano do chao passa por tras das paredes, mesmo o que
        // esta na frente delas — celula de gas encostada em parede tinha o
        // penacho engolido por ela. O chao dessas celulas sai como rocha nua e o
        // gas entra na fila ordenada, mais abaixo.
        // Superficie SEM tile no atlas cai na cor de recuo, e nao no tile 0.
        //
        // O `?? 0` de antes desenhava CHAO LIMPO para toda materia que o atlas
        // ainda nao conhecia — e `draw` devolve true, entao a cor de recuo
        // nunca chegava a rodar. Uma materia nova ficava literalmente
        // invisivel, que e o pior defeito possivel num jogo em que o chao e a
        // mecanica: a silica solta do Devorador e o aviso de por onde ele anda,
        // e o vidro e a prova de que aquele pedaco esta negado a ele.
        const surfKind = surf === SURF_GAS ? 0 : surfaceKindIndex(surf, state.stratum);
        if (
          surfKind === undefined ||
          !this.surfaces.draw(ctx, surfKind, x, y, b, nowMs, sx, sy, z)
        ) {
          diamond(
            sx,
            sy,
            shade(surfaceFallbackColor(surf, state.stratum) ?? PAL.rockShadow, 0.35 + b * 0.75),
          );
        }

        // A COR da luz que chega neste chao, por cima do tile ja escolhido.
        //
        // A INTENSIDADE ja foi resolvida na escolha do nivel assado, e por isso
        // este passe nao pode mexer nela: ele soma COR, em `lighter`, sobre o
        // material que o atlas pintou. E o unico jeito de ter luz colorida sem
        // abandonar os oito niveis — e sem inventar cor nova em cima de uma
        // paleta que a art bible fixa.
        //
        // O piso e uma face que olha para CIMA, entao ele recebe o termo
        // vertical do vetor de incidencia: forte sob a fonte, raspando quando
        // ela se afasta. O material decide o resto — a poca espelha, a rocha
        // espalha, a cinza queimada quase nao devolve nada.
        if (field.hasChromaAt(x, y)) {
          const bounce = bounceOf(field.illuminationAt(x, y), FACE_TOP, surfaceResponse(surf));
          if (bounce) paintBounce((color) => diamond(sx, sy, color), bounce);
        }

        // O HALO da propria materia acesa. O bounce acima e a luz que ela manda
        // para os VIZINHOS; isto e ela parecendo uma fonte. Sem o halo, o fogo
        // iluminava a sala inteira sem ele proprio brilhar — a luz existia e o
        // brilho nao. O tremor vem do relogio e da celula: chama nao e lampada.
        if (this.quality.bloom) {
          if (surf === SURF_FIRE) {
            const flicker = 0.72 + 0.28 * Math.sin(nowMs / 90 + (x * 7 + y * 13));
            drawEmissiveHalo(ctx, PAL.fire, sx, sy, TILE_W * 0.62 * z, 0.5 * flicker);
          } else if (surf === SURF_EMBER) {
            const breath = 0.5 + 0.5 * Math.sin(nowMs / 320 + (x * 3 + y * 11));
            drawEmissiveHalo(ctx, PAL.fire, sx, sy, TILE_W * 0.3 * z, 0.2 * breath);
          }
        }
        // O DILUVIO vem POR CIMA, e nunca no lugar.
        //
        // Esta ordem e a mecanica inteira desenhada: a lamina do Leviata nao
        // substitui o chao, ela o submerge. O tile do material continua sendo
        // desenhado exatamente como era — fungo continua fungo, brasa continua
        // brasa — e o que muda e um veu azul translucido por cima. O jogador
        // continua LENDO o setor que aprendeu; ele so passou a estar debaixo
        // d'agua.
        //
        // Nenhuma celula disto vem pelo wire: `isDeluged` e a mesma funcao que a
        // simulacao usa para decidir por onde o chefe nada e quanto uma descarga
        // cobra, rodando aqui sobre os tres numeros do `bossRuntime`.
        if (delugeR >= 0 && isDeluged(state, i)) {
          // A BORDA da frente acende enquanto ela sobe: e o que faz a inundacao
          // ler como uma parede de agua avancando, e nao como um filtro que
          // alguem ligou na tela.
          const edge = delugeR - Math.hypot(x + 0.5 - delugeCx, y + 0.5 - delugeCy);
          const crest = edge < 1.6 ? 1 - edge / 1.6 : 0;
          const depth = delugeDepth(state, i);
          const surfaceY = sy - depth * TILE_H * z;
          // Superficie elevada + coluna: a agua agora ocupa ALTURA no mundo,
          // em vez de ser somente um filtro colado ao piso.
          ctx.save();
          ctx.fillStyle = `rgba(34,74,105,${(0.08 + depth * 0.025).toFixed(3)})`;
          ctx.fillRect(sx - TILE_W * 0.5 * z, surfaceY, TILE_W * z, Math.max(0, sy - surfaceY));
          diamond(sx, surfaceY, `rgba(92,150,185,${(0.2 + b * 0.12).toFixed(3)})`);
          ctx.restore();
          if (crest > 0) {
            diamond(sx, surfaceY, `rgba(190,225,245,${(crest * 0.48).toFixed(3)})`);
          }
        }
        // A BORDA DO NUCLEO PROFUNDO, sempre — e, debaixo do Diluvio, o buraco
        // na propria superficie.
        //
        // A agua profunda nativa e fatal, e o Diluvio a cobria: a lamina
        // subia por cima do tile escuro e o jogador nao tinha como distinguir
        // o chao raso do poco a dois passos dele. Cair num buraco que a tela
        // nao mostra nao e dificuldade, e injustica. O tile continua sem
        // moldura (o nucleo e um so, nao uma grade de ladrilhos): o que se
        // desenha e o CONTORNO do nucleo — so as arestas que encostam em chao
        // que nao e profundo — e, alagado, uma mancha mais escura no plano da
        // superficie, onde a agua e mais funda porque o chao caiu.
        if (surf === SURF_DEEP_WATER && state.stratum === 'aquifer') {
          const hw = (TILE_W / 2) * z;
          const hh = (TILE_H / 2) * z;
          const flooded = delugeR >= 0 && isDeluged(state, i);
          const planeY = flooded ? sy - delugeDepth(state, i) * TILE_H * z : sy;
          if (flooded) diamond(sx, planeY, `rgba(2,6,14,${(0.34 + b * 0.2).toFixed(3)})`);
          const rimOf = (nx: number, ny: number): boolean => {
            if (nx < 0 || ny < 0 || nx >= w || ny >= state.config.height) return false;
            const n = ny * w + nx;
            return state.solid[n] === SOLID_NONE && state.surface[n] !== SURF_DEEP_WATER;
          };
          ctx.save();
          ctx.strokeStyle = flooded
            ? `rgba(176,214,238,${(0.35 + b * 0.35).toFixed(3)})`
            : `rgba(150,196,226,${(0.18 + b * 0.3).toFixed(3)})`;
          ctx.lineWidth = Math.max(1, z * 0.75);
          ctx.beginPath();
          if (rimOf(x + 1, y)) {
            ctx.moveTo(sx + hw, planeY);
            ctx.lineTo(sx, planeY + hh);
          }
          if (rimOf(x - 1, y)) {
            ctx.moveTo(sx - hw, planeY);
            ctx.lineTo(sx, planeY - hh);
          }
          if (rimOf(x, y + 1)) {
            ctx.moveTo(sx, planeY + hh);
            ctx.lineTo(sx - hw, planeY);
          }
          if (rimOf(x, y - 1)) {
            ctx.moveTo(sx, planeY - hh);
            ctx.lineTo(sx + hw, planeY);
          }
          ctx.stroke();
          ctx.restore();
        }
        const ambientScale = this.quality.maxFx / PRESETS.high.maxFx;
        if (surf === SURF_GAS) {
          // Gas sulfurico: sopros amarelos que abrem enquanto sobem.
          this.particles.emitGas(x + 0.5, y + 0.5, nowMs, ambientScale);
        } else if (surf === SURF_SPORES) {
          // Esporos: graos verdes com deriva lateral, sem a silhueta de puff do gas.
          this.particles.emitSpores(x + 0.5, y + 0.5, nowMs, ambientScale);
        } else if (surf === SURF_FUNGAL_HEATED) {
          // Aviso da secagem: pouca fumaca escura antes de surgir qualquer chama.
          this.particles.emitFungalSmoke(x + 0.5, y + 0.5, nowMs, ambientScale);
        }
        // Os marcadores de objetivo NAO saem mais aqui: viraram objetos com
        // volume e entram na fila ordenada por profundidade, junto das paredes
        // e das criaturas. Desenhados no passo de chao, um pedestal alto seria
        // coberto por qualquer parede a frente dele — inclusive a parede que o
        // jogador esta contornando para chegar ate ele.
      }
    }

    // Cargas eletricas por cima do chao.
    //
    // Eram um losango translucido cintilando com `Math.random()` por quadro.
    // Dois problemas alem do alpha: o cintilar corria na taxa do MONITOR, entao
    // a 120Hz virava um chuvisco e a 30Hz um piscar lento; e, sendo sorteado por
    // cliente, os dois jogadores de uma sala viam a mesma poca eletrificada de
    // formas diferentes. Agora sao voxels sobre a poca, com a fase vinda da
    // POSICAO e do relogio — mesma celula, mesmo instante, mesma imagem nas duas
    // maquinas, e a mesma cadencia em qualquer taxa de quadros.
    for (const c of state.charges) {
      const cx = c.idx % w;
      const cy = Math.floor(c.idx / w);
      const [sx, sy] = toScreen(cx + 0.5, cy + 0.5);
      if (sx < -40 || sx > vw + 40 || sy < -40 || sy > vh + 40) continue;
      const phase = ((cx * 7 + cy * 13) % 5) / 5;
      const arc = Math.sin(nowMs * 0.018 + phase * Math.PI * 2);
      if (arc < -0.2) continue; // a corrente corre em pulsos, nao acesa sem parar
      // O halo PULSA junto com o voxel, no mesmo `arc`: a corrente e o unico
      // emissivo do jogo que pisca de verdade, e o brilho tem de piscar com ela
      // ou vira uma luz constante com um cubo tremendo no meio.
      if (this.quality.bloom) {
        drawEmissiveHalo(ctx, PAL.electric, sx, sy - 2 * z, TILE_W * 0.34 * z, 0.3 + arc * 0.22);
      }
      drawVoxel(ctx, sx, sy - (2 + arc * 2) * z, 3.5 * z, CHARGE_RAMP);
    }

    // FAIXA DE MIRA, no chao e sob tudo o que tem volume.
    //
    // O indicador anterior era um risco de 20px flutuando na altura do peito.
    // Ele dizia o RUMO e mais nada — nem a largura do tiro, nem ate onde ele
    // chega, nem se ha parede no caminho —, e por estar no ar competia com o
    // proprio corpo do Prospector em vez de descrever o chao.
    //
    // A faixa e desenhada no plano do piso, com a largura EXATA do projetil, e
    // para na primeira parede. Sai aqui, entre o passo de chao e a fila ordenada,
    // porque e chao: qualquer parede ou criatura a frente dela tem de cobri-la.
    // Desenhada junto com o jogador, ela passaria por cima da parede que a
    // interrompe, e a unica coisa que a faixa nao pode fazer e mentir sobre o
    // alcance.
    // Quando a faixa aparece e decisao do INPUT (`aiming`), porque e a mesma
    // condicao que decide o disparo. O que o renderer decide e a INTENSIDADE: o
    // desktop carrega a faixa permanente, e ela so pode ficar permanente se, em
    // repouso, for um sussurro. Com o gatilho apertado ela abre inteira.
    if (input.aiming && player.alive && !state.playerExtras[player.slot ?? 0].downed) {
      this.drawAimLane(state, player, toScreen, z, input.firing ? 1 : IDLE_AIM_LANE_ALPHA);
    }

    // passo 2: paredes + entidades + projeteis, ordenados por profundidade
    type DrawItem = { depth: number; draw: () => void };
    const items: DrawItem[] = [];

    // Objetivos como OBJETOS, na fila de profundidade. O mesmo ponto logico
    // representa o poco nos setores intermediarios e o Nucleo no setor final,
    // mas cada um tem silhueta propria. Ambos precisam entrar nesta fila porque
    // AS MARCAS DE CHAO, por baixo de tudo o que tem volume: elas sao pintura
    // no piso, e um aviso que passasse na frente do corpo que ele avisa seria
    // o oposto de um aviso.
    // A VARREDURA DO CORACAO DA FORNALHA: a cunha que queima e a que VAI
    // queimar.
    //
    // Derivada do tick, e nao transmitida: as duas pontas fazem a mesma conta
    // (`furnaceSweepAt`), entao a cunha nao entra no snapshot, nao entra no
    // hash e nao pode dessincronizar. Um cliente que reconecta no meio do
    // encontro ja sabe onde a chama esta e onde ela vai estar.
    //
    // E ela existe porque o CHAO nao consegue dizer isto sozinho. O relato de
    // playtest foi literal — "nao consigo distinguir aonde esta dando dano no
    // chao e aonde tem chao seguro" —, e a razao e que numa Fornalha a brasa
    // natural do bioma, o aviso e o dano usariam todos a mesma familia de
    // laranja. O chao continua contando o passado (fogo aceso = queimando
    // agora, cinza = ja passou); o FUTURO e a unica coisa que so uma cunha
    // desenhada pode contar.
    {
      const heart = state.enemies.find((e) => e.alive && e.archetype === 'furnace_heart');
      if (heart && heart.mood === FURNACE_OVERHEATING) {
        const sweep = furnaceSweepAt(heart.x, heart.y, state.tick);
        const [ox, oy] = toScreen(sweep.x, sweep.y);
        const wedge = (dx: number, dy: number, fill: string, stroke: string): void => {
          const mid = Math.atan2(dy, dx);
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          // Amostrada em world space e projetada ponto a ponto: um setor
          // circular vira um setor ELIPTICO na isometrica, e desenha-lo como
          // arco de circunferencia na tela apontaria para o chao errado.
          const STEPS = 16;
          for (let s = 0; s <= STEPS; s++) {
            const a = mid - sweep.arc + (sweep.arc * 2 * s) / STEPS;
            const [sx, sy] = toScreen(
              sweep.x + Math.cos(a) * sweep.radius,
              sweep.y + Math.sin(a) * sweep.radius,
            );
            ctx.lineTo(sx, sy);
          }
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = stroke;
          ctx.lineWidth = Math.max(1, z * 0.6);
          ctx.stroke();
        };
        ctx.save();
        // O AVISO PULSA — e a unica coisa na tela que pulsa por aqui, e e assim
        // que ele se separa de tudo o que ja e quente na Fornalha: "aqui ainda
        // nao queima, e vai queimar".
        const beat = 0.5 + 0.5 * Math.sin(nowMs / 140);
        // ...e so aparece quando a onda anunciada VAI acontecer. No fim do
        // superaquecimento o instante avisado ja cai no resfriamento, e ali nao
        // ha varredura: uma cunha que some sem se cumprir ensina uma informacao
        // falsa, que e o defeito que ela existe para corrigir.
        if (sweep.warnFires) {
          wedge(
            sweep.warnDx,
            sweep.warnDy,
            `rgba(255,166,63,${(0.06 + beat * 0.1).toFixed(3)})`,
            `rgba(255,166,63,${(0.28 + beat * 0.32).toFixed(3)})`,
          );
        }
        // A QUEIMA nao pulsa: ela e o agora, e o agora nao pisca.
        wedge(sweep.dx, sweep.dy, 'rgba(255,122,47,0.24)', 'rgba(255,122,47,0.68)');
        ctx.restore();
      }
    }

    {
      for (const mark of pendingGroundMarkers(state)) {
        const remaining = mark.fireTick - state.tick;
        const lead =
          mark.kind === 'stalactite'
            ? STALACTITE_LEAD_TICKS
            : mark.kind === 'probe'
              ? mark.deepen
                ? LEVIATHAN_PROBE_DEEPEN_WINDUP_TICKS
                : LEVIATHAN_PROBE_WINDUP_TICKS
              : BLAST_LEAD_TICKS;
        const progress = Math.max(0, Math.min(1, 1 - remaining / lead));
        const [msx, msy] = toScreen(mark.x, mark.y);
        if (mark.kind === 'probe') {
          // A MARCA DA SONDAGEM: circulos ESCUROS se contraindo para o centro,
          // o chao encharcando progressivamente e bolhas subindo. A leitura
          // nao depende de cor: sao aneis concentricos que FECHAM, e o chao
          // fica cada vez mais escuro no miolo — o oposto exato do anel de
          // demolicao (vermelho, e o interno abre). A que AFUNDA a poca tem
          // aneis mais grossos e um anel tracejado a mais: e permanente.
          drawProbeMark(ctx, msx, msy, mark.radius, progress, z, nowMs, mark.deepen === true);
          this.particles.emitMovementBubbles(
            -11,
            mark.x + Math.sin(nowMs / 90) * 0.4,
            mark.y + Math.cos(nowMs / 70) * 0.4,
            0.6 + progress,
            0.6 + progress,
            0.5 + progress * 0.6,
            0.9 + progress,
            nowMs,
            false,
          );
          continue;
        }
        const rx = mark.radius * TILE_W * 0.5 * z;
        const ry = mark.radius * TILE_H * 0.5 * z;
        ctx.save();
        // O anel EXTERNO nao se move: ele diz onde. O interno fecha: ele diz
        // quando. Separar as duas leituras e o que permite decidir a rota sem
        // ficar medindo o relogio.
        ctx.strokeStyle =
          mark.kind === 'stalactite' ? 'rgba(255,166,63,0.55)' : 'rgba(217,59,76,0.55)';
        ctx.lineWidth = Math.max(1, z * 0.6);
        ctx.beginPath();
        ctx.ellipse(msx, msy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle =
          mark.kind === 'stalactite'
            ? `rgba(255,122,47,${0.1 + progress * 0.3})`
            : `rgba(217,59,76,${0.1 + progress * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(msx, msy, rx * progress, ry * progress, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // O VORTICE DA BOCA do Devorador. Desenhado no CHAO, junto das outras
    // marcas de solo e antes de qualquer corpo: ele e terreno acontecendo, nao
    // um efeito por cima da cena — e o jogador precisa ver os proprios pes
    // dentro dele.
    //
    // Nada aqui e transmitido. O unico numero que viaja e o tick em que a boca
    // abriu (`bossRuntime.mawOpenedAt`), e o alcance sai dele pela MESMA funcao
    // que a simulacao usa para decidir quem esta sendo puxado: o anel nao pode
    // prometer um raio diferente do raio que agarra.
    {
      const openedAt = state.bossRuntime.mawOpenedAt;
      const maw = state.enemies.find(
        (e) => e.alive && e.archetype === 'white_devourer' && e.mood === DEVOURER_MAW,
      );
      const reach = maw ? mawReach(state.tick, openedAt) : 0;
      if (maw && reach > 0.05) {
        const [mx, my] = toScreen(maw.x, maw.y);
        // O FATOR DA PROJECAO, e ele nao e cosmetico.
        //
        // Um circulo de raio R no mundo vira, nesta isometrica, uma elipse de
        // semi-eixos `R * TILE_W/2 * raiz(2)` e `R * TILE_H/2 * raiz(2)`: o
        // extremo horizontal esta em (R/raiz2, -R/raiz2), onde `x - y` vale
        // `R * raiz(2)` e nao R. Sem a raiz, o anel sai a 71% do raio que ele
        // anuncia — e ai a areia aparece girando FORA dele, que foi exatamente
        // como o defeito se manifestou.
        //
        // Um anel que promete um raio diferente do raio que agarra e pior que
        // anel nenhum, porque o jogador confia nele para decidir onde ficar.
        // A fracao com que TODO efeito deste cliente segue o preset de qualidade.
        // As duas camadas do vortice — a poeira e os riscos — a usam.
        const fxScale = this.quality.maxFx / PRESETS.high.maxFx;
        const ISO = Math.SQRT2;
        const ringX = (r: number): number => r * TILE_W * 0.5 * ISO * z;
        const ringY = (r: number): number => r * TILE_H * 0.5 * ISO * z;
        const seconds = nowMs / 1000;
        ctx.save();

        // 1. A GARGANTA: a unica coisa preenchida do desenho, e escura. Ela nao
        //    pulsa nem gira — e o lugar para onde tudo o mais aponta, e um
        //    centro que se mexe deixaria de ser um centro.
        //
        //    So aparece quando ela EXISTE, pela mesma condicao que a simulacao
        //    usa para cobrar (`reach >= BITE_RADIUS`). Desenhar a garganta antes
        //    disso mostraria uma sentenca no chao durante o unico segundo da
        //    janela em que pisar ali e inofensivo — e o jogador esta em cima
        //    dela nesse segundo, porque a queda do arco foi mirada nele.
        if (reach >= DEVOURER_MAW_BITE_RADIUS) {
          ctx.fillStyle = 'rgba(14,10,8,0.62)';
          ctx.beginPath();
          ctx.ellipse(
            mx,
            my,
            ringX(DEVOURER_MAW_BITE_RADIUS),
            ringY(DEVOURER_MAW_BITE_RADIUS),
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }

        // 2. A BORDA: ate onde a sucao chega NESTE tick. Cresce com a janela,
        //    entao o anel avancando pelo chao e o cronometro dela.
        ctx.strokeStyle = 'rgba(201,180,140,0.42)';
        ctx.lineWidth = Math.max(1, z * 0.7);
        ctx.beginPath();
        ctx.ellipse(mx, my, ringX(reach), ringY(reach), 0, 0, Math.PI * 2);
        ctx.stroke();

        // 3. A LINHA DO SEM-VOLTA, so depois que a boca cresceu ate ela. E a
        //    unica informacao do encontro que o jogador nao teria como medir:
        //    dali para dentro andar para tras deixa de bastar, e a resposta
        //    passa a ser esquiva, vidro ou uma quina. Vermelha e mais forte que
        //    a borda porque as duas dizem coisas de gravidade diferente.
        if (reach > MAW_NO_RETURN_RADIUS) {
          ctx.strokeStyle = 'rgba(217,59,76,0.5)';
          ctx.lineWidth = Math.max(1, z * 0.55);
          ctx.beginPath();
          ctx.ellipse(
            mx,
            my,
            ringX(MAW_NO_RETURN_RADIUS),
            ringY(MAW_NO_RETURN_RADIUS),
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }

        // 4. A POEIRA. Vem ANTES dos riscos porque e o segundo plano deles: a
        //    cortina que a boca levanta, com os graos passando por cima. Ela
        //    anda pelo MESMO caminho e mais devagar, e e o que da volume ao
        //    disco — sem ela o efeito e um punhado de riscos sobre chao limpo.
        {
          const clouds = Math.max(4, Math.round(MAW_CLOUDS * fxScale));
          ctx.fillStyle = SURFACE_FALLBACK[SURF_SILT];
          for (let i = 0; i < clouds; i++) {
            const puff = mawCloud(i, seconds, reach);
            if (puff.alpha <= 0.01) continue;
            const [cxp, cyGround] = toScreen(maw.x + puff.dx, maw.y + puff.dy);
            // A ALTURA do rolo vira deslocamento de tela aqui, e nao em
            // `maw-vortex.ts`: aquele arquivo e geometria de mundo e nao
            // conhece o zoom. `LEAP_PEAK_PX` e a mesma escala com que o arco do
            // chefe converte altura nesta lamina — um tile de altura, um tile
            // de subida na tela —, e usar duas escalas de altura no mesmo
            // encontro faria a poeira e o corpo dele discordarem do que e alto.
            const cyp = cyGround - puff.liftTiles * LEAP_PEAK_PX * z;
            // TRES LOBOS CONCENTRICOS por nuvem, e nao uma elipse.
            //
            // Uma elipse unica tem CONTORNO, e contorno e a unica coisa que
            // poeira nao tem: na primeira captura cada nuvem lia como uma
            // sombra chapada no chao. Empilhando tres discos que encolhem com o
            // mesmo alfa baixo, a opacidade cresce para o centro e a borda
            // desaparece — o mesmo que um gradiente radial daria, sem alocar um
            // por nuvem a cada quadro.
            for (const lobe of CLOUD_LOBES) {
              ctx.globalAlpha = puff.alpha * 0.075;
              ctx.beginPath();
              ctx.ellipse(
                cxp,
                cyp,
                ringX(puff.radius * lobe),
                ringY(puff.radius * lobe),
                0,
                0,
                Math.PI * 2,
              );
              ctx.fill();
            }
          }
        }

        // 5. A AREIA CAINDO PARA DENTRO. A simulacao come a silica celula a
        //    celula e o chao limpo chega pelo diff de chunks; o que falta, e o
        //    que estes riscos entregam, e o CAMINHO — a materia indo para
        //    dentro, dizendo de que lado esta o centro e o quanto ele puxa ali.
        ctx.strokeStyle = SURFACE_FALLBACK[SURF_SILT];
        ctx.lineWidth = Math.max(1, z * 0.5);
        // A CONTAGEM SEGUE O PRESET, pela mesma fracao que o resto dos efeitos
        // deste cliente usa (`maxFx / PRESETS.high.maxFx`): 145 no alto, 72 no
        // medio, 29 no baixo.
        //
        // Sem isto o vortice era o unico efeito da tela que o governador de
        // qualidade nao conseguia aliviar — e ele nasceu justamente do quadro
        // mais caro do encontro, com o chefe, a fauna arrastada e o disco de
        // terreno mudando ao mesmo tempo. Um efeito que ignora o preset nao e
        // caro: e imune a solucao.
        //
        // `count` vai junto porque e ele que espalha as fases dos graos ao longo
        // do caminho. Desenhar 29 indices de um total de 145 sem baixar o total
        // poria os 29 sobreviventes no mesmo trecho da espiral — um pelotao, e
        // nao um fluxo.
        const streaks = Math.max(12, Math.round(MAW_STREAKS * fxScale));
        for (let i = 0; i < streaks; i++) {
          const grain = mawStreak(i, seconds, reach, streaks);
          if (grain.alpha <= 0.01) continue;
          // Segmento a segmento, com a CABECA mais forte que a cauda.
          //
          // Uma polilinha de alfa unico e uma linha, e uma linha nao tem ponta:
          // ela diz onde a areia esta e nao para onde ela vai. Com o rastro
          // apagando para tras, cada grao vira uma seta — e o conjunto delas e o
          // que anuncia o centro sem desenhar nada apontando para ele.
          //
          // A polilinha continua existindo pelo motivo de sempre: o caminho e
          // uma espiral, e ligar as duas pontas em reta corta a curva pela
          // corda.
          for (let k = 1; k < grain.path.length; k++) {
            const a = grain.path[k - 1];
            const b = grain.path[k];
            const [ax, ay] = toScreen(maw.x + a.dx, maw.y + a.dy);
            const [bx, by] = toScreen(maw.x + b.dx, maw.y + b.dy);
            ctx.globalAlpha = grain.alpha * (0.16 + 0.74 * (k / (grain.path.length - 1)));
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    // levantam volume acima do piso e devem respeitar paredes e entidades.
    {
      const [csx, csy] = toScreen(state.corePos.x + 0.5, state.corePos.y + 0.5);
      if (csx > -80 && csx < vw + 80 && csy > -100 && csy < vh + 100) {
        // O poco fala o dialeto do bioma (portal:<chave>), com o `descent`
        // generico segurando atlas antigos em cache; selado na subida.
        const objectiveChain = objectiveAtlasChain(
          objectiveViewOf(state),
          state.stratum,
          state.occupation,
        );
        items.push({
          depth: state.corePos.x + state.corePos.y,
          draw: () => {
            for (const name of objectiveChain) {
              if (
                this.props.draw(
                  ctx,
                  name,
                  nowMs,
                  csx,
                  csy,
                  z,
                  bodyFaceLight(state.corePos.x, state.corePos.y, PROP_RESPONSE),
                )
              ) {
                return;
              }
            }

            // Fallback enquanto o atlas nao carregou. Mesmo no caminho de erro o
            // poco nao pode voltar a parecer o cristal que ele substituiu.
            if (objectiveName === 'descent') {
              const step = Math.floor(nowMs / 170) % 6;
              const platformRadius = step < 2 ? 3 : step < 4 ? 2 : 1;
              const sink = Math.min(4, step);
              ctx.fillStyle = PAL.rockShadow;
              ctx.fillRect(csx - 7 * z, csy - 3 * z, 14 * z, 5 * z);
              ctx.fillStyle = PAL.rust;
              ctx.fillRect(csx - 6 * z, csy - 4 * z, 12 * z, z);
              ctx.fillStyle = step < 2 ? PAL.loot : shade(PAL.rust, 0.8);
              ctx.fillRect(
                csx - platformRadius * z,
                csy - (6 - sink) * z,
                platformRadius * 2 * z,
                Math.max(1, z),
              );
              return;
            }

            const pulse = 0.6 + 0.4 * Math.sin(nowMs * 0.006);
            ctx.fillStyle =
              objectiveName === 'coreTaken' ? PAL.rockShadow : shade(PAL.biolum, pulse);
            ctx.fillRect(csx - 4 * z, csy - 10 * z, 8 * z, 10 * z);
          },
        });
      }
      const [esx, esy] = toScreen(state.entry.x + 0.5, state.entry.y + 0.5);
      if (esx > -80 && esx < vw + 80 && esy > -100 && esy < vh + 100) {
        // Na subida com o Nucleo a entrada E o portal para o setor de cima:
        // desenhar a plataforma chapada aqui esconderia o unico caminho.
        const entryChain = entryAtlasChain(objectiveViewOf(state), state.stratum, state.occupation);
        items.push({
          depth: state.entry.x + state.entry.y,
          draw: () => {
            for (const name of entryChain) {
              if (
                this.props.draw(
                  ctx,
                  name,
                  nowMs,
                  esx,
                  esy,
                  z,
                  bodyFaceLight(state.entry.x, state.entry.y, PROP_RESPONSE),
                )
              ) {
                return;
              }
            }
            ctx.fillStyle = shade(PAL.loot, 0.3 + brightness(state.entry.x, state.entry.y) * 0.5);
            ctx.fillRect(esx - 4 * z, esy - 2 * z, 8 * z, 4 * z);
          },
        });
      }
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        const solid = state.solid[i];
        if (solid === SOLID_NONE) continue;
        const b = brightness(x, y);
        if (b <= 0.045) continue;
        const [sx, sy] = toScreen(x + 0.5, y + 0.5);
        if (sx < -60 || sx > vw + 60 || sy < -60 || sy > vh + 80) continue;

        // Morfologia de borda: SO a rocha comum (fragil/minerio/cristal sao
        // linguagem mecanica e ficam universais) e SO no contorno — as faces
        // que a projecao mostra sao +x (direita) e +y (esquerda).
        const edgeRight = solid === SOLID_ROCK && x + 1 < w && state.solid[i + 1] === SOLID_NONE;
        const edgeLeft =
          solid === SOLID_ROCK && y + 1 < state.config.height && state.solid[i + w] === SOLID_NONE;

        items.push({
          depth: x + y,
          draw: () => {
            // Bloco voxel pre-renderizado. Um drawImage substitui os tres fills
            // de poligono; o caminho de poligono abaixo continua como fallback
            // para quando o atlas ainda nao carregou ou falhou.
            // Espelha BLOCK_KINDS do atlas de terreno, na ordem em que o
            // gerador empacota os tipos — com a rocha comum trocando de pele
            // pelo estrato do setor.
            const kindIndex = terrainKindIndexFor(solid, state.stratum);
            if (this.terrain.draw(ctx, kindIndex, x, y, b, sx, sy, z)) {
              drawWallEdgeDetail(ctx, state.stratum, i, edgeRight, edgeLeft, sx, sy, z, b);
              drawPipeSpill(ctx, solid, delugeR, nowMs, sx, sy, z);
              this.paintWallBounce(field, paintBounce, solid, x, y, sx, sy, z);
              // CRISTAL VIVO: o unico solido que emite, e o unico que ganha
              // halo. Opacado pelo acido ele apaga — e essa perda e exatamente
              // a leitura que o material existe para entregar. O halo sai na
              // ALTURA do bloco, e nao no pe dele: e o corpo inteiro que brilha.
              if (this.quality.bloom && solid === SOLID_CRYSTAL) {
                const pulse = 0.78 + 0.22 * Math.sin(nowMs / 520 + (x * 5 + y * 9));
                drawEmissiveHalo(
                  ctx,
                  PAL.biolum,
                  sx,
                  sy - WALL_H * 0.5 * z,
                  TILE_W * 0.6 * z,
                  0.42 * pulse,
                );
              }
              return;
            }

            const hw = (TILE_W / 2) * z;
            const hh = (TILE_H / 2) * z;
            const wh = WALL_H * z;
            let top = PAL.rockLight;
            let left = PAL.rock;
            let right = PAL.rockShadow;
            // Os estados corroidos precisam se distinguir TAMBEM no fallback:
            // se o atlas falhar de vez, um bloco enfraquecido apareceria como
            // rocha comum para sempre, e cair sem aviso e exatamente o que o
            // design proibe.
            if (solid === SOLID_FRAGILE_WEAK) {
              top = '#6e4a33';
              left = '#4a3122';
              right = '#2f1f16';
            } else if (solid === SOLID_ORE_CHIPPED) {
              top = '#8a6a3a';
              left = '#5c452a';
              right = '#3a2b1c';
            } else if (solid === SOLID_ORE_SPENT) {
              top = '#3a3f44';
              left = '#2a2e33';
              right = '#1c1f23';
            } else if (solid === SOLID_CRYSTAL_DULL) {
              top = '#2f6b4f';
              left = '#1f3d33';
              right = '#152721';
            } else if (isPipe(solid)) {
              // OS DUTOS: aco escuro e frio, distinto de toda rocha. Eles tem de
              // ler como CONSTRUIDOS a primeira vista — sao a prova de que
              // alguem bombeava agua daqui, e sao o unico aviso de onde ela vai
              // entrar quando o Leviata levantar o lencol.
              top = '#5d6b78';
              left = '#3c4854';
              right = '#252d36';
            } else if (solid === SOLID_FRAGILE) {
              top = '#5a5346';
              left = '#463f35';
              right = '#332e27';
            } else if (solid === SOLID_ORE) {
              top = PAL.rust;
              left = shade(PAL.rust, 0.7).replace('rgb', 'rgb');
              right = '#402b1e';
            } else if (solid === SOLID_CRYSTAL) {
              top = PAL.biolum;
              left = '#2f8a72';
              right = '#1d5c4c';
            }
            const f = 0.3 + b * 0.8;
            // face esquerda
            ctx.fillStyle = shade(left.startsWith('#') ? left : PAL.rock, f * 0.8);
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy);
            ctx.lineTo(sx, sy + hh);
            ctx.lineTo(sx, sy + hh - wh);
            ctx.lineTo(sx - hw, sy - wh);
            ctx.closePath();
            ctx.fill();
            // face direita
            ctx.fillStyle = shade(right.startsWith('#') ? right : PAL.rockShadow, f * 0.7);
            ctx.beginPath();
            ctx.moveTo(sx + hw, sy);
            ctx.lineTo(sx, sy + hh);
            ctx.lineTo(sx, sy + hh - wh);
            ctx.lineTo(sx + hw, sy - wh);
            ctx.closePath();
            ctx.fill();
            // topo
            ctx.fillStyle = shade(top.startsWith('#') ? top : PAL.rockLight, f);
            ctx.beginPath();
            ctx.moveTo(sx, sy - hh - wh);
            ctx.lineTo(sx + hw, sy - wh);
            ctx.lineTo(sx, sy + hh - wh);
            ctx.lineTo(sx - hw, sy - wh);
            ctx.closePath();
            ctx.fill();
            if (solid === SOLID_FRAGILE && b > 0.2) {
              // rachaduras da rocha fragil
              ctx.strokeStyle = `rgba(11,14,20,${0.55 * f})`;
              ctx.lineWidth = z * 0.6;
              ctx.beginPath();
              ctx.moveTo(sx - hw * 0.4, sy - wh - hh * 0.2);
              ctx.lineTo(sx + hw * 0.15, sy - wh + hh * 0.3);
              ctx.stroke();
            }
            // O contorno tambem existe no fallback: a identidade do estrato
            // nao pode depender do atlas ter carregado.
            drawWallEdgeDetail(ctx, state.stratum, i, edgeRight, edgeLeft, sx, sy, z, b);
            drawPipeSpill(ctx, solid, delugeR, nowMs, sx, sy, z);
          },
        });
      }
    }

    // Sites de salvamento: terminal sempre visivel; cofre apenas depois da varredura.
    for (const site of state.salvageSites) {
      const tb = brightness(site.terminal.x, site.terminal.y);
      if (tb > 0.05) {
        const [tsx, tsy] = toScreen(site.terminal.x + 0.5, site.terminal.y + 0.5);
        items.push({
          depth: site.terminal.x + site.terminal.y,
          draw: () => {
            const prop =
              site.terminalState === 'scanning'
                ? 'salvageTerminalScanning'
                : site.terminalState === 'complete'
                  ? 'salvageTerminalComplete'
                  : 'salvageTerminalIdle';
            if (
              this.props.draw(
                ctx,
                prop,
                nowMs,
                tsx,
                tsy,
                z,
                bodyFaceLight(site.terminal.x, site.terminal.y, PROP_RESPONSE),
              )
            ) {
              return;
            }
            ctx.fillStyle = shade(PAL.rockLight, 0.45 + tb * 0.45);
            ctx.fillRect(tsx - 4 * z, tsy - 12 * z, 8 * z, 12 * z);
            ctx.fillStyle =
              site.terminalState === 'scanning'
                ? PAL.loot
                : site.terminalState === 'complete'
                  ? PAL.biolum
                  : PAL.rock;
            ctx.fillRect(tsx - 2 * z, tsy - 9 * z, 4 * z, 4 * z);
          },
        });
      }
      if (!site.cacheRevealed) continue;
      const cb = brightness(site.cache.x, site.cache.y);
      if (cb <= 0.05) continue;
      const [csx, csy] = toScreen(site.cache.x + 0.5, site.cache.y + 0.5);
      items.push({
        depth: site.cache.x + site.cache.y,
        draw: () => {
          // A classe do cofre e GEOMETRIA de prop, nao recolor: ver
          // cachePropChain — a classe I e o fallback para atlas antigo.
          const faces = bodyFaceLight(site.cache.x, site.cache.y, PROP_RESPONSE);
          for (const prop of cachePropChain(site.tier, site.cacheOpened)) {
            if (this.props.draw(ctx, prop, nowMs, csx, csy, z, faces)) return;
          }
          ctx.fillStyle = shade(PAL.rock, 0.5 + cb * 0.4);
          ctx.fillRect(csx - 5 * z, csy - 5 * z, 10 * z, 5 * z);
          ctx.fillStyle = site.cacheOpened ? PAL.rockShadow : PAL.loot;
          ctx.fillRect(csx - 3 * z, csy - 4 * z, 6 * z, 2 * z);
        },
      });
    }

    // sombra de contato + barra de vida, comuns aos caminhos sprite e voxel
    const drawShadow = (sx: number, sy: number, size: number, alpha = 0.45): void => {
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy, size, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    const drawHealthBar = (sx: number, topY: number, size: number, hpFrac: number): void => {
      if (hpFrac >= 1) return;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(sx - size, topY, size * 2, 2.4 * z);
      ctx.fillStyle = hpFrac > 0.4 ? PAL.fungusLight : PAL.blood;
      ctx.fillRect(sx - size, topY, size * 2 * hpFrac, 2.4 * z);
    };

    // Atlases na grade fina (ATLAS_SCALE): no zoom tipico de 2x o sprite e
    // desenhado 1:1 — cada pixel de atlas num pixel de tela — que e onde o
    // detalhe dobrado aparece. Continua inteiro e >= 1 pelo mesmo motivo de
    // sempre: fracao de pixel borra o sprite inteiro.
    const spriteZoom = Math.max(1, Math.round(z / ATLAS_SCALE));

    // Os Ecos da Ressonancia do Poco. Entram na fila ordenada como qualquer
    // corpo: eles ocupam espaco no mundo, e um Eco desenhado por cima da parede
    // que o esconde deixaria de parecer que esta LA.
    for (const offer of state.wellOffers) {
      if (offer.takenBy !== null) continue;
      const [osx, osy] = toScreen(offer.x, offer.y);
      if (osx < -80 || osx > vw + 80 || osy < -100 || osy > vh + 80) continue;
      const reachable =
        Math.hypot(state.player.x - offer.x, state.player.y - offer.y) <= WELL_OFFER_REACH;
      items.push({
        depth: offer.x + offer.y,
        draw: () => this.drawWellOffer(offer, osx, osy, z, spriteZoom, nowMs, reachable),
      });
    }

    // O prompt das JUNCOES de leyline: aparece so com o jogador perto (a
    // proximidade convida, o ato e o botao — a mesma regra da caixa-preta),
    // na fila ordenada porque a juncao e parede do mundo como tudo aqui.
    for (let n = 0; n < state.leylineNodes.length; n++) {
      const node = state.leylineNodes[n];
      const nx = (node.cell % state.config.width) + 0.5;
      const ny = Math.floor(node.cell / state.config.width) + 0.5;
      const dist = Math.hypot(state.player.x - nx, state.player.y - ny);
      if (dist > 2.5) continue;
      const [nsx, nsy] = toScreen(nx, ny);
      if (nsx < -80 || nsx > vw + 80 || nsy < -100 || nsy > vh + 80) continue;
      const reachable = dist <= LEYLINE_NODE_INTERACT_RADIUS;
      // A NASCENTE tem outro verbo e por isso outro rotulo: ela lanca a
      // cascata do circuito em vez de togglar o proprio rele. Dizer "ROTEAR"
      // ali seria prometer o que a tecla nao faz.
      const source = n === state.leylineCircuit.sourceNode;
      items.push({
        depth: nx + ny + 0.5,
        draw: () =>
          this.drawLeylineNodePrompt(
            source
              ? state.leylineCircuit.closed
                ? 'leyline.source.again'
                : 'leyline.source.launch'
              : node.routed
                ? 'leyline.node.unroute'
                : 'leyline.node.route',
            nsx,
            nsy,
            z,
            nowMs,
            reachable,
          ),
      });
    }

    // As peças do Diamandis caidas no chao. Entram na mesma fila ordenada pela
    // mesma razao dos Ecos: elas estao NO mundo, e uma marca desenhada por cima
    // da parede que a esconde mentiria sobre haver caminho ate ela.
    for (const mark of this.bossModuleMarks.values()) {
      const [msx, msy] = toScreen(mark.x, mark.y);
      if (msx < -80 || msx > vw + 80 || msy < -100 || msy > vh + 80) continue;
      items.push({
        depth: mark.x + mark.y,
        draw: () => this.drawBossModuleMark(mark, msx, msy, z, nowMs),
      });
    }

    const pairedEcho = this.deathEchoes.paired;
    for (const echo of this.deathEchoes.echoes) {
      const [esx, esy] = toScreen(echo.x, echo.y);
      if (esx < -80 || esx > vw + 80 || esy < -100 || esy > vh + 80) continue;
      const bodyAlpha = deathEchoBodyAlpha(brightness(echo.x, echo.y));
      items.push({
        depth: echo.x + echo.y,
        draw: () => this.drawDeathEchoBody(echo, esx, esy, z, spriteZoom, nowMs, bodyAlpha),
      });
      if (pairedEcho?.echo.id === echo.id) {
        // O holograma entra como item PRÓPRIO, meio tile à frente da carcaça: ele
        // ocupa o espaço em volta do corpo, e enfileirado junto seria cortado
        // pela mesma parede que esconde o corpo.
        items.push({
          depth: echo.x + echo.y + 0.5,
          draw: () => this.drawDeathEchoTrace(pairedEcho, toScreen, z, nowMs),
        });
      }
      if (this.deathEchoes.prompt?.id === echo.id) {
        items.push({
          depth: echo.x + echo.y + 0.5,
          draw: () => this.drawDeathEchoPrompt(esx, esy, z, nowMs),
        });
      }
    }

    // DECORACAO: derivada e cacheada por setor. Nao vive no estado — e a
    // camada que explica onde o jogador esta sem tocar na simulacao, e
    // qualquer cliente reconstroi a mesma lista a partir da seed.
    const decorKey = `${state.config.seed}:${state.sector}:${state.stratum}`;
    if (this.decorKey !== decorKey) {
      this.decorKey = decorKey;
      this.decor = placeDecor(state);
      // A fenda e escolhida contra o mundo PRISTINO (saloes selados nao
      // contam) e cacheada com a decoracao: uma reconstrucao por setor.
      this.rupture = sectorRupture(state);
      // Mundo novo, lamina nova: rastros do setor anterior morreriam como
      // "orfaos" DESENHADOS por ate 2,6s sobre coordenadas do mapa antigo.
      this.lurkerTrails.clear();
      this.devourerSpines.reset();
      this.leviathanBodies.reset();
      this.devourerAloft.clear();
      this.devourerLandedAt.clear();
      this.bossModuleMarks.clear();
    }
    for (const prop of this.decor) {
      // O landmark ancora numa celula SOLIDA: a luz dele e a da parede (mesma
      // convencao do desenho de blocos), nao a do chao que nao existe ali.
      const db =
        prop.anchor === 'landmark'
          ? brightness(prop.x, prop.y)
          : brightness(prop.x + 0.5, prop.y + 0.5);
      if (db <= 0.05) continue;
      const [dsx, dsy] = toScreen(prop.x + 0.5, prop.y + 0.5);
      // Monumentos e formacoes de teto sobem varias alturas de parede; a
      // margem vertical maior evita poda-los enquanto o topo ainda aparece.
      const tall = prop.anchor === 'landmark' || prop.anchor === 'ceiling';
      if (dsx < -60 || dsx > vw + 60 || dsy < (tall ? -140 : -60) || dsy > vh + 60) continue;
      // O mundo muda por baixo do enfeite: parede arrancada, fogo passando.
      // Um prop invalido simplesmente nao e desenhado neste quadro.
      if (!propStillValid(state, prop)) continue;
      items.push({
        // Teto desenha DEPOIS do que anda na mesma celula: pende acima das
        // criaturas, e a translucidez garante que nada fica escondido. O
        // landmark compartilha a profundidade do pedestal — o sort estavel o
        // desenha logo apos o proprio bloco.
        depth: prop.x + prop.y + (prop.anchor === 'ceiling' ? 2 : 0),
        draw: () => {
          // Prop com massa vem do atlas (modelo voxel de verdade); o desenho
          // de runtime fica como fallback de atlas nao carregado — e como o
          // caminho unico dos micros e dos pendentes que balancam. O
          // landmark ancora no TOPO do bloco pedestal (uma altura de parede
          // acima da base); o pendente de teto e modelado de ponta-cabeca
          // com a bica na ancora, entao sobe erguido — e translucido, com o
          // MESMO contrato de honestidade do caminho de runtime.
          let atlasName = decorAtlasName(prop);
          // O canario e MOSTRADOR: vivo/morto vem da contaminacao
          // autoritativa (mesmo valor do HUD), nunca da variante sorteada —
          // quando os passaros calam, o retorno ja esta caro.
          if (prop.kind === 'canary_cage') {
            atlasName = `decor:canary_cage:${state.contamination >= CANARY_DEAD_AT ? 1 : 0}`;
          }
          if (atlasName) {
            const ceiling = prop.anchor === 'ceiling';
            const lift = prop.anchor === 'landmark' ? 14 * z : ceiling ? 10 * z : 0;
            if (ceiling) {
              ctx.save();
              ctx.globalAlpha *= CEILING_ALPHA;
            }
            const drew = this.props.draw(
              ctx,
              atlasName,
              nowMs,
              dsx,
              dsy - lift,
              z,
              bodyFaceLight(prop.x, prop.y, PROP_RESPONSE),
            );
            if (ceiling) ctx.restore();
            if (drew) return;
          }
          drawDecorProp(ctx, prop, dsx, dsy, z, nowMs);
        },
      });
    }

    this.archetypeById.clear();
    for (const pl of state.players) this.archetypeById.set(pl.id, 'prospector');
    const trailUpdated = new Set<number>();
    const leviathansDrawn = new Set<number>();
    /** Quais Devoradores tiveram corpo montado neste quadro. Ver `keepOnly`. */
    const wormsDrawn = new Set<number>();
    for (const enemy of state.enemies) {
      this.archetypeById.set(enemy.id, enemy.archetype);
      if (!enemy.alive) continue;

      // A AREIA SE ABRINDO E SE FECHANDO. Vem ANTES do corte de luz de
      // proposito: um verme de seis tiles atravessando o chao no escuro
      // continua sacudindo a sala. O tremor e a unica coisa que este chefe
      // entrega quando nao da para ve-lo, e apaga-lo junto com o sprite seria
      // apagar o unico aviso que sobra.
      if (enemy.archetype === 'white_devourer') {
        const aloft = enemy.mood === DEVOURER_AIRBORNE;
        const was = this.devourerAloft.get(enemy.id);
        if (was !== undefined && was !== aloft) {
          const jolt = aloft ? DEVOURER_BREACH_SHAKE : DEVOURER_DIVE_SHAKE;
          this.shake = { power: jolt.power, until: nowMs + jolt.ms };
          // Descer do ar E o pouso: e daqui que a descida comeca a contar.
          if (!aloft) this.devourerLandedAt.set(enemy.id, state.tick);
        }
        this.devourerAloft.set(enemy.id, aloft);
      }

      const b = brightness(enemy.x, enemy.y);
      // O CORTE DE LUZ E DA CABECA, e a cabeca do Devorador nao e o corpo dele.
      //
      // Sair da iteracao aqui apagava os dez aneis inteiros no instante em que a
      // CABECA entrava numa celula escura — um corpo de seis tiles some porque
      // uma ponta dele atravessou uma sombra, com o resto ainda iluminado. Pior
      // que o sumico: sem passar pelo `wormsDrawn` deste quadro, `keepOnly`
      // jogava fora o rastro, e o corpo voltava RETO quando a cabeca reaparecia.
      //
      // Entao o corte espera: o corpo e montado e enfileirado antes dele, e quem
      // decide anel por anel e a luz de cada anel, que ja e conferida no laco de
      // baixo. Todo o resto (sprite da cabeca, barra, sombra) continua cortado.
      const headDark = b <= 0.05;
      if (headDark && enemy.archetype !== 'white_devourer') continue;
      const anim = this.animFor(enemy.id, enemy.x, enemy.y, enemy.hp, enemy.alive, nowMs);
      const presented = this.presentation.animationFor(enemy, state, anim, nowMs);
      // Espreitador DENTRO do elemento: o corpo nao aparece. A simulacao ja
      // manda a postura em `mood` (e por isso ela viaja no snapshot); desenhar
      // o sprite inteiro aqui apagaria a mecanica de ocultacao do Aquifero e
      // da Cripta — o jogador veria a posicao exata em vez da ONDULACAO que o
      // bioma promete. Fica so a perturbacao da superficie, sem sombra e sem
      // barra de vida; o indicador de atordoamento continua, porque levar a
      // descarga e exatamente o momento em que a leitura tem de ser clara.
      const lurkerHidden =
        (enemy.archetype === 'mud_lamprey' || enemy.archetype === 'frost_wraith') &&
        enemy.mood === LURKER_HIDDEN;
      if (lurkerHidden) {
        // O RASTRO: alem da perturbacao no lugar atual, a lamina lembra por
        // onde o bicho passou — o espreitador vira um vetor legivel, nao um
        // ponto. Ver lurker-trail.ts; tudo deriva de posicao + relogio.
        const inWater = enemy.archetype === 'mud_lamprey';
        let trail = this.lurkerTrails.get(enemy.id);
        if (!trail) {
          trail = { ttlMs: trailTtlMs(inWater), inWater, points: [] };
          this.lurkerTrails.set(enemy.id, trail);
        }
        updateTrail(trail, enemy.x, enemy.y, nowMs);
        trailUpdated.add(enemy.id);
        const size = enemy.radius * TILE_W * 0.9 * z;
        // A pegada mais nova E a posicao atual — la desenha a perturbacao
        // viva; o rastro sao as anteriores, desbotando.
        for (let p = 0; p < trail.points.length - 1; p++) {
          const pt = trail.points[p];
          // A pegada obedece a MESMA luz que tudo: um risco desenhado no
          // escuro entregaria a rota do bicho por terreno que o jogador nao
          // ve — stealth pago em iluminacao nao pode vazar pelo rastro.
          if (brightness(pt.x, pt.y) <= 0.05) continue;
          const [tx, ty] = toScreen(pt.x, pt.y);
          if (tx < -60 || tx > vw + 60 || ty < -60 || ty > vh + 60) continue;
          const age = trailAge(trail, pt, nowMs);
          items.push({
            depth: pt.x + pt.y - 0.25,
            draw: () => drawLurkerTrailPoint(ctx, tx, ty, size, z, age, inWater),
          });
        }
      }
      // O ARCO do Devorador. A simulacao nao tem altura — nao ha colisao em z —
      // entao ela viaja como TEMPO, no vao da acao de salto, e vira pixel aqui.
      // `sy` continua sendo o chao (e onde a sombra e a profundidade da fila
      // moram); so o corpo sobe.
      //
      // Sai da closure de desenho porque o CORPO do Devorador tambem precisa
      // dele, e precisa antes: os dez aneis entram na fila ordenada um a um, com
      // profundidade propria, e a fila e montada aqui fora.
      const leap =
        enemy.action?.kind === 'leap'
          ? leapHeight(leapProgress(state.tick, enemy.action.startedAt, enemy.action.releaseAt))
          : 0;

      // O MERGULHO E A EMERGENCIA.
      //
      // Ele pousa, ENTRA na areia e sai em outro lugar. A simulacao ja fazia a
      // metade que importa — no instante em que arma a erupcao ela realoca o
      // corpo para o ponto de decolagem, a 5..11 tiles dali — mas com o bicho a
      // 11 px de profundidade aquilo era um teleporte a vista, e o intervalo
      // inteiro era uma lombada passeando pela areia. Escondido, a mesma
      // realocacao vira o que ela sempre quis dizer.
      //
      // As duas pontas sao telegrafos que ja existiam e ninguem estava usando: a
      // descida comeca no pouso (a cratera e o tremor ja avisam) e a subida corre
      // pelo windup da erupcao, que existe exatamente para prometer "vou sair
      // aqui". O aviso agora e o proprio corpo saindo.
      const submerged01 =
        enemy.archetype === 'white_devourer'
          ? devourerSubmergence(
              enemy.mood,
              landedAgo(this.devourerLandedAt.get(enemy.id), state.tick),
              enemy.action?.kind === 'erupt'
                ? leapProgress(state.tick, enemy.action.startedAt, enemy.action.releaseAt)
                : null,
            )
          : 0;
      // O CORPO SEGMENTADO DO DEVORADOR.
      //
      // O chefe media 3,1 tiles e o relato de playtest foi "nem parece um Boss".
      // O que faltava nao era area: era COMPRIMENTO, e comprimento num sprite
      // unico custa largura de atlas ao quadrado. Entao o corpo saiu do sprite —
      // o atlas do chefe desenha so a cabeca e o colar — e virou dez aneis
      // pendurados no rastro que a propria cabeca deixou (devourer-spine.ts).
      //
      // O que isso compra alem do tamanho: o MERGULHO. A elevacao viaja no
      // rastro junto com a posicao, entao quando a cabeca crava na areia no fim
      // do salto os aneis atras dela ainda estao lendo a altura que ela tinha no
      // meio do arco — o bicho entra no chao com a cauda no ar, que e o que uma
      // parabola faz e que nenhum sprite rigido consegue desenhar.
      //
      // A COLISAO NAO MUDA: a simulacao continua movendo e testando um ponto so,
      // a cabeca. Os aneis nao machucam, nao bloqueiam e nao existem fora daqui.
      const wormBody =
        enemy.archetype === 'white_devourer' && enemy.mood !== DEVOURER_MAW && !lurkerHidden
          ? this.devourerSpines.follow(
              enemy.id,
              {
                x: enemy.x,
                y: enemy.y,
                liftPx: devourerHeadLiftPx(enemy.mood, leap, submerged01),
                dirX: presented.facingX,
                dirY: presented.facingY,
              },
              nowMs,
            )
          : null;
      // A cabeca sobe pelo MESMO numero que alimenta o rastro. Derivar as duas
      // alturas em separado abriria a porta para a cabeca e o primeiro anel
      // discordarem por um pixel — e e exatamente ali que fica a costura entre
      // os dois atlas.
      const headLiftPx = wormBody
        ? devourerHeadLiftPx(enemy.mood, leap, submerged01)
        : leap * LEAP_PEAK_PX;
      if (wormBody) {
        wormsDrawn.add(enemy.id);
        for (const node of wormBody) {
          // Cada anel entra na fila com a PROFUNDIDADE DELE, e nao com a da
          // cabeca. Um corpo de seis tiles empilhado numa profundidade so
          // passaria inteiro na frente (ou inteiro atras) de tudo o que ele
          // atravessa — e ele atravessa muito, porque e comprido.
          const nb = brightness(node.x, node.y);
          if (nb <= 0.05) continue;
          const [nsx, nsy] = toScreen(node.x, node.y);
          if (nsx < -90 || nsx > vw + 90 || nsy < -90 || nsy > vh + 90) continue;
          items.push({
            depth: node.x + node.y,
            draw: () =>
              this.drawDevourerRing(
                ctx,
                node,
                nsx,
                nsy,
                z,
                spriteZoom,
                bodyLight(node.x, node.y, CREATURE_RESPONSE),
                bodyFaceLight(node.x, node.y, CREATURE_RESPONSE),
              ),
          });
        }
      }
      // O CORPO SEGMENTADO DO LEVIATA.
      //
      // Oito cortes transversais atras da cabeca (leviathan-body.ts). A razao
      // de ele ser em pecas nao e comprimento, e a SUBMERSAO: cabeca, asas,
      // tronco e cauda atravessam a lamina em momentos diferentes, e cada
      // peca e recortada pela superficie da agua na propria fracao. Ancorado
      // ele nao tem rastro (a pose e autorada em volta do corpo parado);
      // cacando, na segunda fase, o corpo segue as curvas da cabeca pelo
      // mesmo rastro por comprimento de arco do Devorador.
      //
      // ESCONDIDO nao desenha NADA — nem corpo, nem sombra, nem barra: a
      // posicao autoritativa ja e a da poca de destino, e o unico sinal que
      // ele da e o borbulhar la (desenhado com as marcas de chao).
      // Quanto o Leviata SOBE para nadar na superficie do Diluvio, em pixels:
      // a altura da coluna d'agua na celula, so na cacada (ancorado, a poca e
      // dele e a lamina ainda nao subiu).
      //
      // Emergindo debaixo do Diluvio ele SOBE do fundo ate a superficie com a
      // propria emergencia (`exposed` e a fracao fora d'agua daquela peca):
      // sem isso ele emergia no piso e saltava um tile inteiro para cima no
      // primeiro quadro da cacada.
      const swimLiftAt = (ent: Entity, x: number, y: number, exposed = 1): number => {
        if (ent.archetype !== 'sheet_leviathan') return 0;
        const posture = leviathanPosture(ent);
        const rising =
          posture === 'emerging' && (state.bossRuntime.phasesFired & BOSS_PHASE_DELUGE) !== 0;
        if (posture !== 'hunting' && posture !== 'charging' && !rising) return 0;
        const ci = Math.floor(y) * state.config.width + Math.floor(x);
        return (
          delugeDepth(state, ci) * TILE_H * z * (rising ? Math.max(0, Math.min(1, exposed)) : 1)
        );
      };
      let leviathanHead: LeviathanBodyHead | null = null;
      if (enemy.archetype === 'sheet_leviathan') {
        if (leviathanPosture(enemy) === 'hidden') continue;
        const subs = leviathanSubmersions(enemy, state.tick);
        leviathanHead = {
          x: enemy.x,
          y: enemy.y,
          dirX: presented.facingX,
          dirY: presented.facingY,
          submersion: subs.head,
        };
        const nodes = this.leviathanBodies.nodes(enemy, state.tick, leviathanHead, nowMs);
        leviathansDrawn.add(enemy.id);
        // A MASSA por baixo da lamina: uma sombra larga e sem borda sob a
        // cabeca e sob cada peca, so sobre agua. O dorso e o que se ve; a
        // sombra e o que diz que ha muito mais dele ali embaixo. Ela fica
        // enquanto o corpo afunda (a coisa continua la) e some com ele.
        const massAt = (x: number, y: number, radius: number, submersion: number): void => {
          const ci = Math.floor(y) * state.config.width + Math.floor(x);
          if (ci < 0 || ci >= state.surface.length) return;
          const surf = state.surface[ci];
          const wet = surf === SURF_WATER || surf === SURF_DEEP_WATER || delugeDepth(state, ci) > 0;
          if (!wet) return;
          if (brightness(x, y) <= 0.05) return;
          const [msx, msy] = toScreen(x, y);
          items.push({
            depth: x + y - 0.75,
            draw: () => drawLeviathanMass(ctx, msx, msy, radius, z, 0.5 * (1 - 0.45 * submersion)),
          });
        };
        massAt(enemy.x, enemy.y, LEVIATHAN_HEAD_MASS_RADIUS, subs.head);
        for (const node of nodes) {
          if (node.submersion >= 1) continue;
          massAt(node.x, node.y, LEVIATHAN_MASS_RADIUS[node.rank] ?? 0.5, node.submersion);
        }
        for (const node of nodes) {
          if (node.submersion >= 1) continue;
          const nb = brightness(node.x, node.y);
          if (nb <= 0.05) continue;
          const [nsx, nsy] = toScreen(node.x, node.y);
          if (nsx < -120 || nsx > vw + 120 || nsy < -120 || nsy > vh + 120) continue;
          const pieceLift = swimLiftAt(enemy, node.x, node.y, 1 - node.submersion);
          items.push({
            depth: node.x + node.y,
            draw: () =>
              this.drawLeviathanPiece(
                ctx,
                node,
                nsx,
                nsy - pieceLift,
                z,
                spriteZoom,
                bodyLight(node.x, node.y, CREATURE_RESPONSE),
                bodyFaceLight(node.x, node.y, CREATURE_RESPONSE),
                nowMs,
              ),
          });
        }
      }
      // Montado o corpo (e preservado o rastro), a cabeca no escuro para aqui.
      if (headDark) continue;

      // SUMIDO NA AREIA: nao ha cabeca, e nao ha nada em volta dela.
      //
      // O `continue` leva junto a sombra, a barra de vida, o anel de elite e o
      // indicador de atordoamento, e e por isso que ele fica aqui e nao dentro
      // do desenho do sprite: uma barra de vida boiando sobre areia lisa
      // entregaria a posicao exata de um bicho que acabou de sumir, e o
      // intervalo enterrado existe justamente para o jogador NAO saber onde ele
      // esta — o rastro de silica e a unica resposta que esse intervalo da.
      //
      // A PERGUNTA E A DO RECORTE, e nao "o afundamento chegou a 1". A primeira
      // versao comparava com 1 e estava errada nas duas pontas da rampa: a
      // cabeca some do recorte com 0,605 de afundamento (zoom largo), entao
      // sobravam nove ticks de descida e nove de subida com a sombra e a barra
      // desenhadas sozinhas — no ponto de emergencia, que e o que este mergulho
      // existe para nao entregar.
      //
      // Os aneis ja passaram: eles saem por conta propria, porque a elevacao
      // deles vem do rastro e a cauda ainda esta entrando quando a cabeca ja
      // sumiu. O corpo termina de entrar depois da cabeca, que e o que um verme
      // faz.
      if (enemy.archetype === 'white_devourer' && !devourerHeadShows(headLiftPx, z, spriteZoom)) {
        continue;
      }

      // A NINHADA. Caminho proprio e curto, porque tudo o que o caminho comum
      // faz por um inimigo esta errado para ela: nao ha barra de vida (um
      // bicho de um ponto de vida com barra seria uma piada de interface), nao
      // ha sombra (ela mede um terco de tile e a sombra ficaria maior que o
      // corpo), nao ha indicador de atordoamento e nao ha tint de elite.
      //
      // E o quadro nao vem do relogio sozinho: os quadros deste atlas sao
      // (variante x fase), e a variante sai do ID do bicho. Pelo caminho comum
      // as tres variantes viravam uma minhoquinha so, trocando de corpo
      // enquanto anda.
      if (enemy.archetype === 'devourer_brood') {
        items.push({
          depth: enemy.x + enemy.y,
          draw: () => {
            const [bx, by] = toScreen(enemy.x, enemy.y);
            const variant = ((enemy.id % BROOD_VARIANTS) + BROOD_VARIANTS) % BROOD_VARIANTS;
            // A fase corre pelo relogio com um desvio POR BICHO. Sem o desvio,
            // catorze filhotes ondulariam em unissono — que e a leitura de
            // engrenagem, o oposto exato de um bando.
            const phase = Math.floor(nowMs / BROOD_FRAME_MS + enemy.id * 2.7) % BROOD_PHASES;
            this.sprites.drawPiece(
              ctx,
              DEVOURER_BROOD_ATLAS,
              'idle',
              variant * BROOD_PHASES + phase,
              presented.facingX,
              presented.facingY,
              bx,
              by,
              spriteZoom,
              undefined,
              bodyLight(enemy.x, enemy.y, CREATURE_RESPONSE),
              bodyFaceLight(enemy.x, enemy.y, CREATURE_RESPONSE),
            );
          },
        });
        continue;
      }

      items.push({
        depth: enemy.x + enemy.y,
        draw: () => {
          const [sx, sy] = toScreen(enemy.x, enemy.y);
          const size = enemy.radius * TILE_W * 0.9 * z;
          const bodyY = sy - headLiftPx * z;
          if (lurkerHidden) {
            drawLurkerDisturbance(
              ctx,
              sx,
              sy,
              size,
              z,
              nowMs,
              enemy.id,
              enemy.archetype === 'mud_lamprey',
              enemy.facing,
            );
            if (enemy.stunnedUntil > state.tick) {
              drawStunIndicator(ctx, sx, sy, size, z, enemy.id, state.tick);
            }
            return;
          }
          drawShadow(sx, sy, size * leapShadowScale(leap), leapShadowAlpha(leap));
          // O RECORTE NA LINHA DA AREIA, so para quem esta atravessando ela.
          //
          // O anel do corpo ja fazia isso; a cabeca nunca fez, e enquanto o
          // afundamento era de 11 px ninguem reparou — o sprite descia um
          // dedo e pronto. Descendo 95 px ela apareceria inteira, desenhada
          // sobre o terreno de baixo, boiando: um verme flutuando no ar por
          // fora da duna. O recorte e o que transforma "desenhado mais para
          // baixo" em "enfiado na areia".
          // Recorta so na TRAVESSIA. De boca aberta ele tambem esta abaixo do
          // chao, mas ali o sprite e a cratera — autorada para ficar na areia, e
          // descendo 40 px abaixo da ancora. Cortar aquilo na linha de 11
          // decapitaria a propria janela de dano do encontro.
          const sand =
            enemy.mood === DEVOURER_BURROWED && submerged01 > 0
              ? this.devourerSandLine(sy, spriteZoom)
              : null;
          if (sand !== null) {
            if (sand <= 0) return;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, ctx.canvas.width, sand);
            ctx.clip();
          }
          // A CABECA DO LEVIATA atravessando a lamina: desce e e recortada na
          // linha d'agua, como cada peca do corpo (ver `drawLeviathanPiece`).
          const dip = leviathanHead
            ? leviathanWaterDip(leviathanHead.submersion, sy, spriteZoom)
            : null;
          if (dip) {
            if (dip.line <= 0) return;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, ctx.canvas.width, dip.line);
            ctx.clip();
          }
          // NA CACADA ele nada NA SUPERFICIE do Diluvio: a cabeca sobe a
          // altura da coluna d'agua (a massa fica no chao). Desenhado no piso,
          // tres tiles debaixo da lamina, ele lia como um bicho no fundo de um
          // aquario — e a agua, como um filtro.
          const swimLift = swimLiftAt(
            enemy,
            enemy.x,
            enemy.y,
            1 - (leviathanHead?.submersion ?? 0),
          );
          const cell = Math.floor(enemy.y) * state.config.width + Math.floor(enemy.x);
          const waterDepth = leviathanHead ? 0 : delugeDepth(state, cell);
          const waterLine = waterDepth > 0 ? sy - waterDepth * TILE_H * z : null;
          const drawY = bodyY + (dip?.drop ?? 0) - swimLift;
          const paint = (override: Tint | undefined): boolean =>
            this.sprites.drawEntity(
              ctx,
              enemy.archetype,
              presented.anim,
              presented.facingX,
              presented.facingY,
              presented.elapsedMs,
              sx,
              drawY,
              spriteZoom,
              // Um sheet de frames fixos nao sabe o humor da entidade, e o
              // mineiro enfurecido precisa ler como enfurecido A DISTANCIA. O
              // gancho de tint que ja existia para o elite serve exatamente para
              // isso — e vermelho contra o laranja do elite mantem as duas
              // marcacoes distinguiveis.
              override ??
                (enemy.archetype === 'miner' && enemy.mood === MINER_MOOD_ENRAGED
                  ? { color: 'rgba(217,59,76,0.45)', alpha: 0.45 }
                  : // O COLAPSO no corpo do chefe: a pedra dele esquenta ate ficar
                    // vermelha, e a instabilidade a leva ao branco. E a leitura
                    // que diz, sem numero na tela, que a luta esta acabando — e
                    // ela pulsa no MESMO ritmo do tremor, porque e o mesmo
                    // coracao batendo.
                    enemy.archetype === 'furnace_heart'
                    ? furnaceBodyTint(livePhases, nowMs)
                    : enemy.elite
                      ? { color: 'rgba(255,122,47,0.35)', alpha: 0.35 }
                      : undefined),
              // A LUZ DO MUNDO sobre a casca do bicho. Separada do tint acima de
              // proposito: aquele conta um ESTADO da criatura (elite, enfurecida,
              // colapsando) e este conta o que esta acontecendo AO REDOR dela. Se
              // dividissem o mesmo canal, uma explosao apagaria a marcacao de
              // elite justamente no instante de maior confusao na tela.
              bodyLight(enemy.x, enemy.y, CREATURE_RESPONSE),
              bodyFaceLight(enemy.x, enemy.y, CREATURE_RESPONSE),
            );
          // Todo corpo que nao nada e CORTADO pela lamina: e a linha d'agua
          // que o jogador le para saber quanto a sala ja encheu.
          const drew =
            waterLine !== null
              ? drawCutByWaterline(ctx, waterLine, sx, enemy.radius * TILE_W * z, z, nowMs, paint)
              : paint(undefined);
          if (!drew) {
            drawVoxelEntity(ctx, {
              sx,
              sy: drawY,
              z,
              radius: enemy.radius,
              brightness: b,
              archetype: enemy.archetype,
              elite: enemy.elite,
              nowMs,
              // Amostra a superficie sob o bicho em vez de esperar um campo no
              // snapshot: o cliente online ja espelha os chunks, entao o chao
              // debaixo do bispo e um dado que ele TEM. Mandar um booleano por
              // inimigo por tick para dizer o que o mapa ja diz seria pagar
              // banda por uma leitura local.
              // Dois usos, uma bandeira: "esta criatura esta ACESA agora". No
              // bispo e a cura vindo do chao; no mineiro e a raiva. Sao a mesma
              // pergunta de desenho — acender ou nao a luz emissiva — e separar
              // em dois parametros so duplicaria o `if` do outro lado.
              charged:
                (enemy.archetype === 'bishop' &&
                  state.surface[Math.floor(enemy.y) * state.config.width + Math.floor(enemy.x)] ===
                    SURF_FUNGAL) ||
                (enemy.archetype === 'miner' && enemy.mood === MINER_MOOD_ENRAGED),
            });
          }
          if (dip) {
            ctx.restore();
            drawWaterlineRipple(
              ctx,
              sx,
              dip.line,
              size * 1.6,
              z,
              nowMs,
              leviathanHead?.submersion ?? 0,
            );
          }
          if (sand !== null) ctx.restore();
          if (enemy.stunnedUntil > state.tick) {
            drawStunIndicator(ctx, sx, bodyY, size, z, enemy.id, state.tick);
          }
          if (enemy.elite && drew) {
            // O anel de elite fica no CHAO com a sombra, e nao com o corpo: ele
            // marca a celula que a criatura ocupa, e um anel subindo junto com
            // um salto marcaria o ar.
            ctx.strokeStyle = PAL.fire;
            ctx.lineWidth = z;
            ctx.beginPath();
            ctx.ellipse(sx, sy, size * 1.05, size * 0.55, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          // A barra do Leviata so existe enquanto ele E alvo: uma barra sobre
          // agua lisa entregaria a posicao de um corpo que ninguem ve — e
          // prometeria dano onde o funil nao cobra.
          if (!leviathanHead || leviathanTargetable(enemy, state.tick)) {
            drawHealthBar(sx, bodyY - size * 2.1 - 5 * z, size, enemy.hp / enemy.maxHp);
          }
        },
      });
    }

    // O rastro de um Devorador que saiu de cena e jogado fora na hora, e nao
    // desbotado como os dos espreitadores: ele nao e uma marca no chao que o
    // jogador ainda esta lendo, e a memoria de uma FORMA.
    //
    // "Saiu de cena" inclui a boca aberta, e e ai que isso importa. A janela
    // dura 7,5 s com a cabeca parada, e nada alimenta o rastro nesse tempo:
    // guarda-lo faria o corpo reaparecer com a forma que tinha antes da boca
    // abrir, oito segundos velha. Descartado, ele renasce reto atras da cabeca
    // no primeiro quadro depois que a boca fecha — que e a pose de quem acabou
    // de se enfiar na areia.
    this.devourerSpines.keepOnly(wormsDrawn);
    this.leviathanBodies.keepOnly(leviathansDrawn);

    // Rastros orfaos (o bicho emergiu, morreu ou apagou): desbotam ate o fim
    // e a entrada some — a lamina esquece no proprio ritmo, nunca de supetao.
    for (const [id, trail] of this.lurkerTrails) {
      if (trailUpdated.has(id)) continue;
      decayTrail(trail, nowMs);
      if (trail.points.length === 0) {
        this.lurkerTrails.delete(id);
        continue;
      }
      // O elemento vem do PROPRIO rastro: o bicho morto ja saiu do snapshot,
      // e consultar o mapa de arquetipos aqui trocaria agua por gelo no
      // meio do desbote.
      const inWater = trail.inWater;
      for (const pt of trail.points) {
        if (brightness(pt.x, pt.y) <= 0.05) continue;
        const [tx, ty] = toScreen(pt.x, pt.y);
        if (tx < -60 || tx > vw + 60 || ty < -60 || ty > vh + 60) continue;
        const age = trailAge(trail, pt, nowMs);
        items.push({
          depth: pt.x + pt.y - 0.25,
          draw: () => drawLurkerTrailPoint(ctx, tx, ty, TILE_W * 0.35 * z, z, age, inWater),
        });
      }
    }

    // desenha TODOS os players (co-op): o parceiro precisa estar visivel para
    // coordenacao e revive. state.player e apenas o alias LOCAL (camera/HUD/mira).
    for (const pl of state.players) {
      const slot = pl.slot ?? 0;
      const ex = state.playerExtras[slot];
      // slot reservado/nao reivindicado nao existe em jogo (nada de fantasma)
      if (!ex.joined || !pl.alive) continue;
      const isLocal = pl === player;
      const anim = this.animFor(pl.id, pl.x, pl.y, pl.hp, pl.alive, nowMs);
      // A ROTACAO reconstruida entra na composicao aqui, e nao dentro da
      // apresentacao, porque e o render quem ingere `minigun_spin` /
      // `minigun_burst` e quem integra o angulo por quadro. Ela decide DUAS
      // coisas que a lista de modulos nao alcanca: que o parceiro remoto esta
      // com o canhao montado (o `activeModules` dele nao chega neste cliente) e
      // que o canhao local continua montado durante a desaceleracao, depois de
      // a bala 300 ja ter tirado o modulo da lista.
      const presented = this.presentation.animationFor(
        pl,
        state,
        anim,
        nowMs,
        ex.downed,
        this.minigunViews.get(slot),
        ex.frostbitten,
      );
      // O FRIO NO CORPO: o medidor veste o chassi continuamente (ver
      // frost-shell.ts), e a estatua pulsa e treme a cada ciclo termico.
      const frostFrac = freezeFraction(ex);
      const frozen = ex.frostbitten;
      const frostClocks = this.presentation.frostClocks(pl.id, nowMs);
      const pulse = frozen ? thermalPulse(frostClocks.sinceCycleMs, prefersReducedMotion()) : null;
      // Superaquecimento: o corpo TREME e o cano solta fumaca preta.
      //
      // O tremor e do corpo inteiro e nao da arma. Quem trava o gatilho e o
      // Prospector, nao o cano — ele acabou de tomar dano do proprio tiro, e um
      // sinal que morasse so na arma seria mais um enfeite dela. Poucos pixels,
      // em fase de tempo real e nao de quadro: a 120Hz um tremor por quadro
      // viraria chuvisco e a 30Hz um pulo.
      const overheating = state.tick < ex.overheatedUntil;
      // FALHA DO CHASSI (chassis-fault.ts): com integridade baixa o corpo da
      // solavancos curtos e solta faisca. E uma maquina perdendo continuidade
      // eletrica, nao um ferido — o solavanco e seco e o arco e azul. Vale
      // para o parceiro tambem: no co-op, ver o outro chassi em curto e o que
      // avisa que ele precisa de uma Purga antes de cair.
      const fault = chassisFault(nowMs, slot, pl.hp / pl.maxHp);
      const reducedMotion = prefersReducedMotion();
      const faultX = fault.active && !reducedMotion ? fault.jitterX * z : 0;
      const faultY = fault.active && !reducedMotion ? fault.jitterY * z : 0;
      const shakeX =
        (overheating ? Math.sin(nowMs / 26 + slot) * 1.15 * z : 0) + faultX + (pulse?.dx ?? 0) * z;
      const shakeY =
        (overheating ? Math.sin(nowMs / 17 + slot * 2) * 0.7 * z : 0) +
        faultY +
        (pulse?.dy ?? 0) * z;
      items.push({
        depth: pl.x + pl.y,
        draw: () => {
          const [rawX, rawY] = toScreen(pl.x, pl.y);
          const psx = rawX + shakeX;
          const psy = rawY + shakeY;
          const size = pl.radius * TILE_W * 0.9 * z;
          // A fumaca sai do OMBRO, na altura do cano, e nao dos pes: no chao ela
          // se confundiria com a fumaca do fungo secando, que e outra coisa e
          // significa outra coisa.
          if (overheating) {
            this.particles.emitOverheatSmoke(
              slot,
              pl.x,
              pl.y,
              nowMs,
              this.quality.maxFx / PRESETS.high.maxFx,
            );
          }
          // A faisca do curto sai mesmo com movimento reduzido: o solavanco e
          // enfeite, a faisca e a informacao ("este chassi esta no fim").
          if (fault.active) {
            this.particles.emitShortCircuit(
              slot,
              pl.x,
              pl.y,
              nowMs,
              this.quality.maxFx / PRESETS.high.maxFx,
            );
          }
          // O jogador local NUNCA some: a camera esta nele, e um Prospector
          // invisivel no proprio centro da tela e um jogo quebrado, nao uma
          // caverna escura. O parceiro obedece a luz como todo o resto do mundo.
          const allyLight = isLocal ? 1 : brightness(pl.x, pl.y);
          const bodyAlpha = isLocal ? 1 : allyBodyAlpha(allyLight);
          const flick = isLocal && ex.iframesUntil > state.tick && state.tick % 2 === 0;
          // ESQUIVA COM PROPULSAO: durante o dash o corpo se PROSTRA no rumo do
          // deslocamento — inclinado e levemente agachado, como quem esta sendo
          // empurrado pelos foguetes do hardpoint — e os bocais traseiros cospem
          // brasas. A sombra fica fora da inclinacao: ela pertence ao chao.
          const dashing = state.tick < ex.dodgeUntil;
          if (dashing) {
            this.particles.emitDashJets(
              slot,
              pl.x,
              pl.y,
              ex.dodgeDir.x,
              ex.dodgeDir.y,
              nowMs,
              this.quality.maxFx / PRESETS.high.maxFx,
            );
          }
          if (bodyAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = bodyAlpha;
            drawShadow(psx, psy, size);
            if (dashing) {
              // Rumo da esquiva em coordenadas de TELA (projecao 2:1),
              // renormalizado — e ele que diz para que lado o corpo tomba.
              const ddx = ex.dodgeDir.x - ex.dodgeDir.y;
              const ddy = (ex.dodgeDir.x + ex.dodgeDir.y) * 0.5;
              const dlen = Math.hypot(ddx, ddy) || 1;
              // Gira em torno dos PES: o apoio nao sai do lugar, o tronco tomba.
              ctx.translate(psx + (ddx / dlen) * 2 * z, psy);
              ctx.rotate((ddx / dlen) * 0.22);
              ctx.scale(1, 0.92);
              ctx.translate(-psx, -psy);
            }
            if (!flick) {
              const paintProspector = (override: Tint | undefined): boolean =>
                this.sprites.drawEntity(
                  ctx,
                  'prospector',
                  presented.anim,
                  presented.facingX,
                  presented.facingY,
                  presented.elapsedMs,
                  psx,
                  psy,
                  spriteZoom,
                  // A agua vence tudo; depois, o veu da geada vence o tint do
                  // parceiro: o frio e informacao, a cor de aliado e convencao
                  // — e o visor ja diz quem e quem.
                  override ??
                    frostTint(frostFrac, frozen) ??
                    // parceiro (nao-local) recebe leve tint frio para diferenciar
                    (isLocal ? undefined : { color: 'rgba(89,242,194,0.30)', alpha: 0.3 }),
                  // O CHASSI E LATAO USINADO: o unico corpo polido que anda pela
                  // tela, e por isso o unico que devolve um realce concentrado em
                  // vez de um veu. E ele que faz o proprio tiro do jogador acender
                  // a armadura ao sair — a arma esta montada no ombro direito, e o
                  // estilhaco nasce a um palmo dela.
                  bodyLight(pl.x, pl.y, CHASSIS_RESPONSE),
                  bodyFaceLight(pl.x, pl.y, CHASSIS_RESPONSE),
                );
              // O Prospector CORTADO pela lamina do Diluvio: e nele que o
              // jogador le o nivel — cintura, peito, cabeca.
              const playerCell = Math.floor(pl.y) * state.config.width + Math.floor(pl.x);
              const playerDepth = delugeDepth(state, playerCell);
              const drew =
                playerDepth > 0
                  ? drawCutByWaterline(
                      ctx,
                      psy - playerDepth * TILE_H * z,
                      psx,
                      pl.radius * TILE_W * z,
                      z,
                      nowMs,
                      paintProspector,
                    )
                  : paintProspector(undefined);
              if (!drew) {
                drawVoxelEntity(ctx, {
                  sx: psx,
                  sy: psy,
                  z,
                  radius: pl.radius,
                  brightness: isLocal ? 1 : allyLight,
                  archetype: 'prospector',
                  elite: false,
                  nowMs,
                  allyTint: !isLocal,
                });
              }
              // O CANHAO ROTATIVO nao e mais desenhado aqui.
              //
              // Ele era uma sobreposicao procedural (`minigun-mount.ts`), com o
              // argumento de que quadros por rumo x posicao de cano sairiam
              // caros demais. A conta estava errada — a camada inteira pesa 15
              // kB — e o custo real era outro: desenho de runtime nao participa
              // do rasterizador, entao a arma nao tinha mapa de faces, nem
              // oclusao de ambiente, nem a luz por face que o resto do bot
              // recebe. Ficava CHAPADA ao lado de um chassi facetado.
              //
              // Agora ela e `layer-module-minigun`, montada por `sprites.ts` no
              // lugar da camada da arma. A rotacao vem dos quatro quadros de
              // `attack`, que a rajada mantem continuos (o `action_start` da
              // Minigun cobre a janela seguinte de proposito).
              //
              // O VAPOR fica, porque ele nunca foi da arma: e o aviso de que o
              // gatilho esta prestes a travar, e sai perto do travamento e nunca
              // durante a rajada — fumaca continua taparia o proprio alvo.
              if (isLocal && this.minigunViews.get(slot).spin > 0.001) {
                const gunView = this.minigunViews.get(slot);
                if (gunView.phase === 'overheated' || ex.heat > HEAT_MAX * 0.82) {
                  this.particles.emitOverheatSmoke(
                    slot,
                    pl.x,
                    pl.y,
                    nowMs,
                    this.quality.maxFx / PRESETS.high.maxFx,
                  );
                }
              }
              // A GEADA, por cima do sprite e antes de tudo o que e leitura de
              // estado: placas, cristais, a concha da estatua e as fissuras do
              // degelo. O vapor sai pelas juntas enquanto o motor forca.
              if (frostFrac > 0 || frozen) {
                const thaw = frozen
                  ? Math.max(0, Math.min(1, (FREEZE_MAX - ex.freeze) / FREEZE_THAW_LAYER))
                  : 0;
                this.drawFrostOverlay(
                  ctx,
                  psx,
                  psy,
                  size,
                  z,
                  pl.id,
                  frostFrac,
                  frozen,
                  thaw,
                  pulse?.glow ?? 0,
                  frostClocks.sinceBreakMs,
                );
                if (frozen && pulse?.steam) {
                  this.particles.emitThawSteam(
                    slot,
                    pl.x,
                    pl.y,
                    nowMs,
                    this.quality.maxFx / PRESETS.high.maxFx,
                  );
                }
              }
              // O ARCO do curto, por cima da chapa.
              if (fault.active) drawShortArc(ctx, psx, psy, size, z, nowMs, slot);
              // A VARREDURA DE REBOOT da Purga: uma linha de fosforo sobe dos
              // pes a cabeca em meio segundo, com um veu que se apaga atras
              // dela. E o chassi religando modulo por modulo — de baixo para
              // cima, como um sistema que sobe.
              const rebootT = (nowMs - this.purgeUsedAtMs) / 520;
              if (isLocal && rebootT >= 0 && rebootT < 1 && !reducedMotion) {
                const bodyH = size * 2.7;
                const lineY = psy - rebootT * bodyH;
                ctx.save();
                ctx.globalAlpha = (1 - rebootT) * 0.45;
                ctx.fillStyle = PAL.biolum;
                ctx.fillRect(psx - size * 1.2, lineY, size * 2.4, psy - lineY);
                ctx.globalAlpha = 0.95 * (1 - rebootT * 0.5);
                ctx.fillStyle = PAL.player;
                ctx.fillRect(psx - size * 1.3, lineY - z, size * 2.6, Math.max(1, z * 1.2));
                ctx.restore();
              }
              // Os marcos geracionais (ombreiras, antena, placa, pistoes,
              // halo) NAO sao mais desenhados. Eram tracos de runtime medidos
              // para um corpo mais baixo que o sprite atual — caiam na
              // cintura em vez do ombro — e presos aos pes, sem acompanhar
              // andar, esquiva nem tremor. Liam como glitch, e nao como
              // geracao. A geracao continua legivel na Matriz; o chassi em
              // campo volta a ter uma silhueta so, ate existirem atlases
              // proprios por geracao (spec da Matriz Geracional, §14.4).
              if (isLocal) {
                // Levantamento: instrumentacao, e nao mapa. Sai depois do corpo
                // porque as setas partem DELE, e so para o Prospector local — a
                // arvore e de quem a comprou.
                const nav = state.config.tuning.navigation;
                if (hasSurvey(nav)) {
                  if (nav.routeMemory) this.route.observe(state);
                  drawSurveyWorld({
                    ctx,
                    state,
                    nav,
                    sx: psx,
                    sy: psy,
                    z,
                    nowMs,
                    sectorEnteredAtMs: this.sectorEnteredAtMs,
                    route: this.route,
                    toScreen,
                  });
                }
                // IA — Cognicao de Combate: leitura, pela mesma regra do
                // Levantamento. So o Prospector local, e so o que a arvore
                // comprada informa: brackets, telegrafo e antecipacao.
                const combat = combatTuningOf(state.config.tuning);
                if (hasCombatSense(combat)) {
                  this.targetMotion.observe(state, nowMs);
                  drawCombatSenseWorld({
                    ctx,
                    state,
                    combat,
                    z,
                    nowMs,
                    motion: this.targetMotion,
                    toScreen,
                  });
                }
              }
            }
            ctx.restore();
          }
          // O visor do parceiro atravessa o escuro sozinho. E a mesma regra do
          // farol da caixa-preta: a fog of war revela LUZES, nao silhuetas —
          // saber onde o parceiro esta nunca deveria custar enxergar a sala
          // inteira em volta dele.
          if (!isLocal) drawAllyVisor(ctx, psx, psy, size, z, nowMs, allyLight);
          if (pl.stunnedUntil > state.tick) {
            drawStunIndicator(ctx, psx, psy, size, z, pl.id, state.tick);
          }
          // O Prospector local ja tem HP numerico na HUD fixa. Repetir a barra
          // sobre a propria cabeca cobre animacao e mira; o parceiro ainda precisa
          // dela para coordenacao de revive no co-op — mas so quando ha corpo
          // para ela medir. No breu ela seria uma barra flutuando no nada.
          if (!isLocal && bodyAlpha > 0) {
            drawHealthBar(psx, psy - size * 2.4 - 5 * z, size, pl.hp / pl.maxHp);
          }

          // marcador de abatido (precisa de revive)
          if (ex.downed) {
            ctx.fillStyle = PAL.blood;
            ctx.font = `bold ${Math.round(7 * z)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('!', psx, psy - size * 2.6 - 8 * z);
          }

          // O risco de mira que ficava aqui saiu: virou a faixa no chao,
          // desenhada antes das paredes para poder ser coberta por elas.
        },
      });
    }

    // A QUEDA NO BURACO. Antes das lapides na fila, pela mesma razao de sempre:
    // ordem de insercao com a mesma profundidade decide quem fica por cima, e o
    // Prospector afundando tem de ficar ATRAS do respingo que ele levanta.
    //
    // Nenhum sprite novo: o atlas do Prospector com transformacao e mascara. O
    // corpo perde altura, escorrega para dentro da celula e e COMIDO de baixo
    // para cima — o recorte sobe conforme ele afunda, entao a agua sempre cobre
    // exatamente a parte que ja entrou. Um fade simples faria o Prospector
    // desaparecer no ar; o recorte faz a agua leva-lo.
    for (const plunge of this.presentation.plunges(nowMs)) {
      items.push({
        depth: plunge.x + plunge.y,
        draw: () => {
          const [pxs, pys] = toScreen(plunge.x, plunge.y);
          const t = Math.max(
            0,
            Math.min(1, (nowMs - plunge.startedMs) / (plunge.endsMs - plunge.startedMs)),
          );
          // Perda de altura primeiro, afundamento depois: `t^2` concentra o
          // deslocamento na segunda metade, que e como um corpo cai — devagar
          // enquanto o apoio cede, rapido quando ele acaba.
          const sink = t * t;
          // A MESMA medida do corpo vivo (`pl.radius * TILE_W * 0.9 * z`): a
          // queda tem de sair na escala em que o Prospector estava andando um
          // tick atras, e nao numa propria.
          const size = 0.34 * TILE_W * 0.9 * z;
          // A LAMINA D'AGUA: o plano em que o corpo desaparece. Meio corpo
          // acima do centro do tile, que e onde a crosta de agua profunda
          // desenha a propria superficie.
          const waterLine = pys - size * 0.5;
          if (sink < 1) {
            ctx.save();
            // Mascara: so o que esta ACIMA da lamina continua visivel. A caixa
            // e larga e alta o bastante para conter o sprite inteiro do
            // Prospector — recortar por cima seria cortar a cabeca dele.
            ctx.beginPath();
            ctx.rect(pxs - size * 3, waterLine - size * 8, size * 6, size * 8);
            ctx.clip();
            // O corpo desce ate uma altura inteira abaixo da lamina e encolhe
            // um pouco: perspectiva de quem se afasta para baixo.
            ctx.translate(0, sink * size * 2.6);
            const shrink = 1 - sink * 0.18;
            ctx.translate(pxs, pys);
            ctx.scale(shrink, shrink);
            ctx.translate(-pxs, -pys);
            ctx.globalAlpha = 1 - sink * 0.35;
            const drew = this.sprites.drawEntity(
              ctx,
              'prospector',
              'die',
              plunge.facingX,
              plunge.facingY,
              nowMs - plunge.startedMs,
              pxs,
              pys,
              spriteZoom,
            );
            if (!drew) {
              drawVoxelEntity(ctx, {
                sx: pxs,
                sy: pys,
                z,
                radius: 0.34,
                brightness: 0.7,
                archetype: 'prospector',
                elite: false,
                nowMs,
              });
            }
            ctx.restore();
          }
          // A ONDULACAO fica depois do corpo e dura ate o fim: e ela que conta
          // que alguem entrou ali, e ela e a unica coisa na tela nos ultimos
          // ~220 ms. Dois aneis defasados, no PLANO da agua e nao no chao.
          ctx.save();
          for (const [delay, tint] of [
            [0, PAL.mist],
            [0.28, PAL.electric],
          ] as const) {
            const rt = (t - delay) / (1 - delay);
            if (rt <= 0 || rt >= 1) continue;
            ctx.globalAlpha = (1 - rt) * 0.5;
            ctx.strokeStyle = tint;
            ctx.lineWidth = Math.max(1, 0.9 * z);
            ctx.beginPath();
            ctx.ellipse(
              pxs,
              waterLine,
              size * (0.5 + rt * 1.6),
              size * (0.25 + rt * 0.8),
              0,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
          }
          ctx.restore();
        },
      });
    }

    for (const tombstone of this.presentation.tombstones(nowMs)) {
      items.push({
        depth: tombstone.x + tombstone.y,
        draw: () => {
          const [tsx, tsy] = toScreen(tombstone.x, tombstone.y);
          const elapsed = nowMs - tombstone.startedMs;
          const drew = this.sprites.drawEntity(
            ctx,
            tombstone.archetype,
            'die',
            tombstone.facingX,
            tombstone.facingY,
            elapsed,
            tsx,
            tsy,
            spriteZoom,
          );
          if (!drew) {
            drawVoxelEntity(ctx, {
              sx: tsx,
              sy: tsy,
              z,
              radius: tombstone.archetype === 'guardian' ? 0.68 : 0.34,
              brightness: 0.7,
              archetype: tombstone.archetype,
              elite: false,
              nowMs,
            });
          }
        },
      });
    }

    // Direcao de voo vem do quadro anterior; o protocolo so carrega posicao e
    // a direcao serve apenas para inclinar o rastro, que e cosmetico.
    this.projectileView.sync(state.projectiles, nowMs);
    for (const proj of state.projectiles) {
      // So os projeteis DESTE jogador passam pelo filtro de cargas. As cargas
      // dele o cliente conhece nos dois modos — em co-op elas vem no `you` do
      // snapshot. As do parceiro nao: ali o servidor ja mandou a marca corrigida,
      // e conferir de novo com uma lista vazia apagaria modulos que existem.
      const mine = proj.owner === player.id;
      const modules = mine
        ? liveProjectileModules(proj.modules, state.playerExtras[player.slot ?? 0], state.tick)
        : proj.modules;
      const view = modules === proj.modules ? proj : { ...proj, modules };
      items.push({
        depth: proj.x + proj.y,
        draw: () => {
          // O CARRINHO nao e um tiro: e um corpo. Caixa de ferrugem sobre
          // rodas escuras, com sombra — desenhado em runtime porque a
          // orientacao vem da velocidade e o resto do jogo ja faz voxel vivo
          // assim (particulas, projeteis).
          // O CICLONE tem atlas proprio: seis quadros de coluna girando, com
          // as espirais defasadas dando o sentido do giro. E o unico projetil
          // do jogo desenhado por sprite — os outros sao pequenos o bastante
          // para o voxel de runtime resolver, e este ocupa uma coluna inteira
          // de chao. Sem atlas ele cai no ramo generico e vira um ponto, que e
          // exatamente o que um perigo do tamanho dele nao pode ser.
          if (proj.kind === 'cyclone') {
            const [csx, csy] = toScreen(proj.x, proj.y);
            drawGroundShadow(ctx, csx, csy, 6 * z);
            if (!this.sprites.drawFx(ctx, 'fx-fire-cyclone', 'fly', nowMs, csx, csy, z)) {
              // Recuo enquanto o atlas nao carregou: uma coluna de chama que
              // ainda ocupa o espaco certo. Um perigo invisivel seria pior que
              // um perigo feio.
              for (let k = 0; k < 6; k++) {
                const t = k / 5;
                const wob = Math.sin(nowMs / 90 + t * 3) * z;
                ctx.fillStyle = t < 0.4 ? '#ffe9b8' : t < 0.75 ? '#ffa63f' : '#ff7a2f';
                const rw = (3 + t * 5) * z;
                ctx.fillRect(csx - rw / 2 + wob, csy - k * 4 * z, rw, 3 * z);
              }
            }
            return;
          }
          if (proj.kind === 'cart') {
            const [csx, csy] = toScreen(proj.x, proj.y);
            drawGroundShadow(ctx, csx, csy, 7 * z);
            // A orientacao vem do TRILHO sob o carrinho, nao da velocidade:
            // o snapshot online reconstroi projeteis com vx/vy zerados, e um
            // carrinho vertical desenhado deitado mentiria o rumo da linha.
            const underCart =
              state.surface[Math.floor(proj.y) * state.config.width + Math.floor(proj.x)];
            const horizontal =
              underCart === SURF_RAIL_V
                ? false
                : underCart === SURF_RAIL
                  ? true
                  : Math.abs(proj.vx) >= Math.abs(proj.vy);
            const wob = Math.sin(nowMs / 45) * z * 0.5;
            drawVoxel(ctx, csx - (horizontal ? 4 : 2) * z, csy + wob * 0.4, 3 * z, [
              '#1d2430',
              '#0b0e14',
              '#0b0e14',
            ]);
            drawVoxel(ctx, csx + (horizontal ? 4 : 2) * z, csy - wob * 0.4, 3 * z, [
              '#1d2430',
              '#0b0e14',
              '#0b0e14',
            ]);
            drawVoxel(ctx, csx, csy - 3 * z + wob, 9 * z, ['#6e4a33', '#3d2a22', '#1d2430']);
            drawVoxel(ctx, csx, csy - 6 * z + wob, 7 * z, ['#46566e', '#2e3a4d', '#1d2430']);
            return;
          }
          // O halo do PROJETIL, por baixo do corpo dele.
          //
          // Ele ja empurra uma luz para a grade (o corredor acende quando o tiro
          // passa), mas isso ilumina os OUTROS: sem halo proprio o estilhaco
          // continuava sendo tres faces chapadas voando no meio de uma sala que
          // ele mesmo acendeu. Sai ANTES do corpo para o voxel ficar nitido por
          // cima do borrao — halo por cima comeria a silhueta que diz o rumo.
          if (this.quality.bloom) {
            const spec = projectileLightSpec(view);
            if (spec) {
              // A MESMA origem do corpo, e nao `view.x/y`: perto da arma o
              // projetil e desenhado saindo da boca, e um halo preso a posicao
              // autoritativa ficaria para tras da propria bala durante o
              // primeiro tile — o brilho descolado do que brilha.
              const [hx, hy] = toScreen(...this.projectileView.worldOrigin(view));
              drawEmissiveHalo(
                ctx,
                spec.hex,
                hx,
                hy - heightToScreenPx(COMBAT_PLANE_TILES, TILE_H, z),
                TILE_W * 0.34 * z * spec.r,
                0.34,
              );
            }
          }
          this.projectileView.draw(ctx, view, toScreen, z, TILE_H);
        },
      });
    }

    // GOTEJAMENTO DA POCA: goticulas de biofluido caem do teto da caverna
    // sobre a lamina e abrem ondulacoes concentricas. Deterministico por
    // celula e relogio — nenhum estado, nenhuma particula: a queda, o respingo
    // e os aneis saem da fase do ciclo, e cada celula pingante tem ciclo e
    // ponto proprios (hash). Entra na fila ordenada porque a gota cai ALTO e
    // precisa ser ocultada por paredes como qualquer corpo.
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        // A agua do Aquifero pinga como a poca: goteiras sao a assinatura
        // sonora e visual do estrato, e o efeito ja e deterministico por celula.
        const dripSurf = state.surface[i];
        if (
          state.solid[i] !== SOLID_NONE ||
          (dripSurf !== SURF_BIOFLUID && dripSurf !== SURF_WATER)
        )
          continue;
        const seed = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
        if (seed % 5 !== 0) continue; // so parte das celulas pinga
        if (brightness(x, y) <= 0.05) continue;
        const [sx, sy] = toScreen(x + 0.5, y + 0.5);
        if (sx < -40 || sx > vw + 40 || sy < -80 || sy > vh + 40) continue;
        const cycle = 2200 + (seed % 1400);
        const phase = ((nowMs + (seed % 100000)) % cycle) / cycle;
        // Celula cercada de poca por todos os lados pode abrir ondulacao larga
        // — ela morre dentro do proprio liquido. Na borda, o anel e contido ao
        // losango da celula: ondulacao subindo na rocha seca e agua mentindo.
        const pool = (nx: number, ny: number): boolean => {
          if (nx < 0 || ny < 0 || nx >= w || ny * w + nx >= state.solid.length) return false;
          const ni = ny * w + nx;
          return state.solid[ni] === SOLID_NONE && state.surface[ni] === SURF_BIOFLUID;
        };
        const enclosed = pool(x - 1, y) && pool(x + 1, y) && pool(x, y - 1) && pool(x, y + 1);
        items.push({
          depth: x + y,
          draw: () => this.drawPoolDrip(ctx, sx, sy, z, phase, seed, enclosed),
        });
      }
    }

    // Gas: alto demais para o passo de chao, e por ULTIMO na fila.
    //
    // Desenhado no piso, ele saia ANTES de toda parede, entao a parede vizinha
    // passava por cima do penacho e o gas encostado nela sumia dentro dela.
    // Aqui ele entra com a MESMA profundidade das paredes e criaturas, `x + y`,
    // e passa a ser ocultado so pelo que esta de fato na frente dele.
    //
    // Por ultimo porque `sort` e estavel: empate de profundidade preserva a
    // ordem de insercao, e empate acontece toda vez que uma parede esta na
    // diagonal exata de uma celula de gas. Empilhado antes, o gas perderia esses
    // empates e continuaria sumindo em bem menos lugares — o pior jeito de um
    // defeito voltar, porque parece corrigido. Das duas leituras ambiguas, ver o
    // gas e a segura: ele machuca.
    //
    // O alfa e a outra razao de estar aqui: a peca de gas nao carrega laje,
    // entao da para deixa-la translucida sem deixar o CHAO translucido junto.
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (state.solid[i] !== SOLID_NONE || state.surface[i] !== SURF_GAS) continue;
        const b = brightness(x, y);
        if (b <= 0.045) continue;
        const [sx, sy] = toScreen(x + 0.5, y + 0.5);
        if (sx < -60 || sx > vw + 60 || sy < -80 || sy > vh + 60) continue;
        items.push({
          depth: x + y,
          draw: () => {
            ctx.save();
            ctx.globalAlpha = GAS_ALPHA;
            if (!this.surfaces.draw(ctx, SURFACE_KIND_INDEX[SURF_GAS], x, y, b, nowMs, sx, sy, z)) {
              // Sem o atlas, o gas tem de continuar VISIVEL: ele machuca.
              ctx.fillStyle = shade(SURFACE_FALLBACK[SURF_GAS], 0.35 + b * 0.75);
              ctx.fillRect(sx - 3 * z, sy - 10 * z, 6 * z, 10 * z);
            }
            ctx.restore();
          },
        });
      }
    }

    // Bolhas de locomocao usam velocidade autoritativa, throttle por entidade e
    // o mesmo budget global dos demais VFX. Parados praticamente nao emitem.
    for (const entity of [...state.players, ...state.enemies]) {
      if (!entity.alive) continue;
      const i = Math.floor(entity.y) * state.config.width + Math.floor(entity.x);
      const depth = delugeDepth(state, i);
      if (depth < 0.5) continue;
      this.particles.emitMovementBubbles(
        entity.id,
        entity.x,
        entity.y,
        entity.vx,
        entity.vy,
        entity.radius,
        depth,
        nowMs,
        entity.archetype === 'sheet_leviathan',
      );
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) item.draw();

    // A luz ambiente do estrato entra AQUI: por cima do mundo e das criaturas,
    // por baixo de particulas, numeros de dano e HUD.
    drawBiomeVeil(ctx, state.stratum, vw, vh);

    // AS BOLHAS PROTETORAS, em duas camadas com dois raios distintos.
    //
    // 1. O ANEL NO CHAO, no RAIO SEGURO (`bubble.radius`): a projecao correta
    //    de um circulo de raio R no mundo — semi-eixos `R * TILE_W/2 * raiz2`
    //    e `R * TILE_H/2 * raiz2` — e nao `R * TILE_W`, que era o defeito: o
    //    domo desenhado media muito mais que a area que a simulacao protegia,
    //    e o jogador morria DENTRO do desenho. O ponto de contato do
    //    Prospector dentro deste anel significa "seguro", pelo MESMO predicado
    //    que a simulacao usa para nao cobrar (`insideAnyBubble`).
    // 2. O DOMO atmosferico, decorativo, no raio da CASCA (`bubbleShellRadius`):
    //    maior que a area segura, e nunca a promessa.
    //
    // Quando o jogador local esta dentro, o anel interno se ESTABILIZA (para
    // de pulsar), engrossa e ganha um segundo traco: a confirmacao nao depende
    // de cor. O som (`leviathanBubbleSafe`) faz a mesma pergunta.
    const ISO_RING = Math.SQRT2;
    for (const bubble of state.bossRuntime.protectiveBubbles) {
      const [bx, by] = toScreen(bubble.x, bubble.y);
      const safeRx = bubble.radius * TILE_W * 0.5 * ISO_RING * z;
      const safeRy = bubble.radius * TILE_H * 0.5 * ISO_RING * z;
      const shell = bubbleShellRadius(bubble);
      const shellRx = shell * TILE_W * 0.5 * ISO_RING * z;
      const shellRy = shell * TILE_H * 0.5 * ISO_RING * z;
      const here = state.player.alive && insideAnyBubble(state.player.x, state.player.y, [bubble]);
      const pulse = here ? 0.95 : 0.7 + 0.18 * Math.sin(nowMs / 115 + bubble.x);
      ctx.save();
      // O domo: uma casca translucida SOBRE o anel, mais alta que larga.
      const fill = ctx.createRadialGradient(
        bx - shellRx * 0.25,
        by - shellRy * 0.9,
        1,
        bx,
        by - shellRy * 0.4,
        shellRx,
      );
      fill.addColorStop(0, 'rgba(232,247,255,0.22)');
      fill.addColorStop(0.7, 'rgba(110,190,225,0.08)');
      fill.addColorStop(1, 'rgba(70,135,170,0.02)');
      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(160,215,240,0.35)';
      ctx.lineWidth = Math.max(1, z);
      ctx.beginPath();
      ctx.ellipse(bx, by - shellRy * 0.9, shellRx, shellRy * 2.1, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // O ANEL SEGURO no chao: e ele que promete.
      ctx.strokeStyle = `rgba(220,248,255,${pulse.toFixed(3)})`;
      ctx.lineWidth = Math.max(2, (here ? 3 : 2.2) * z);
      ctx.beginPath();
      ctx.ellipse(bx, by, safeRx, safeRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (here) {
        // Confirmado: um segundo traco por dentro e o miolo mais claro.
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = Math.max(1, z);
        ctx.beginPath();
        ctx.ellipse(bx, by, safeRx * 0.86, safeRy * 0.86, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(200,240,255,0.14)';
        ctx.beginPath();
        ctx.ellipse(bx, by, safeRx, safeRy, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(125,210,240,0.45)';
        ctx.lineWidth = Math.max(1, z);
        ctx.beginPath();
        ctx.ellipse(bx, by, safeRx * 0.86, safeRy * 0.86, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    const chargingLeviathan = state.enemies.find(
      (enemy) =>
        enemy.alive &&
        enemy.archetype === 'sheet_leviathan' &&
        enemy.action?.kind === 'massive_shock',
    );
    if (chargingLeviathan?.action) {
      // O TELEGRAFO DA DESCARGA usa o corpo inteiro (as linhas condutivas
      // acendem pelo atlas, `special`) e a agua em volta: ondas CONVERGINDO
      // para o corpo, riscos eletricos na lamina FORA das bolhas (o interior
      // fica calmo), e no ultimo meio segundo tres contracoes claras. Nada
      // de strobe de tela inteira; tudo abaixo do orcamento de efeitos.
      const [lx, ly] = toScreen(chargingLeviathan.x, chargingLeviathan.y);
      const span = Math.max(1, LEVIATHAN_SHOCK_WINDUP_TICKS);
      const charge = Math.max(
        0,
        Math.min(1, (state.tick - chargingLeviathan.action.startedAt) / span),
      );
      const remaining = chargingLeviathan.action.releaseAt - state.tick;
      const contraction =
        remaining <= 10 && remaining >= 0
          ? Math.max(0, Math.sin((remaining / 10) * Math.PI * 3))
          : 0;
      const fxScale = this.quality.maxFx / PRESETS.high.maxFx;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      // Ondas convergindo: aneis que ENCOLHEM em direcao ao corpo.
      for (let i = 0; i < 3; i++) {
        const phase = (((nowMs / 700 + i / 3) % 1) + 1) % 1;
        const r = (1 - phase) * 6 * z * TILE_W * 0.5 * ISO_RING * 0.5 + 6 * z;
        ctx.strokeStyle = `rgba(150,220,255,${(0.1 + charge * 0.25 * phase).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, z);
        ctx.beginPath();
        ctx.ellipse(lx, ly, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Riscos eletricos na lamina, FORA das bolhas. Semeados pelo tick: as
      // duas maquinas do co-op veem os mesmos riscos.
      const streaks = Math.floor((4 + charge * 14) * fxScale);
      for (let i = 0; i < streaks; i++) {
        const seed =
          ((Math.imul(i + 1, 2654435761) ^ Math.imul(state.tick >> 1, 40503)) >>> 0) % 10000;
        const angle = (seed / 10000) * Math.PI * 2;
        const dist = 2 + (((seed >> 3) % 100) / 100) * 9;
        const wx = chargingLeviathan.x + Math.cos(angle) * dist;
        const wy = chargingLeviathan.y + Math.sin(angle) * dist;
        if (insideAnyBubble(wx, wy, state.bossRuntime.protectiveBubbles)) continue;
        const [sx0, sy0] = toScreen(wx, wy);
        ctx.strokeStyle = `rgba(190,235,255,${(0.25 + charge * 0.45).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, z * 0.8);
        ctx.beginPath();
        ctx.moveTo(sx0, sy0);
        ctx.lineTo(sx0 + (seed % 7) * z - 3 * z, sy0 - 2 * z - (seed % 5) * z);
        ctx.lineTo(sx0 + (seed % 11) * z - 5 * z, sy0 - 5 * z);
        ctx.stroke();
      }
      // Os arcos junto ao corpo, e as tres contracoes finais.
      ctx.strokeStyle = `rgba(150,220,255,${(0.2 + charge * 0.5 + contraction * 0.3).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.5, (1 + charge * 2 + contraction * 2) * z);
      const arcs = 2 + Math.floor(charge * 4);
      for (let i = 0; i < arcs; i++) {
        const radius = (20 + i * 7 + Math.sin(nowMs / 55 + i) * 4) * z * (1 - contraction * 0.25);
        ctx.beginPath();
        ctx.arc(lx, ly - 14 * z, radius, i * 0.9 + nowMs / 420, i * 0.9 + nowMs / 420 + 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }
    // A VIAGEM ESCONDIDA: a poca de destino borbulha cada vez mais forte ate
    // ele emergir; e o AVISO DO MERGULHO na poca ocupada: um anel escuro
    // pulsando no raio da tampa — quem esta de pe sobre o corpo tem de sair
    // antes de a cauda sumir. Os dois sao identificaveis sem cor: um cresce,
    // o outro pulsa.
    for (const enemy of state.enemies) {
      if (!enemy.alive || enemy.archetype !== 'sheet_leviathan') continue;
      const posture = leviathanPosture(enemy);
      if (posture === 'hidden' && state.bossRuntime.leviathanDest >= 0) {
        const w = state.config.width;
        const dest = state.bossRuntime.leviathanDest;
        const dx = (dest % w) + 0.5;
        const dy = Math.floor(dest / w) + 0.5;
        const surfaceAt = state.bossRuntime.leviathanSurfaceAt;
        const intensity =
          surfaceAt >= 0 ? Math.max(0.15, Math.min(1, 1 - (surfaceAt - state.tick) / 50)) : 0.5;
        const [bx, by] = toScreen(dx, dy);
        drawPoolBoil(ctx, bx, by, intensity, z, nowMs);
        this.particles.emitMovementBubbles(
          -12,
          dx + Math.sin(nowMs / 130) * 0.5 * intensity,
          dy + Math.cos(nowMs / 110) * 0.5 * intensity,
          1 + intensity * 2,
          1 + intensity * 2,
          0.8 + intensity,
          1.5,
          nowMs,
          true,
        );
      }
      if (
        posture === 'diving' &&
        enemy.action?.kind === 'dive' &&
        enemy.action.phase === 'windup'
      ) {
        const [bx, by] = toScreen(enemy.x, enemy.y);
        const remaining = enemy.action.releaseAt - state.tick;
        const progress =
          1 -
          Math.max(
            0,
            Math.min(1, remaining / Math.max(1, enemy.action.releaseAt - enemy.action.startedAt)),
          );
        const beat = 0.5 + 0.5 * Math.sin(nowMs / (160 - progress * 90));
        ctx.save();
        ctx.strokeStyle = `rgba(20,30,50,${(0.5 + beat * 0.4).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, (2 + beat * 2) * z);
        ctx.beginPath();
        ctx.ellipse(
          bx,
          by,
          LEVIATHAN_LID_RADIUS * TILE_W * 0.5 * ISO_RING * z,
          LEVIATHAN_LID_RADIUS * TILE_H * 0.5 * ISO_RING * z,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.strokeStyle = `rgba(220,240,255,${(0.35 + beat * 0.4).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, z);
        ctx.setLineDash([4 * z, 4 * z]);
        ctx.lineDashOffset = -nowMs / 30;
        ctx.stroke();
        ctx.restore();
      }
    }

    // O TELEGRAFO DO CARRINHO: a linha inteira do tramo pulsa em laranja de
    // perigo durante o aviso. SOBRE o veu e SEM corte de luz: morte anunciada
    // nao negocia com a atmosfera nem com a escuridao — o aviso e a unica
    // coisa que o jogador precisa ver naquele segundo. Derivado DIRETO do
    // estado autoritativo (firingAt em ticks), nao de relogio de parede: a
    // pausa congela ticks, e um aviso por performance.now() expiraria durante
    // o menu e deixaria o carrinho chegar sem o telegrafo prometido.
    for (const warn of state.railTracks) {
      if (!(warn.firingAt > state.tick)) continue;
      const pulse = 0.3 + 0.4 * Math.abs(Math.sin(nowMs / 90));
      ctx.save();
      ctx.strokeStyle = `rgba(255, 122, 47, ${pulse.toFixed(3)})`;
      ctx.lineWidth = Math.max(1, z);
      for (let k = 0; k < warn.len; k++) {
        const wx = warn.x + warn.dx * k;
        const wy = warn.y + warn.dy * k;
        const [wsx, wsy] = toScreen(wx + 0.5, wy + 0.5);
        if (wsx < -40 || wsx > vw + 40 || wsy < -40 || wsy > vh + 40) continue;
        const hw = (TILE_W / 2) * z;
        const hh = (TILE_H / 2) * z;
        ctx.beginPath();
        ctx.moveTo(wsx, wsy - hh);
        ctx.lineTo(wsx + hw, wsy);
        ctx.lineTo(wsx, wsy + hh);
        ctx.lineTo(wsx - hw, wsy);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    // A RUPTURA A SUPERFICIE: no setor raro em que o teto rachou ate o ceu,
    // um feixe de luz de dia desce inclinado sobre o salao e abre uma poca
    // clara no chao. Sobre o veu (a luz vence a atmosfera), sob particulas e
    // HUD. E ambiente, nao informacao: nada joga diferente debaixo dela —
    // por isso o tom e quente-neutro, longe do telegrafo e do gas.
    {
      const rupture = this.rupture;
      if (rupture) {
        const [rx, ry] = toScreen(rupture.x + 0.5, rupture.y + 0.5);
        if (rx > -180 && rx < vw + 180 && ry > -180 && ry < vh + 180) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          // O feixe desce INCLINADO, como luz por uma fenda — nunca um pilar
          // vertical perfeito, que leria como efeito de habilidade.
          const topX = rx + 42 * z;
          const beam = ctx.createLinearGradient(topX, 0, rx, ry);
          beam.addColorStop(0, 'rgba(255,244,214,0.15)');
          beam.addColorStop(1, 'rgba(255,244,214,0.03)');
          ctx.fillStyle = beam;
          ctx.beginPath();
          ctx.moveTo(topX - 24 * z, -8);
          ctx.lineTo(topX + 24 * z, -8);
          ctx.lineTo(rx + 46 * z, ry);
          ctx.lineTo(rx - 46 * z, ry);
          ctx.closePath();
          ctx.fill();
          const pool = ctx.createRadialGradient(rx, ry, 4 * z, rx, ry, 46 * z);
          pool.addColorStop(0, 'rgba(255,244,214,0.13)');
          pool.addColorStop(1, 'rgba(255,244,214,0)');
          ctx.fillStyle = pool;
          ctx.beginPath();
          ctx.ellipse(rx, ry, 46 * z, 23 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // FX
    // Vem do relogio, nao de um 16.7 fixo: em rAF o passo fixo amarrava a vida
    // e a fisica dos efeitos a taxa do monitor, e a 120Hz tudo durava metade do
    // tempo e percorria metade da distancia. Vale para os FX antigos tambem —
    // eles ja tinham a duracao expressa em ms, so nao a respeitavam.
    const dtFx = frameDeltaMs(this.lastFrameMs, nowMs);
    this.lastFrameMs = nowMs;
    // As particulas voxel entram DEPOIS das paredes e entidades, com ordem do
    // pintor propria: brasa e gas sao volume no ar, tem de passar por cima do
    // chao e do bloco, mas continuam atras do HUD.
    this.particles.step(dtFx);
    this.particles.draw(ctx, toScreen, z, TILE_H);

    // O LATAO e os CARTUCHOS EJETADOS. Depois das particulas e antes dos
    // numeros de dano: sao objetos no chao, entao passam por cima do terreno
    // e por baixo de tudo que informa. `visible` corta pela camera antes de
    // qualquer conta — capsula fora da tela nao pode custar nada.
    const onCamera = (sx: number, sy: number): boolean =>
      sx > -60 && sx < vw + 60 && sy > -60 && sy < vh + 60;
    this.stepModuleProps(state, dtFx, nowMs);
    // A rampa reconstruida anda com o tempo REAL; os slots cujo estado o
    // cliente conhece por inteiro sao reancorados logo depois, entao a
    // integracao so vale para quem nao tem outra fonte.
    this.minigunViews.step(dtFx);
    // So o slot LOCAL e reancorado no estado. `net.ts` preenche `minigun`
    // apenas para o viewer, entao reancorar um slot remoto zeraria a
    // reconstrucao com um `idle` que nunca foi atualizado. Os demais vivem da
    // integracao acima, que e o que este registro existe para fazer.
    const localExtra = state.playerExtras[this.localPlayerId - 1];
    if (localExtra?.joined) {
      this.minigunViews.applyAuthoritative(
        this.localPlayerId - 1,
        localExtra.minigun.phase,
        localExtra.minigun.spin,
      );
    }
    this.casings.step(dtFx);
    this.casings.draw(ctx, toScreen, z, TILE_H, onCamera);
    this.moduleProps.drawWorld(ctx, toScreen, z, TILE_H, onCamera, nowMs);
    this.fxList = this.fxList.filter((fx) => (fx.life -= dtFx) > 0);
    for (const fx of this.fxList) {
      const t = 1 - fx.life / fx.maxLife;
      if (fx.kind === 'ring') {
        const [sx, sy] = toScreen(fx.x, fx.y);
        const r = (fx.r + (fx.maxR - fx.r) * t) * TILE_W * 0.5 * z;
        ctx.strokeStyle = fx.color;
        ctx.globalAlpha = 1 - t;
        ctx.lineWidth = z * 1.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (fx.kind === 'frostBurst') {
        this.drawFrostBurst(ctx, fx.x, fx.y, fx.burst, t, toScreen, z);
      } else {
        const [sx, sy] = toScreen(fx.x + fx.offsetX, fx.y);
        // O numero segura opaco na primeira metade e so entao some. Desvanecer
        // desde o quadro zero — como fazia — gasta em transparencia justamente
        // o instante em que o jogador esta olhando para o golpe.
        drawDamageNumber(
          ctx,
          fx.text,
          sx,
          sy - 16 * z - t * 12 * z,
          fx.color,
          fx.scale,
          damageAlpha(t),
          z,
        );
      }
    }

    this.renderRewardFlight(toScreen, nowMs);
    this.renderCargoFlights(toScreen, nowMs);
    // O voo de incorporacao e desenhado em espaco de TELA, depois do mundo e
    // antes da HUD: o cartucho sai de um card de interface e chega a um corpo
    // do mundo, entao ele nao pertence a nenhum dos dois — mas nunca pode
    // passar por cima do painel de vida.
    this.renderModuleInstallFlights(state, toScreen, nowMs);
    this.trackSector(state, nowMs);
    this.renderHud(state, input, nowMs, vw, vh);
    this.renderDeathEchoReadout(state, vw, vh);
  }

  /**
   * A GEADA NO PROSPECTOR (ver frost-shell.ts). `size` e o raio do corpo em
   * px; a altura do chassi e `size * 2.7`, como a varredura da Purga usa.
   * As pecas vem em unidades de corpo e viram quads aqui; a estatua e um
   * poligono facetado por cima da silhueta, com o nucleo pulsando laranja
   * durante o ciclo e as fissuras crescendo na proporcao do que derreteu. Na
   * quebra, a concha se abre por 220 ms — lascas soltas para fora — e some.
   */
  private drawFrostOverlay(
    ctx: CanvasRenderingContext2D,
    psx: number,
    psy: number,
    size: number,
    z: number,
    entityId: number,
    frac: number,
    frozen: boolean,
    thaw: number,
    glow: number,
    sinceBreakMs: number,
  ): void {
    // A altura do chassi em px. O sprite do Prospector mede ~3,8 raios de pe
    // a cabeca; a varredura da Purga usa 2,7 porque so cobre o tronco.
    const bodyH = size * FROST_BODY_HEIGHT;
    const bx = (x: number): number => psx + x * size;
    const by = (y: number): number => psy - y * bodyH;
    const seed = Math.imul(entityId, 2654435761) ^ 0xf05;
    ctx.save();
    if (!frozen) {
      // Os degraus parciais: geada, placas, cristais.
      if (frac > 0) {
        for (const piece of frostPieces(seed, frac))
          this.drawFrostPiece(ctx, piece, bx, by, size, z);
      }
      // A concha ABRINDO: logo depois da quebra, os fragmentos da estatua
      // voam para fora por um instante — e o corpo so volta a se mexer quando
      // a leitura da quebra ja aconteceu.
      if (sinceBreakMs < 220) {
        const u = sinceBreakMs / 220;
        const shell = frostShell(seed);
        ctx.globalAlpha = (1 - u) * 0.85;
        ctx.fillStyle = '#dbe9ff';
        for (let i = 0; i < shell.length; i++) {
          const [x0, y0] = shell[i];
          const [x1, y1] = shell[(i + 1) % shell.length];
          const ox = ((x0 + x1) / 2) * u * 1.6;
          const oy = -u * 0.5 + ((y0 + y1) / 2 - 0.5) * u * 1.2;
          ctx.beginPath();
          ctx.moveTo(bx(x0 + ox), by(y0 + oy));
          ctx.lineTo(bx(x1 + ox), by(y1 + oy));
          ctx.lineTo(bx((x0 + x1) / 2 + ox), by((y0 + y1) / 2 - 0.12 + oy));
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
      return;
    }
    // A ESTATUA. A silhueta continua visivel por baixo (o veu do sprite ja
    // e frio); a concha e o que diz "selado": faces claras, arestas mais
    // claras ainda, nada de curva.
    const shell = frostShell(seed);
    ctx.beginPath();
    shell.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(bx(x), by(y)) : ctx.lineTo(bx(x), by(y))));
    ctx.closePath();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#dbe9ff';
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(1, z * 0.9);
    ctx.strokeStyle = '#f4f9ff';
    ctx.stroke();
    // Facetas internas: arestas do centro para vertices alternados.
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(1, z * 0.5);
    for (let i = 0; i < shell.length; i += 4) {
      ctx.beginPath();
      ctx.moveTo(bx(0), by(0.5));
      ctx.lineTo(bx(shell[i][0]), by(shell[i][1]));
      ctx.stroke();
    }
    // O NUCLEO aceso sob o gelo, no ciclo termico.
    if (glow > 0) {
      const r = size * (0.45 + glow * 0.35);
      const grad = ctx.createRadialGradient(bx(0), by(0.52), 0, bx(0), by(0.52), r);
      grad.addColorStop(0, `rgba(255,178,102,${0.75 * glow})`);
      grad.addColorStop(0.6, `rgba(255,122,47,${0.35 * glow})`);
      grad.addColorStop(1, 'rgba(255,122,47,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx(0), by(0.52), r, 0, Math.PI * 2);
      ctx.fill();
    }
    // As FISSURAS: do motor e da arma para o resto da crosta, na proporcao do
    // que ja derreteu — e o unico progresso que a estatua mostra.
    const cracks = frostCracks(seed);
    const shown = Math.round(thaw * cracks.length);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#2e3a4d';
    ctx.lineWidth = Math.max(1, z * 0.7);
    for (let i = 0; i < shown; i++) {
      const c = cracks[i];
      ctx.beginPath();
      ctx.moveTo(bx(c.x0), by(c.y0));
      ctx.lineTo(bx(c.x1), by(c.y1));
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFrostPiece(
    ctx: CanvasRenderingContext2D,
    piece: FrostPiece,
    bx: (x: number) => number,
    by: (y: number) => number,
    size: number,
    z: number,
  ): void {
    // A altura do chassi em px. O sprite do Prospector mede ~3,8 raios de pe
    // a cabeca; a varredura da Purga usa 2,7 porque so cobre o tronco.
    const bodyH = size * FROST_BODY_HEIGHT;
    if (piece.kind === 'speck') {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#e8f1ff';
      ctx.fillRect(
        bx(piece.x) - (piece.w * size) / 2,
        by(piece.y),
        piece.w * size,
        Math.max(1, piece.h * bodyH),
      );
      return;
    }
    if (piece.kind === 'plate') {
      ctx.save();
      ctx.translate(bx(piece.x), by(piece.y));
      ctx.rotate(piece.angle);
      const w = piece.w * size;
      const h = piece.h * bodyH;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#dbe9ff';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#f4f9ff';
      ctx.lineWidth = Math.max(1, z * 0.5);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }
    // Cristal: um triangulo fino apontando para o nucleo.
    const len = piece.w * size * 1.6;
    const half = Math.max(1, piece.h * bodyH);
    const dx = Math.cos(piece.angle);
    const dy = -Math.sin(piece.angle) * 0.6;
    const x0 = bx(piece.x);
    const y0 = by(piece.y);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e8f1ff';
    ctx.beginPath();
    ctx.moveTo(x0 - dy * half, y0 + dx * half);
    ctx.lineTo(x0 + dx * len, y0 + dy * len);
    ctx.lineTo(x0 + dy * half, y0 - dx * half);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * A coroa de estilhacos do congelamento, no plano do chao.
   *
   * Todo ponto do chao passa por `toScreen`, e a altura e subtraida em
   * pixels de tile — o mesmo contrato das particulas — para a coroa cair na
   * mesma projecao que o resto da cena, seja qual for o angulo da camera.
   * Tres camadas, de tras para frente: o disco de geada (o lago que virou
   * lamina de uma vez), os riscos de po correndo para fora, e as lascas em pe,
   * pintadas em ordem de pintor para as de tras nao cobrirem as da frente.
   */
  private drawFrostBurst(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    burst: FrostBurst,
    t: number,
    toScreen: (x: number, y: number) => [number, number],
    z: number,
  ): void {
    const frame = frostBurstFrame(t);
    if (frame.alpha <= 0 && frame.disc <= 0) return;
    const [cx, cy] = toScreen(x, y);
    const unit = TILE_W * 0.5 * z;
    // 1. O disco de geada.
    const discR = burst.radius * unit * (0.55 + 0.45 * frame.grow);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.5);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, discR);
    grad.addColorStop(0, `rgba(232,241,255,${frame.disc})`);
    grad.addColorStop(0.5, `rgba(196,216,242,${frame.disc * 0.5})`);
    grad.addColorStop(1, 'rgba(160,184,220,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, discR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 2. Os riscos de po, para alem da coroa.
    ctx.lineWidth = Math.max(1, z * 0.8);
    ctx.strokeStyle = PAL.player;
    for (const st of burst.streaks) {
      const g = pieceGrow(frame.grow, st.delay);
      if (g <= 0) continue;
      const to = st.from + (st.to - st.from) * g;
      const [ax, ay] = toScreen(x + Math.cos(st.angle) * st.from, y + Math.sin(st.angle) * st.from);
      const [bx, by] = toScreen(x + Math.cos(st.angle) * to, y + Math.sin(st.angle) * to);
      ctx.globalAlpha = frame.alpha * 0.55 * g;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    // 3. As lascas, de tras para frente.
    for (const sh of burst.shards) {
      const g = pieceGrow(frame.grow, sh.delay);
      if (g <= 0) continue;
      const px = -Math.sin(sh.angle) * sh.halfWidth;
      const py = Math.cos(sh.angle) * sh.halfWidth;
      const bx = x + Math.cos(sh.angle) * sh.base;
      const by = y + Math.sin(sh.angle) * sh.base;
      const reach = sh.base + (sh.reach - sh.base) * g;
      const [lx, ly] = toScreen(bx + px, by + py);
      const [rx, ry] = toScreen(bx - px, by - py);
      const [tx, tyGround] = toScreen(
        x + Math.cos(sh.angle) * reach,
        y + Math.sin(sh.angle) * reach,
      );
      const ty = tyGround - sh.height * g * TILE_H * z;
      const [mx, my] = toScreen(bx, by);
      // A face: clara, com a borda de tras um pouco mais funda para a lasca
      // ter espessura — e nao ser um triangulo branco chapado.
      ctx.globalAlpha = frame.alpha * (0.6 + 0.4 * g);
      ctx.fillStyle = '#dbe9ff';
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(tx, ty);
      ctx.lineTo(rx, ry);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f4f9ff';
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(tx, ty);
      ctx.lineTo(rx, ry);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PAL.mist;
      ctx.lineWidth = Math.max(1, z * 0.6);
      ctx.globalAlpha = frame.alpha * 0.7;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Faixa de mira no plano do chao, com a largura do projetil.
   *
   * A largura NAO e um valor escolhido para ficar bonito: e duas vezes o raio de
   * colisao que a simulacao usa para o tiro. E essa a promessa que a faixa faz —
   * "o que estiver dentro daqui e atingido" — e ela so vale se o numero for o
   * mesmo dos dois lados. Por isso o raio vem importado de `projectiles`, e nao
   * digitado aqui.
   *
   * O corredor e um quadrilatero de quatro cantos projetados, e nao um `lineTo`
   * grosso: na projecao 2:1 uma linha de espessura constante em pixels tem
   * larguras de MUNDO diferentes conforme a direcao — larga quando aponta para o
   * norte, estreita quando aponta para leste. Projetar os cantos mantem a
   * largura constante em tiles, que e a unica que significa alguma coisa.
   */
  /**
   * A LUZ COLORIDA nas tres faces de um bloco, cada uma com o proprio `N.L`.
   *
   * Este e o lugar em que a luz deixa de ser um numero por celula e passa a ser
   * direcional. O bloco e desenhado como uma imagem so — o atlas ja traz as tres
   * faces sombreadas —, mas a GEOMETRIA delas na tela e conhecida e fixa na
   * projecao 2:1, e sao exatamente os mesmos quadrilateros que o caminho de
   * recuo desenha logo abaixo. Repintar por cima deles em `lighter` da a cada
   * face a luz que a orientacao dela manda receber:
   *
   *   - a face da ESQUERDA na tela olha para +y do mundo;
   *   - a da DIREITA olha para +x;
   *   - o TOPO olha para cima.
   *
   * O efeito e o que se espera de uma tocha: uma explosao a leste acende a face
   * direita das paredes e deixa a esquerda no escuro. Antes, as duas recebiam o
   * mesmo valor e a parede lia como um adesivo chapado.
   *
   * So roda quando ha COR na celula, e por isso nao custa nada numa sala sem
   * fonte colorida — que e a maioria das salas na maior parte do tempo.
   */
  private paintWallBounce(
    field: LightField,
    paintBounce: (paint: (color: string) => void, bounce: Bounce) => void,
    solid: number,
    x: number,
    y: number,
    sx: number,
    sy: number,
    z: number,
  ): void {
    if (!field.hasChromaAt(x, y)) return;
    const illumination = field.illuminationAt(x, y);
    const material = solidResponse(solid);
    const ctx = this.ctx;
    const hw = (TILE_W / 2) * z;
    const hh = (TILE_H / 2) * z;
    const wh = WALL_H * z;

    const quad = (points: ReadonlyArray<readonly [number, number]>, color: string): void => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fill();
    };

    const faces = [
      {
        normal: FACE_LEFT,
        points: [
          [sx - hw, sy],
          [sx, sy + hh],
          [sx, sy + hh - wh],
          [sx - hw, sy - wh],
        ],
      },
      {
        normal: FACE_RIGHT,
        points: [
          [sx + hw, sy],
          [sx, sy + hh],
          [sx, sy + hh - wh],
          [sx + hw, sy - wh],
        ],
      },
      {
        normal: FACE_TOP,
        points: [
          [sx, sy - hh - wh],
          [sx + hw, sy - wh],
          [sx, sy + hh - wh],
          [sx - hw, sy - wh],
        ],
      },
    ] as const;

    for (const face of faces) {
      const bounce = bounceOf(illumination, face.normal, material);
      if (bounce) paintBounce((color) => quad(face.points, color), bounce);
    }
  }

  private drawAimLane(
    state: SurvivalState,
    player: SurvivalState['player'],
    toScreen: (x: number, y: number) => [number, number],
    z: number,
    intensity: number,
  ): void {
    const ctx = this.ctx;
    const extra = state.playerExtras[player.slot ?? 0];
    const aim = extra.aim;
    const length = Math.hypot(aim.x, aim.y);
    if (length < 1e-6) return;

    const w = state.config.width;
    const height = state.config.height;
    const legs = aimLanePath(
      player.x,
      player.y,
      aim.x / length,
      aim.y / length,
      (x, y) => {
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        if (cx < 0 || cy < 0 || cx >= w || cy >= height) return true;
        return state.solid[cy * w + cx] !== SOLID_NONE;
      },
      // Rebotes que o PROXIMO tiro vai ter de fato: o modulo equipado E com
      // carga. Desenhar o quique de um Ricochete sem carga prometeria uma parede
      // que o tiro nao vai usar.
      moduleHasCapacity(extra, 'ricochet', state.tick) ? RICOCHET_BOUNCES : 0,
    );
    if (legs.length === 0) return;

    // Comeca na borda do corpo: sob os pes do proprio Prospector a faixa nao
    // informa nada e ainda suja a silhueta dele.
    const bodyGap = player.radius + 0.15;
    const total = legs.reduce((sum, leg) => sum + leg.length, 0);
    if (total - bodyGap < 0.2) return;

    const half = SMALL_PROJECTILE_RADIUS;
    /**
     * Desenha um trecho reto do trajeto. `from`/`to` sao distancias medidas ao
     * longo do trajeto INTEIRO, e nao deste trecho: e o que faz o desvanecimento
     * atravessar o quique sem reiniciar, e portanto o que faz os dois trechos
     * lerem como um tiro so em vez de duas faixas soltas.
     */
    const band = (leg: AimLaneLeg, from: number, widthScale: number, alpha: number): void => {
      const px = -leg.ny * half * widthScale;
      const py = leg.nx * half * widthScale;
      const steps = 6;
      const begin = leg === legs[0] ? Math.min(leg.length, bodyGap) : 0;
      if (leg.length - begin <= 0) return;
      for (let i = 0; i < steps; i++) {
        const t0 = begin + ((leg.length - begin) * i) / steps;
        const t1 = begin + ((leg.length - begin) * (i + 1)) / steps;
        // Some para a frente: a faixa nao pode terminar num traco reto, que
        // leria como "o tiro para aqui" — e ele nao para.
        ctx.globalAlpha = alpha * intensity * (1 - ((from + t0) / total) * 0.85);
        const [ax, ay] = toScreen(leg.x0 + leg.nx * t0 + px, leg.y0 + leg.ny * t0 + py);
        const [bx, by] = toScreen(leg.x0 + leg.nx * t1 + px, leg.y0 + leg.ny * t1 + py);
        const [cx, cy] = toScreen(leg.x0 + leg.nx * t1 - px, leg.y0 + leg.ny * t1 - py);
        const [dx, dy] = toScreen(leg.x0 + leg.nx * t0 - px, leg.y0 + leg.ny * t0 - py);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx, cy);
        ctx.lineTo(dx, dy);
        ctx.closePath();
        ctx.fill();
      }
    };

    // Duas faixas encaixadas: o corredor cheio, fraco, e um miolo mais forte.
    // O miolo e o que a vista pega de relance; o corredor e o que ela confere
    // quando o jogador quer mesmo saber se o inimigo esta dentro.
    ctx.save();
    ctx.fillStyle = PAL.biolum;
    for (const [scale, alpha] of [
      [1, 0.22],
      [0.34, 0.4],
    ] as const) {
      let walked = 0;
      for (const leg of legs) {
        band(leg, walked, scale, alpha);
        walked += leg.length;
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    const last = legs[legs.length - 1];
    const tipPx = -last.ny * half;
    const tipPy = last.nx * half;
    const tipX = last.x1;
    const tipY = last.y1;

    ctx.save();
    ctx.strokeStyle = PAL.biolum;
    ctx.lineWidth = Math.max(1, z * 0.9);

    // Marca do QUIQUE: um losango na parede onde o tiro vira. E o ponto que o
    // jogador de fato escolhe quando usa Ricochete — a mira aponta para a
    // parede, nao para o alvo — entao ele precisa de um alvo proprio.
    ctx.globalAlpha = 0.7 * intensity;
    for (let i = 0; i < legs.length - 1; i++) {
      const leg = legs[i];
      const [kx, ky] = toScreen(leg.x1, leg.y1);
      const r = Math.max(2, 3 * z);
      ctx.beginPath();
      ctx.moveTo(kx, ky - r * 0.5);
      ctx.lineTo(kx + r, ky);
      ctx.lineTo(kx, ky + r * 0.5);
      ctx.lineTo(kx - r, ky);
      ctx.closePath();
      ctx.stroke();
    }

    // Traco final atravessado na ponta: um alvo, e nao um fim de linha. Da a
    // faixa um ponto de leitura para quem mira "aquela distancia".
    ctx.globalAlpha = 0.5 * intensity;
    const [tipLx, tipLy] = toScreen(tipX + tipPx * 1.9, tipY + tipPy * 1.9);
    const [tipRx, tipRy] = toScreen(tipX - tipPx * 1.9, tipY - tipPy * 1.9);
    ctx.beginPath();
    ctx.moveTo(tipLx, tipLy);
    ctx.lineTo(tipRx, tipRy);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /**
   * Uma goticula do teto sobre a poca: queda, respingo e ondulacoes.
   *
   * A fase [0,1) percorre o ciclo inteiro: ate 0.3 a gota CAI (acelerando, como
   * gota cai), dai ate 0.85 os aneis abrem na lamina enquanto o respingo salta
   * e assenta, e o resto do ciclo e silencio — pingo de caverna nao e metronomo.
   * O ponto de impacto sai do hash da celula, fora do centro, para duas celulas
   * vizinhas nao pingarem em pontos espelhados.
   */
  private drawPoolDrip(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    z: number,
    phase: number,
    seed: number,
    enclosed: boolean,
  ): void {
    // Ponto de impacto contido no miolo do losango: perto da borda o anel
    // teria de nascer ja cortado.
    const jx = sx + ((((seed >>> 3) % 33) - 16) / 33) * TILE_W * 0.3 * z;
    const jy = sy + ((((seed >>> 9) % 33) - 16) / 33) * TILE_H * 0.25 * z;
    // Raio maximo do anel, em fracao da meia-celula. Cercada de poca, a
    // ondulacao pode atravessar para as celulas vizinhas — e liquido continuo.
    // Na borda, o teto vem da metrica do losango (|dx|/W + |dy|/H <= 1): o
    // anel para ANTES da linha da agua, nunca sobe na rocha seca.
    const half = TILE_W * 0.5 * z;
    const halfH = TILE_H * 0.5 * z;
    const offset = Math.abs(jx - sx) / half + Math.abs(jy - sy) / halfH;
    const kMax = enclosed ? 0.85 : Math.max(0.16, 0.68 - offset);
    const FALL_END = 0.3;
    const RIPPLE_END = 0.85;
    if (phase < FALL_END) {
      const t = phase / FALL_END;
      const drop = t * t; // queda livre: comeca lenta, chega rapida
      const yPos = jy - 2.4 * WALL_H * z * (1 - drop);
      ctx.fillStyle = PAL.biolum;
      // fio fino se alongando: a gota estica conforme ganha velocidade
      ctx.globalAlpha = 0.4 + drop * 0.5;
      ctx.fillRect(jx - z * 0.5, yPos - (2 + drop * 3) * z, z, (2 + drop * 3) * z);
      ctx.globalAlpha = 1;
      return;
    }
    if (phase >= RIPPLE_END) return;
    const t = (phase - FALL_END) / (RIPPLE_END - FALL_END);
    // Dois aneis concentricos defasados, achatados na proporcao do losango.
    ctx.strokeStyle = PAL.biolum;
    ctx.lineWidth = Math.max(1, z * 0.8);
    for (const [delay, gain] of [
      [0, 0.55],
      [0.3, 0.35],
    ] as const) {
      const tt = (t - delay) / (1 - delay);
      if (tt <= 0 || tt >= 1) continue;
      ctx.globalAlpha = (1 - tt) * gain;
      ctx.beginPath();
      ctx.ellipse(jx, jy, tt * kMax * half, tt * kMax * halfH, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Respingo do impacto: duas goticulas saltando e recaindo no primeiro
    // quarto da fase de ondulacao.
    if (t < 0.28) {
      const st = t / 0.28;
      const hop = Math.sin(st * Math.PI);
      ctx.fillStyle = PAL.biolum;
      ctx.globalAlpha = 0.85 * (1 - st * 0.6);
      ctx.fillRect(jx - 1.6 * z, jy - hop * 3.2 * z - z, z, z);
      ctx.fillRect(jx + 0.8 * z, jy - hop * 2.2 * z - z, z, z);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * UM anel do corpo do Devorador, recortado na linha da areia.
   *
   * O recorte e o que faz o corpo ENTRAR no chao em vez de deslizar por cima
   * dele. Sem ele um anel de elevacao negativa continuaria desenhado inteiro,
   * so mais baixo na tela — o que na projecao isometrica e indistinguivel de um
   * anel que andou para o fundo. E a mesma ambiguidade que a sombra resolve para
   * o salto (ver `leapShadowScale`), pelo lado oposto.
   *
   * A linha nao e `sy`. A saia de baixo do tubo projeta ABAIXO da ancora — e o
   * canto de perto do cilindro, que numa vista 2:1 desce ate a metade da
   * espessura —, e cortar em `sy` comeria essa saia em TODO anel, inclusive nos
   * que estao pousados na superficie. O corte fica onde o sprite pousado
   * termina, e esse numero vem do proprio manifest (`frameHeight - anchorY`), de
   * modo que reautorar o anel nao deixa o recorte para tras.
   */
  /**
   * A LINHA DA AREIA da cabeca, em pixels de tela.
   *
   * Nao e o fundo do QUADRO: o quadro da cabeca tem 48 px abaixo da ancora e
   * quase todos sao folga da pose de boca aberta. Cortar por ele deixava a
   * linha 37 px baixa demais, e o verme aparecia inteiro, de pe, desenhado por
   * cima do chao a frente dele. Ver `DEVOURER_BELOW_ANCHOR_PX`.
   */
  private devourerSandLine(sy: number, spriteZoom: number): number {
    return sy + DEVOURER_BELOW_ANCHOR_PX * spriteZoom;
  }

  /**
   * UMA PECA do corpo do Leviata: o quadro do posto, no rumo da peca, descendo
   * e recortada pela LINHA D'AGUA na fracao de submersao dela — e, se esta
   * atravessando a lamina, a ondulacao onde o corpo corta a superficie.
   *
   * Apenas deslocar o sprite para baixo nao bastaria: sem o recorte a peca
   * apareceria inteira, desenhada por baixo da poca, boiando. O recorte e o
   * que transforma "mais para baixo" em "debaixo d'agua".
   */
  private drawLeviathanPiece(
    ctx: CanvasRenderingContext2D,
    node: LeviathanBodyNode,
    sx: number,
    sy: number,
    z: number,
    spriteZoom: number,
    light: Tint | undefined,
    faces: FaceLighting | undefined,
    nowMs: number,
  ): void {
    const piece = leviathanPieceFrame(node.rank);
    const loaded = this.sprites.get(piece.atlas);
    // Sem atlas nao ha corpo, e nao ha recuo: a cabeca sozinha e um chefe
    // legivel; oito losangos de recuo em fila seriam pior que a ausencia.
    if (!loaded) return;
    const dip = leviathanWaterDip(node.submersion, sy, spriteZoom);
    const bodyY = sy - node.bobPx * z + (dip?.drop ?? 0);
    if (dip) {
      if (dip.line <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, ctx.canvas.width, dip.line);
      ctx.clip();
    }
    this.sprites.drawPiece(
      ctx,
      piece.atlas,
      'idle',
      piece.frame,
      node.dirX,
      node.dirY,
      sx,
      bodyY,
      spriteZoom,
      undefined,
      light,
      faces,
    );
    if (dip) {
      ctx.restore();
      drawWaterlineRipple(
        ctx,
        sx,
        dip.line,
        TILE_W * 0.45 * z * (1.3 - node.rank * 0.1),
        z,
        nowMs,
        node.submersion,
      );
    }
  }

  private drawDevourerRing(
    ctx: CanvasRenderingContext2D,
    node: SpineNode,
    sx: number,
    sy: number,
    z: number,
    spriteZoom: number,
    light: Tint | undefined,
    faces: FaceLighting | undefined,
  ): void {
    const loaded = this.sprites.get(DEVOURER_COIL_ATLAS);
    // Sem atlas nao ha corpo, e nao ha recuo: a cabeca sozinha e o chefe que o
    // jogo tinha ate ontem, e um losango de recuo repetido dez vezes seria pior
    // que a ausencia.
    if (!loaded) return;
    const bodyY = sy - node.liftPx * z;
    if (node.liftPx >= 0) {
      this.sprites.drawPiece(
        ctx,
        DEVOURER_COIL_ATLAS,
        'idle',
        node.rank,
        node.dirX,
        node.dirY,
        sx,
        bodyY,
        spriteZoom,
        undefined,
        light,
        faces,
      );
      return;
    }

    // FUNDO DEMAIS PARA DEIXAR MARCA. Sem esta saida o colar de silica
    // continuava sendo pintado por cima de cada anel ja sumido — dez elipses
    // claras desenhando na areia lisa exatamente a linha do bicho que o
    // mergulho acabou de esconder. O recorte tira o corpo; a marca do corpo
    // tinha de sair junto.
    if (node.liftPx <= -DEVOURER_HIDDEN_PX) return;

    const sand = sy + (loaded.manifest.frameHeight - loaded.manifest.anchorY) * spriteZoom;
    // Enterrado a ponto de a linha da areia sair da tela por cima: nao ha um
    // pixel deste anel para desenhar, e um retangulo de recorte de altura
    // negativa e comportamento indefinido em canvas.
    if (sand <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, sand);
    ctx.clip();
    this.sprites.drawPiece(
      ctx,
      DEVOURER_COIL_ATLAS,
      'idle',
      node.rank,
      node.dirX,
      node.dirY,
      sx,
      bodyY,
      spriteZoom,
      undefined,
      light,
      faces,
    );
    ctx.restore();

    // O COLAR de silica revirada onde o corpo atravessa a superficie.
    //
    // Ele existe por causa do corte: sem nada em cima, o recorte e uma linha
    // reta atravessando um corpo redondo, e uma linha reta e a assinatura de um
    // recorte. Com a areia amontoada por cima dela a mesma aresta le como o
    // lugar onde a duna cede — a informacao passa a ser "ele esta enfiado ali"
    // em vez de "este sprite foi cortado".
    //
    // Larga e baixa na razao 2:1 do mundo, e opaca no comeco da descida e
    // sumindo conforme ele afunda: uma vez enterrado nao ha o que revirar.
    // A escala do desbotamento e a do MERGULHO INTEIRO, e nao a da crista.
    //
    // Enquanto ele afundava so 11 px as duas eram a mesma coisa. Agora ele
    // atravessa 95, e medir o desbotamento pelos 11 saturava no primeiro
    // decimo do caminho: o colar chegava em 0,15 de opacidade e ficava la,
    // aceso, por toda a travessia. Medido pelo caminho inteiro ele apaga junto
    // com o corpo, que e o que "uma vez enterrado nao ha o que revirar" sempre
    // quis dizer.
    const buried = Math.min(1, -node.liftPx / DEVOURER_HIDDEN_PX);
    const width = TILE_W * 0.5 * z * (0.9 - node.rank * 0.045);
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - buried);
    ctx.fillStyle = SURFACE_FALLBACK[SURF_SILT];
    ctx.beginPath();
    ctx.ellipse(sx, sand - 1.5 * z, width, width * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawDeathEchoBody(
    echo: PlacedDeathEcho,
    sx: number,
    sy: number,
    z: number,
    spriteZoom: number,
    nowMs: number,
    bodyAlpha: number,
  ): void {
    const ctx = this.ctx;
    const variant = carcassVariant(echo.cause);
    if (bodyAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = bodyAlpha;
      const size = 0.34 * TILE_W * 0.9 * z;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, size, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Os cacos ficam no plano do chão, sob o corpo, e por isso vêm antes dele.
      // São o que a morte espalhou: brasa, placa arrancada, fungo, pedra.
      for (const piece of variant.debris) {
        const px = sx + (piece.dx - piece.dy) * (TILE_W / 2) * z;
        const py = sy + (piece.dx + piece.dy) * (TILE_H / 2) * z;
        const side = Math.max(1, piece.size * TILE_W * z * 0.5);
        ctx.fillStyle = piece.color;
        ctx.fillRect(Math.round(px - side / 2), Math.round(py - side / 2), side, side);
      }

      const drew = this.sprites.drawEntity(
        ctx,
        'prospector',
        'die',
        echo.facingX,
        echo.facingY,
        10_000,
        sx,
        sy,
        spriteZoom,
        variant.tint,
      );
      if (!drew) {
        ctx.fillStyle = variant.shell;
        ctx.fillRect(sx - 9 * z, sy - 5 * z, 16 * z, 4 * z);
        ctx.fillStyle = PAL.rockShadow;
        ctx.fillRect(sx - 6 * z, sy - 8 * z, 7 * z, 4 * z);
        ctx.fillStyle = PAL.player;
        ctx.fillRect(sx - 5 * z, sy - 7 * z, 2 * z, z);
      }
      ctx.restore();
    }

    // O farol da caixa-preta é a ÚNICA coisa que atravessa o escuro.
    //
    // Ele denuncia que há algo ali sem revelar o quê: a silhueta, os cacos e a
    // causa continuam presos à luz do mundo. A cor não muda com o tipo de morte
    // de propósito — um farol que dissesse "aqui alguém queimou" transformaria a
    // escuridão num mapa de causas, e a caixa-preta existe para ser LIDA de
    // perto, pareando.
    const pulse = Math.sin(nowMs * 0.008 + echo.cell * 0.17);
    const lit = pulse > -0.2;
    const bx = sx + 2 * z;
    const by = sy - 7 * z;
    if (lit) {
      ctx.save();
      ctx.globalAlpha = 0.18 + Math.max(0, pulse) * 0.22;
      ctx.fillStyle = PAL.biolum;
      ctx.beginPath();
      ctx.ellipse(bx + 1.5 * z, by + 1.5 * z, 7 * z, 7 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = lit ? PAL.biolum : PAL.rockShadow;
    ctx.fillRect(bx, by, 3 * z, 3 * z);
    ctx.strokeStyle = PAL.dark;
    ctx.lineWidth = Math.max(1, z * 0.6);
    ctx.strokeRect(bx, by, 3 * z, 3 * z);
  }

  /**
   * Um Eco demonstrando uma habilidade ao lado do poço.
   *
   * Silhueta translúcida na cor da habilidade, e não um baú: o que o jogador
   * precisa entender antes de chegar perto é que aquilo é ALGUÉM mostrando algo,
   * e que há dois. A cor faz a comparação acontecer de longe — antes de ele
   * escolher a que estava mais perto por acaso.
   *
   * O rótulo aparece SEMPRE, mesmo no escuro. Ele é instrução, e a regra de "a
   * fog of war revela luzes, não silhuetas" protege informação sobre o mundo —
   * uma oferta que o jogo está fazendo ao jogador não é informação sobre o mundo.
   */
  /**
   * Uma peça do chefe caida no chao: anel pulsando e um bloco pequeno em cima.
   *
   * Deliberadamente MENOR e mais discreto que a oferta do Poco. As duas coisas
   * marcam "ha algo aqui para pegar", mas a do Poco e uma escolha de build que
   * para a luta, e esta e uma peça de sucata no meio dela. Igualar as duas
   * ensinaria o jogador a parar no meio do combate do Diamandis.
   */
  private drawBossModuleMark(
    mark: BossModuleMark,
    sx: number,
    sy: number,
    z: number,
    nowMs: number,
  ): void {
    const ctx = this.ctx;
    // A fase vem da POSICAO, e nao do instante em que a marca nasceu: duas
    // peças caidas lado a lado pulsando em unissono lem como interface, e nao
    // como duas coisas separadas no chao.
    const breath = 0.5 + Math.sin(nowMs * 0.006 + mark.x + mark.y) * 0.3;
    ctx.save();
    ctx.globalAlpha = 0.3 + breath * 0.4;
    ctx.strokeStyle = mark.color;
    ctx.lineWidth = Math.max(1, z * 0.6);
    ctx.beginPath();
    ctx.ellipse(sx, sy, (6 + breath * 2) * z, (3 + breath) * z, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.75 + breath * 0.25;
    ctx.fillStyle = mark.color;
    ctx.fillRect(sx - 2 * z, sy - 5 * z, Math.max(2, 4 * z), Math.max(2, 4 * z));
    ctx.restore();
  }

  private drawWellOffer(
    offer: { ability: AbilityId; x: number; y: number },
    sx: number,
    sy: number,
    z: number,
    spriteZoom: number,
    nowMs: number,
    reachable: boolean,
  ): void {
    const ctx = this.ctx;
    const presentation = abilityPresentation(offer.ability);
    const breath = 0.55 + Math.sin(nowMs * 0.005 + offer.x) * 0.15;

    ctx.save();
    ctx.globalAlpha = breath * 0.5;
    ctx.fillStyle = presentation.color;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 10 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.5 + breath * 0.25;
    const drew = this.sprites.drawEntity(
      ctx,
      'prospector',
      'idle',
      0,
      1,
      nowMs,
      sx,
      sy,
      spriteZoom,
      { color: presentation.color, alpha: 0.7 },
    );
    if (!drew) {
      ctx.fillStyle = presentation.color;
      ctx.fillRect(sx - 3 * z, sy - 16 * z, Math.max(2, 6 * z), Math.max(2, 16 * z));
      ctx.fillRect(sx - 4 * z, sy - 21 * z, Math.max(2, 8 * z), Math.max(2, 5 * z));
    }
    ctx.restore();

    const label = reachable
      ? t('ability.offer.use', { ability: presentation.label })
      : presentation.label;
    ctx.save();
    ctx.font = `bold ${Math.round(6.5 * z)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(label).width + 10 * z;
    const height = 11 * z;
    const top = sy - 30 * z;
    ctx.fillStyle = 'rgba(11,14,20,0.9)';
    ctx.fillRect(sx - width / 2, top, width, height);
    ctx.strokeStyle = presentation.color;
    ctx.lineWidth = Math.max(1, z * (reachable ? 0.9 : 0.5));
    ctx.strokeRect(sx - width / 2, top, width, height);
    ctx.fillStyle = presentation.color;
    ctx.fillText(label, sx, top + height / 2);
    ctx.restore();
  }

  /**
   * O prompt da juncao: rotear ou desfazer, pelo mesmo botao de tudo. A
   * moldura e a da oferta do poco; a borda e eletrica porque a juncao e. O
   * label diz o que o botao FARA (abrir/fechar o rele), nao o que ha.
   */
  private drawLeylineNodePrompt(
    key:
      | 'leyline.node.route'
      | 'leyline.node.unroute'
      | 'leyline.source.launch'
      | 'leyline.source.again',
    sx: number,
    sy: number,
    z: number,
    nowMs: number,
    reachable: boolean,
  ): void {
    const ctx = this.ctx;
    const label = t(key);
    ctx.save();
    ctx.font = `bold ${Math.round(6.5 * z)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(label).width + 10 * z;
    const height = 11 * z;
    const top = sy - 24 * z;
    ctx.globalAlpha = reachable ? 0.92 : 0.55 + Math.sin(nowMs * 0.006) * 0.1;
    ctx.fillStyle = 'rgba(11,14,20,0.9)';
    ctx.fillRect(sx - width / 2, top, width, height);
    ctx.strokeStyle = PAL.electric;
    ctx.lineWidth = Math.max(1, z * (reachable ? 0.9 : 0.5));
    ctx.strokeRect(sx - width / 2, top, width, height);
    ctx.fillStyle = PAL.electric;
    ctx.fillText(label, sx, top + height / 2);
    ctx.restore();
  }

  /** O convite a parear: aparece no escuro, porque é instrução e não matéria. */
  private drawDeathEchoPrompt(sx: number, sy: number, z: number, nowMs: number): void {
    const ctx = this.ctx;
    const label = t('echo.prompt');
    ctx.save();
    ctx.font = `bold ${Math.round(6.5 * z)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(label).width + 10 * z;
    const height = 11 * z;
    const top = sy - 24 * z;
    ctx.globalAlpha = 0.82 + Math.sin(nowMs * 0.006) * 0.18;
    ctx.fillStyle = 'rgba(11,14,20,0.9)';
    ctx.fillRect(sx - width / 2, top, width, height);
    ctx.strokeStyle = PAL.biolum;
    ctx.lineWidth = Math.max(1, z * 0.5);
    ctx.strokeRect(sx - width / 2, top, width, height);
    ctx.fillStyle = PAL.biolum;
    ctx.fillText(label, sx, top + height / 2);
    ctx.restore();
  }

  /**
   * A reprodução holográfica dos últimos segundos.
   *
   * Curta, estilizada e incompleta por decisão: ela conta para onde o Prospector
   * corria, para onde mirava e em que instante o gatilho esteve apertado. Não
   * desenha o inimigo — a cápsula guarda a CAUSA, não a posição de quem matou, e
   * inventar essa posição seria ensinar uma geometria que nunca existiu.
   *
   * O trajeto é relativo à carcaça, então num eco reprojetado ele pode atravessar
   * uma parede que não existia no mapa original. Isso é aceitável e é parte do
   * ponto: o holograma é uma TRANSMISSÃO de outro lugar, não um fantasma preso à
   * geometria daqui. Corrigi-lo contra as paredes atuais custaria um pathfinding
   * por quadro para forjar um trajeto que ninguém percorreu.
   */
  private drawDeathEchoTrace(
    link: { echo: PlacedDeathEcho; openedAtMs: number },
    toScreen: (x: number, y: number) => [number, number],
    z: number,
    nowMs: number,
  ): void {
    const trace = link.echo.finalTrace;
    if (!trace) return;
    const duration = deathEchoTraceDuration(trace);
    if (duration <= 0) return;
    const elapsed = Math.max(0, nowMs - link.openedAtMs) % duration;
    const head = Math.min(trace.dx.length - 1, Math.floor(elapsed / trace.stepMs));
    const ctx = this.ctx;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // O caminho inteiro fica fraco no fundo: é o contorno da fuga, e ler o
    // trajeto todo de uma vez é o que transforma um corpo num acontecimento.
    ctx.strokeStyle = PAL.biolum;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = Math.max(1, z * 0.7);
    ctx.beginPath();
    for (let i = 0; i < trace.dx.length; i++) {
      const point = decodeDeathEchoTracePoint(trace, i, link.echo.x, link.echo.y);
      if (!point) continue;
      const [px, py] = toScreen(point.x, point.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Cada disparo marca o chão de onde saiu. Três ou quatro marcas dizem
    // "ele estava atirando enquanto recuava" sem uma linha de texto.
    for (let i = 0; i <= head; i++) {
      const point = decodeDeathEchoTracePoint(trace, i, link.echo.x, link.echo.y);
      if (!point?.firing) continue;
      const [px, py] = toScreen(point.x, point.y);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = PAL.electric;
      ctx.fillRect(
        Math.round(px - z),
        Math.round(py - 10 * z),
        Math.max(1, 2 * z),
        Math.max(1, 2 * z),
      );
    }

    const current = decodeDeathEchoTracePoint(trace, head, link.echo.x, link.echo.y);
    if (!current) {
      ctx.restore();
      return;
    }
    const [hx, hy] = toScreen(current.x, current.y);
    // A sombra do Prospector: silhueta chapada, sem sprite. Ela não é o corpo —
    // é a transmissão de um corpo que já não está ali.
    ctx.globalAlpha = 0.34 + Math.sin(nowMs * 0.01) * 0.06;
    ctx.fillStyle = PAL.biolum;
    ctx.fillRect(
      Math.round(hx - 3 * z),
      Math.round(hy - 16 * z),
      Math.max(2, 6 * z),
      Math.max(2, 16 * z),
    );
    ctx.fillRect(
      Math.round(hx - 4 * z),
      Math.round(hy - 21 * z),
      Math.max(2, 8 * z),
      Math.max(2, 5 * z),
    );

    // Para onde ele estava mirando no instante que a reprodução alcançou.
    const aimLength = Math.hypot(current.aimX, current.aimY) || 1;
    const ax = ((current.aimX - current.aimY) / aimLength) * 18 * z;
    const ay = ((current.aimX + current.aimY) / aimLength) * 9 * z;
    ctx.globalAlpha = current.firing ? 0.75 : 0.35;
    ctx.strokeStyle = current.firing ? PAL.electric : PAL.biolum;
    ctx.lineWidth = Math.max(1, z * (current.firing ? 1 : 0.7));
    ctx.beginPath();
    ctx.moveTo(hx + ax * 0.35, hy - 10 * z + ay * 0.35);
    ctx.lineTo(hx + ax, hy - 10 * z + ay);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * O laudo da caixa-preta, aberto pelo botão usar.
   *
   * Antes ele acendia por proximidade: passar perto de um corpo despejava texto
   * na tela sem que o jogador tivesse pedido nada. Agora a transmissão é um ATO —
   * o mesmo botão que abre terminal e cofre abre a caixa-preta —, e é esse ato
   * que as etapas seguintes (recuperar módulo, pagar contaminação) vão custar.
   */
  private renderDeathEchoReadout(state: SurvivalState, vw: number, vh: number): void {
    const link = this.deathEchoes.paired;
    if (!link) return;
    const echo = link.echo;

    // O retangulo do painel e o que `renderHud` acabou de desenhar neste
    // quadro — uma conta so, em hud-layout.ts. Antes do primeiro quadro, a
    // geometria minima serve de reserva.
    const hud =
      this.hudPanelRect ??
      (() => {
        const hs = hudScale(vw, vh);
        const layout = hudPanelLayout({
          viewportWidth: vw / hs,
          safe: {
            top: this.safeArea.top / hs,
            right: this.safeArea.right / hs,
            bottom: this.safeArea.bottom / hs,
            left: this.safeArea.left / hs,
          },
          dense: hudDense(vw, vh),
          moduleCount: state.playerExtra.activeModules.length,
          surveyHeight: 0,
          objectiveLines: 1,
          freezeMeter: state.playerExtra.freeze > 0 || state.playerExtra.frostbitten,
        });
        return {
          x: layout.x * hs,
          y: layout.y * hs,
          width: layout.width * hs,
          height: layout.height * hs,
        };
      })();
    const region = deathEchoReadoutRegion(vw, vh, this.safeArea, hud);
    if (!region) return;

    const ctx = this.ctx;
    const readout = deathEchoReadout(echo);
    const titleSize = 10;
    const conditionSize = 9;
    const bodySize = 12;
    const lessonSize = 10;
    const lineHeight = bodySize + 4;
    const lessonHeight = lessonSize + 3;

    // A LARGURA VEM PRIMEIRO, e o texto é quebrado contra ela.
    //
    // Quebrar contra `region.maxWidth` e depois dimensionar a caixa pela manchete
    // — que é curta — produzia linhas de lição medidas para 360 px dentro de um
    // painel de 190 px: a lição vazava a borda e podia sair da safe area. A ordem
    // correta é decidir a caixa e só então quebrar tudo o que vai dentro dela.
    ctx.font = `bold ${bodySize}px monospace`;
    const headlineText = readout.headline.toUpperCase();
    const headlineNatural = wrapMeasuredText(ctx, headlineText, region.maxWidth - 24);
    const minimumWidth = Math.min(190, region.maxWidth);
    const boxWidth = Math.min(
      region.maxWidth,
      Math.max(minimumWidth, ...headlineNatural.map((line) => ctx.measureText(line).width + 24)),
    );
    const textWidth = boxWidth - 24;
    const lines = wrapMeasuredText(ctx, headlineText, textWidth);

    ctx.font = `${lessonSize}px monospace`;
    // A lição é o que a caixa-preta tem de melhor a oferecer, mas é também a
    // parte mais longa: numa viewport curta ela sai antes do resto, em vez de o
    // painel inteiro desaparecer.
    const lessonLines = readout.lesson ? wrapMeasuredText(ctx, readout.lesson, textWidth) : [];
    const aggregateLines = readout.aggregate
      ? wrapMeasuredText(ctx, readout.aggregate, textWidth)
      : [];

    const headerHeight = 20 + titleSize + conditionSize + 4;
    const boxHeight =
      headerHeight + aggregateLines.length * lessonHeight + lines.length * lineHeight;
    if (boxHeight > region.maxHeight) return;
    const withLesson = boxHeight + 6 + lessonLines.length * lessonHeight;
    const showLesson = lessonLines.length > 0 && withLesson <= region.maxHeight;
    const totalHeight = showLesson ? withLesson : boxHeight;
    const x =
      region.align === 'right'
        ? region.x + region.maxWidth - boxWidth
        : region.x + (region.maxWidth - boxWidth) / 2;
    const y = region.y;

    ctx.save();
    ctx.fillStyle = 'rgba(11,14,20,0.94)';
    ctx.fillRect(x, y, boxWidth, totalHeight);
    ctx.strokeStyle = PAL.biolum;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(x, y, boxWidth, totalHeight);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PAL.biolum;
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.fillText(readout.title, x + 12, y + 8);
    ctx.fillStyle = PAL.rust;
    ctx.font = `${conditionSize}px monospace`;
    ctx.fillText(readout.condition, x + 12, y + 10 + titleSize);
    let bodyTop = y + 14 + titleSize + conditionSize;
    if (aggregateLines.length > 0) {
      // A escala da câmara vem ANTES da causa: "dezessete unidades" muda o que a
      // frase seguinte significa, e lida depois ela seria só um rodapé.
      ctx.fillStyle = PAL.blood;
      ctx.font = `${lessonSize}px monospace`;
      aggregateLines.forEach((line, index) =>
        ctx.fillText(line, x + 12, bodyTop + index * lessonHeight),
      );
      bodyTop += aggregateLines.length * lessonHeight;
    }
    ctx.fillStyle = PAL.player;
    ctx.font = `bold ${bodySize}px monospace`;
    lines.forEach((line, index) => ctx.fillText(line, x + 12, bodyTop + index * lineHeight));
    if (showLesson) {
      ctx.fillStyle = PAL.bone;
      ctx.font = `${lessonSize}px monospace`;
      const lessonTop = bodyTop + lines.length * lineHeight + 6;
      lessonLines.forEach((line, index) =>
        ctx.fillText(line, x + 12, lessonTop + index * lessonHeight),
      );
    }
    ctx.fillStyle = echo.projection === 'exact' ? PAL.blood : PAL.rust;
    ctx.fillRect(x, y + totalHeight - 3, boxWidth, 3);
    ctx.restore();
  }

  /**
   * A lasca que sobe, curva e chega.
   *
   * Duas coisas ao mesmo tempo, de proposito: o "+N ⬡" sobe do ponto ATINGIDO
   * (onde o jogador esta olhando) enquanto a lasca viaja ate o contador (onde o
   * numero vive). Fazer em sequencia dobraria a duracao e a mineracao ficaria
   * atrasada em relacao ao proprio som.
   */
  private renderCargoFlights(
    toScreen: (x: number, y: number) => [number, number],
    nowMs: number,
  ): void {
    if (this.cargoFlights.length === 0) return;
    const ctx = this.ctx;
    // O alvo e o CONTADOR DE CARGA, encostado a direita do painel — e nao o
    // glifo de purga na esquerda, para onde o voo da recompensa vai. As duas
    // animacoes tem alvos diferentes porque sao coisas diferentes chegando; a
    // lasca que pousasse em cima da purga diria que minerar rende purga.
    const target = { x: this.cargoCounterX, y: this.hudResourcesGlyphY };
    const alive: typeof this.cargoFlights = [];
    for (const flight of this.cargoFlights) {
      if (!flight.startScreen) {
        const [x, y] = toScreen(flight.worldX, flight.worldY);
        flight.startScreen = { x, y };
      }
      const elapsed = nowMs - flight.startedAt;
      const sample = rewardFlightPosition(flight.startScreen, target, elapsed, flight.durationMs);
      if (sample.progress >= 1) {
        this.cargoPulseUntil = nowMs + 380;
        continue;
      }
      alive.push(flight);

      // O texto: sobe do ponto atingido e some na primeira metade do voo.
      const textPhase = Math.min(1, elapsed / (flight.durationMs * 0.55));
      if (textPhase < 1) {
        ctx.save();
        ctx.globalAlpha = textPhase < 0.6 ? 1 : 1 - (textPhase - 0.6) / 0.4;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0b0e14';
        const label = `+${flight.amount} ⬡`;
        const ty = flight.startScreen.y - 10 - textPhase * 18;
        ctx.strokeText(label, flight.startScreen.x, ty);
        ctx.fillStyle = PAL.loot;
        ctx.fillText(label, flight.startScreen.x, ty);
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = 0.85;
      drawOreGlyph(ctx, sample.x, sample.y, 9 + Math.sin(sample.progress * Math.PI) * 3, PAL.loot);
      ctx.restore();
    }
    this.cargoFlights = alive;
  }

  /**
   * Resolve as ejecoes pendentes e adianta a fisica dos cartuchos.
   *
   * As duas coisas juntas porque as duas precisam do MESMO quadro: a ejecao
   * so pode nascer quando ha um corpo no mundo de onde sair, e a fisica so
   * anda com o passo real que o desenho acabou de medir.
   *
   * Uma pendencia que nao acha o dono (parceiro que saiu, jogador que morreu
   * no mesmo tick) e DESCARTADA depois de meio segundo em vez de esperar para
   * sempre: um cartucho que sai de um corpo que ja nao esta la nao conta
   * nada, e a fila nao pode crescer sem teto.
   */
  private stepModuleProps(state: SurvivalState, dtMs: number, nowMs: number): void {
    if (this.pendingEjections.length > 0) {
      const stillPending: typeof this.pendingEjections = [];
      for (const pending of this.pendingEjections) {
        const player = state.players[pending.slot];
        const extra = state.playerExtras[pending.slot];
        if (!player || !extra?.joined || !player.alive) {
          if (nowMs - pending.at < 500) stillPending.push(pending);
          continue;
        }
        // A Minigun sai FUMEGANTE: o calor do cano no instante da ultima bala
        // vira o brilho residual da peca no ar. Os outros modulos saem frios,
        // porque nenhum deles aquece nada.
        const heat = pending.module === 'minigun' ? Math.min(1, extra.heat / HEAT_MAX) : 0;
        this.moduleProps.eject(
          pending.module,
          pending.slot,
          player.x,
          player.y,
          pending.at,
          nowMs,
          player.facing.x,
          player.facing.y,
          heat,
          prefersReducedMotion(),
        );
      }
      this.pendingEjections = stillPending;
    }
    this.moduleProps.step(dtMs, nowMs);
  }

  /**
   * Os cartuchos que estao voando para dentro do Prospector.
   *
   * O destino e resolvido A CADA QUADRO a partir do corpo: o bot anda durante
   * os 620 ms do voo, e um destino congelado no inicio faria o cartucho pousar
   * onde ele estava, nao onde ele esta. Quando o corpo nao pode ser resolvido
   * — fora da camera, ainda nao entrou, caiu no meio do voo — o recuo e o
   * painel da HUD, que e onde o modulo passa a existir de qualquer forma.
   */
  private renderModuleInstallFlights(
    state: SurvivalState,
    toScreen: (x: number, y: number) => [number, number],
    nowMs: number,
  ): void {
    if (this.moduleProps.flightCount === 0) return;
    const hudFallback = { x: this.hudModuleAnchor.x, y: this.hudModuleAnchor.y };
    // REDUCAO DE MOVIMENTO: quem pediu menos movimento nao recebe o arco, e
    // sim o clarao de encaixe direto sobre o proprio Prospector. Nao ha um
    // segundo caminho para manter — recusar a origem e exatamente o mesmo
    // recuo do cofre fora da camera, que ja existe e ja e testado.
    const reduced = prefersReducedMotion();
    this.moduleProps.drawScreen(
      this.ctx,
      nowMs,
      (slot) => {
        const player = state.players[slot];
        const extra = state.playerExtras[slot];
        if (!player || !extra?.joined || !player.alive) return null;
        const [sx, sy] = toScreen(player.x, player.y);
        // Uns pixels acima dos pes: o hardpoint fica no ombro, e um cartucho
        // pousando na sombra do bot leria como algo caindo no chao.
        return { x: sx, y: sy - 18 * this.zoom };
      },
      (origin) => {
        if (reduced) return null;
        if (origin.space === 'screen') return { x: origin.x, y: origin.y };
        const [sx, sy] = toScreen(origin.x, origin.y);
        // Cofre fora da camera: sem origem visivel nao ha arco honesto a
        // desenhar, e o recuo assume.
        if (sx < -80 || sx > window.innerWidth + 80 || sy < -80 || sy > window.innerHeight + 80) {
          return null;
        }
        return { x: sx, y: sy };
      },
      hudFallback,
    );
  }

  private renderRewardFlight(
    toScreen: (x: number, y: number) => [number, number],
    nowMs: number,
  ): void {
    const flight = this.rewardFlight;
    if (!flight || nowMs < flight.startedAt) return;
    if (!flight.startScreen) {
      const [x, y] = toScreen(flight.worldX, flight.worldY);
      flight.startScreen = { x, y };
    }
    const target = { x: this.hudPurgeGlyph.x, y: this.hudPurgeGlyph.y };
    const sample = rewardFlightPosition(
      flight.startScreen,
      target,
      nowMs - flight.startedAt,
      flight.durationMs,
    );
    if (sample.progress >= 1) {
      this.rewardFlight = null;
      this.purgePulseUntil = nowMs + 420;
      return;
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - sample.progress) * 1.7 + 0.25);
    ctx.translate(sample.x, sample.y);
    ctx.rotate((1 - sample.progress) * 0.35);
    drawBatteryGlyph(ctx, 0, 0, 18 + Math.sin(sample.progress * Math.PI) * 5, PAL.biolum);
    ctx.restore();
  }

  private renderHud(
    state: SurvivalState,
    input: InputState,
    nowMs: number,
    vw: number,
    vh: number,
  ): void {
    const ctx = this.ctx;
    const extra = state.playerExtra;
    ctx.textBaseline = 'alphabetic';

    // Contaminacao continua sendo a unica faixa presa ao topo inteiro.
    //
    // Ela era tres pixels de acido sem numero e sem rotulo — o suficiente para
    // quem ja sabia o que aquilo media, e invisivel para todo mundo que nao
    // sabia. Um relogio que mata precisa ser LIDO antes de cobrar, entao a
    // faixa ganhou tres coisas: espessura que muda com o perigo, a cor que
    // percorre acido -> fogo -> sangue conforme sobe, e o numero, que so
    // aparece quando ha o que decidir (do primeiro degrau em diante). Antes
    // disso o valor nao muda nenhuma escolha, e um HUD que grita o tempo todo
    // ensina a nao olhar.
    const contam = state.contamination;
    const saturated = contam >= 1;
    const firstStep = CONTAMINATION_WAVES[0][0];
    const lastStep = CONTAMINATION_WAVES[CONTAMINATION_WAVES.length - 1][0];
    // A pulsacao e do RELOGIO da simulacao, nao de `nowMs`: ela bate junto com
    // a pancada que o ar cobra, entao o brilho e o dano sao o mesmo evento.
    const pulse = saturated ? 0.55 + 0.45 * Math.sin((state.tick / TICK_HZ) * Math.PI * 2) : 1;
    const barH = saturated ? 6 : contam >= lastStep ? 5 : 3;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, vw, barH);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = saturated ? PAL.blood : contam >= lastStep ? PAL.fire : PAL.acid;
    ctx.fillRect(0, 0, vw * contam, barH);
    ctx.globalAlpha = 1;

    if (contam >= firstStep) {
      const label = saturated
        ? t('hud.contamination.saturated')
        : `${t('hud.contamination')} ${Math.round(contam * 100)}%`;
      ctx.font = `bold ${saturated ? 9 : 8}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(label, vw / 2 + 1, barH + 11);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = saturated ? PAL.blood : contam >= lastStep ? PAL.fire : PAL.acid;
      ctx.fillText(label, vw / 2, barH + 10);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    // O LOCALIZADOR DE COFRE: instrumento 360° no topo-centro, no lugar do
    // antigo texto "COFRE: LESTE · ~10m" do painel esquerdo. O bearing e
    // suavizado pelo MENOR arco entre quadros; trocar de alvo (cofre aberto →
    // proximo promovido) rearma o marcador sem varrer a volta longa.
    const targets = locatorTargets(state.salvageSites, state.player.x, state.player.y);
    if (targets.length > 0) {
      const primary = targets[0];
      const dtMs = Math.min(120, Math.max(0, nowMs - this.locatorLastMs));
      this.locatorLastMs = nowMs;
      if (this.locatorSiteId !== primary.siteId || this.locatorBearing === null) {
        this.locatorSiteId = primary.siteId;
        this.locatorBearing = primary.bearingDeg;
      } else {
        this.locatorBearing = lerpBearingDeg(
          this.locatorBearing,
          primary.bearingDeg,
          1 - Math.exp(-dtMs * 0.012),
        );
      }
      drawCacheLocator(
        ctx,
        cacheLocatorLayout(vw, vh, this.safeArea),
        primary,
        this.locatorBearing,
        targets.slice(1),
        nowMs,
      );
    } else {
      this.locatorSiteId = null;
      this.locatorBearing = null;
    }

    // ------------------------------------------------------------------
    // O PAINEL DE STATUS. A geometria vem de hud-layout.ts; aqui e so tinta.
    // ------------------------------------------------------------------
    const reduced = prefersReducedMotion();
    const hpFrac = Math.max(0, Math.min(1, state.player.hp / state.player.maxHp));
    const nav = state.config.tuning.navigation;
    const surveyHeight =
      nav.routeMemory || nav.contaminationForecast ? surveyHudHeight(state, nav, this.route) : 0;

    // A diretiva, em ordem de urgencia:
    //
    // 1. o selo do setor, quando ha um — enquanto o dono esta de pe, nem o poco
    //    nem o pedestal aceitam a mao, e mandar "desca pelo poco" apontaria
    //    para uma interacao recusada;
    // 2. o caminho de VOLTA, quando o Nucleo do fundo ja esta na mao: a
    //    diretiva vira a mesma para os dois jogadores em qualquer setor — va a
    //    ENTRADA, subir (setor > 1) ou fechar o contrato (setor 1);
    // 3. o Nucleo deste setor, se houver um por recolher;
    // 4. descer.
    //
    // Medida ANTES do painel: a diretiva mais longa nao cabe numa linha do
    // painel compacto, e a altura do painel depende de em quantas ela quebrou.
    const hudObjective = objectiveViewOf(state);
    const objectiveKey = hudObjective.sealedByBoss
      ? 'hud.objective.breakSeal'
      : hudObjective.returning
        ? state.sector > 1
          ? 'hud.objective.ascend'
          : 'hud.objective.extract'
        : hudObjective.hasCore && !hudObjective.coreTakenHere
          ? 'hud.objective.findCore'
          : 'hud.objective.descend';
    ctx.font = HUD_OBJECTIVE_FONT;
    const objectiveLines = wrapHudText(
      t(objectiveKey),
      hudObjectiveMaxWidth(vw / hudScale(vw, vh)),
      (text) => ctx.measureText(text).width,
    ).slice(0, HUD_OBJECTIVE_MAX_LINES);
    if (objectiveKey !== this.objectiveKey) {
      // A diretiva TROCOU: e o unico momento em que ela precisa puxar o olho.
      // Depois disso ela e a linha mais lenta do painel, e um texto que grita
      // o tempo todo ensina a nao olhar.
      this.objectiveChangedAtMs = this.objectiveKey === null ? -1e9 : nowMs;
      this.objectiveKey = objectiveKey;
    }

    // Em tela pequena o painel inteiro e desenhado em escala (hud-layout.ts,
    // `hudScale`): a geometria fica em unidades de painel — a viewport e a
    // area segura entram DIVIDIDAS pela escala — e `ctx.scale` faz o resto.
    // Tudo o que sai daqui para outros leitores e multiplicado de volta.
    const hs = hudScale(vw, vh);
    const layout = hudPanelLayout({
      viewportWidth: vw / hs,
      safe: {
        top: this.safeArea.top / hs,
        right: this.safeArea.right / hs,
        bottom: this.safeArea.bottom / hs,
        left: this.safeArea.left / hs,
      },
      dense: hudDense(vw, vh),
      moduleCount: extra.activeModules.length,
      surveyHeight,
      objectiveLines: objectiveLines.length,
      freezeMeter: extra.freeze > 0 || extra.frostbitten,
    });
    // Os leitores do retangulo (caixa-preta, voos) usam o do ULTIMO quadro.
    this.hudPanelRect = {
      x: layout.x * hs,
      y: layout.y * hs,
      width: layout.width * hs,
      height: layout.height * hs,
    };
    this.hudResourcesGlyphY = layout.resources.glyphY * hs;
    this.hudModuleAnchor = layout.modules
      ? { x: (layout.modules.x + 15) * hs, y: (layout.modules.y + 15) * hs }
      : { x: (layout.innerLeft + 15) * hs, y: (layout.resources.glyphY + 12) * hs };

    // O RASTRO da barra de HP: o preenchimento cai na hora, e um trilho palido
    // segura o valor antigo por um instante antes de descer ate ele. O tamanho
    // do rastro E o tamanho do golpe — sem numero flutuante nenhum.
    const dtMs = Math.min(100, Math.max(0, nowMs - this.hudLastMs));
    this.hudLastMs = nowMs;
    if (this.hpLastFrac < 0) {
      this.hpGhost = hpFrac;
    } else if (hpFrac < this.hpLastFrac - 1e-6) {
      this.hpHitAtMs = nowMs;
      this.hpHitStrength = Math.min(1, 0.35 + (this.hpLastFrac - hpFrac) * 4);
    }
    this.hpLastFrac = hpFrac;
    this.hpGhost = reduced
      ? hpFrac
      : hpGhostStep(this.hpGhost, hpFrac, nowMs - this.hpHitAtMs, dtMs);

    const roundedPanel = (x: number, y: number, w: number, h: number, radius: number): void => {
      const r = Math.min(radius, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // Um texto que ACABOU de mudar: a cor base, com um veu branco que se
    // desfaz em `durationMs`. E a mesma linguagem para setor, Nucleos e
    // diretiva — uma so forma de "isto e novo", e nao tres.
    const flashText = (
      text: string,
      x: number,
      y: number,
      base: string,
      elapsedMs: number,
      durationMs: number,
    ): void => {
      ctx.fillStyle = base;
      ctx.fillText(text, x, y);
      if (reduced || elapsedMs < 0 || elapsedMs >= durationMs) return;
      ctx.globalAlpha = 1 - elapsedMs / durationMs;
      ctx.fillStyle = PAL.player;
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 1;
    };

    // O vidro: um degrade curto de cima para baixo e um fio de luz na borda
    // superior. Com HP baixo a moldura inteira respira em sangue — e o unico
    // estado em que o painel, e nao so a barra, tem algo a dizer.
    const lowHp = state.player.hp > 0 && hpFrac <= 0.35;
    const lowPulse = lowHp && !reduced ? 0.5 + 0.5 * Math.sin(nowMs / 170) : lowHp ? 0.6 : 0;
    ctx.save();
    ctx.scale(hs, hs);
    roundedPanel(layout.x, layout.y, layout.width, layout.height, 10);
    const glass = ctx.createLinearGradient(0, layout.y, 0, layout.y + layout.height);
    glass.addColorStop(0, 'rgba(17,22,31,0.86)');
    glass.addColorStop(1, 'rgba(9,12,18,0.82)');
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.strokeStyle = lowHp ? `rgba(217,59,76,${0.4 + 0.45 * lowPulse})` : 'rgba(232,241,255,0.26)';
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232,241,255,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.x + 10, layout.y + 1.5);
    ctx.lineTo(layout.x + layout.width - 10, layout.y + 1.5);
    ctx.stroke();

    // Coracao voxel + HP numerico: a vida do jogador vive somente aqui. Com HP
    // baixo o coracao BATE — a mesma batida da moldura.
    const heartBeat = lowHp && !reduced ? 1 + 0.14 * Math.max(0, Math.sin(nowMs / 170)) ** 3 : 1;
    ctx.save();
    ctx.translate(layout.heart.x, layout.heart.y);
    ctx.scale(heartBeat, heartBeat);
    ctx.fillStyle = hpFrac > 0.35 ? PAL.fungusLight : PAL.blood;
    ctx.fillRect(-8, -7, 6, 6);
    ctx.fillRect(2, -7, 6, 6);
    ctx.fillRect(-10, -3, 20, 7);
    ctx.fillRect(-6, 4, 12, 4);
    ctx.fillRect(-2, 8, 4, 4);
    ctx.restore();

    const { hpBar } = layout;
    const hpInnerW = hpBar.w - 2;
    const hpFillW = hpInnerW * hpFrac;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(hpBar.x, hpBar.y, hpBar.w, hpBar.h);
    if (this.hpGhost > hpFrac + 0.002) {
      ctx.fillStyle = 'rgba(232,241,255,0.55)';
      ctx.fillRect(
        hpBar.x + 1 + hpFillW,
        hpBar.y + 1,
        hpInnerW * (this.hpGhost - hpFrac),
        hpBar.h - 2,
      );
    }
    ctx.fillStyle = hpFrac > 0.35 ? PAL.fungusLight : PAL.blood;
    ctx.fillRect(hpBar.x + 1, hpBar.y + 1, hpFillW, hpBar.h - 2);
    // Um fio de luz no topo do preenchimento e tres marcas de quarto: a barra
    // passa a ter relevo e escala sem ganhar um numero a mais.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(hpBar.x + 1, hpBar.y + 1, hpFillW, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let q = 1; q < 4; q++) {
      ctx.fillRect(hpBar.x + Math.round((hpBar.w * q) / 4), hpBar.y + 1, 1, hpBar.h - 2);
    }
    const sinceHit = nowMs - this.hpHitAtMs;
    if (!reduced && sinceHit >= 0 && sinceHit < 200) {
      ctx.fillStyle = `rgba(255,255,255,${(1 - sinceHit / 200) * 0.5 * this.hpHitStrength})`;
      ctx.fillRect(hpBar.x, hpBar.y, hpBar.w, hpBar.h);
    }
    // A VARREDURA da Purga na barra: uma banda de fosforo cruza a barra da
    // esquerda para a direita enquanto o chassi religa. E o mesmo evento que a
    // linha subindo pelo corpo — duas leituras do mesmo reboot, no mesmo
    // meio segundo.
    const sweepT = (nowMs - this.purgeUsedAtMs) / 600;
    if (!reduced && sweepT >= 0 && sweepT < 1) {
      const sweepX = hpBar.x + hpBar.w * sweepT;
      const sweepGrad = ctx.createLinearGradient(sweepX - 22, 0, sweepX + 4, 0);
      sweepGrad.addColorStop(0, 'rgba(89,242,194,0)');
      sweepGrad.addColorStop(0.8, `rgba(89,242,194,${0.75 * (1 - sweepT * 0.4)})`);
      sweepGrad.addColorStop(1, 'rgba(232,241,255,0.9)');
      ctx.save();
      ctx.beginPath();
      ctx.rect(hpBar.x + 1, hpBar.y + 1, hpBar.w - 2, hpBar.h - 2);
      ctx.clip();
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(sweepX - 22, hpBar.y, 26, hpBar.h);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(232,241,255,0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpBar.x, hpBar.y, hpBar.w, hpBar.h);
    const hpText = `${Math.max(0, Math.ceil(state.player.hp))} / ${Math.ceil(state.player.maxHp)}`;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(hpText, hpBar.x + hpBar.w - 4, hpBar.y + 12);
    ctx.fillStyle = sweepT >= 0 && sweepT < 1 ? PAL.biolum : PAL.player;
    ctx.fillText(hpText, hpBar.x + hpBar.w - 5, hpBar.y + 11);

    // Calor permanece legivel, mas como trilho secundario dentro do mesmo painel.
    //
    // Com a Minigun equipada os dois trilhos param antes da borda: a ponta
    // direita e reservada a PALAVRA de estado do canhao ("GIRANDO", "CANO
    // TRAVADO"), que antes era desenhada por cima do proprio trilho de calor.
    const minigunEquipped = extra.activeModules.some((module) => module.id === 'minigun');
    const spinFrac = extra.minigun.spin / MINIGUN_SPIN_MAX;
    const showSpin = minigunEquipped || spinFrac > 0;
    const railX = hpBar.x;
    const railW = showSpin ? hpBar.w - 66 : hpBar.w;
    const heatFrac = Math.min(1, extra.heat / HEAT_MAX);
    const overheated = state.tick < extra.overheatedUntil;
    const { heatRail, spinRail } = layout;
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(railX, heatRail.y, railW, heatRail.h);
    // Acima do limiar a barra PULSA, na mesma fronteira em que o tique de aviso
    // comeca a soar. Sem isso as duas leituras contariam historias diferentes: o
    // audio calaria num ponto que a barra nao mostra, e o jogador atribuiria o
    // silencio a sorte em vez de a um limite que ele pode aprender.
    const warning = !overheated && heatFrac > HEAT_WARN_AT;
    ctx.globalAlpha = warning && !reduced ? 0.72 + 0.28 * Math.sin(nowMs / 90) : 1;
    ctx.fillStyle = overheated ? PAL.blood : PAL.fire;
    ctx.fillRect(railX, heatRail.y, railW * heatFrac, heatRail.h);
    ctx.globalAlpha = 1;
    // A marca do limiar fica visivel com o trilho VAZIO. Ela e o que informa que
    // existe um ponto de virada antes de o jogador chegar nele — depois de
    // atingido, quem avisa ja e o tique.
    ctx.fillStyle = 'rgba(232,241,255,0.45)';
    ctx.fillRect(railX + Math.round(railW * HEAT_WARN_AT), heatRail.y - 1, 1, heatRail.h + 2);

    // ROTACAO DO CANHAO, colada ao trilho de calor.
    //
    // Dois pixels sob a barra que ja existe, e nao um medidor novo. O jogador
    // ja tem de olhar para o calor enquanto segura o gatilho da Minigun — as
    // duas leituras sao a MESMA decisao ("posso continuar?"), e separa-las em
    // dois cantos do painel obrigaria a dividir a atencao no unico momento em
    // que ela esta toda no combate.
    //
    // O trilho so aparece quando ha rotacao para mostrar: com a arma parada e
    // sem municao ele nao ocupa pixel nenhum.
    if (showSpin) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(railX, spinRail.y, railW, spinRail.h);
      // Verde enquanto sobe, BRANCO quando ja esta cuspindo: a cor troca no
      // MESMO ponto em que a arma comeca a atirar, entao a barra ensina o
      // limiar sem numero nenhum.
      //
      // Branco e nao ambar de proposito. O trilho de calor logo acima e
      // laranja, e um segundo trilho ambar colado nele daria duas leituras
      // quase da mesma cor a um pixel de distancia — o jogador teria de
      // decidir qual das duas esta olhando no meio de uma rajada. Verde ->
      // branco e a mesma progressao "subindo -> pronto" que o resto do jogo
      // usa, e nenhuma das duas colide com o calor.
      const firing = extra.minigun.phase === 'firing';
      ctx.fillStyle = firing ? PAL.player : PAL.biolum;
      ctx.fillRect(railX, spinRail.y, railW * spinFrac, spinRail.h);
      // A marca do limiar operacional: o ponto a partir do qual sai bala.
      ctx.fillStyle = 'rgba(232,241,255,0.5)';
      ctx.fillRect(
        railX + Math.round((railW * MINIGUN_SPIN_FIRE_AT) / MINIGUN_SPIN_MAX),
        spinRail.y - 1,
        1,
        spinRail.h + 2,
      );
      // O ESTADO em palavra, so nos dois momentos em que ele nao e obvio pela
      // barra: girando sem atirar, e travado. "Atirando" nao precisa de
      // legenda — a tela inteira ja esta dizendo isso.
      const label =
        extra.minigun.phase === 'spinning_up'
          ? t('hud.minigun.spinup')
          : extra.minigun.phase === 'overheated'
            ? t('hud.minigun.overheated')
            : '';
      if (label) {
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = extra.minigun.phase === 'overheated' ? PAL.blood : PAL.biolum;
        ctx.fillText(label, hpBar.x + hpBar.w, heatRail.y + 6);
        ctx.textAlign = 'left';
      }
    }

    // O MEDIDOR DE CONGELAMENTO, colado aos trilhos termicos e inequivoco
    // ao lado deles: azul-claro, SEGMENTADO em tres, com um floco na origem —
    // segmento, icone, fissura e cadeado dizem o que a cor sozinha nao diz.
    // Tres segmentos porque o medidor tem tres leituras: geada, congelamento
    // avancado e perigo critico. Cheio, trava com a legenda; enquanto o
    // gatilho derrete, o ultimo segmento racha e recua em azul, ao mesmo
    // tempo em que o trilho de calor logo acima cresce em laranja — a relacao
    // termica e um par de barras a tres pixels uma da outra.
    if (layout.freezeRail) {
      const rail = layout.freezeRail;
      const frac = freezeFraction(extra);
      const frozen = extra.frostbitten;
      const iconX = hpBar.x - 9;
      const iconY = rail.y + rail.h / 2;
      // O floco: tres riscos cruzados.
      ctx.strokeStyle = frozen ? PAL.player : PAL.electric;
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(iconX - Math.cos(a) * 3.5, iconY - Math.sin(a) * 3.5);
        ctx.lineTo(iconX + Math.cos(a) * 3.5, iconY + Math.sin(a) * 3.5);
        ctx.stroke();
      }
      const gap = 2;
      const segW = (railW - gap * 2) / 3;
      for (let seg = 0; seg < 3; seg++) {
        const sx = railX + seg * (segW + gap);
        ctx.fillStyle = 'rgba(0,0,0,0.58)';
        ctx.fillRect(sx, rail.y, segW, rail.h);
        const fill = Math.max(0, Math.min(1, frac * 3 - seg));
        if (fill > 0) {
          // O terceiro segmento e o perigo, e por isso o mais claro.
          ctx.fillStyle = frozen ? PAL.player : seg === 2 ? '#bfe0ff' : PAL.electric;
          ctx.globalAlpha = frozen && !reduced ? 0.8 + 0.2 * Math.sin(nowMs / 120) : 1;
          ctx.fillRect(sx, rail.y, segW * fill, rail.h);
          ctx.globalAlpha = 1;
        }
        if (frozen && seg === 2) {
          // As FISSURAS do degelo atravessam o ultimo segmento na proporcao do
          // que ja derreteu.
          const thaw = Math.max(0, Math.min(1, (FREEZE_MAX - extra.freeze) / FREEZE_THAW_LAYER));
          const cracks = Math.round(thaw * 5);
          ctx.strokeStyle = PAL.dark;
          for (let c = 0; c < cracks; c++) {
            const cx = sx + segW * (0.15 + c * 0.18);
            ctx.beginPath();
            ctx.moveTo(cx, rail.y);
            ctx.lineTo(cx + 2, rail.y + rail.h);
            ctx.stroke();
          }
        }
      }
      if (frozen) {
        // O CADEADO no fim do trilho e a legenda por cima: o estado travou.
        const lx = railX + railW + 3;
        ctx.strokeStyle = PAL.player;
        ctx.beginPath();
        ctx.arc(lx + 2.5, rail.y + 1.5, 1.8, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = PAL.player;
        ctx.fillRect(lx, rail.y + 1.5, 5, rail.h - 1.5);
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = PAL.dark;
        ctx.fillText(t('hud.freeze.critical'), railX + railW / 2, rail.y + rail.h - 1);
        ctx.textAlign = 'left';
        // A instrucao repete enquanto a estatua durar: e a unica saida, e o
        // jogador que entrou depois da primeira frase precisa le-la tambem.
        if (nowMs - this.frostHoldNagAtMs > 3000) {
          this.frostHoldNagAtMs = nowMs;
          this.messages.push({ text: t('hud.freeze.hold'), until: nowMs + 2400, tone: 'warn' });
        }
      } else if (frac > 0) {
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = PAL.electric;
        ctx.fillText(t('hud.freeze.label'), hpBar.x + hpBar.w, rail.y + rail.h - 1);
        ctx.textAlign = 'left';
      }
    }

    const divider = (y: number): void => {
      ctx.strokeStyle = 'rgba(232,241,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(layout.innerLeft, y + 0.5);
      ctx.lineTo(layout.innerRight, y + 0.5);
      ctx.stroke();
    };
    divider(layout.dividerA);

    const purgePulse = nowMs < this.purgePulseUntil;
    const cargoPulse = nowMs < this.cargoPulseUntil;
    const { resources } = layout;
    const cargoLabel = t('hud.cargo', { count: this.cargoOre });

    // AS CELULAS DE PURGA, uma a uma.
    //
    // Antes era "CÉLULA DE PURGA ×1": um numero que o olho tinha de LER. Agora
    // sao pilhas — um glifo por celula, lado a lado, como as baterias que sao.
    // Quantidade vira comprimento, que se conta de relance; com zero celulas
    // sobra um contorno vazio, que diz "o compartimento existe e esta vazio"
    // em vez de sumir. Acima de seis, as pilhas viram seis e um "×N".
    const purgeCount = extra.purgeCells;
    const PIP_PITCH = 12;
    const PIP_MAX = 6;
    const pipsShown = Math.min(PIP_MAX, Math.max(1, purgeCount));
    const purgeOverflow = purgeCount > PIP_MAX ? `×${purgeCount}` : '';
    const purgeLabel = t('hud.purge');
    ctx.font = 'bold 10px monospace';
    const purgeLabelW = ctx.measureText(purgeLabel).width;
    const pipsX = layout.innerLeft + purgeLabelW + 8;
    ctx.font = 'bold 9px monospace';
    const overflowW = purgeOverflow ? ctx.measureText(purgeOverflow).width + 4 : 0;
    const purgeRowRight = pipsX + pipsShown * PIP_PITCH + overflowW;

    // A carga ocupa o que sobra a direita; se o portugues nao couber a 12 px
    // no painel de 230, a fonte dela desce um ponto de cada vez.
    let resourceSize = 12;
    for (; resourceSize > 9; resourceSize--) {
      ctx.font = `bold ${resourceSize}px monospace`;
      const needed = ctx.measureText(cargoLabel).width + 9 + 15 + 8;
      if (purgeRowRight + needed <= layout.innerRight) break;
    }

    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = purgePulse ? PAL.biolum : PAL.bone;
    ctx.fillText(purgeLabel, layout.innerLeft, resources.baseline);
    const sincePurge = nowMs - this.purgeUsedAtMs;
    const draining = !reduced && sincePurge >= 0 && sincePurge < 420;
    for (let i = 0; i < pipsShown; i++) {
      const filled = i < purgeCount;
      const px = pipsX + i * PIP_PITCH + 3;
      if (filled) {
        drawBatteryGlyph(
          ctx,
          px,
          resources.glyphY,
          purgePulse ? 16 : 14,
          purgePulse ? PAL.biolum : PAL.bone,
        );
      } else {
        // O compartimento vazio: a mesma pilha, sem carga e apagada.
        drawBatteryGlyph(ctx, px, resources.glyphY, 14, PAL.bone, 'empty', 0.38);
      }
    }
    // A pilha que ACABOU de ser gasta: brilha branca e se apaga no lugar onde
    // estava, para o olho ver de onde saiu — em vez de a fileira so encurtar.
    if (draining && purgeCount < PIP_MAX) {
      const tD = sincePurge / 420;
      const px = pipsX + purgeCount * PIP_PITCH + 3;
      ctx.save();
      ctx.globalAlpha = 1 - tD;
      ctx.translate(px, resources.glyphY);
      ctx.scale(1 + tD * 0.5, 1 + tD * 0.5);
      drawBatteryGlyph(ctx, 0, 0, 14, PAL.player);
      ctx.restore();
    }
    if (purgeOverflow) {
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = PAL.bone;
      ctx.fillText(purgeOverflow, pipsX + pipsShown * PIP_PITCH + 2, resources.baseline);
    }
    // O voo da recompensa pousa na PROXIMA pilha — a que ele vai acender.
    this.hudPurgeGlyph = {
      x: (pipsX + Math.min(PIP_MAX - 1, Math.max(0, purgeCount - 1)) * PIP_PITCH + 3) * hs,
      y: resources.glyphY * hs,
    };

    // A carga fica na MESMA linha da purga, encostada a direita do painel: os
    // dois sao recursos que o jogador carrega, e uma linha propria custaria
    // altura de HUD num painel que ja disputa espaco com os modulos.
    const cargoRight = layout.innerRight;
    ctx.textAlign = 'right';
    ctx.font = `bold ${cargoPulse ? resourceSize + 1 : resourceSize}px monospace`;
    ctx.fillStyle = cargoPulse ? PAL.bone : PAL.loot;
    ctx.fillText(cargoLabel, cargoRight, resources.baseline);
    const cargoGlyphX = cargoRight - ctx.measureText(cargoLabel).width - 9;
    // Em unidades de TELA: quem le e o voo da lasca, fora deste `ctx.scale`.
    this.cargoCounterX = cargoGlyphX * hs;
    drawOreGlyph(ctx, cargoGlyphX, resources.glyphY, cargoPulse ? 15 : 13, ctx.fillStyle as string);
    ctx.textAlign = 'left';

    if (layout.modules) {
      this.renderModuleHud(
        extra.activeModules,
        state.tick,
        nowMs,
        layout.modules.x,
        layout.modules.y,
        layout.modules.right,
        this.minigunViews.get(this.localPlayerId - 1).barrelPhase,
        layout.modules.size,
      );
    }

    divider(layout.dividerB);

    // SETOR e NUCLEOS na mesma linha: sao a mesma pergunta ("onde estou na
    // descida?"), e uma linha a menos aqui e uma linha a mais para a diretiva.
    //
    // O denominador e o TOTAL ACESSIVEL desta run, e nunca o maximo potencial
    // da linhagem. Uma expedicao de G-01 mostra "SETOR 3/3" e le como completa;
    // mostrar "3/7" a faria parecer truncada por uma area perdida que ela nunca
    // teve autorizacao para ver.
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px monospace';
    const runSectors = state.config.depth.sectorCount;
    flashText(
      t('hud.sector', { sector: state.sector, total: runSectors }),
      layout.innerLeft,
      layout.sectorBaseline,
      PAL.bone,
      nowMs - this.sectorEnteredAtMs,
      1200,
    );

    // NUCLEOS: so aparece quando a run tem mais de um, e ai ele e a informacao
    // que decide se vale continuar descendo. Numa run de um Nucleo a linha
    // seria ruido — o objetivo logo abaixo ja diz tudo.
    const coreSectors = state.config.depth.coreSectors;
    if (coreSectors.length > 1) {
      const taken = countCoresTaken(state);
      if (taken !== this.coresTakenSeen) {
        this.coresChangedAtMs = this.coresTakenSeen < 0 ? -1e9 : nowMs;
        this.coresTakenSeen = taken;
      }
      ctx.textAlign = 'right';
      ctx.font = 'bold 9px monospace';
      flashText(
        t('hud.cores', { taken, total: coreSectors.length }),
        layout.innerRight,
        layout.sectorBaseline,
        PAL.biolum,
        nowMs - this.coresChangedAtMs,
        900,
      );
      ctx.textAlign = 'left';
    }

    // O estrato/ocupacao logo abaixo do numero: menor e mais apagado, porque e
    // contexto e nao objetivo. Fonte 9px para o nome composto mais longo
    // ("CATEDRAL PRISMÁTICA · MATRIZ MICELIAL") caber no painel compacto.
    ctx.fillStyle = 'rgba(184,169,143,0.78)';
    ctx.font = '9px monospace';
    ctx.fillText(
      biomeLabel(state.stratum, state.occupation),
      layout.innerLeft,
      layout.biomeBaseline,
    );

    // Instrumentacao de Levantamento: mapa de saloes visitados e previsao de
    // onda. Depois do bioma porque sao a leitura MAIS lenta do painel — quem
    // consulta um mapa nao esta no meio de uma luta.
    if (surveyHeight > 0) {
      drawSurveyHud(ctx, state, nav, this.route, layout.innerLeft, layout.surveyTop, nowMs);
    }

    // A DIRETIVA. Uma barra de acento a esquerda diz de que TIPO ela e antes de
    // o texto ser lido: sangue para um selo a derrubar, fosforo para o caminho
    // de volta, ambar para o Nucleo a recolher, osso para a descida comum.
    const { objective } = layout;
    const accent = hudObjective.sealedByBoss
      ? PAL.blood
      : hudObjective.returning
        ? PAL.biolum
        : objectiveKey === 'hud.objective.findCore'
          ? PAL.loot
          : PAL.bone;
    const objectiveElapsed = nowMs - this.objectiveChangedAtMs;
    const objectiveFresh = !reduced && objectiveElapsed >= 0 && objectiveElapsed < 900;
    const lastBaseline =
      objective.firstBaseline + (objectiveLines.length - 1) * objective.lineHeight;
    ctx.fillStyle = accent;
    ctx.globalAlpha = objectiveFresh ? 1 : 0.85;
    ctx.fillRect(
      objective.accentX,
      objective.firstBaseline - 9,
      2,
      lastBaseline + 2 - (objective.firstBaseline - 9),
    );
    ctx.globalAlpha = 1;
    ctx.font = HUD_OBJECTIVE_FONT;
    ctx.textAlign = 'left';
    objectiveLines.forEach((line, index) => {
      flashText(
        line,
        objective.x,
        objective.firstBaseline + index * objective.lineHeight,
        PAL.loot,
        objectiveElapsed,
        900,
      );
    });
    ctx.restore();

    // AS NOTIFICACOES CENTRAIS.
    //
    // A mesma pele do painel — vidro escuro, fio de luz, moldura fina — com um
    // acento a esquerda que diz o tom antes de a frase ser lida: fosforo para
    // o que e bom, sangue para o aviso, osso para o neutro. Entram deslizando
    // quatro pixels e desvanecem nos ultimos 300 ms. Em tela pequena descem um
    // ponto de fonte junto com o painel. Tres no maximo, a mais nova embaixo.
    this.messages = this.messages.filter((m) => m.until > nowMs);
    const visibleMessages = this.messages.filter((m) => (m.startsAt ?? 0) <= nowMs);
    const msgFont = hs < 1 ? 12 : 13;
    const msgH = msgFont + 11;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let my = Math.max(this.safeArea.top + 28, vh * 0.2);
    for (const m of visibleMessages.slice(-3)) {
      if (m.shownAt === undefined) m.shownAt = nowMs;
      const age = nowMs - m.shownAt;
      const enter = reduced ? 1 : Math.min(1, age / 160);
      const leave = reduced ? 1 : Math.max(0, Math.min(1, (m.until - nowMs) / 300));
      const alpha = Math.min(enter, leave);
      const slide = (1 - enter) * 4;
      ctx.font = `bold ${msgFont}px monospace`;
      const tw = ctx.measureText(m.text).width;
      const boxW = tw + 30;
      const boxX = vw / 2 - boxW / 2;
      const boxY = my - msgH / 2 + slide;
      ctx.globalAlpha = alpha;
      roundedPanel(boxX, boxY, boxW, msgH, 6);
      const msgGlass = ctx.createLinearGradient(0, boxY, 0, boxY + msgH);
      msgGlass.addColorStop(0, 'rgba(17,22,31,0.88)');
      msgGlass.addColorStop(1, 'rgba(9,12,18,0.84)');
      ctx.fillStyle = msgGlass;
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,241,255,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const tone = m.tone ?? 'info';
      // 'voice' e a LEGENDA de uma fala de chefe (hoje, o Diamandis): o acento
      // e o texto no teal da Aurix, a cor de tudo o que a companhia escreveu.
      ctx.fillStyle =
        tone === 'good'
          ? PAL.biolum
          : tone === 'warn'
            ? PAL.blood
            : tone === 'voice'
              ? VOICE_CAPTION_COLOR
              : PAL.bone;
      ctx.fillRect(boxX + 6, boxY + 6, 2, msgH - 12);
      ctx.fillStyle =
        tone === 'warn' ? PAL.player : tone === 'voice' ? VOICE_CAPTION_COLOR : PAL.bone;
      ctx.fillText(m.text, vw / 2 + 4, my + slide);
      ctx.globalAlpha = 1;
      my += msgH + 6;
    }
    ctx.textBaseline = 'alphabetic';

    // Controles touch: mesma pele nos dois lados; esquerda move, direita mira
    // e atira. O reticulo e a unica diferenca semantica necessaria.
    if (input.usingTouch) {
      const drawJoystick = (
        stick: InputState['joystick'] | InputState['aimTouch'],
        radius: number,
        shooting: boolean,
      ): void => {
        const accent = shooting ? PAL.biolum : PAL.player;
        const activeAlpha = stick.active ? 0.76 : 0.42;
        const travel = radius * 0.55;
        const knobX = stick.originX + (stick.active ? stick.dx * travel : 0);
        const knobY = stick.originY + (stick.active ? stick.dy * travel : 0);
        const knobR = radius * 0.36;

        ctx.save();
        ctx.fillStyle = 'rgba(11,14,20,0.42)';
        ctx.beginPath();
        ctx.arc(stick.originX, stick.originY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(232,241,255,${stick.active ? 0.62 : 0.38})`;
        ctx.lineWidth = stick.active ? 2.2 : 1.6;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(stick.originX, stick.originY, radius * 0.84, 0, Math.PI * 2);
        ctx.strokeStyle = shooting
          ? `rgba(89,242,194,${stick.active ? 0.45 : 0.22})`
          : `rgba(232,241,255,${stick.active ? 0.35 : 0.18})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Quatro marcas direcionais fazem a base parecer um controle, nao um botao.
        ctx.fillStyle = `rgba(232,241,255,${stick.active ? 0.45 : 0.24})`;
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.translate(stick.originX, stick.originY);
          ctx.rotate((i * Math.PI) / 2);
          ctx.beginPath();
          ctx.moveTo(0, -radius * 0.76);
          ctx.lineTo(-4, -radius * 0.66);
          ctx.lineTo(4, -radius * 0.66);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        ctx.fillStyle = shooting
          ? `rgba(89,242,194,${stick.active ? 0.28 : 0.12})`
          : `rgba(232,241,255,${stick.active ? 0.24 : 0.12})`;
        ctx.beginPath();
        ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.globalAlpha = activeAlpha;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (shooting) {
          const reticle = knobR * 0.48;
          ctx.strokeStyle = `rgba(89,242,194,${stick.active ? 0.9 : 0.58})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(knobX, knobY, reticle * 0.58, 0, Math.PI * 2);
          ctx.moveTo(knobX - reticle, knobY);
          ctx.lineTo(knobX - reticle * 0.35, knobY);
          ctx.moveTo(knobX + reticle * 0.35, knobY);
          ctx.lineTo(knobX + reticle, knobY);
          ctx.moveTo(knobX, knobY - reticle);
          ctx.lineTo(knobX, knobY - reticle * 0.35);
          ctx.moveTo(knobX, knobY + reticle * 0.35);
          ctx.lineTo(knobX, knobY + reticle);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(232,241,255,${stick.active ? 0.72 : 0.4})`;
          ctx.beginPath();
          ctx.arc(knobX, knobY, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };

      drawJoystick(input.joystick, MOVE_JOYSTICK_RADIUS, false);
      drawJoystick(input.aimTouch, AIM_JOYSTICK_RADIUS, true);

      for (const b of input.buttons) {
        ctx.fillStyle = b.pressed ? 'rgba(255,209,102,0.5)' : 'rgba(11,14,20,0.52)';
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = b.pressed ? PAL.loot : 'rgba(232,241,255,0.5)';
        ctx.lineWidth = b.pressed ? 2.2 : 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, b.r * 0.82, 0, Math.PI * 2);
        ctx.strokeStyle = b.pressed ? 'rgba(255,209,102,0.5)' : 'rgba(232,241,255,0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const iconColor = b.pressed ? PAL.loot : 'rgba(232,241,255,0.9)';
        const drewIcon = this.touchIcons.draw(ctx, b.id, b.cx, b.cy, b.r * 1.05, iconColor);
        if (!drewIcon) {
          ctx.fillStyle = iconColor;
          ctx.beginPath();
          ctx.moveTo(b.cx, b.cy - b.r * 0.28);
          ctx.lineTo(b.cx + b.r * 0.28, b.cy);
          ctx.lineTo(b.cx, b.cy + b.r * 0.28);
          ctx.lineTo(b.cx - b.r * 0.28, b.cy);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  private renderModuleHud(
    modules: readonly ActiveModule[],
    tick: number,
    nowMs: number,
    x: number,
    y: number,
    viewportWidth: number,
    /**
     * ANGULO acumulado do canhao, 0..1, quando ha um. O icone da Minigun GIRA
     * com ele: e a leitura mais barata possivel de "os canos ja estao no
     * ponto", e ela chega ao olho sem custar uma linha de HUD.
     */
    minigunPhase = 0,
    /** Lado maximo de cada card; o ritmo denso da tela pequena pede 24. */
    maxSize = 30,
  ): void {
    const ctx = this.ctx;
    const availableWidth = Math.max(0, viewportWidth - 12 - x);
    const { size, gap } = moduleHudMetrics(modules.length, availableWidth, maxSize);
    let cursor = x;
    for (const module of modules) {
      if (cursor + size > viewportWidth - 12) break;
      const pulse = (this.modulePulseUntil.get(module.id) ?? 0) > nowMs;
      const scale = pulse ? 1.1 : 1;
      const drawSize = size * scale;
      const half = drawSize / 2;
      const cx = cursor + size / 2;
      const cy = y + size / 2;

      let fraction = 1;
      let label = '';
      if (module.lifetime.kind === 'charges') {
        fraction =
          module.lifetime.maximum > 0 ? module.lifetime.remaining / module.lifetime.maximum : 0;
        label = String(module.lifetime.remaining);
      } else {
        const total = Math.max(1, module.lifetime.expiresAtTick - module.lifetime.acquiredAtTick);
        fraction = Math.max(0, (module.lifetime.expiresAtTick - tick) / total);
        label = `${Math.max(0, Math.ceil((module.lifetime.expiresAtTick - tick) / 20))}s`;
      }
      const low = fraction <= 0.2;

      // O CARD e o badge inteiro: nada sobra para fora dele. O anel que
      // orbitava o quadrado a 3 px de distancia encostava no vizinho a cada
      // fileira cheia, e num painel de tela pequena os dois aneis viravam um
      // so. A carga restante agora e o NIVEL que sobe pelo fundo do card,
      // como uma bateria: a leitura e a mesma ("quanto ainda tenho"), e cabe
      // dentro da propria moldura.
      ctx.save();
      ctx.beginPath();
      const radius = Math.max(3, Math.round(size * 0.14));
      ctx.moveTo(cx - half + radius, cy - half);
      ctx.lineTo(cx + half - radius, cy - half);
      ctx.quadraticCurveTo(cx + half, cy - half, cx + half, cy - half + radius);
      ctx.lineTo(cx + half, cy + half - radius);
      ctx.quadraticCurveTo(cx + half, cy + half, cx + half - radius, cy + half);
      ctx.lineTo(cx - half + radius, cy + half);
      ctx.quadraticCurveTo(cx - half, cy + half, cx - half, cy + half - radius);
      ctx.lineTo(cx - half, cy - half + radius);
      ctx.quadraticCurveTo(cx - half, cy - half, cx - half + radius, cy - half);
      ctx.closePath();
      ctx.fillStyle = 'rgba(11,14,20,0.84)';
      ctx.fill();
      // O nivel: recorta pelo card, para o preenchimento herdar os cantos.
      ctx.clip();
      const levelH = (drawSize - 2) * Math.min(1, Math.max(0, fraction));
      const levelTop = cy + half - 1 - levelH;
      ctx.fillStyle = low ? 'rgba(255,209,102,0.62)' : 'rgba(89,242,194,0.5)';
      ctx.fillRect(cx - half + 1, levelTop, drawSize - 2, levelH);
      // A linha d'agua: um fio mais claro na borda do nivel, para o olho ler a
      // altura sem comparar dois tons de verde.
      if (fraction > 0 && fraction < 1) {
        ctx.fillStyle = low ? PAL.loot : PAL.biolum;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(cx - half + 1, levelTop, drawSize - 2, 1);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // A moldura: fina em repouso, branca e grossa no pulso de instalacao,
      // ambar quando a carga esta no fim.
      ctx.strokeStyle = pulse ? PAL.player : low ? PAL.loot : 'rgba(232,241,255,0.42)';
      ctx.lineWidth = pulse ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx - half + radius, cy - half);
      ctx.lineTo(cx + half - radius, cy - half);
      ctx.quadraticCurveTo(cx + half, cy - half, cx + half, cy - half + radius);
      ctx.lineTo(cx + half, cy + half - radius);
      ctx.quadraticCurveTo(cx + half, cy + half, cx + half - radius, cy + half);
      ctx.lineTo(cx - half + radius, cy + half);
      ctx.quadraticCurveTo(cx - half, cy + half, cx - half, cy + half - radius);
      ctx.lineTo(cx - half, cy - half + radius);
      ctx.quadraticCurveTo(cx - half, cy - half, cx - half + radius, cy - half);
      ctx.closePath();
      ctx.stroke();

      // O glifo, um pouco acima do centro para deixar o canto de baixo ao
      // numero — e pintado em DUAS passagens, recortadas pela linha d'agua.
      // Acima do nivel ele e claro sobre o fundo escuro; abaixo, escuro sobre
      // a carga. Com a carga pela metade, metade do icone e de cada cor, e
      // ele continua legivel em qualquer fracao — um icone de uma cor so
      // sumiria justamente na faixa em que se confunde com o preenchimento.
      const glyphY = cy - Math.round(size * 0.06);
      const spinning = module.id === 'minigun' && minigunPhase > 0 && !prefersReducedMotion();
      const paintGlyph = (color: string, clipTop: number, clipBottom: number): void => {
        if (clipBottom <= clipTop) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - half, clipTop, drawSize, clipBottom - clipTop);
        ctx.clip();
        if (spinning) {
          // Gira em torno do proprio centro. O angulo e INTEGRADO a partir da
          // rotacao autoritativa (`minigun-view.ts`), e nao lido dela nem de
          // `nowMs`: a rotacao satura em 1 durante a rajada — usa-la como
          // angulo deixaria o icone parado no pico —, e um relogio proprio
          // faria o icone girar durante o travamento, que e exatamente o
          // instante em que ele tem de estar parando.
          ctx.translate(cx, glyphY);
          ctx.rotate(minigunPhase * Math.PI * 2);
          drawModuleGlyph(ctx, module.id, 0, 0, size * 0.4, color);
        } else {
          drawModuleGlyph(ctx, module.id, cx, glyphY, size * 0.4, color);
        }
        ctx.restore();
      };
      paintGlyph(low ? PAL.loot : PAL.biolum, cy - half, levelTop);
      paintGlyph(PAL.dark, levelTop, cy + half);

      // O numero no canto de baixo, com fundo: o glifo e o nivel passam por
      // tras dele, e "80" sobre um arco fosforo nao se le.
      ctx.font = `bold ${Math.max(8, Math.round(size * 0.3))}px monospace`;
      const labelW = ctx.measureText(label).width;
      const labelRight = cx + half - 2;
      const labelBaseline = cy + half - 3;
      ctx.fillStyle = 'rgba(11,14,20,0.88)';
      ctx.fillRect(labelRight - labelW - 1, labelBaseline - 8, labelW + 2, 10);
      ctx.fillStyle = low ? PAL.loot : PAL.bone;
      ctx.textAlign = 'right';
      ctx.fillText(label, labelRight, labelBaseline);
      cursor += size + gap;
    }
  }

  /**
   * Painel nao-bloqueante de escolha privada do jogador local.
   *
   * A composicao vive em salvage-choice-presentation.ts: carcaca Aurix, CRT,
   * cabecalho com a CLASSE do cofre de origem (derivada de sourceSiteId +
   * salvageSites — nenhum campo novo de protocolo) e os dois compartimentos
   * com os cartuchos fisicos. Os retangulos devolvidos continuam sendo
   * EXATAMENTE os cards de moduleChoiceLayout — o contrato de acerto do
   * input nao mudou. O boot (~400 ms de tinta apos choiceRevealAt) nunca
   * atrasa a interacao nem a simulacao por baixo.
   */
  renderChoice(
    state: SurvivalState,
    vw: number,
    vh: number,
    input?: InputState,
    nowMs: number = typeof performance !== 'undefined' ? performance.now() : 0,
  ): Array<{ x: number; y: number; w: number; h: number }> {
    const pending = state.playerExtra.pendingModuleChoice;
    if (!pending) return [];
    const ctx = this.ctx;
    const reserveTouch = input?.usingTouch ? Math.min(190, vh * 0.28) : 0;
    const layout = salvageTerminalLayout(vw, vh, this.safeArea, reserveTouch);
    const boot = choiceBootPhase(nowMs, this.choiceRevealAt);

    ctx.fillStyle = 'rgba(11,14,20,0.38)';
    ctx.fillRect(0, 0, vw, vh);

    drawRecoveryTerminal(
      ctx,
      layout,
      {
        cacheTier: choiceSourceTier(state.salvageSites, pending.sourceSiteId),
        integrityPercent: dataIntegrityPercent(pending.sourceSiteId),
      },
      boot,
      nowMs,
    );
    pending.options.forEach((id, index) => {
      const active = state.playerExtra.activeModules.some((module) => module.id === id);
      const card = layout.cards[index];
      drawModuleChoiceCard(ctx, card, { id, index, active }, boot, nowMs);
      // De ONDE o cartucho vai voar quando este for o escolhido. Guardado no
      // proprio desenho: o layout depende da viewport, do modo de toque e das
      // margens seguras, e recalcula-lo no voo divergiria em alguma tela.
      this.choiceCardCenters.set(id, {
        x: card.x + card.w / 2,
        y: card.y + card.h * 0.36,
        at: nowMs,
      });
    });
    // Os embelezamentos de vidro (vinheta, reflexo) seguem a qualidade; o
    // conteudo — classe, tier, cartucho, CTA — nunca depende dela.
    drawCrtOverlay(ctx, layout, boot, this.quality.bloom);
    return layout.cards;
  }

  /**
   * Tela de resultado — o documento de fim de contrato da Aurix (doc AD-UI-2.0).
   *
   * Morte e o RELATORIO DE PERDA DE UNIDADE; extracao e a LIQUIDACAO DE
   * CONTRATO. O mesmo conteudo de sempre, agora dentro de uma moldura de
   * formulario: cabecalho com codigo de documento, causa como "CAUSA PROVAVEL"
   * e licao como "RECOMENDACAO DE CAMPO". Vermelho so aparece na perda.
   *
   * Desenha o SUMARIO congelado, nunca o estado vivo: `state` continua sendo o
   * objeto real depois do fim da run, e ler a contaminacao dele aqui daria um
   * numero mudando enquanto o jogador o le.
   *
   * A ordem vertical e a ordem de leitura, e ela e deliberada:
   *   1. o que aconteceu (titulo + estrelas)
   *   2. POR QUE aconteceu (causa + licao) -- a razao de a tela existir
   *   3. o que voce fez (numeros)
   *   4. o que falta para a proxima estrela
   *   5. a seed, para repetir esta mesma descida
   *   6. as duas saidas: descer de novo ou voltar ao terminal
   *
   * A ordem tambem e a da ANIMACAO: a nota se carimba enquanto o resto do
   * documento ja esta lido, e `nowMs` e o unico relogio dela — nao ha rAF
   * proprio, porque esta tela ja e redesenhada a cada quadro.
   *
   * Devolve onde os dois botoes ficaram, para o laco saber o que um toque
   * acertou; `null` quando nao ha sumario — ou quando quem chamou dispensou o
   * rodape (`actions: false`), e nao ha botao nenhum a acertar.
   */
  /**
   * Ha uma queda no buraco em curso?
   *
   * Publico porque a Arena de Chefes tem a PROPRIA tela de resultado (um
   * overlay de HTML, fora do canvas) e ela precisa da mesma espera que
   * `renderEnd` ja faz por conta propria — senao a ferramenta que existe para
   * testar a queda seria a unica que nao a mostra.
   */
  plungeActive(nowMs: number): boolean {
    return this.presentation.plungeActive(nowMs);
  }

  renderEnd(
    state: SurvivalState,
    vw: number,
    vh: number,
    nowMs: number,
    opts: EndScreenOptions = {},
  ): EndActionRegions | null {
    const { input, actions = true } = opts;
    const summary = state.summary;
    if (!summary) return null;
    // A TELA DE RESULTADO ESPERA A QUEDA TERMINAR.
    //
    // Afundar num buraco encerra a run no MESMO tick em que a animacao comeca, e
    // sem esta espera o documento de fim entrava por cima do Prospector no
    // primeiro quadro — o jogador lia "o gelo cedeu debaixo de voce" sem nunca
    // ter visto o gelo ceder, e a unica apresentacao que explica esta morte
    // ficava atras de um painel opaco.
    //
    // Aqui e nao nos cinco chamadores: a regra e da tela, e um chamador novo que
    // esquecesse dela reintroduziria o defeito em silencio. Devolver `null` e o
    // que os chamadores ja tratam (nao ha sumario para tocar), entao a espera
    // tambem desarma os botoes — ninguem pode acertar "descer de novo" atras de
    // uma animacao que ainda esta rodando.
    if (this.presentation.plungeActive(nowMs)) return null;
    // O relogio da animacao nasce no primeiro quadro DESTE sumario.
    //
    // A chave e feita de campos congelados, e nao da identidade do objeto: no
    // co-op cada snapshot desserializa uma copia nova da mesma run terminal, e
    // comparar referencias reiniciaria o carimbo a cada quadro — as estrelas
    // ficariam caindo para sempre, sem nunca pousar.
    const key = `${summary.seed}:${summary.phase}:${summary.ticks}`;
    if (key !== this.endScreenKey) {
      this.endScreenKey = key;
      this.endScreenAt = nowMs;
    }
    const ctx = this.ctx;
    const outcome = describeOutcome(summary);
    const lost = summary.phase === 'dead';
    // A paleta Aurix da folha de documento. Local ao metodo: o resto do jogo
    // continua na paleta do mundo (PAL), e o documento e a UNICA superficie
    // que fala na paleta corporativa.
    const AX = {
      gold: '#c9a35a',
      goldDim: '#a2854a',
      brass: '#4a3a1e',
      redLine: '#6b2a20',
      redText: '#e6a99f',
      teal: '#4fd6c9',
      ink: '#cfc6b4',
      inkBright: '#e2d9c6',
      inkMute: '#9a9184',
    } as const;
    const colors = { blood: AX.redText, loot: AX.gold, biolum: AX.teal } as const;

    ctx.fillStyle = 'rgba(10, 10, 11, 0.9)';
    ctx.fillRect(0, 0, vw, vh);

    const cause = describeCause(summary.deathCause);
    const lines = summaryLines(summary);
    const half = Math.ceil(lines.length / 2);
    const hint = nextStarHint(summary);
    const record = reputationNote(summary);
    const cargo = cargoNote(summary);

    // Escala tipografica MEDIDA, nao estimada. Toda a geometria vertical desta
    // tela e linear em `unit`, entao a altura necessaria e uma soma de
    // coeficientes vezes `unit` — e quando ela nao cabe (paisagem de 360px com
    // o caso completo: nove metricas, carga, registro, dica e reinicio), um
    // unico fator de escala devolve o maior `unit` que cabe. Sem laco e sem
    // corte: o documento encolhe inteiro em vez de perder a ultima linha.
    const margin = Math.max(8, Math.min(22, vw * 0.02));
    // Coeficientes na ordem do desenho: ascendente do titulo, a nota, causa
    // (rotulo + manchete), licao (rotulo + frase), respiro, numeros, carga,
    // registro, dica e o rodape de acoes (respiro + botoes + folga). Os dois
    // blocos novos trazem o proprio coeficiente do modulo que os desenha, para
    // a conta e o desenho nunca discordarem — esquecer um deles aqui nao muda
    // nada no desktop e corta o rodape inteiro numa paisagem de 320px.
    const blockUnits =
      1.4 +
      STARS_UNITS +
      1.6 +
      0.9 +
      (cause.lesson ? 1.95 : 0) +
      2 +
      half * 1.25 +
      (cargo ? 1.45 : 0) +
      (record ? 1.45 : 0) +
      (hint ? 0.6 : 0) +
      // Sem rodape, so a folga do descendente da ultima linha: reservar a
      // altura dos botoes que nao serao desenhados centraria o documento em
      // volta de um vazio.
      (actions ? ACTIONS_UNITS : 0.5);
    // Cabecalho (2.8) + respiro minimo antes do conteudo (1.6) + bloco.
    const neededUnits = 2.8 + 1.6 + blockUnits;
    const unitBase = Math.max(10, Math.min(20, vh / 24));
    const unit = Math.max(7, Math.min(unitBase, (vh - margin * 2) / neededUnits));

    // A moldura do formulario: 1px de latao (perda: vermelho), com keyline
    // interna escura — a mesma gramatica das folhas em DOM.
    ctx.strokeStyle = lost ? AX.redLine : AX.brass;
    ctx.lineWidth = 1;
    ctx.strokeRect(margin + 0.5, margin + 0.5, vw - margin * 2 - 1, vh - margin * 2 - 1);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeRect(margin + 1.5, margin + 1.5, vw - margin * 2 - 3, vh - margin * 2 - 3);

    // Cabecalho do documento: titulo a esquerda, estrelas a direita, regua.
    const headY = margin + unit * 1.4;
    ctx.textAlign = 'left';
    ctx.fillStyle = lost ? AX.redText : AX.gold;
    ctx.font = `bold ${Math.round(unit * 0.8)}px monospace`;
    ctx.fillText(t(lost ? 'summary.doc.loss' : 'summary.doc.settlement'), margin + unit, headY);
    ctx.fillStyle = AX.goldDim;
    ctx.font = `${Math.round(unit * 0.6)}px monospace`;
    // Serial de documento: cromo neutro de lingua (codigos nao se traduzem),
    // numa variavel para a varredura de sumidouros nao o ler como prosa.
    const docSerial = lost ? 'AD-PU-0114' : 'AD-LQ-0114';
    ctx.fillText(
      `${docSerial} · ${t('summary.seed', { seed: formatSeed(summary.seed) })}`,
      margin + unit,
      headY + unit * 0.85,
    );
    // A nota SAIU do cabecalho. Ela morava aqui, em onze pixels, na cor do
    // numero de serie: o resultado da descida entregue como cromo de papel
    // timbrado, do lado oposto de onde o olho le. Agora ela e um bloco proprio
    // no corpo do documento, carimbada uma a uma — e repeti-la no canto so
    // faria a resposta chegar antes da animacao que a conta.
    const ruleY = headY + unit * 1.4;
    ctx.strokeStyle = lost ? AX.redLine : AX.brass;
    ctx.beginPath();
    ctx.moveTo(margin + 1, ruleY);
    ctx.lineTo(vw - margin - 1, ruleY);
    ctx.stroke();

    ctx.textAlign = 'center';

    // Centraliza o bloco no espaco que sobra abaixo da regua; com o `unit`
    // ajustado acima, o minimo nunca empurra a ultima linha para fora.
    // `y` e a linha de base do titulo; o bloco comeca 1.4·unit acima dela
    // (o ascendente ja contado em `blockUnits`).
    const blockHeight = blockUnits * unit;
    let y = Math.max(
      ruleY + unit * 1.6,
      ruleY + (vh - margin - ruleY - blockHeight) / 2 + unit * 1.4,
    );

    ctx.fillStyle = colors[outcome.color];
    ctx.font = `bold ${Math.round(unit * 1.7)}px monospace`;
    ctx.fillText(outcome.title, vw / 2, y);

    // A nota, logo abaixo do titulo: o que aconteceu e QUANTO valeu, na mesma
    // altura do olho. Ela se carimba sozinha a partir do relogio do quadro.
    this.drawStarRow(summary, vw, y + unit * STAR_TOP_GAP_UNITS, unit, margin, nowMs, {
      filled: AX.gold,
      socket: AX.brass,
      ring: AX.teal,
      sweep: AX.inkBright,
      strike: AX.redText,
    });
    y += unit * STARS_UNITS;

    // Causa e licao: o motivo de esta tela existir, na voz do formulario.
    y += unit * 1.6;
    ctx.fillStyle = AX.goldDim;
    ctx.font = `${Math.round(unit * 0.6)}px monospace`;
    ctx.fillText(t('summary.doc.cause'), vw / 2, y);
    y += unit * 0.9;
    ctx.fillStyle = AX.inkBright;
    ctx.font = `bold ${Math.round(unit)}px monospace`;
    ctx.fillText(cause.headline, vw / 2, y);
    if (cause.lesson) {
      y += unit * 1.1;
      ctx.fillStyle = AX.goldDim;
      ctx.font = `${Math.round(unit * 0.6)}px monospace`;
      ctx.fillText(t('summary.doc.recommendation'), vw / 2, y);
      y += unit * 0.85;
      ctx.fillStyle = AX.ink;
      ctx.font = `${Math.round(unit * 0.85)}px monospace`;
      ctx.fillText(cause.lesson, vw / 2, y);
    }

    // Numeros em duas colunas de livro-caixa: uma coluna unica de oito linhas
    // nao cabe em landscape de celular.
    //
    // A largura da coluna e MEDIDA, nao chutada. Um valor fixo em `unit` colidia
    // rotulo com numero exatamente nas linhas mais longas ("Contaminação 62%"
    // saia como "Contamina62%o") — e sao justamente as que o jogador procura.
    y += unit * 2;
    const statFont = `${Math.round(unit * 0.85)}px monospace`;
    ctx.font = statFont;
    let labelW = 0;
    let valueW = 0;
    for (const line of lines) {
      labelW = Math.max(labelW, ctx.measureText(line.label).width);
      valueW = Math.max(valueW, ctx.measureText(line.value).width);
    }
    const colW = labelW + valueW + unit * 1.2; // folga entre rotulo e numero
    const gap = unit * 1.6;
    const startX = vw / 2 - (colW * 2 + gap) / 2;
    const colX = [startX, startX + colW + gap];

    for (let i = 0; i < lines.length; i++) {
      const col = i < half ? 0 : 1;
      const row = i < half ? i : i - half;
      const lineY = y + row * unit * 1.25;
      ctx.textAlign = 'left';
      ctx.fillStyle = AX.inkMute;
      ctx.fillText(lines[i].label, colX[col], lineY);
      ctx.textAlign = 'right';
      ctx.fillStyle = AX.inkBright;
      ctx.fillText(lines[i].value, colX[col] + colW, lineY);
      // A linha pontilhada do livro-caixa, no vao entre rotulo e numero.
      const dotStart = colX[col] + ctx.measureText(lines[i].label).width + 5;
      const dotEnd = colX[col] + colW - ctx.measureText(lines[i].value).width - 5;
      if (dotEnd > dotStart) {
        ctx.strokeStyle = 'rgba(51, 41, 29, 0.9)';
        ctx.setLineDash([1, 3]);
        ctx.beginPath();
        ctx.moveTo(dotStart, lineY);
        ctx.lineTo(dotEnd, lineY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.textAlign = 'center';
    y += half * unit * 1.25;

    // A CARGA vem primeiro, antes do registro e da dica.
    //
    // E a linha que ensina o loop: numa morte ela diz o que ficou no Veio, e a
    // cor faz metade do trabalho — vermelho de perda contra o teal do que foi
    // transmitido. Depois de uma extracao ela anuncia a transmissao; o numero
    // creditado chega pelo banner quando o servidor responde.
    if (cargo) {
      y += unit * 0.6;
      ctx.fillStyle = cargo.tone === 'lost' ? AX.redText : AX.teal;
      ctx.font = statFont;
      ctx.fillText(cargo.text, vw / 2, y);
      y += unit * 0.85;
    }

    // O registro vem ANTES da dica de estrela e em vermelho: ele nao e um
    // conselho de como jogar melhor, e a unica linha desta tela que so constata.
    if (record) {
      y += unit * 0.6;
      ctx.fillStyle = AX.redText;
      ctx.font = statFont;
      ctx.fillText(record, vw / 2, y);
      y += unit * 0.85;
    }

    if (hint) {
      y += unit * 0.6;
      ctx.fillStyle = AX.gold;
      ctx.font = statFont;
      ctx.fillText(hint, vw / 2, y);
    }

    // As duas saidas. Descer de novo continua sendo a primeira — e a resposta
    // certa para a morte rapida, e vem a esquerda, onde a leitura termina — mas
    // ela nao e mais a UNICA: o minerio desta run so vira Matriz no terminal, e
    // parar de jogar tem de ser um botao, nao o X da aba.
    //
    // Teal em quem age, latao em quem sai: a mesma gramatica de cor do resto do
    // documento, onde o teal e sempre "o proximo gesto do operador".
    if (!actions) return null;
    const regions = layoutEndActions(vw, y + unit * TOP_GAP_UNITS, unit, margin);
    this.drawEndButton(
      regions.restart,
      t('summary.action.restart'),
      KEY_RESTART,
      AX.teal,
      unit,
      input,
    );
    this.drawEndButton(
      regions.terminal,
      t('summary.action.terminal'),
      KEY_TERMINAL,
      AX.gold,
      unit,
      input,
    );
    return regions;
  }

  /**
   * A nota da run, carimbada.
   *
   * Os soquetes vazios entram primeiro para a fileira ter forma; depois cada
   * estrela conquistada CAI sobre o seu, esmaga um fio abaixo do tamanho final
   * e abre um anel de impacto. Nota cheia ganha um brilho que atravessa a
   * fileira uma vez. Nota zero — que so acontece na morte — recebe a linha
   * vermelha de recusa por cima dos tres soquetes.
   *
   * O quando de tudo isso mora em `run-stars`, testavel em Node; aqui so se
   * pinta o que aquele modulo diz que existe neste instante.
   */
  private drawStarRow(
    summary: RunSummary,
    vw: number,
    top: number,
    unit: number,
    margin: number,
    nowMs: number,
    palette: { filled: string; socket: string; ring: string; sweep: string; strike: string },
  ): void {
    const ctx = this.ctx;
    const elapsed = nowMs - this.endScreenAt;
    const reduced = prefersReducedMotion();
    const row = starRowLayout(vw, top, unit, margin);
    const stars = summary.stars;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(row.size)}px monospace`;

    // Os soquetes: o lugar onde a nota CABERIA. Sao eles que dao ao jogador de
    // duas estrelas a informacao de que existe uma terceira.
    ctx.globalAlpha = socketAlpha(elapsed, reduced) * 0.75;
    ctx.fillStyle = palette.socket;
    for (const cx of row.centers) ctx.fillText(STAR_EMPTY, cx, row.cy);

    for (let i = 0; i < stars; i++) {
      const stamp = starStamp(elapsed, i, reduced);
      if (stamp.alpha <= 0) continue;
      ctx.globalAlpha = stamp.alpha;
      ctx.fillStyle = palette.filled;
      ctx.save();
      ctx.translate(row.centers[i], row.cy);
      ctx.scale(stamp.scale, stamp.scale);
      ctx.fillText(STAR_FILLED, 0, 0);
      ctx.restore();
      if (stamp.ring > 0) {
        // O anel nasce colado no glifo e some ao abrir: e o baque do carimbo,
        // nao um enfeite que fica.
        ctx.globalAlpha = (1 - stamp.ring) * 0.55;
        ctx.strokeStyle = palette.ring;
        ctx.lineWidth = Math.max(1, unit * 0.12);
        ctx.beginPath();
        ctx.arc(row.centers[i], row.cy, row.size * (0.34 + stamp.ring * 0.75), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // O brilho da nota cheia: uma luz que ATRAVESSA a fileira, uma vez.
    //
    // Por queda de intensidade por estrela, e nao por faixa recortada: a faixa
    // corta o glifo no meio e le como uma emenda: a queda acende cada estrela
    // conforme a luz passa por ela, que e o que uma luz faz. A subida de escala
    // e o mesmo gesto — o metal parece levantar quando a luz bate.
    const sweep = sweepProgress(elapsed, stars, reduced);
    if (sweep > 0) {
      const span = row.centers[STAR_COUNT - 1] - row.centers[0];
      const reach = row.size * 1.3;
      const x = row.centers[0] - reach + sweep * (span + reach * 2);
      const janela = Math.sin(sweep * Math.PI);
      ctx.fillStyle = palette.sweep;
      for (const cx of row.centers) {
        const intensidade = Math.max(0, 1 - Math.abs(cx - x) / reach) * janela;
        if (intensidade <= 0.01) continue;
        ctx.globalAlpha = intensidade;
        ctx.save();
        ctx.translate(cx, row.cy);
        ctx.scale(1 + intensidade * 0.12, 1 + intensidade * 0.12);
        ctx.fillText(STAR_FILLED, 0, 0);
        ctx.restore();
      }
    }

    // A recusa: sem nota nenhuma, a companhia risca o campo.
    const strike = strikeProgress(elapsed, stars, reduced);
    if (strike > 0) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = palette.strike;
      ctx.lineWidth = Math.max(1, unit * 0.14);
      // Um fio abaixo do centro do bloco de texto: e onde fica o centro OPTICO
      // do glifo, e uma linha que passa pelo topo das estrelas parece
      // sublinhado torto, nao um risco.
      const strikeY = row.cy + row.size * 0.08;
      ctx.beginPath();
      ctx.moveTo(vw / 2 - row.half, strikeY);
      ctx.lineTo(vw / 2 - row.half + row.half * 2 * strike, strikeY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  /**
   * Um botao da tela de fim: moldura, rotulo e a tecla que faz o mesmo.
   *
   * A tecla so aparece para quem tem teclado. No celular ela seria a UI
   * ensinando um gesto impossivel, bem no lugar onde o polegar ja esta.
   */
  private drawEndButton(
    rect: Rect,
    label: string,
    key: string,
    color: string,
    unit: number,
    input?: InputState,
  ): void {
    const ctx = this.ctx;
    // O preenchimento e quase nada de proposito: o documento inteiro e linha
    // fina sobre preto, e um botao solido aqui leria como outra aplicacao.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    // A tecla mora na borda direita, na mesma linha do rotulo — e uma etiqueta
    // do botao, nao uma segunda frase. Empilhada embaixo ela colidiria com o
    // descendente do rotulo na altura que este botao tem (duas unidades).
    const showKey = !input?.usingTouch;
    const keyRoom = showKey ? unit * 1.3 : 0;

    // O rotulo cabe SEMPRE: num botao estreito ele encolhe em vez de vazar por
    // cima da moldura ou por cima da tecla — e "VOLTAR AO TERMINAL" e a linha
    // mais longa da tela.
    let size = unit * 0.8;
    ctx.font = `bold ${Math.round(size)}px monospace`;
    const maxWidth = rect.w - unit * 0.7 - keyRoom;
    const measured = ctx.measureText(label).width;
    if (measured > maxWidth) {
      size = Math.max(unit * 0.4, (size * maxWidth) / measured);
      ctx.font = `bold ${Math.round(size)}px monospace`;
    }
    const baseline = rect.y + rect.h / 2 + size * 0.36;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(label, rect.x + (rect.w - keyRoom) / 2, baseline);
    if (showKey) {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(154, 145, 132, 0.85)';
      ctx.font = `${Math.round(unit * 0.6)}px monospace`;
      ctx.fillText(key, rect.x + rect.w - unit * 0.45, baseline);
      ctx.textAlign = 'center';
    }
  }
}
