import {
  SOLID_CRYSTAL,
  SOLID_FRAGILE,
  SOLID_NONE,
  SOLID_ORE,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_GAS,
  SURF_SCORCHED,
  HEAT_MAX,
} from '@voxelyn/survival-sim';
import { AIM_JOYSTICK_RADIUS, MOVE_JOYSTICK_RADIUS, type InputState } from './input';
import type { SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { SpriteBank, TerrainBank, deriveAnim, type EntityAnimState } from './sprites';
import { VoxelParticles, frameDeltaMs } from './particles';
import { ProjectileView } from './projectiles';
import { EntityPresentation } from './presentation';
import { PRESETS, type QualityLevel, type QualityPreset } from './settings';
import { TouchIconBank } from './touch-icons';
import { drawVoxelEntity } from './voxel-fallback';

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

export type Fx =
  | { kind: 'ring'; x: number; y: number; r: number; maxR: number; color: string; life: number; maxLife: number }
  | { kind: 'spark'; x: number; y: number; life: number; maxLife: number }
  | { kind: 'text'; x: number; y: number; text: string; color: string; life: number; maxLife: number };

export type CameraShake = { power: number; until: number };

export class SurvivalRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  zoom = 2;
  fxList: Fx[] = [];
  shake: CameraShake = { power: 0, until: 0 };
  messages: Array<{ text: string; until: number }> = [];
  readonly sprites = new SpriteBank();
  readonly terrain = new TerrainBank();
  readonly particles = new VoxelParticles();
  readonly projectileView = new ProjectileView();
  /** Relogio do ultimo frame, para o passo de FX vir do tempo real. */
  private lastFrameMs = 0;
  private readonly touchIcons = new TouchIconBank();
  private readonly animStates = new Map<number, EntityAnimState>();
  private readonly presentation = new EntityPresentation();
  quality: QualityPreset = PRESETS.high;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponivel');
    this.ctx = ctx;
    this.sprites.load();
    this.terrain.load();
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

  ingestEvents(events: SemanticEvent[], nowMs: number): void {
    this.presentation.ingest(events, nowMs);
    // As particulas nascem dos MESMOS eventos autoritativos que os FX antigos.
    // O cliente nunca decide que houve explosao — so a desenha.
    this.particles.budget = this.quality.maxFx * 2;
    this.particles.ingest(events, this.worldWidth, this.quality.maxFx / PRESETS.high.maxFx);
    for (const ev of events) {
      switch (ev.t) {
        case 'explosion':
          this.fxList.push({ kind: 'ring', x: ev.x, y: ev.y, r: 0.2, maxR: ev.radius, color: PAL.fire, life: 320, maxLife: 320 });
          this.shake = { power: 5, until: nowMs + 220 };
          break;
        case 'discharge':
          for (const cell of ev.cells.slice(0, 40)) {
            this.fxList.push({ kind: 'spark', x: (cell % this.worldWidth) + 0.5, y: Math.floor(cell / this.worldWidth) + 0.5, life: 260, maxLife: 260 });
          }
          break;
        case 'hit':
          this.fxList.push({
            kind: 'text',
            x: ev.x,
            y: ev.y,
            text: `${Math.round(ev.amount)}`,
            color: ev.target === this.localPlayerId ? PAL.blood : PAL.bone,
            life: 550,
            maxLife: 550,
          });
          if (ev.target === this.localPlayerId) this.shake = { power: 3, until: nowMs + 120 };
          break;
        case 'death':
          this.fxList.push({ kind: 'ring', x: ev.x, y: ev.y, r: 0.1, maxR: 0.9, color: PAL.blood, life: 260, maxLife: 260 });
          break;
        case 'pulse':
          this.fxList.push({ kind: 'ring', x: ev.x, y: ev.y, r: 0.2, maxR: 2.6, color: PAL.electric, life: 260, maxLife: 260 });
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

        const surf = state.surface[i];
        let base = PAL.rockShadow;
        if (surf === SURF_FUNGAL) base = PAL.fungusDark;
        else if (surf === SURF_BIOFLUID) base = PAL.fungus;
        else if (surf === SURF_SCORCHED) base = '#151516';
        diamond(sx, sy, shade(base, 0.35 + b * 0.75));

        if (surf === SURF_FUNGAL && b > 0.25) {
          ctx.fillStyle = shade(PAL.fungusLight, b * 0.7);
          const dotSeed = (x * 7 + y * 13) % 5;
          ctx.fillRect(sx - 3 * z + dotSeed * z, sy - z, z, z);
        }
        if (surf === SURF_BIOFLUID) {
          ctx.fillStyle = shade(PAL.biolum, 0.25 + b * 0.4);
          ctx.fillRect(sx - z * 2, sy - z * 0.5, z * 4, z);
        }
        if (surf === SURF_FIRE) {
          const flick = 0.7 + 0.3 * Math.sin(nowMs * 0.02 + x * 3 + y * 5);
          diamond(sx, sy, shade(PAL.fire, flick));
        }
        if (surf === SURF_GAS) {
          diamond(sx, sy, `rgba(168, 230, 60, ${0.16 + 0.1 * Math.sin(nowMs * 0.004 + x + y)})`);
          // A mancha no chao diz ONDE o gas esta; os motes subindo dizem que
          // ele esta VIVO e para onde vai. Sem eles o gas era so uma textura.
          this.particles.emitGas(x + 0.5, y + 0.5, nowMs, this.quality.maxFx / PRESETS.high.maxFx);
        }
        // marcadores de objetivo
        if (x === state.corePos.x && y === state.corePos.y && !state.coreTaken) {
          const pulse = 0.6 + 0.4 * Math.sin(nowMs * 0.006);
          diamond(sx, sy - 3 * z, shade(PAL.biolum, pulse));
        }
        if (x === state.entry.x && y === state.entry.y) {
          diamond(sx, sy, shade(PAL.loot, 0.3 + brightness(x, y) * 0.5));
        }
      }
    }

    // cargas eletricas por cima do chao
    for (const c of state.charges) {
      const cx = c.idx % w;
      const cy = Math.floor(c.idx / w);
      const [sx, sy] = toScreen(cx + 0.5, cy + 0.5);
      diamond(sx, sy, `rgba(122, 184, 255, ${0.35 + 0.3 * Math.random()})`);
    }

    // passo 2: paredes + entidades + projeteis, ordenados por profundidade
    type DrawItem = { depth: number; draw: () => void };
    const items: DrawItem[] = [];

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
            const kindIndex =
              solid === SOLID_FRAGILE ? 1 : solid === SOLID_ORE ? 2 : solid === SOLID_CRYSTAL ? 3 : 0;
            if (this.terrain.draw(ctx, kindIndex, x, y, b, sx, sy, z)) return;

            const hw = (TILE_W / 2) * z;
            const hh = (TILE_H / 2) * z;
            const wh = WALL_H * z;
            let top = PAL.rockLight;
            let left = PAL.rock;
            let right = PAL.rockShadow;
            if (solid === SOLID_FRAGILE) {
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

    // caches
    for (const cache of state.caches) {
      if (cache.opened) continue;
      const b = brightness(cache.x, cache.y);
      if (b <= 0.05) continue;
      const [sx, sy] = toScreen(cache.x + 0.5, cache.y + 0.5);
      items.push({
        depth: cache.x + cache.y,
        draw: () => {
          ctx.fillStyle = shade(PAL.loot, 0.4 + b * 0.6);
          ctx.fillRect(sx - 4 * z, sy - 6 * z, 8 * z, 6 * z);
          ctx.fillStyle = shade('#8a6a2f', 0.4 + b * 0.5);
          ctx.fillRect(sx - 4 * z, sy - 2 * z, 8 * z, 2 * z);
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

    for (const enemy of state.enemies) {
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
      } else if (fx.kind === 'spark') {
        const [sx, sy] = toScreen(fx.x, fx.y);
        ctx.strokeStyle = PAL.electric;
        ctx.globalAlpha = 1 - t;
        ctx.lineWidth = z * 0.8;
        ctx.beginPath();
        ctx.moveTo(sx - 4 * z, sy - 4 * z + 8 * z * Math.random());
        ctx.lineTo(sx + 4 * z, sy - 4 * z + 8 * z * Math.random());
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        const [sx, sy] = toScreen(fx.x, fx.y);
        ctx.fillStyle = fx.color;
        ctx.globalAlpha = 1 - t;
        ctx.font = `bold ${Math.round(6 * z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(fx.text, sx, sy - 14 * z - t * 10 * z);
        ctx.globalAlpha = 1;
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

    // consumiveis + modificadores + objetivo
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = PAL.bone;
    ctx.fillText(`Frascos ${extra.consumables}  |  ${extra.modifiers.map((m) => m.toUpperCase().slice(0, 4)).join(' ') || 'sem modificadores'}`, safeLeft, safeTop + 42);
    ctx.fillStyle = PAL.loot;
    const objective = extra.hasCore
      ? 'VOLTE PARA A ENTRADA'
      : state.coreTaken
        ? 'EXTRAIA NA ENTRADA'
        : 'ENCONTRE O NUCLEO';
    ctx.fillText(objective, safeLeft, safeTop + 58);

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

  /** Overlay da escolha de modificador; retorna regioes clicaveis. */
  renderChoice(options: [string, string], vw: number, vh: number): Array<{ x: number; y: number; w: number; h: number }> {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(11,14,20,0.82)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = PAL.loot;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CACHE ABERTO - ESCOLHA UM MODIFICADOR', vw / 2, vh * 0.24);

    const DESCRIPTIONS: Record<string, string> = {
      piercing: 'PERFURANTE: atravessa inimigos e rompe rocha fragil',
      conductive: 'CONDUTOR: +dano em alvos molhados; descarrega pocas',
      explosive: 'EXPLOSIVO: area ao impactar; perigoso de perto',
      siphon: 'SIFAO: rouba vida a cada acerto',
    };

    const cardW = Math.min(340, vw * 0.42);
    const cardH = Math.min(150, vh * 0.32);
    const gap = vw * 0.04;
    const regions: Array<{ x: number; y: number; w: number; h: number }> = [];
    options.forEach((opt, i) => {
      const x = vw / 2 - cardW - gap / 2 + i * (cardW + gap);
      const y = vh * 0.34;
      regions.push({ x, y, w: cardW, h: cardH });
      ctx.fillStyle = 'rgba(46,58,77,0.9)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = PAL.loot;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cardW, cardH);
      ctx.fillStyle = PAL.player;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`[${i + 1}] ${opt.toUpperCase()}`, x + cardW / 2, y + 34);
      ctx.fillStyle = PAL.bone;
      ctx.font = '11px monospace';
      const desc = DESCRIPTIONS[opt] ?? opt;
      // quebra simples em duas linhas
      const words = desc.split(' ');
      let line = '';
      let ly = y + 64;
      for (const word of words) {
        if ((line + word).length > 34) {
          ctx.fillText(line, x + cardW / 2, ly);
          ly += 16;
          line = '';
        }
        line += `${word} `;
      }
      if (line) ctx.fillText(line, x + cardW / 2, ly);
    });
    return regions;
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
