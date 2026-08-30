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
  SURF_GLASS,
  SURF_RAIL,
  SURF_SILT,
  SURF_RAIL_V,
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
  HEAT_MAX,
  MINIGUN_SPIN_FIRE_AT,
  MINIGUN_SPIN_MAX,
  RICOCHET_BOUNCES,
  liveProjectileModules,
  moduleHasCapacity,
  countCoresTaken,
  furnaceSweepAt,
  isDeluged,
  delugeFront,
  isPipe,
  FURNACE_OVERHEATING,
  WELL_OFFER_REACH,
} from '@voxelyn/survival-sim';
import { AIM_JOYSTICK_RADIUS, MOVE_JOYSTICK_RADIUS, type InputState } from './input';
import type {
  AbilityId,
  ActiveModule,
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
import { VoxelParticles, frameDeltaMs, hitMaterialOf } from './particles';
import { DAMAGE_FAN, damageAlpha, damageScale, drawDamageNumber } from './damage-text';
import { ProjectileView, SMALL_PROJECTILE_RADIUS } from './projectiles';
import { EntityPresentation } from './presentation';
import { HEAT_WARN_AT } from './audio/ambience';
import { PRESETS, type QualityLevel, type QualityPreset } from './settings';
import { TouchIconBank } from './touch-icons';
import { addFlash, flashPower, pruneFlashes, type Flash } from './flash';
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
import type { FaceLighting } from './sprites';
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
import {
  moduleChoiceLayout,
  rewardFlightPosition,
  type Rect,
  type SafeInsets,
} from './module-layout';
import { CasingField } from './casings';
import { MinigunViews } from './minigun-view';
import { ModulePropField, type PropOrigin } from './module-props';
import { drawGenerationMarks, marksFor } from './prospector-generation';
import { RouteMemory, drawSurveyHud, drawSurveyWorld, hasSurvey } from './survey-overlay';
import {
  TargetMotion,
  combatTuningOf,
  drawCombatSenseWorld,
  hasCombatSense,
} from './combat-assist';
import type { ProspectorGeneration } from '@voxelyn/survival-sim';
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
};

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
};

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
export const moduleHudMetrics = (count: number, availableWidth: number): ModuleHudMetrics => {
  const normalizedCount = Math.max(0, Math.floor(count));
  if (normalizedCount <= 0) return { size: 30, gap: 7 };
  if (normalizedCount === 1) return { size: Math.max(24, Math.min(30, availableWidth)), gap: 0 };

  const baseGap = 7;
  const size = Math.max(
    24,
    Math.min(30, Math.floor((availableWidth - baseGap * (normalizedCount - 1)) / normalizedCount)),
  );
  const remaining = Math.max(0, availableWidth - size * normalizedCount);
  const gap = Math.max(3, Math.min(baseGap, remaining / (normalizedCount - 1)));
  return { size, gap };
};

// Paleta da art bible (docs/art/voxelyn-survival-art-bible.md)
const PAL = {
  dark: '#0b0e14',
  rockShadow: '#1d2430',
  rock: '#2e3a4d',
  rockLight: '#46566e',
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
const drawLurkerDisturbance = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  z: number,
  nowMs: number,
  entityId: number,
  inWater: boolean,
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
  // Gelo: tres rachaduras curtas em leque, comprimento respirando devagar.
  const breath = 0.75 + 0.25 * Math.sin(nowMs / 480 + seed);
  ctx.strokeStyle = 'rgba(123,139,163,0.55)';
  ctx.lineWidth = Math.max(1, z);
  for (let c = 0; c < 3; c++) {
    const angle = ((seed + c * 331) % 628) / 100; // 0..2π deterministico
    const len = size * (1 + c * 0.35) * breath;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    // Achata no eixo Y: a rachadura vive na lamina isometrica, nao de pe.
    ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.5);
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
  const seed =
    (Math.imul(Math.round(sx * 3) + Math.imul(Math.round(sy * 3), 131), 2654435761) >>> 0) % 628;
  ctx.strokeStyle = `rgba(123,139,163,${(0.42 * fade).toFixed(3)})`;
  ctx.lineWidth = Math.max(1, z * 0.8);
  for (let c = 0; c < 2; c++) {
    const angle = ((seed + c * 271) % 628) / 100;
    const len = size * (0.7 + c * 0.35);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.5);
    ctx.stroke();
  }
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

const drawPurgeCellGlyph = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void => {
  const u = Math.max(1, Math.floor(size / 8));
  ctx.fillStyle = 'rgba(11,14,20,0.92)';
  ctx.fillRect(cx - 3 * u, cy - 4 * u, 6 * u, 8 * u);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, u);
  ctx.strokeRect(cx - 3 * u, cy - 4 * u, 6 * u, 8 * u);
  ctx.fillStyle = color;
  ctx.fillRect(cx - 2 * u, cy - 2 * u, 4 * u, u);
  ctx.fillRect(cx - u, cy, 2 * u, 3 * u);
  ctx.fillStyle = PAL.player;
  ctx.fillRect(cx - u, cy - 3 * u, 2 * u, u);
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
  kind: 'blast' | 'stalactite';
};

export const pendingGroundMarkers = (state: {
  config: { width: number };
  bossRuntime: { collapseCells: readonly { idx: number; at: number }[]; blastCells: readonly number[] };
  enemies: readonly { alive: boolean; action?: { kind: string; releaseAt: number } }[];
}): GroundMarker[] => {
  const w = state.config.width;
  const out: GroundMarker[] = [];
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
    const at = state.enemies.find((e) => e.alive && e.action?.kind === 'demolish')?.action?.releaseAt;
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
  messages: Array<{ text: string; startsAt?: number; until: number }> = [];
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
  /** A Ruptura do setor atual (ou null), cacheada junto com a decoracao. */
  private rupture: { x: number; y: number } | null = null;
  /** Proxima posicao do leque de numeros de dano. */
  private damageFanIndex = 0;
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
   * A geracao do Prospector LOCAL, para os marcos visuais.
   *
   * Vem do perfil autoritativo, e nao da run: a run nao carrega a arvore, so o
   * tuning derivado dela. Isso mantem o desenho ignorante de metaprogressao — ele
   * recebe uma etiqueta e desenha.
   *
   * O parceiro do co-op continua em G-00 enquanto o modo for padronizado; quando
   * a geracao viajar no protocolo, e aqui que ela entra.
   */
  private localGeneration: ProspectorGeneration = 'G-00';
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
    this.zoom = window.innerWidth < 700 ? 1.6 : 2;
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
    this.bossModuleMarks.clear();
    // O Levantamento e memoria da RUN pela mesma razao, e o detalhe que torna
    // isso obrigatorio: a run nova comeca no setor 1, como a anterior terminou.
    // `trackSector` compara NUMEROS e sairia cedo, deixando o beacon de SV-01
    // sem disparar e a memoria de rota mostrando os saloes da run passada.
    this.route.reset();
    this.lastSector = 0;
    this.sectorEnteredAtMs = 0;
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

  /** A geracao do chassi local. Puramente cosmetica: nao toca hitbox nem sim. */
  setProspectorGeneration(generation: ProspectorGeneration): void {
    this.localGeneration = generation;
  }

  ingestEvents(events: SemanticEvent[], nowMs: number): void {
    this.presentation.ingest(events, nowMs);
    // As particulas nascem dos MESMOS eventos autoritativos que os FX antigos.
    // O cliente nunca decide que houve explosao — so a desenha.
    this.particles.budget = this.quality.maxFx * 2;
    this.particles.ingest(events, this.worldWidth, this.quality.maxFx / PRESETS.high.maxFx);
    for (const ev of events) {
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
            this.addFlash(cx / ev.cells.length, cy / ev.cells.length, 5.5, 0.95, nowMs, 200, PAL.electric);
          }
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
        case 'pulse':
          // O pulso e CINETICO: desloca ar, nao queima. Luz branca — ele revela a sala
          // sem tingir nada, que e a diferenca visivel entre ele e uma detonacao.
          this.addFlash(ev.x, ev.y, ABILITY_RADIUS * 2, 0.75, nowMs, 200, LIGHT_NEUTRAL);
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
          this.messages.push({ text: t('toast.well.resonance'), until: nowMs + 3400 });
          break;
        case 'ability_taken':
          this.addFlash(ev.x, ev.y, 3, 0.9, nowMs, 320);
          this.messages.push({
            text: t('toast.ability.assimilated', {
              ability: abilityPresentation(ev.ability).label,
            }),
            until: nowMs + 2600,
          });
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
          this.messages.push({ text: t('toast.guardian.awake'), until: nowMs + 3000 });
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
          this.messages.push({ text: t('toast.furnace.cooled'), until: nowMs + 3200 });
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
          this.modulePulseUntil.set(ev.module, nowMs + 260);
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
          this.messages.push({
            text: t('toast.module.expired', { module: modulePresentation(ev.module).label }),
            until: nowMs + 1800,
          });
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
            Math.imul(ev.slot + 1, 0x9e3779b9) ^ Math.imul(ev.rounds, 0x85ebca6b) ^ this.casingSalt++,
            this.quality.maxFx / PRESETS.high.maxFx,
          );
          break;
        case 'salvage_cache_opened':
          this.messages.push({ text: t('toast.cache.opened'), until: nowMs + 2200 });
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
        case 'purge_cell_acquired':
          if (ev.slot === this.localPlayerId - 1) {
            const startsAt = nowMs + 220;
            this.messages.push({ text: t('toast.purgeCell'), startsAt, until: startsAt + 2200 });
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
          this.messages.push({ text: t('toast.scan.complete'), until: nowMs + 2800 });
          break;
        case 'overheat':
          this.messages.push({ text: t('toast.overheat'), until: nowMs + 1600 });
          break;
        case 'message':
          // A simulacao manda a CHAVE, nunca a frase: ela roda tambem no
          // servidor (verificacao de replay), onde nao existe idioma de
          // jogador. Traduzir e trabalho de quem desenha.
          this.messages.push({ text: t(ev.key), until: nowMs + 3600 });
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
              lights.push({ x: x + 0.5, y: y + 0.5, r: 3.2, power: breathe, hex: PAL.electric, height: 0.7 });
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
        const surfKind = surf === SURF_GAS ? 0 : SURFACE_KIND_INDEX[surf];
        if (surfKind === undefined || !this.surfaces.draw(ctx, surfKind, x, y, b, nowMs, sx, sy, z)) {
          diamond(sx, sy, shade(SURFACE_FALLBACK[surf] ?? PAL.rockShadow, 0.35 + b * 0.75));
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
          diamond(sx, sy, `rgba(46,58,77,${(0.28 + b * 0.16).toFixed(3)})`);
          if (crest > 0) {
            diamond(sx, sy, `rgba(150,190,225,${(crest * 0.4).toFixed(3)})`);
          }
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
            const a = mid - sweep.arc + ((sweep.arc * 2) * s) / STEPS;
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
        const lead = mark.kind === 'stalactite' ? STALACTITE_LEAD_TICKS : BLAST_LEAD_TICKS;
        const progress = Math.max(0, Math.min(1, 1 - remaining / lead));
        const [msx, msy] = toScreen(mark.x, mark.y);
        const rx = mark.radius * TILE_W * 0.5 * z;
        const ry = mark.radius * TILE_H * 0.5 * z;
        ctx.save();
        // O anel EXTERNO nao se move: ele diz onde. O interno fecha: ele diz
        // quando. Separar as duas leituras e o que permite decidir a rota sem
        // ficar medindo o relogio.
        ctx.strokeStyle = mark.kind === 'stalactite' ? 'rgba(255,166,63,0.55)' : 'rgba(217,59,76,0.55)';
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
                  ctx, name, nowMs, csx, csy, z,
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
        const entryChain = entryAtlasChain(
          objectiveViewOf(state),
          state.stratum,
          state.occupation,
        );
        items.push({
          depth: state.entry.x + state.entry.y,
          draw: () => {
            for (const name of entryChain) {
              if (
                this.props.draw(
                  ctx, name, nowMs, esx, esy, z,
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
                ctx, prop, nowMs, tsx, tsy, z,
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
              ctx, atlasName, nowMs, dsx, dsy - lift, z,
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
    for (const enemy of state.enemies) {
      this.archetypeById.set(enemy.id, enemy.archetype);
      if (!enemy.alive) continue;
      const b = brightness(enemy.x, enemy.y);
      if (b <= 0.05) continue;
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
      items.push({
        depth: enemy.x + enemy.y,
        draw: () => {
          const [sx, sy] = toScreen(enemy.x, enemy.y);
          const size = enemy.radius * TILE_W * 0.9 * z;
          // O ARCO do Devorador. A simulacao nao tem altura — nao ha colisao em
          // z — entao ela viaja como TEMPO, no vao da acao de salto, e vira
          // pixel aqui. `sy` continua sendo o chao (e onde a sombra e a
          // profundidade da fila moram); so o corpo sobe.
          const leap =
            enemy.action?.kind === 'leap'
              ? leapHeight(leapProgress(state.tick, enemy.action.startedAt, enemy.action.releaseAt))
              : 0;
          const bodyY = sy - leap * LEAP_PEAK_PX * z;
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
            );
            if (enemy.stunnedUntil > state.tick) {
              drawStunIndicator(ctx, sx, sy, size, z, enemy.id, state.tick);
            }
            return;
          }
          drawShadow(sx, sy, size * leapShadowScale(leap), leapShadowAlpha(leap));
          const drew = this.sprites.drawEntity(
            ctx,
            enemy.archetype,
            presented.anim,
            presented.facingX,
            presented.facingY,
            presented.elapsedMs,
            sx,
            bodyY,
            spriteZoom,
            // Um sheet de frames fixos nao sabe o humor da entidade, e o
            // mineiro enfurecido precisa ler como enfurecido A DISTANCIA. O
            // gancho de tint que ja existia para o elite serve exatamente para
            // isso — e vermelho contra o laranja do elite mantem as duas
            // marcacoes distinguiveis.
            enemy.archetype === 'miner' && enemy.mood === MINER_MOOD_ENRAGED
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
                  : undefined,
            // A LUZ DO MUNDO sobre a casca do bicho. Separada do tint acima de
            // proposito: aquele conta um ESTADO da criatura (elite, enfurecida,
            // colapsando) e este conta o que esta acontecendo AO REDOR dela. Se
            // dividissem o mesmo canal, uma explosao apagaria a marcacao de
            // elite justamente no instante de maior confusao na tela.
            bodyLight(enemy.x, enemy.y, CREATURE_RESPONSE),
            bodyFaceLight(enemy.x, enemy.y, CREATURE_RESPONSE),
          );
          if (!drew) {
            drawVoxelEntity(ctx, {
              sx,
              sy: bodyY,
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
          drawHealthBar(sx, bodyY - size * 2.1 - 5 * z, size, enemy.hp / enemy.maxHp);
        },
      });
    }

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
      );
      // Superaquecimento: o corpo TREME e o cano solta fumaca preta.
      //
      // O tremor e do corpo inteiro e nao da arma. Quem trava o gatilho e o
      // Prospector, nao o cano — ele acabou de tomar dano do proprio tiro, e um
      // sinal que morasse so na arma seria mais um enfeite dela. Poucos pixels,
      // em fase de tempo real e nao de quadro: a 120Hz um tremor por quadro
      // viraria chuvisco e a 30Hz um pulo.
      const overheating = state.tick < ex.overheatedUntil;
      const shakeX = overheating ? Math.sin(nowMs / 26 + slot) * 1.15 * z : 0;
      const shakeY = overheating ? Math.sin(nowMs / 17 + slot * 2) * 0.7 * z : 0;
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
              const drew = this.sprites.drawEntity(
                ctx,
                'prospector',
                presented.anim,
                presented.facingX,
                presented.facingY,
                presented.elapsedMs,
                psx,
                psy,
                spriteZoom,
                // parceiro (nao-local) recebe leve tint frio para diferenciar
                isLocal ? undefined : { color: 'rgba(89,242,194,0.30)', alpha: 0.3 },
                // O CHASSI E LATAO USINADO: o unico corpo polido que anda pela
                // tela, e por isso o unico que devolve um realce concentrado em
                // vez de um veu. E ele que faz o proprio tiro do jogador acender
                // a armadura ao sair — a arma esta montada no ombro direito, e o
                // estilhaco nasce a um palmo dela.
                bodyLight(pl.x, pl.y, CHASSIS_RESPONSE),
                bodyFaceLight(pl.x, pl.y, CHASSIS_RESPONSE),
              );
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
              // Os marcos geracionais vao DEPOIS do corpo, por cima dele, e so
              // no Prospector local: o parceiro do co-op e padronizado enquanto
              // o modo for G-00, e desenhar a geracao de quem nao a tem seria
              // mentir sobre o que aquela unidade pode fazer.
              //
              // Nada aqui toca `pl.radius` — a colisao e a mesma em G-00 e G-04.
              if (isLocal) {
                drawGenerationMarks(
                  ctx,
                  marksFor(this.localGeneration),
                  psx,
                  psy,
                  z,
                  presented.facingX,
                  nowMs,
                );
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

    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) item.draw();

    // A luz ambiente do estrato entra AQUI: por cima do mundo e das criaturas,
    // por baixo de particulas, numeros de dano e HUD.
    drawBiomeVeil(ctx, state.stratum, vw, vh);

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
    key: 'leyline.node.route' | 'leyline.node.unroute' | 'leyline.source.launch' | 'leyline.source.again',
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

    const extra = state.playerExtra;
    const safeTop = this.safeArea.top + 10;
    const safeLeft = this.safeArea.left + 12;
    const hasModules = extra.activeModules.length > 0;
    const panelW = Math.min(300, Math.max(230, vw * 0.34));
    const sectorY = safeTop + (hasModules ? 112 : 84);
    const biomeY = sectorY + 14;
    const objectiveY = biomeY + 18;
    // O painel nao reserva mais a linha do cofre: o localizador de cofre vive
    // no topo-centro (ver renderHud), e a caixa-preta encosta mais alto.
    const panelH = objectiveY - safeTop + 13;
    const region = deathEchoReadoutRegion(vw, vh, this.safeArea, {
      x: safeLeft,
      y: safeTop,
      width: panelW,
      height: panelH,
    });
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
    const target = { x: this.cargoCounterX, y: this.safeArea.top + 61 };
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
        const heat =
          pending.module === 'minigun'
            ? Math.min(1, extra.heat / HEAT_MAX)
            : 0;
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
    const hudFallback = { x: this.safeArea.left + 30, y: this.safeArea.top + 80 };
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
    const target = { x: this.safeArea.left + 30, y: this.safeArea.top + 67 };
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
    drawPurgeCellGlyph(ctx, 0, 0, 18 + Math.sin(sample.progress * Math.PI) * 4, PAL.biolum);
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
    const safeTop = this.safeArea.top + 10;
    const safeLeft = this.safeArea.left + 12;
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

    const hasModules = extra.activeModules.length > 0;
    const panelW = Math.min(300, Math.max(230, vw * 0.34));
    const moduleY = safeTop + 68;
    const sectorY = safeTop + (hasModules ? 112 : 84);
    const biomeY = sectorY + 14;
    const objectiveY = biomeY + 18;
    // O espaco vertical do antigo texto de cofre foi DEVOLVIDO ao painel: o
    // localizador vive no topo-centro e nao ocupa mais uma linha aqui.
    const panelH = objectiveY - safeTop + 13;

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

    roundedPanel(safeLeft, safeTop, panelW, panelH, 12);
    ctx.fillStyle = 'rgba(11,14,20,0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,241,255,0.32)';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    // Coracao voxel + HP numerico: a vida do jogador vive somente aqui.
    const heartX = safeLeft + 20;
    const heartY = safeTop + 21;
    ctx.fillStyle = state.player.hp / state.player.maxHp > 0.35 ? PAL.fungusLight : PAL.blood;
    ctx.fillRect(heartX - 8, heartY - 7, 6, 6);
    ctx.fillRect(heartX + 2, heartY - 7, 6, 6);
    ctx.fillRect(heartX - 10, heartY - 3, 20, 7);
    ctx.fillRect(heartX - 6, heartY + 4, 12, 4);
    ctx.fillRect(heartX - 2, heartY + 8, 4, 4);

    const hpFrac = Math.max(0, Math.min(1, state.player.hp / state.player.maxHp));
    const hpBarX = safeLeft + 42;
    const hpBarY = safeTop + 14;
    const hpBarW = panelW - 54;
    const hpBarH = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
    ctx.fillStyle = hpFrac > 0.35 ? PAL.fungusLight : PAL.blood;
    ctx.fillRect(hpBarX + 1, hpBarY + 1, (hpBarW - 2) * hpFrac, hpBarH - 2);
    ctx.strokeStyle = 'rgba(232,241,255,0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);
    ctx.fillStyle = PAL.player;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${Math.max(0, Math.ceil(state.player.hp))} / ${Math.ceil(state.player.maxHp)}`,
      hpBarX + hpBarW - 5,
      hpBarY + 11,
    );

    // Calor permanece legivel, mas como trilho secundario dentro do mesmo painel.
    const heatFrac = Math.min(1, extra.heat / HEAT_MAX);
    const overheated = state.tick < extra.overheatedUntil;
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(hpBarX, safeTop + 32, hpBarW, 4);
    // Acima do limiar a barra PULSA, na mesma fronteira em que o tique de aviso
    // comeca a soar. Sem isso as duas leituras contariam historias diferentes: o
    // audio calaria num ponto que a barra nao mostra, e o jogador atribuiria o
    // silencio a sorte em vez de a um limite que ele pode aprender.
    const warning = !overheated && heatFrac > HEAT_WARN_AT;
    ctx.globalAlpha = warning ? 0.72 + 0.28 * Math.sin(nowMs / 90) : 1;
    ctx.fillStyle = overheated ? PAL.blood : PAL.fire;
    ctx.fillRect(hpBarX, safeTop + 32, hpBarW * heatFrac, 4);
    ctx.globalAlpha = 1;
    // A marca do limiar fica visivel com o trilho VAZIO. Ela e o que informa que
    // existe um ponto de virada antes de o jogador chegar nele — depois de
    // atingido, quem avisa ja e o tique.
    ctx.fillStyle = 'rgba(232,241,255,0.45)';
    ctx.fillRect(hpBarX + Math.round(hpBarW * HEAT_WARN_AT), safeTop + 31, 1, 6);

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
    const minigunEquipped = extra.activeModules.some((module) => module.id === 'minigun');
    const spinFrac = extra.minigun.spin / MINIGUN_SPIN_MAX;
    if (minigunEquipped || spinFrac > 0) {
      const spinY = safeTop + 37;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(hpBarX, spinY, hpBarW, 2);
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
      ctx.fillRect(hpBarX, spinY, hpBarW * spinFrac, 2);
      // A marca do limiar operacional: o ponto a partir do qual sai bala.
      ctx.fillStyle = 'rgba(232,241,255,0.5)';
      ctx.fillRect(
        hpBarX + Math.round((hpBarW * MINIGUN_SPIN_FIRE_AT) / MINIGUN_SPIN_MAX),
        spinY - 1,
        1,
        4,
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
        ctx.fillText(label, hpBarX + hpBarW, spinY - 4);
        ctx.textAlign = 'left';
      }
    }

    ctx.strokeStyle = 'rgba(232,241,255,0.17)';
    ctx.beginPath();
    ctx.moveTo(safeLeft + 12, safeTop + 43);
    ctx.lineTo(safeLeft + panelW - 12, safeTop + 43);
    ctx.stroke();

    const purgePulse = nowMs < this.purgePulseUntil;
    const purgeY = safeTop + 57;
    ctx.font = `bold ${purgePulse ? 13 : 12}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = purgePulse ? PAL.biolum : PAL.bone;
    drawPurgeCellGlyph(ctx, safeLeft + 18, purgeY, purgePulse ? 15 : 13, ctx.fillStyle as string);
    ctx.fillText(t('hud.purgeCells', { count: extra.purgeCells }), safeLeft + 34, purgeY + 4);

    // A carga fica na MESMA linha da purga, encostada a direita do painel: os
    // dois sao recursos que o jogador carrega, e uma linha propria custaria
    // altura de HUD num painel que ja disputa espaco com os modulos.
    const cargoPulse = nowMs < this.cargoPulseUntil;
    const cargoRight = safeLeft + panelW - 12;
    ctx.textAlign = 'right';
    ctx.font = `bold ${cargoPulse ? 13 : 12}px monospace`;
    ctx.fillStyle = cargoPulse ? PAL.bone : PAL.loot;
    const cargoLabel = t('hud.cargo', { count: this.cargoOre });
    ctx.fillText(cargoLabel, cargoRight, purgeY + 4);
    this.cargoCounterX = cargoRight - ctx.measureText(cargoLabel).width - 9;
    drawOreGlyph(ctx, this.cargoCounterX, purgeY, cargoPulse ? 15 : 13, ctx.fillStyle as string);
    ctx.textAlign = 'left';

    if (hasModules) {
      this.renderModuleHud(
        extra.activeModules,
        state.tick,
        nowMs,
        safeLeft + 12,
        moduleY,
        safeLeft + panelW,
        this.minigunViews.get(this.localPlayerId - 1).barrelPhase,
      );
    }

    const lowerDividerY = safeTop + (hasModules ? 104 : 75);
    ctx.strokeStyle = 'rgba(232,241,255,0.17)';
    ctx.beginPath();
    ctx.moveTo(safeLeft + 12, lowerDividerY);
    ctx.lineTo(safeLeft + panelW - 12, lowerDividerY);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = PAL.rockLight;
    ctx.font = '11px monospace';
    // O denominador e o TOTAL ACESSIVEL desta run, e nunca o maximo potencial
    // da linhagem. Uma expedicao de G-01 mostra "SETOR 3/3" e le como completa;
    // mostrar "3/7" a faria parecer truncada por uma area perdida que ela nunca
    // teve autorizacao para ver.
    const runSectors = state.config.depth.sectorCount;
    ctx.fillText(
      t('hud.sector', { sector: state.sector, total: runSectors }),
      safeLeft + 12,
      sectorY,
    );

    // O estrato/ocupacao logo abaixo do numero: menor e mais apagado, porque e
    // contexto e nao objetivo. Fonte 9px para o nome composto mais longo
    // ("CATEDRAL PRISMÁTICA · MATRIZ MICELIAL") caber no painel compacto.
    ctx.fillStyle = PAL.bone;
    ctx.font = '9px monospace';
    ctx.fillText(biomeLabel(state.stratum, state.occupation), safeLeft + 12, biomeY);

    // Instrumentacao de Levantamento: mapa de saloes visitados e previsao de
    // onda. Depois do bioma porque sao a leitura MAIS lenta do painel — quem
    // consulta um mapa nao esta no meio de uma luta.
    const nav = state.config.tuning.navigation;
    if (nav.routeMemory || nav.contaminationForecast) {
      drawSurveyHud(ctx, state, nav, this.route, safeLeft + 12, biomeY + 6, nowMs);
    }

    // NUCLEOS: so aparece quando a run tem mais de um, e ai ele e a informacao
    // que decide se vale continuar descendo. Numa run de um Nucleo a linha
    // seria ruido — o objetivo logo abaixo ja diz tudo.
    const coreSectors = state.config.depth.coreSectors;
    const hudObjective = objectiveViewOf(state);
    if (coreSectors.length > 1) {
      ctx.fillStyle = PAL.biolum;
      ctx.font = '9px monospace';
      ctx.fillText(
        t('hud.cores', {
          taken: countCoresTaken(state),
          total: coreSectors.length,
        }),
        safeLeft + 12,
        biomeY + 9,
      );
    }

    ctx.fillStyle = PAL.loot;
    ctx.font = 'bold 12px monospace';
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
    const objectiveKey = hudObjective.sealedByBoss
      ? 'hud.objective.breakSeal'
      : hudObjective.returning
        ? state.sector > 1
          ? 'hud.objective.ascend'
          : 'hud.objective.extract'
        : hudObjective.hasCore && !hudObjective.coreTakenHere
          ? 'hud.objective.findCore'
          : 'hud.objective.descend';
    ctx.fillText(t(objectiveKey), safeLeft + 12, objectiveY);

    // mensagens centrais
    this.messages = this.messages.filter((m) => m.until > nowMs);
    const visibleMessages = this.messages.filter((m) => (m.startsAt ?? 0) <= nowMs);
    ctx.textAlign = 'center';
    let my = Math.max(this.safeArea.top + 28, vh * 0.2);
    for (const m of visibleMessages.slice(-3)) {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const tw = ctx.measureText(m.text).width;
      ctx.fillRect(vw / 2 - tw / 2 - 8, my - 14, tw + 16, 20);
      ctx.fillStyle = PAL.bone;
      ctx.fillText(m.text, vw / 2, my);
      my += 26;
    }

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
  ): void {
    const ctx = this.ctx;
    const availableWidth = Math.max(0, viewportWidth - 12 - x);
    const { size, gap } = moduleHudMetrics(modules.length, availableWidth);
    let cursor = x;
    for (const module of modules) {
      if (cursor + size > viewportWidth - 12) break;
      const pulse = (this.modulePulseUntil.get(module.id) ?? 0) > nowMs;
      const scale = pulse ? 1.12 : 1;
      const drawSize = size * scale;
      const cx = cursor + size / 2;
      const cy = y + size / 2;
      ctx.fillStyle = 'rgba(11,14,20,0.72)';
      ctx.fillRect(cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize);
      ctx.strokeStyle = PAL.player;
      ctx.lineWidth = pulse ? 2.5 : 1.5;
      ctx.strokeRect(cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize);
      if (module.id === 'minigun' && minigunPhase > 0 && !prefersReducedMotion()) {
        // Gira em torno do proprio centro. O angulo e INTEGRADO a partir da
        // rotacao autoritativa (`minigun-view.ts`), e nao lido dela nem de
        // `nowMs`: a rotacao satura em 1 durante a rajada — usa-la como
        // angulo deixaria o icone parado no pico —, e um relogio proprio
        // faria o icone girar durante o travamento, que e exatamente o
        // instante em que ele tem de estar parando.
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(minigunPhase * Math.PI * 2);
        drawModuleGlyph(ctx, module.id, 0, 0, size * 0.47, PAL.biolum);
        ctx.restore();
      } else {
        drawModuleGlyph(ctx, module.id, cx, cy, size * 0.47, PAL.biolum);
      }

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
      ctx.strokeStyle = fraction <= 0.2 ? PAL.loot : PAL.biolum;
      ctx.lineWidth = fraction <= 0.2 ? 3 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2 + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
      ctx.stroke();
      ctx.fillStyle = PAL.bone;
      ctx.font = `bold ${Math.max(8, Math.round(size * 0.3))}px monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(label, cursor + size - 2, y + size - 2);
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
