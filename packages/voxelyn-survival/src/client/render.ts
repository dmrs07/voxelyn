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
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_NONE,
  SURF_SCORCHED,
  SURF_SPORES,
  ABILITY_RADIUS,
  HEAT_MAX,
} from '@voxelyn/survival-sim';
import { AIM_JOYSTICK_RADIUS, MOVE_JOYSTICK_RADIUS, type InputState } from './input';
import type { ActiveModule, ModuleId, SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { SpriteBank, SurfaceBank, TerrainBank, deriveAnim, type EntityAnimState,
  PropBank,
} from './sprites';
import { VoxelParticles, frameDeltaMs, hitMaterialOf } from './particles';
import { DAMAGE_FAN, damageAlpha, damageScale, drawDamageNumber } from './damage-text';
import { ProjectileView } from './projectiles';
import { EntityPresentation } from './presentation';
import { PRESETS, type QualityLevel, type QualityPreset } from './settings';
import { TouchIconBank } from './touch-icons';
import { addFlash, flashPower, pruneFlashes, type Flash } from './flash';
import { drawVoxel, type FaceRamp } from './voxel-draw';
import { drawVoxelEntity } from './voxel-fallback';
import { modulePresentation } from './module-presentation';
import { moduleChoiceLayout, type Rect } from './module-layout';

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

export class SurvivalRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  zoom = 2;
  fxList: Fx[] = [];
  flashes: Flash[] = [];
  shake: CameraShake = { power: 0, until: 0 };
  messages: Array<{ text: string; until: number }> = [];
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
          break;
        case 'purge_cell_acquired':
          if (ev.slot === this.localPlayerId - 1) {
            this.messages.push({ text: '+1 CÉLULA DE PURGA', until: nowMs + 2400 });
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

    // luzes dinamicas visiveis (fogo, cristais, descargas, nucleo)
    const lights: Array<{ x: number; y: number; r: number; power: number }> = [
      { x: player.x, y: player.y, r: 8.5, power: 1 },
    ];
    if (!state.coreTaken) lights.push({ x: state.corePos.x + 0.5, y: state.corePos.y + 0.5, r: 6, power: 0.9 });

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

    // passo 2: paredes + entidades + projeteis, ordenados por profundidade
    type DrawItem = { depth: number; draw: () => void };
    const items: DrawItem[] = [];

    // Objetivos como OBJETOS, na fila de profundidade.
    //
    // O Nucleo e a coisa mais importante do mapa e era um losango chapado
    // pulsando 3px acima do chao — menor que qualquer parede em volta dele.
    // Agora e um monumento voxel, e por isso tem de ser ordenado com o resto:
    // desenhado no passo de chao, um pedestal alto ficaria por baixo de toda
    // parede a frente, inclusive a que o jogador esta contornando para chegar
    // ate ele.
    {
      const [csx, csy] = toScreen(state.corePos.x + 0.5, state.corePos.y + 0.5);
      if (csx > -80 && csx < vw + 80 && csy > -100 && csy < vh + 100) {
        items.push({
          depth: state.corePos.x + state.corePos.y,
          draw: () => {
            const name = state.coreTaken ? 'coreTaken' : 'core';
            if (this.props.draw(ctx, name, nowMs, csx, csy, z)) return;
            // Fallback enquanto o atlas nao carregou.
            const pulse = 0.6 + 0.4 * Math.sin(nowMs * 0.006);
            ctx.fillStyle = state.coreTaken ? PAL.rockShadow : shade(PAL.biolum, pulse);
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
            enemy.elite ? { color: 'rgba(255,122,47,0.35)', alpha: 0.35 } : undefined
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
            });
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
      items.push({
        depth: pl.x + pl.y,
        draw: () => {
          const [psx, psy] = toScreen(pl.x, pl.y);
          const size = pl.radius * TILE_W * 0.9 * z;
          drawShadow(psx, psy, size);
          const flick = isLocal && ex.iframesUntil > state.tick && state.tick % 2 === 0;
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
                brightness: 1,
                archetype: 'prospector',
                elite: false,
                nowMs,
                allyTint: !isLocal,
              });
            }
          }
          drawHealthBar(psx, psy - size * 2.4 - 5 * z, size, pl.hp / pl.maxHp);

          // marcador de abatido (precisa de revive)
          if (ex.downed) {
            ctx.fillStyle = PAL.blood;
            ctx.font = `bold ${Math.round(7 * z)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('!', psx, psy - size * 2.6 - 8 * z);
          }

          // indicador de mira: somente o player local
          if (isLocal) {
            const aim = ex.aim;
            const alen = Math.hypot(aim.x, aim.y) || 1;
            const axs = ((aim.x - aim.y) / alen) * 20 * z;
            const ays = ((aim.x + aim.y) / alen) * 10 * z;
            ctx.strokeStyle = 'rgba(232,241,255,0.5)';
            ctx.lineWidth = z * 0.8;
            ctx.beginPath();
            ctx.moveTo(psx + axs * 0.4, psy - 8 * z + ays * 0.4);
            ctx.lineTo(psx + axs, psy - 8 * z + ays);
            ctx.stroke();
          }
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

    this.renderHud(state, input, nowMs, vw, vh);
  }

  private renderHud(state: SurvivalState, input: InputState, nowMs: number, vw: number, vh: number): void {
    const ctx = this.ctx;
    const extra = state.playerExtra;
    const safeTop = 10;
    const safeLeft = 12;

    // HP
    const barW = Math.min(220, vw * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(safeLeft, safeTop, barW, 14);
    const hpFrac = Math.max(0, state.player.hp / state.player.maxHp);
    ctx.fillStyle = hpFrac > 0.35 ? PAL.fungusLight : PAL.blood;
    ctx.fillRect(safeLeft + 1, safeTop + 1, (barW - 2) * hpFrac, 12);

    // calor
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(safeLeft, safeTop + 18, barW, 8);
    const heatFrac = Math.min(1, extra.heat / HEAT_MAX);
    ctx.fillStyle = state.tick < extra.overheatedUntil ? PAL.blood : PAL.fire;
    ctx.fillRect(safeLeft + 1, safeTop + 19, (barW - 2) * heatFrac, 6);

    // contaminacao (topo, fina)
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, vw, 3);
    ctx.fillStyle = PAL.acid;
    ctx.fillRect(0, 0, vw * state.contamination, 3);

    // Celulas de Purga + modulos temporarios.
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = PAL.bone;
    ctx.fillText(`CÉLULA DE PURGA ×${extra.purgeCells}`, safeLeft, safeTop + 43);
    this.renderModuleHud(extra.activeModules, state.tick, nowMs, safeLeft, safeTop + 58, vw);
    ctx.fillStyle = PAL.loot;
    const objective = extra.hasCore
      ? 'VOLTE PARA A ENTRADA'
      : state.coreTaken
        ? 'EXTRAIA NA ENTRADA'
        : 'ENCONTRE O NÚCLEO';
    ctx.fillText(objective, safeLeft, safeTop + 100);
    const revealed = state.salvageSites
      .filter((site) => site.cacheRevealed && !site.cacheOpened)
      .sort((a, b) => {
        const da = Math.hypot(a.cache.x + 0.5 - state.player.x, a.cache.y + 0.5 - state.player.y);
        const db = Math.hypot(b.cache.x + 0.5 - state.player.x, b.cache.y + 0.5 - state.player.y);
        return da - db;
      })[0];
    if (revealed) {
      const dx = revealed.cache.x + 0.5 - state.player.x;
      const dy = revealed.cache.y + 0.5 - state.player.y;
      const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'LESTE' : 'OESTE') : (dy > 0 ? 'SUL' : 'NORTE');
      ctx.fillStyle = PAL.biolum;
      ctx.fillText(`COFRE: ${direction} · ~${Math.round(Math.hypot(dx, dy))}m`, safeLeft, safeTop + 116);
    }

    // mensagens centrais
    this.messages = this.messages.filter((m) => m.until > nowMs);
    ctx.textAlign = 'center';
    let my = vh * 0.2;
    for (const m of this.messages.slice(-3)) {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const tw = ctx.measureText(m.text).width;
      ctx.fillRect(vw / 2 - tw / 2 - 8, my - 14, tw + 16, 20);
      ctx.fillStyle = PAL.bone;
      ctx.fillText(m.text, vw / 2, my);
      my += 26;
    }

    // controles touch: movimento livre a esquerda, mira fixa 360 graus a direita.
    if (input.usingTouch) {
      if (input.joystick.active) {
        ctx.fillStyle = 'rgba(11,14,20,0.28)';
        ctx.beginPath();
        ctx.arc(input.joystick.originX, input.joystick.originY, MOVE_JOYSTICK_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(232,241,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(232,241,255,0.38)';
        ctx.beginPath();
        ctx.arc(
          input.joystick.originX + input.joystick.dx * MOVE_JOYSTICK_RADIUS,
          input.joystick.originY + input.joystick.dy * MOVE_JOYSTICK_RADIUS,
          22,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      const aim = input.aimTouch;
      ctx.fillStyle = aim.active ? 'rgba(89,242,194,0.13)' : 'rgba(11,14,20,0.34)';
      ctx.beginPath();
      ctx.arc(aim.originX, aim.originY, AIM_JOYSTICK_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = aim.active ? 'rgba(89,242,194,0.62)' : 'rgba(232,241,255,0.3)';
      ctx.lineWidth = aim.active ? 2.4 : 1.8;
      ctx.stroke();

      // Reticula discreta comunica que este controle mira e atira.
      ctx.strokeStyle = aim.active ? 'rgba(89,242,194,0.72)' : 'rgba(232,241,255,0.28)';
      ctx.lineWidth = 1.4;
      const mark = AIM_JOYSTICK_RADIUS * 0.22;
      ctx.beginPath();
      ctx.moveTo(aim.originX - mark, aim.originY);
      ctx.lineTo(aim.originX + mark, aim.originY);
      ctx.moveTo(aim.originX, aim.originY - mark);
      ctx.lineTo(aim.originX, aim.originY + mark);
      ctx.stroke();

      ctx.fillStyle = aim.active ? 'rgba(89,242,194,0.52)' : 'rgba(232,241,255,0.26)';
      ctx.beginPath();
      ctx.arc(
        aim.originX + aim.dx * AIM_JOYSTICK_RADIUS,
        aim.originY + aim.dy * AIM_JOYSTICK_RADIUS,
        23,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.strokeStyle = aim.active ? PAL.biolum : 'rgba(232,241,255,0.38)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      for (const b of input.buttons) {
        ctx.fillStyle = b.pressed ? 'rgba(255,209,102,0.5)' : 'rgba(11,14,20,0.48)';
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = b.pressed ? PAL.loot : 'rgba(232,241,255,0.44)';
        ctx.lineWidth = b.pressed ? 2 : 1.5;
        ctx.stroke();

        const iconColor = b.pressed ? PAL.loot : 'rgba(232,241,255,0.88)';
        const drewIcon = this.touchIcons.draw(ctx, b.id, b.cx, b.cy, b.r * 1.05, iconColor);
        if (!drewIcon) {
          // Primeiro frame antes do SVG carregar: placeholder geometrico, nunca sigla textual.
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
    const size = 30;
    const gap = 7;
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
      drawModuleGlyph(ctx, module.id, cx, cy, 14, PAL.biolum);

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
      ctx.font = 'bold 9px monospace';
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
    const cards = moduleChoiceLayout(vw, vh, { top: 0, right: 0, bottom: 0, left: 0 }, reserveTouch);

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

  renderEnd(state: SurvivalState, vw: number, vh: number): void {
    const ctx = this.ctx;
    const config: Record<string, { title: string; color: string; sub: string }> = {
      dead: { title: 'O VEIO TE CONSUMIU', color: PAL.blood, sub: 'A morte e permanente. Cada run e um novo Veio.' },
      extracted: { title: 'EXTRAIDO SEM O NUCLEO', color: PAL.loot, sub: 'Voce sobreviveu... mas voltou de maos vazias.' },
      extracted_with_core: { title: 'NUCLEO EXTRAIDO!', color: PAL.biolum, sub: 'Voce venceu o Veio - desta vez.' },
    };
    const c = config[state.phase];
    if (!c) return;
    ctx.fillStyle = 'rgba(11,14,20,0.8)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = c.color;
    ctx.font = 'bold 26px monospace';
    ctx.fillText(c.title, vw / 2, vh * 0.42);
    ctx.fillStyle = PAL.bone;
    ctx.font = '13px monospace';
    ctx.fillText(c.sub, vw / 2, vh * 0.5);
    ctx.fillText(`Sobreviveu ${Math.floor(state.tick / 20)}s  |  contaminacao ${(state.contamination * 100).toFixed(0)}%`, vw / 2, vh * 0.56);
    ctx.fillStyle = PAL.player;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Toque ou pressione R para descer novamente', vw / 2, vh * 0.66);
  }
}
