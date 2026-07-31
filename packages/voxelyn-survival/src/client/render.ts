import {
  SOLID_CRYSTAL,
  SOLID_CRYSTAL_DULL,
  SOLID_FRAGILE,
  SOLID_FRAGILE_WEAK,
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
  ABILITY_RADIUS,
  HEAT_MAX,
  SECTOR_COUNT,
  WELL_OFFER_REACH,
  isFinalSector,
} from '@voxelyn/survival-sim';
import { AIM_JOYSTICK_RADIUS, MOVE_JOYSTICK_RADIUS, type InputState } from './input';
import type { AbilityId, ActiveModule, ModuleId, SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { SpriteBank, SurfaceBank, TerrainBank, deriveAnim, type EntityAnimState,
  PropBank,
} from './sprites';
import { VoxelParticles, frameDeltaMs, hitMaterialOf } from './particles';
import { DAMAGE_FAN, damageAlpha, damageScale, drawDamageNumber } from './damage-text';
import { ProjectileView, SMALL_PROJECTILE_RADIUS } from './projectiles';
import { EntityPresentation } from './presentation';
import { PRESETS, type QualityLevel, type QualityPreset } from './settings';
import { TouchIconBank } from './touch-icons';
import { addFlash, flashPower, pruneFlashes, type Flash } from './flash';
import { drawVoxel, type FaceRamp } from './voxel-draw';
import { drawVoxelEntity } from './voxel-fallback';
import { modulePresentation } from './module-presentation';
import { abilityPresentation } from './ability-presentation';
import { moduleChoiceLayout, rewardFlightPosition, type Rect, type SafeInsets } from './module-layout';
import {
  describeCause,
  describeOutcome,
  formatSeed,
  nextStarHint,
  reputationNote,
  summaryLines,
} from './run-summary';
import { objectiveLightSpec, objectivePropName } from './objective-prop';
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
};

/**
 * SURF_* -> indice em SURFACE_KINDS do atlas de chao. Pela mesma razao da tabela
 * acima: a cadeia de ifs que existia aqui tratava tres dos seis casos e deixava
 * os outros caindo no ramo da rocha nua sem que nada acusasse.
 */
const SURFACE_KIND_INDEX: Record<number, number> = {
  [SURF_NONE]: 0,
  [SURF_FUNGAL]: 1,
  [SURF_BIOFLUID]: 2,
  [SURF_GAS]: 3,
  [SURF_FIRE]: 4,
  [SURF_SCORCHED]: 5,
  [SURF_SPORES]: 6,
  [SURF_FUNGAL_HEATED]: 7,
};

/**
 * Cor de recuo por superficie, para quando o atlas ainda nao carregou ou falhou.
 *
 * Nao e a arte: e o minimo para o jogador nao pisar num gas invisivel enquanto a
 * imagem nao chega. A arte de verdade e o voxel do atlas.
 */
const SURFACE_FALLBACK: Record<number, string> = {
  [SURF_FUNGAL]: '#1f3d33',
  [SURF_BIOFLUID]: '#2f6b4f',
  // Amarelo-esverdeado, e da paleta mestra: o oliva anterior nao existia nela e
  // apontava para o lado errado agora que a crosta de gas e enxofre.
  [SURF_GAS]: '#a8e63c',
  [SURF_FIRE]: '#ff7a2f',
  [SURF_SCORCHED]: '#0b0e14',
  [SURF_SPORES]: '#66c28a',
  [SURF_FUNGAL_HEATED]: '#6e4a33',
};

export const TILE_W = 32;
export const TILE_H = 16;
const WALL_H = 14;

export type ModuleHudMetrics = { size: number; gap: number };

/** Mantem todos os modulos visiveis dentro da largura compacta do painel. */
export const moduleHudMetrics = (count: number, availableWidth: number): ModuleHudMetrics => {
  const normalizedCount = Math.max(0, Math.floor(count));
  if (normalizedCount <= 0) return { size: 30, gap: 7 };
  if (normalizedCount === 1) return { size: Math.max(24, Math.min(30, availableWidth)), gap: 0 };

  const baseGap = 7;
  const size = Math.max(24, Math.min(30, Math.floor(
    (availableWidth - baseGap * (normalizedCount - 1)) / normalizedCount
  )));
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
  | { kind: 'ring'; x: number; y: number; r: number; maxR: number; color: string; life: number; maxLife: number }
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
 * Ate onde a faixa de mira alcanca antes de bater em pedra.
 *
 * Pura e exportada para o teste poder conferir o caso que importa — a faixa
 * parando NA parede e nao atras dela — sem precisar de um canvas.
 */
export const aimLaneReach = (
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  isSolid: (x: number, y: number) => boolean,
  maxLength = AIM_LANE_LENGTH
): number => {
  const length = Math.hypot(dirX, dirY);
  if (length < 1e-6) return 0;
  const nx = dirX / length;
  const ny = dirY / length;
  for (let d = AIM_LANE_STEP; d <= maxLength; d += AIM_LANE_STEP) {
    if (isSolid(originX + nx * d, originY + ny * d)) return d - AIM_LANE_STEP;
  }
  return maxLength;
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
export const stunIndicatorOffsets = (entityId: number, tick: number): readonly [number, number][] => {
  const phase = ((tick + entityId * 3) % 8) * (Math.PI / 4);
  return [
    [Math.cos(phase), Math.sin(phase) * 0.45],
    [Math.cos(phase + Math.PI), Math.sin(phase + Math.PI) * 0.45],
  ];
};

const drawStunIndicator = (
  ctx: CanvasRenderingContext2D, sx: number, sy: number, size: number, z: number, entityId: number, tick: number
): void => {
  const lift = size * 2.25 + 6 * z;
  for (const [ox, oy] of stunIndicatorOffsets(entityId, tick)) {
    drawVoxel(ctx, sx + ox * size * 0.75, sy - lift + oy * size, Math.max(2, 2.6 * z), CHARGE_RAMP);
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
  light: number
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
  ctx.fillRect(Math.round(sx - visor / 2), Math.round(cy - visor / 2), visor, Math.max(2, visor * 0.6));
};

const drawModuleGlyph = (
  ctx: CanvasRenderingContext2D,
  id: ModuleId,
  cx: number,
  cy: number,
  size: number,
  color: string
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
    for (const [dx, dy] of [[0,-5],[0,5],[-5,0],[5,0],[-4,-4],[4,-4],[-4,4],[4,4]]) {
      ctx.fillRect(cx + dx * u - u / 2, cy + dy * u - u / 2, u, u);
    }
  } else if (id === 'siphon') {
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(cx - u, cy - 4 * u, 2 * u, 8 * u);
    ctx.fillRect(cx - 4 * u, cy - u, 8 * u, 2 * u);
  } else if (id === 'ricochet') {
    ctx.beginPath();
    ctx.moveTo(cx - 4 * u, cy + 3 * u);
    ctx.lineTo(cx, cy - 2 * u);
    ctx.lineTo(cx + 4 * u, cy + 2 * u);
    ctx.stroke();
    ctx.fillRect(cx + 2 * u, cy, 3 * u, u);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 2 * u, Math.PI * 0.25, Math.PI * 1.75);
    ctx.stroke();
  }
};

const drawPurgeCellGlyph = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
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
  maxWidth: number
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
export const allyVisorGlow = (light: number): number =>
  1.6 - allyBodyAlpha(light) * 0.75;

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
  /** Proxima posicao do leque de numeros de dano. */
  private damageFanIndex = 0;
  private readonly touchIcons = new TouchIconBank();
  private readonly animStates = new Map<number, EntityAnimState>();
  private readonly presentation = new EntityPresentation();
  private readonly modulePulseUntil = new Map<ModuleId, number>();
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
  private purgePulseUntil = 0;
  private deathEchoes: DeathEchoFrame = emptyDeathEchoFrame();
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

  private animFor(id: number, x: number, y: number, hp: number, alive: boolean, nowMs: number): EntityAnimState {
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

  private addFlash(x: number, y: number, r: number, power: number, nowMs: number, durationMs: number): void {
    addFlash(this.flashes, { x, y, r, power, startedMs: nowMs, durationMs });
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
            this.addFlash(cx / ev.cells.length, cy / ev.cells.length, 5.5, 0.95, nowMs, 200);
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
            this.quality.maxFx / PRESETS.high.maxFx
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
          this.fxList.push({ kind: 'ring', x: ev.x, y: ev.y, r: 0.1, maxR: 0.9, color: PAL.blood, life: 260, maxLife: 260 });
          break;
        case 'pulse':
          this.addFlash(ev.x, ev.y, ABILITY_RADIUS * 2, 0.75, nowMs, 200);
          break;
        case 'flame_cone': {
          // O cone e desenhado como uma frente que ANDA: brasas nascem ao longo
          // do alcance, e nao um leque estatico. A chama que fica no chao ja e
          // superficie de verdade e se desenha sozinha — isto e so o sopro.
          this.addFlash(ev.x, ev.y, ev.range, 0.9, nowMs, 260);
          const steps = Math.max(3, Math.round(ev.range * 2));
          for (let i = 1; i <= steps; i++) {
            const reach = (ev.range * i) / steps;
            const spread = Math.tan(ev.arc) * reach;
            for (const side of [-1, 0, 1]) {
              this.particles.emitGas(
                ev.x + ev.dx * reach - ev.dy * spread * side * 0.6,
                ev.y + ev.dy * reach + ev.dx * spread * side * 0.6,
                nowMs,
                0.6,
              );
            }
          }
          this.shake = { power: 2, until: nowMs + 140 };
          break;
        }
        case 'arc_chain': {
          // Um anel curto em cada salto. A LINHA entre eles nao e desenhada: o
          // arco ja resolveu tudo num tick, e um raio persistente prometeria uma
          // duracao que a simulacao nao tem.
          for (const hop of ev.hops) {
            this.fxList.push({
              kind: 'ring', x: hop.x, y: hop.y, r: 0.1, maxR: 0.8,
              color: PAL.electric, life: 220, maxLife: 220,
            });
          }
          break;
        }
        case 'well_offers':
          this.messages.push({
            text: 'O VEIO RESSOA - DOIS ECOS DEMONSTRAM',
            until: nowMs + 3400,
          });
          break;
        case 'ability_taken':
          this.addFlash(ev.x, ev.y, 3, 0.9, nowMs, 320);
          this.messages.push({
            text: `${abilityPresentation(ev.ability).label} ASSIMILADO`,
            until: nowMs + 2600,
          });
          break;
        case 'dodge':
          this.fxList.push({ kind: 'ring', x: ev.x, y: ev.y, r: 0.1, maxR: 0.6, color: PAL.player, life: 180, maxLife: 180 });
          break;
        case 'pickup_core':
          this.messages.push({ text: 'NUCLEO EXTRAIDO - VOLTE PARA A ENTRADA!', until: nowMs + 4200 });
          this.shake = { power: 4, until: nowMs + 300 };
          break;
        case 'guardian_awake':
          this.messages.push({ text: 'O GUARDIAO DESPERTOU', until: nowMs + 3000 });
          this.shake = { power: 6, until: nowMs + 500 };
          break;
        case 'module_charge_consumed':
          this.modulePulseUntil.set(ev.module, nowMs + 260);
          break;
        case 'module_expired':
          this.messages.push({ text: `${modulePresentation(ev.module).label} DESATIVADO`, until: nowMs + 1800 });
          break;
        case 'salvage_cache_opened':
          this.messages.push({ text: 'COFRE RECUPERADO', until: nowMs + 2200 });
          this.addFlash(ev.x, ev.y, 4.5, 0.9, nowMs, 300);
          if (ev.slot === this.localPlayerId - 1) {
            this.pendingRewardOrigin = { slot: ev.slot, x: ev.x + 0.5, y: ev.y + 0.5 };
            this.choiceRevealAt = Math.max(this.choiceRevealAt, nowMs + 920);
          }
          break;
        case 'purge_cell_acquired':
          if (ev.slot === this.localPlayerId - 1) {
            const startsAt = nowMs + 220;
            this.messages.push({ text: '+1 CÉLULA DE PURGA', startsAt, until: startsAt + 2200 });
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
          this.messages.push({ text: 'VARREDURA CONCLUÍDA — COFRE REVELADO', until: nowMs + 2800 });
          break;
        case 'overheat':
          this.messages.push({ text: 'SUPERAQUECIMENTO!', until: nowMs + 1600 });
          break;
        case 'message':
          this.messages.push({ text: ev.text, until: nowMs + 3600 });
          break;
        default:
          break;
      }
    }
  }

  render(state: SurvivalState, alpha: number, input: InputState, nowMs: number): void {
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
    const objectiveName = objectivePropName(state.sector, state.coreTaken);
    const lights: Array<{ x: number; y: number; r: number; power: number }> = [
      { x: player.x, y: player.y, r: 8.5, power: 1 },
    ];
    const objectiveLight = objectiveLightSpec(state.sector, state.coreTaken);
    if (objectiveLight) {
      lights.push({
        x: state.corePos.x + 0.5,
        y: state.corePos.y + 0.5,
        r: objectiveLight.radius,
        power: objectiveLight.power,
      });
    }

    // Clarões de explosao, descarga e pulso. Entram FORA do `if
    // (quality.dynamicLights)`: no preset baixo o jogo abre mao das luzes
    // permanentes de fogo e cristal, que sao ambientacao, mas nao da luz que
    // revela o que acabou de detonar ao lado do jogador — sao poucas, duram
    // fracao de segundo, e sem elas o preset baixo esconderia o perigo.
    this.flashes = pruneFlashes(this.flashes, nowMs);
    for (const f of this.flashes) {
      lights.push({ x: f.x, y: f.y, r: f.r, power: flashPower(f, nowMs) });
    }

    const range = Math.ceil((vw / z / TILE_W) + (vh / z / TILE_H)) + 4;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const x0 = Math.max(0, px - range);
    const x1 = Math.min(w - 1, px + range);
    const y0 = Math.max(0, py - range);
    const y1 = Math.min(h - 1, py + range);

    if (this.quality.dynamicLights) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * w + x;
          if (state.surface[i] === SURF_FIRE) lights.push({ x: x + 0.5, y: y + 0.5, r: 4, power: 0.8 });
          // Apenas o cristal VIVO ilumina. Opacado pelo acido ele continua na
          // tela com a mesma silhueta, mas o mapa escurece — que e exatamente a
          // perda que o jogador tem de sentir.
          else if (state.solid[i] === SOLID_CRYSTAL) lights.push({ x: x + 0.5, y: y + 0.5, r: 3.5, power: 0.55 });
        }
      }
      for (const c of state.charges) {
        lights.push({ x: (c.idx % w) + 0.5, y: Math.floor(c.idx / w) + 0.5, r: 3, power: 0.9 });
      }
    }

    const brightness = (x: number, y: number): number => {
      let b = 0.04;
      for (const light of lights) {
        const d = Math.hypot(x + 0.5 - light.x, y + 0.5 - light.y);
        if (d < light.r) b = Math.max(b, light.power * (1 - d / light.r));
      }
      return Math.min(1, b);
    };

    const shade = (hex: string, factor: number): string => {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.floor(((n >> 16) & 0xff) * factor);
      const g = Math.floor(((n >> 8) & 0xff) * factor);
      const bl = Math.floor((n & 0xff) * factor);
      return `rgb(${r},${g},${bl})`;
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
        const surfKind = surf === SURF_GAS ? 0 : (SURFACE_KIND_INDEX[surf] ?? 0);
        if (!this.surfaces.draw(ctx, surfKind, x, y, b, nowMs, sx, sy, z)) {
          diamond(sx, sy, shade(SURFACE_FALLBACK[surf] ?? PAL.rockShadow, 0.35 + b * 0.75));
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
    if (player.alive && !state.playerExtras[player.slot ?? 0].downed) {
      this.drawAimLane(state, player, toScreen, z);
    }

    // passo 2: paredes + entidades + projeteis, ordenados por profundidade
    type DrawItem = { depth: number; draw: () => void };
    const items: DrawItem[] = [];

    // Objetivos como OBJETOS, na fila de profundidade. O mesmo ponto logico
    // representa o poco nos setores intermediarios e o Nucleo no setor final,
    // mas cada um tem silhueta propria. Ambos precisam entrar nesta fila porque
    // levantam volume acima do piso e devem respeitar paredes e entidades.
    {
      const [csx, csy] = toScreen(state.corePos.x + 0.5, state.corePos.y + 0.5);
      if (csx > -80 && csx < vw + 80 && csy > -100 && csy < vh + 100) {
        items.push({
          depth: state.corePos.x + state.corePos.y,
          draw: () => {
            if (this.props.draw(ctx, objectiveName, nowMs, csx, csy, z)) return;

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
            ctx.fillStyle = objectiveName === 'coreTaken' ? PAL.rockShadow : shade(PAL.biolum, pulse);
            ctx.fillRect(csx - 4 * z, csy - 10 * z, 8 * z, 10 * z);
          },
        });
      }
      const [esx, esy] = toScreen(state.entry.x + 0.5, state.entry.y + 0.5);
      if (esx > -80 && esx < vw + 80 && esy > -100 && esy < vh + 100) {
        items.push({
          depth: state.entry.x + state.entry.y,
          draw: () => {
            if (this.props.draw(ctx, 'extraction', nowMs, esx, esy, z)) return;
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

        items.push({
          depth: x + y,
          draw: () => {
            // Bloco voxel pre-renderizado. Um drawImage substitui os tres fills
            // de poligono; o caminho de poligono abaixo continua como fallback
            // para quando o atlas ainda nao carregou ou falhou.
            // Espelha BLOCK_KINDS do atlas de terreno, na ordem em que o
            // gerador empacota os tipos.
            const kindIndex = TERRAIN_KIND_INDEX[solid] ?? 0;
            if (this.terrain.draw(ctx, kindIndex, x, y, b, sx, sy, z)) return;

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
            const prop = site.terminalState === 'scanning'
              ? 'salvageTerminalScanning'
              : site.terminalState === 'complete'
                ? 'salvageTerminalComplete'
                : 'salvageTerminalIdle';
            if (this.props.draw(ctx, prop, nowMs, tsx, tsy, z)) return;
            ctx.fillStyle = shade(PAL.rockLight, 0.45 + tb * 0.45);
            ctx.fillRect(tsx - 4 * z, tsy - 12 * z, 8 * z, 12 * z);
            ctx.fillStyle = site.terminalState === 'scanning' ? PAL.loot : site.terminalState === 'complete' ? PAL.biolum : PAL.rock;
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
          const prop = site.cacheOpened ? 'salvageCacheOpened' : 'salvageCache';
          if (this.props.draw(ctx, prop, nowMs, csx, csy, z)) return;
          ctx.fillStyle = shade(PAL.rock, 0.5 + cb * 0.4);
          ctx.fillRect(csx - 5 * z, csy - 5 * z, 10 * z, 5 * z);
          ctx.fillStyle = site.cacheOpened ? PAL.rockShadow : PAL.loot;
          ctx.fillRect(csx - 3 * z, csy - 4 * z, 6 * z, 2 * z);
        },
      });
    }

    // sombra de contato + barra de vida, comuns aos caminhos sprite e voxel
    const drawShadow = (sx: number, sy: number, size: number): void => {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
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

    const spriteZoom = Math.max(1, Math.round(z));

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

    this.archetypeById.clear();
    for (const pl of state.players) this.archetypeById.set(pl.id, 'prospector');
    for (const enemy of state.enemies) {
      this.archetypeById.set(enemy.id, enemy.archetype);
      if (!enemy.alive) continue;
      const b = brightness(enemy.x, enemy.y);
      if (b <= 0.05) continue;
      const anim = this.animFor(enemy.id, enemy.x, enemy.y, enemy.hp, enemy.alive, nowMs);
      const presented = this.presentation.animationFor(enemy, state, anim, nowMs);
      items.push({
        depth: enemy.x + enemy.y,
        draw: () => {
          const [sx, sy] = toScreen(enemy.x, enemy.y);
          const size = enemy.radius * TILE_W * 0.9 * z;
          drawShadow(sx, sy, size);
          const drew = this.sprites.drawEntity(
            ctx,
            enemy.archetype,
            presented.anim,
            presented.facingX,
            presented.facingY,
            presented.elapsedMs,
            sx,
            sy,
            spriteZoom,
            // Um sheet de frames fixos nao sabe o humor da entidade, e o
            // mineiro enfurecido precisa ler como enfurecido A DISTANCIA. O
            // gancho de tint que ja existia para o elite serve exatamente para
            // isso — e vermelho contra o laranja do elite mantem as duas
            // marcacoes distinguiveis.
            enemy.archetype === 'miner' && enemy.mood === MINER_MOOD_ENRAGED
              ? { color: 'rgba(217,59,76,0.45)', alpha: 0.45 }
              : enemy.elite
                ? { color: 'rgba(255,122,47,0.35)', alpha: 0.35 }
                : undefined
          );
          if (!drew) {
            drawVoxelEntity(ctx, {
              sx,
              sy,
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
                  state.surface[Math.floor(enemy.y) * state.config.width + Math.floor(enemy.x)] === SURF_FUNGAL) ||
                (enemy.archetype === 'miner' && enemy.mood === MINER_MOOD_ENRAGED),
            });
          }
          if (enemy.stunnedUntil > state.tick) {
            drawStunIndicator(ctx, sx, sy, size, z, enemy.id, state.tick);
          }
          if (enemy.elite && drew) {
            ctx.strokeStyle = PAL.fire;
            ctx.lineWidth = z;
            ctx.beginPath();
            ctx.ellipse(sx, sy, size * 1.05, size * 0.55, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          drawHealthBar(sx, sy - size * 2.1 - 5 * z, size, enemy.hp / enemy.maxHp);
        },
      });
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
      const presented = this.presentation.animationFor(pl, state, anim, nowMs, ex.downed);
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
              slot, pl.x, pl.y, nowMs, this.quality.maxFx / PRESETS.high.maxFx
            );
          }
          // O jogador local NUNCA some: a camera esta nele, e um Prospector
          // invisivel no proprio centro da tela e um jogo quebrado, nao uma
          // caverna escura. O parceiro obedece a luz como todo o resto do mundo.
          const allyLight = isLocal ? 1 : brightness(pl.x, pl.y);
          const bodyAlpha = isLocal ? 1 : allyBodyAlpha(allyLight);
          const flick = isLocal && ex.iframesUntil > state.tick && state.tick % 2 === 0;
          if (bodyAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = bodyAlpha;
            drawShadow(psx, psy, size);
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
                isLocal ? undefined : { color: 'rgba(89,242,194,0.30)', alpha: 0.3 }
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
            ctx, tombstone.archetype, 'die', tombstone.facingX, tombstone.facingY,
            elapsed, tsx, tsy, spriteZoom
          );
          if (!drew) {
            drawVoxelEntity(ctx, {
              sx: tsx, sy: tsy, z,
              radius: tombstone.archetype === 'guardian' ? 0.68 : 0.34,
              brightness: 0.7, archetype: tombstone.archetype,
              elite: false, nowMs,
            });
          }
        },
      });
    }

    // Direcao de voo vem do quadro anterior; o protocolo so carrega posicao e
    // a direcao serve apenas para inclinar o rastro, que e cosmetico.
    this.projectileView.sync(state.projectiles, nowMs);
    for (const proj of state.projectiles) {
      items.push({
        depth: proj.x + proj.y,
        draw: () => {
          this.projectileView.draw(ctx, proj, toScreen, z, TILE_H);
        },
      });
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
        drawDamageNumber(ctx, fx.text, sx, sy - 16 * z - t * 12 * z, fx.color, fx.scale, damageAlpha(t), z);
      }
    }

    this.renderRewardFlight(toScreen, nowMs);
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
  private drawAimLane(
    state: SurvivalState,
    player: SurvivalState['player'],
    toScreen: (x: number, y: number) => [number, number],
    z: number
  ): void {
    const ctx = this.ctx;
    const aim = state.playerExtras[player.slot ?? 0].aim;
    const length = Math.hypot(aim.x, aim.y);
    if (length < 1e-6) return;
    const nx = aim.x / length;
    const ny = aim.y / length;

    const w = state.config.width;
    const height = state.config.height;
    const reach = aimLaneReach(player.x, player.y, nx, ny, (x, y) => {
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      if (cx < 0 || cy < 0 || cx >= w || cy >= height) return true;
      return state.solid[cy * w + cx] !== SOLID_NONE;
    });
    // Comeca na borda do corpo: sob os pes do proprio Prospector a faixa nao
    // informa nada e ainda suja a silhueta dele.
    const start = Math.min(reach, player.radius + 0.15);
    if (reach - start < 0.2) return;

    const half = SMALL_PROJECTILE_RADIUS;
    // Perpendicular no MUNDO. Projetada depois, ela vira a largura correta na
    // tela em qualquer direcao.
    const px = -ny * half;
    const py = nx * half;

    // Duas faixas encaixadas: o corredor cheio, fraco, e um miolo mais forte.
    // O miolo e o que a vista pega de relance; o corredor e o que ela confere
    // quando o jogador quer mesmo saber se o inimigo esta dentro.
    const band = (widthScale: number, alpha: number, fade: number): void => {
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        const t0 = start + ((reach - start) * i) / steps;
        const t1 = start + ((reach - start) * (i + 1)) / steps;
        // Some para a frente: a faixa nao pode terminar num traco reto, que
        // leria como "o tiro para aqui" — e ele nao para.
        const segmentAlpha = alpha * (1 - (i / steps) * fade);
        const [ax, ay] = toScreen(player.x + nx * t0 + px * widthScale, player.y + ny * t0 + py * widthScale);
        const [bx, by] = toScreen(player.x + nx * t1 + px * widthScale, player.y + ny * t1 + py * widthScale);
        const [cx, cy] = toScreen(player.x + nx * t1 - px * widthScale, player.y + ny * t1 - py * widthScale);
        const [dx, dy] = toScreen(player.x + nx * t0 - px * widthScale, player.y + ny * t0 - py * widthScale);
        ctx.globalAlpha = segmentAlpha;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx, cy);
        ctx.lineTo(dx, dy);
        ctx.closePath();
        ctx.fill();
      }
    };

    ctx.save();
    ctx.fillStyle = PAL.biolum;
    band(1, 0.22, 0.85);
    band(0.34, 0.4, 0.85);
    ctx.restore();
    ctx.globalAlpha = 1;

    // Traco final atravessado na ponta: um alvo, e nao um fim de linha. Da a
    // faixa um ponto de leitura para quem mira "aquela distancia".
    const [tipLx, tipLy] = toScreen(player.x + nx * reach + px * 1.9, player.y + ny * reach + py * 1.9);
    const [tipRx, tipRy] = toScreen(player.x + nx * reach - px * 1.9, player.y + ny * reach - py * 1.9);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = PAL.biolum;
    ctx.lineWidth = Math.max(1, z * 0.9);
    ctx.beginPath();
    ctx.moveTo(tipLx, tipLy);
    ctx.lineTo(tipRx, tipRy);
    ctx.stroke();
    ctx.restore();
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
      ctx, 'prospector', 'idle', 0, 1, nowMs, sx, sy, spriteZoom,
      { color: presentation.color, alpha: 0.7 },
    );
    if (!drew) {
      ctx.fillStyle = presentation.color;
      ctx.fillRect(sx - 3 * z, sy - 16 * z, Math.max(2, 6 * z), Math.max(2, 16 * z));
      ctx.fillRect(sx - 4 * z, sy - 21 * z, Math.max(2, 8 * z), Math.max(2, 5 * z));
    }
    ctx.restore();

    const label = reachable ? `USAR — ${presentation.label}` : presentation.label;
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

  /** O convite a parear: aparece no escuro, porque é instrução e não matéria. */
  private drawDeathEchoPrompt(sx: number, sy: number, z: number, nowMs: number): void {
    const ctx = this.ctx;
    const label = 'USAR — PAREAR CAIXA-PRETA';
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
      ctx.fillRect(Math.round(px - z), Math.round(py - 10 * z), Math.max(1, 2 * z), Math.max(1, 2 * z));
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
    ctx.fillRect(Math.round(hx - 3 * z), Math.round(hy - 16 * z), Math.max(2, 6 * z), Math.max(2, 16 * z));
    ctx.fillRect(Math.round(hx - 4 * z), Math.round(hy - 21 * z), Math.max(2, 8 * z), Math.max(2, 5 * z));

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
    const revealed = state.salvageSites
      .filter((site) => site.cacheRevealed && !site.cacheOpened)
      .sort((a, b) => {
        const da = Math.hypot(a.cache.x + 0.5 - state.player.x, a.cache.y + 0.5 - state.player.y);
        const db = Math.hypot(b.cache.x + 0.5 - state.player.x, b.cache.y + 0.5 - state.player.y);
        return da - db;
      })[0];
    const hasModules = extra.activeModules.length > 0;
    const panelW = Math.min(300, Math.max(230, vw * 0.34));
    const sectorY = safeTop + (hasModules ? 112 : 84);
    const objectiveY = sectorY + 18;
    const cacheY = objectiveY + 17;
    const panelH = (revealed ? cacheY : objectiveY) - safeTop + 13;
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
    const lessonLines = readout.lesson
      ? wrapMeasuredText(ctx, readout.lesson, textWidth)
      : [];
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
    const x = region.align === 'right'
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
    lines.forEach((line, index) =>
      ctx.fillText(line, x + 12, bodyTop + index * lineHeight),
    );
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

  private renderRewardFlight(
    toScreen: (x: number, y: number) => [number, number],
    nowMs: number
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
      flight.durationMs
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

  private renderHud(state: SurvivalState, input: InputState, nowMs: number, vw: number, vh: number): void {
    const ctx = this.ctx;
    const extra = state.playerExtra;
    const safeTop = this.safeArea.top + 10;
    const safeLeft = this.safeArea.left + 12;
    ctx.textBaseline = 'alphabetic';

    // Contaminacao continua sendo a unica faixa presa ao topo inteiro.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, vw, 3);
    ctx.fillStyle = PAL.acid;
    ctx.fillRect(0, 0, vw * state.contamination, 3);

    const revealed = state.salvageSites
      .filter((site) => site.cacheRevealed && !site.cacheOpened)
      .sort((a, b) => {
        const da = Math.hypot(a.cache.x + 0.5 - state.player.x, a.cache.y + 0.5 - state.player.y);
        const db = Math.hypot(b.cache.x + 0.5 - state.player.x, b.cache.y + 0.5 - state.player.y);
        return da - db;
      })[0];

    const hasModules = extra.activeModules.length > 0;
    const panelW = Math.min(300, Math.max(230, vw * 0.34));
    const moduleY = safeTop + 68;
    const sectorY = safeTop + (hasModules ? 112 : 84);
    const objectiveY = sectorY + 18;
    const cacheY = objectiveY + 17;
    const panelH = (revealed ? cacheY : objectiveY) - safeTop + 13;

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
      hpBarY + 11
    );

    // Calor permanece legivel, mas como trilho secundario dentro do mesmo painel.
    const heatFrac = Math.min(1, extra.heat / HEAT_MAX);
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(hpBarX, safeTop + 32, hpBarW, 4);
    ctx.fillStyle = state.tick < extra.overheatedUntil ? PAL.blood : PAL.fire;
    ctx.fillRect(hpBarX, safeTop + 32, hpBarW * heatFrac, 4);

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
    ctx.fillText(`CÉLULA DE PURGA ×${extra.purgeCells}`, safeLeft + 34, purgeY + 4);

    if (hasModules) {
      this.renderModuleHud(
        extra.activeModules, state.tick, nowMs, safeLeft + 12, moduleY, safeLeft + panelW
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
    ctx.fillText(`SETOR ${state.sector}/${SECTOR_COUNT}`, safeLeft + 12, sectorY);

    ctx.fillStyle = PAL.loot;
    ctx.font = 'bold 12px monospace';
    const objective = !isFinalSector(state.sector)
      ? 'DESÇA PELO POÇO'
      : extra.hasCore
        ? 'VOLTE PARA A ENTRADA'
        : state.coreTaken
          ? 'EXTRAIA NA ENTRADA'
          : 'ENCONTRE O NÚCLEO';
    ctx.fillText(objective, safeLeft + 12, objectiveY);

    if (revealed) {
      const dx = revealed.cache.x + 0.5 - state.player.x;
      const dy = revealed.cache.y + 0.5 - state.player.y;
      const direction = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'LESTE' : 'OESTE')
        : (dy > 0 ? 'SUL' : 'NORTE');
      ctx.fillStyle = PAL.biolum;
      ctx.fillText(`COFRE: ${direction} · ~${Math.round(Math.hypot(dx, dy))}m`, safeLeft + 12, cacheY);
    }

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
        shooting: boolean
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
          ctx.rotate(i * Math.PI / 2);
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
    viewportWidth: number
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
      drawModuleGlyph(ctx, module.id, cx, cy, size * 0.47, PAL.biolum);

      let fraction = 1;
      let label = '';
      if (module.lifetime.kind === 'charges') {
        fraction = module.lifetime.maximum > 0 ? module.lifetime.remaining / module.lifetime.maximum : 0;
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

  /** Painel nao-bloqueante de escolha privada do jogador local. */
  renderChoice(
    state: SurvivalState,
    vw: number,
    vh: number,
    input?: InputState
  ): Array<{ x: number; y: number; w: number; h: number }> {
    const pending = state.playerExtra.pendingModuleChoice;
    if (!pending) return [];
    const ctx = this.ctx;
    const reserveTouch = input?.usingTouch ? Math.min(190, vh * 0.28) : 0;
    const cards = moduleChoiceLayout(vw, vh, this.safeArea, reserveTouch);

    ctx.fillStyle = 'rgba(11,14,20,0.38)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = PAL.loot;
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DADOS DE MÓDULO ENCONTRADOS', vw / 2, Math.max(30, cards[0].y - 38));

    pending.options.forEach((id, index) => {
      const card: Rect = cards[index];
      const presentation = modulePresentation(id);
      const active = state.playerExtra.activeModules.some((module) => module.id === id);
      ctx.fillStyle = 'rgba(24,31,43,0.94)';
      ctx.fillRect(card.x, card.y, card.w, card.h);
      ctx.strokeStyle = presentation.risk === 'volatile' ? PAL.fire : PAL.loot;
      ctx.lineWidth = 2;
      ctx.strokeRect(card.x, card.y, card.w, card.h);

      const iconX = card.x + 38;
      const iconY = card.y + 42;
      ctx.fillStyle = 'rgba(46,58,77,0.9)';
      ctx.fillRect(iconX - 24, iconY - 24, 48, 48);
      drawModuleGlyph(ctx, id, iconX, iconY, 22, PAL.biolum);

      ctx.textAlign = 'left';
      ctx.fillStyle = PAL.player;
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`[${index + 1}] ${presentation.label}`, card.x + 72, card.y + 30);
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = PAL.loot;
      ctx.fillText(active ? `RECARGA · ${presentation.lifetimeLabel}` : presentation.lifetimeLabel, card.x + 72, card.y + 49);
      if (presentation.risk === 'volatile') {
        ctx.fillStyle = PAL.fire;
        ctx.fillText('VOLÁTIL', card.x + 72, card.y + 65);
      }

      ctx.fillStyle = PAL.bone;
      ctx.font = '11px monospace';
      const lines = wrapMeasuredText(ctx, presentation.shortDescription, card.w - 28);
      let lineY = Math.max(card.y + 88, iconY + 38);
      for (const line of lines.slice(0, 4)) {
        ctx.fillText(line, card.x + 14, lineY);
        lineY += 15;
      }
    });
    return cards;
  }

  /**
   * Tela de resultado.
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
   */
  renderEnd(state: SurvivalState, vw: number, vh: number): void {
    const summary = state.summary;
    if (!summary) return;
    const ctx = this.ctx;
    const outcome = describeOutcome(summary);
    const colors = { blood: PAL.blood, loot: PAL.loot, biolum: PAL.biolum } as const;

    ctx.fillStyle = 'rgba(11,14,20,0.88)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';

    // Escala tipografica derivada da altura: a tela tem de caber num celular em
    // landscape (390 de altura) sem cortar a linha da licao, que e a util.
    const unit = Math.max(10, Math.min(20, vh / 24));

    const cause = describeCause(summary.deathCause);
    const lines = summaryLines(summary);
    const half = Math.ceil(lines.length / 2);
    const hint = nextStarHint(summary);
    const record = reputationNote(summary);

    // Altura do bloco medida ANTES de desenhar, para centralizar de verdade.
    //
    // Comecar num percentual fixo da altura (era 0.14) parece funcionar e nao
    // funciona: o bloco cresce e encolhe com a causa, com a licao e com a dica
    // de estrela, entao um topo fixo deixa a tela de morte colada no topo e a
    // de extracao com um vao embaixo. Centralizar exige saber o total.
    const blockHeight =
      unit * 2 + // titulo
      unit * 2.1 + // estrelas
      unit * (cause.lesson ? 1.35 : 0) + // licao
      unit * 2 + // respiro antes dos numeros
      half * unit * 1.25 + // numeros
      (record ? unit * 1.45 : 0) +
      (hint ? unit * 1.45 : 0) +
      unit * 1.5 + // seed
      unit * 1.6; // chamada de reinicio
    let y = Math.max(unit * 1.6, (vh - blockHeight) / 2);

    ctx.fillStyle = colors[outcome.color];
    ctx.font = `bold ${Math.round(unit * 1.7)}px monospace`;
    ctx.fillText(outcome.title, vw / 2, y);

    y += unit * 2;
    ctx.font = `${Math.round(unit * 1.9)}px monospace`;
    ctx.fillStyle = PAL.loot;
    const filled = '★'.repeat(summary.stars);
    const empty = '☆'.repeat(3 - summary.stars);
    ctx.fillText(filled + empty, vw / 2, y);

    // Causa e licao: o motivo de esta tela existir.
    y += unit * 2.1;
    ctx.fillStyle = PAL.player;
    ctx.font = `bold ${Math.round(unit)}px monospace`;
    ctx.fillText(cause.headline, vw / 2, y);
    if (cause.lesson) {
      y += unit * 1.35;
      ctx.fillStyle = PAL.bone;
      ctx.font = `${Math.round(unit * 0.85)}px monospace`;
      ctx.fillText(cause.lesson, vw / 2, y);
    }

    // Numeros em duas colunas: uma coluna unica de oito linhas nao cabe em
    // landscape de celular.
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
      ctx.fillStyle = PAL.bone;
      ctx.fillText(lines[i].label, colX[col], lineY);
      ctx.textAlign = 'right';
      ctx.fillStyle = PAL.player;
      ctx.fillText(lines[i].value, colX[col] + colW, lineY);
    }
    ctx.textAlign = 'center';
    y += half * unit * 1.25;

    // O registro vem ANTES da dica de estrela e em vermelho: ele nao e um
    // conselho de como jogar melhor, e a unica linha desta tela que so constata.
    if (record) {
      y += unit * 0.6;
      ctx.fillStyle = PAL.blood;
      ctx.font = statFont;
      ctx.fillText(record, vw / 2, y);
      y += unit * 0.85;
    }

    if (hint) {
      y += unit * 0.6;
      ctx.fillStyle = PAL.loot;
      ctx.font = statFont;
      ctx.fillText(hint, vw / 2, y);
    }

    y += unit * 1.5;
    ctx.fillStyle = PAL.rockLight;
    ctx.font = `${Math.round(unit * 0.8)}px monospace`;
    ctx.fillText(`seed ${formatSeed(summary.seed)}`, vw / 2, y);

    y += unit * 1.6;
    ctx.fillStyle = PAL.player;
    ctx.font = `bold ${Math.round(unit * 0.95)}px monospace`;
    ctx.fillText('Toque ou pressione R para descer de novo', vw / 2, y);
  }
}
