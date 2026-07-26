import {
  dirFromFacing,
  frameAtTime,
  resolveFrame,
  lightLevelFor,
  resolveBlock,
  variantAt,
  type SpriteManifestEntry,
  type TerrainManifest,
} from '@voxelyn/survival-content';

import playerManifest from '@voxelyn/survival-content/assets/atlases/player-prospector.json';
import stalkerManifest from '@voxelyn/survival-content/assets/atlases/enemy-stalker.json';
import spitterManifest from '@voxelyn/survival-content/assets/atlases/enemy-spitter.json';
import bomberManifest from '@voxelyn/survival-content/assets/atlases/enemy-spore-bomber.json';
import bruiserManifest from '@voxelyn/survival-content/assets/atlases/enemy-bruiser.json';
import guardianManifest from '@voxelyn/survival-content/assets/atlases/enemy-guardian.json';
import boltManifest from '@voxelyn/survival-content/assets/atlases/fx-projectile-bolt.json';
import impactManifest from '@voxelyn/survival-content/assets/atlases/fx-impact-burst.json';
import terrainManifest from '@voxelyn/survival-content/assets/atlases/terrain-blocks.json';

import playerUrl from '@voxelyn/survival-content/assets/atlases/player-prospector.png?url';
import stalkerUrl from '@voxelyn/survival-content/assets/atlases/enemy-stalker.png?url';
import spitterUrl from '@voxelyn/survival-content/assets/atlases/enemy-spitter.png?url';
import bomberUrl from '@voxelyn/survival-content/assets/atlases/enemy-spore-bomber.png?url';
import bruiserUrl from '@voxelyn/survival-content/assets/atlases/enemy-bruiser.png?url';
import guardianUrl from '@voxelyn/survival-content/assets/atlases/enemy-guardian.png?url';
import boltUrl from '@voxelyn/survival-content/assets/atlases/fx-projectile-bolt.png?url';
import impactUrl from '@voxelyn/survival-content/assets/atlases/fx-impact-burst.png?url';
import terrainUrl from '@voxelyn/survival-content/assets/atlases/terrain-blocks.png?url';

type Loaded = { manifest: SpriteManifestEntry; image: HTMLImageElement; ready: boolean; failed: boolean };
const SOURCES: Array<{ manifest: SpriteManifestEntry; url: string }> = [
  { manifest: playerManifest as unknown as SpriteManifestEntry, url: playerUrl },
  { manifest: stalkerManifest as unknown as SpriteManifestEntry, url: stalkerUrl },
  { manifest: spitterManifest as unknown as SpriteManifestEntry, url: spitterUrl },
  { manifest: bomberManifest as unknown as SpriteManifestEntry, url: bomberUrl },
  { manifest: bruiserManifest as unknown as SpriteManifestEntry, url: bruiserUrl },
  { manifest: guardianManifest as unknown as SpriteManifestEntry, url: guardianUrl },
  { manifest: boltManifest as unknown as SpriteManifestEntry, url: boltUrl },
  { manifest: impactManifest as unknown as SpriteManifestEntry, url: impactUrl },
];

const ARCHETYPE_SPRITE: Record<string, string> = {
  prospector: 'player-prospector',
  stalker: 'enemy-stalker',
  spitter: 'enemy-spitter',
  bomber: 'enemy-spore-bomber',
  bruiser: 'enemy-bruiser',
  guardian: 'enemy-guardian',
};

/**
 * Banco de blocos de terreno. Separado do SpriteBank porque o eixo de variacao e
 * outro: aqui nao ha animacao nem direcao, so tipo, variante de superficie e
 * nivel de luz — tudo pre-renderizado.
 */
export class TerrainBank {
  private readonly manifest = terrainManifest as unknown as TerrainManifest;
  private readonly image = new Image();
  private ready = false;

  load(): void {
    this.image.onload = () => { this.ready = true; };
    this.image.onerror = () => {
      console.warn('[terrain] atlas failed to load; using flat blocks');
    };
    this.image.src = terrainUrl;
  }

  get kinds(): string[] { return this.manifest.kinds; }
  get variants(): number { return this.manifest.variants; }

  /**
   * Desenha um bloco com o centro do tile em (sx, sy) no plano do chao.
   *
   * A ancora vem do manifest (originX/originY), entao mexer no modelo voxel nao
   * desalinha o terreno: o gerador recalcula e o cliente segue junto.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    kindIndex: number,
    x: number,
    y: number,
    brightness: number,
    screenX: number,
    screenY: number,
    zoom: number
  ): boolean {
    if (!this.ready) return false;
    const m = this.manifest;
    const rect = resolveBlock(m, kindIndex, variantAt(x, y, m.variants), lightLevelFor(m, brightness));
    // A origem do modelo cai meio voxel adiante do centro do tile nos dois
    // eixos, o que na projecao 2:1 e 1px para baixo e 0 na horizontal.
    const dx = screenX - m.originX * zoom;
    const dy = screenY + zoom - m.originY * zoom;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, rect.sx, rect.sy, rect.sw, rect.sh,
      dx, dy, m.frameWidth * zoom, m.frameHeight * zoom);
    return true;
  }
}

export class SpriteBank {
  private readonly byId = new Map<string, Loaded>();
  private tintBuffer: HTMLCanvasElement | null = null;

  load(): void {
    for (const { manifest, url } of SOURCES) {
      const image = new Image();
      const entry: Loaded = { manifest, image, ready: false, failed: false };
      image.onload = () => { entry.ready = true; };
      image.onerror = () => {
        entry.failed = true;
        console.warn(`[sprites] atlas failed to load; using fallback: ${manifest.id}`);
      };
      image.src = url;
      this.byId.set(manifest.id, entry);
    }
  }

  get(id: string): Loaded | null {
    const entry = this.byId.get(id);
    return entry && entry.ready ? entry : null;
  }

  manifestForArchetype(archetype: string): SpriteManifestEntry | null {
    const id = ARCHETYPE_SPRITE[archetype];
    return id ? this.byId.get(id)?.manifest ?? null : null;
  }

  spriteForArchetype(archetype: string): Loaded | null {
    const id = ARCHETYPE_SPRITE[archetype];
    return id ? this.get(id) : null;
  }

  drawEntity(
    ctx: CanvasRenderingContext2D,
    archetype: string,
    animation: string,
    facingX: number,
    facingY: number,
    elapsedMs: number,
    footX: number,
    footY: number,
    zoom: number,
    tint?: { color: string; alpha: number }
  ): boolean {
    const loaded = this.spriteForArchetype(archetype);
    if (!loaded) return false;
    const { manifest, image } = loaded;
    const fallbackAnimation = animation === 'special' && !manifest.animations.special ? 'attack' : animation;
    const useAnimation = manifest.animations[fallbackAnimation] ? fallbackAnimation : 'idle';
    const direction = manifest.directions > 1 ? dirFromFacing(facingX, facingY) : manifest.authoredDirs[0];
    const frame = frameAtTime(manifest, useAnimation, elapsedMs);
    const rect = resolveFrame(manifest, useAnimation, direction, frame);
    const dw = manifest.frameWidth * zoom;
    const dh = manifest.frameHeight * zoom;
    const dx = footX - manifest.anchorX * zoom;
    const dy = footY - manifest.anchorY * zoom;

    let source: CanvasImageSource = image;
    let sx = rect.sx;
    let sy = rect.sy;
    if (tint && tint.alpha > 0) {
      source = this.tintedFrame(image, rect, manifest.frameWidth, manifest.frameHeight, tint);
      sx = 0;
      sy = 0;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (rect.flip) {
      ctx.translate(footX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-footX, 0);
      const flippedX = footX - (manifest.frameWidth - manifest.anchorX) * zoom;
      ctx.drawImage(source, sx, sy, rect.sw, rect.sh, flippedX, dy, dw, dh);
    } else {
      ctx.drawImage(source, sx, sy, rect.sw, rect.sh, dx, dy, dw, dh);
    }
    ctx.restore();
    return true;
  }

  private tintedFrame(
    image: CanvasImageSource,
    rect: { sx: number; sy: number; sw: number; sh: number },
    width: number,
    height: number,
    tint: { color: string; alpha: number }
  ): HTMLCanvasElement {
    if (!this.tintBuffer) this.tintBuffer = document.createElement('canvas');
    const buffer = this.tintBuffer;
    if (buffer.width !== width || buffer.height !== height) {
      buffer.width = width;
      buffer.height = height;
    }
    const bctx = buffer.getContext('2d');
    if (!bctx) return buffer;
    bctx.globalCompositeOperation = 'source-over';
    bctx.globalAlpha = 1;
    bctx.clearRect(0, 0, width, height);
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, width, height);
    bctx.globalCompositeOperation = 'source-atop';
    bctx.globalAlpha = tint.alpha;
    bctx.fillStyle = tint.color;
    bctx.fillRect(0, 0, width, height);
    bctx.globalCompositeOperation = 'source-over';
    bctx.globalAlpha = 1;
    return buffer;
  }

  drawBolt(ctx: CanvasRenderingContext2D, sx: number, sy: number, elapsedMs: number, zoom: number): boolean {
    const loaded = this.get('fx-projectile-bolt');
    if (!loaded) return false;
    const { manifest, image } = loaded;
    const frame = frameAtTime(manifest, 'fly', elapsedMs);
    const rect = resolveFrame(manifest, 'fly', 'n', frame);
    const dw = manifest.frameWidth * zoom;
    const dh = manifest.frameHeight * zoom;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, sx - dw / 2, sy - dh / 2, dw, dh);
    return true;
  }

  drawImpact(ctx: CanvasRenderingContext2D, sx: number, sy: number, progress: number, zoom: number): boolean {
    const loaded = this.get('fx-impact-burst');
    if (!loaded) return false;
    const { manifest, image } = loaded;
    const frame = Math.min(manifest.animations.burst.frames - 1, Math.floor(progress * manifest.animations.burst.frames));
    const rect = resolveFrame(manifest, 'burst', 'n', frame);
    const dw = manifest.frameWidth * zoom;
    const dh = manifest.frameHeight * zoom;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, sx - dw / 2, sy - dh / 2, dw, dh);
    return true;
  }
}

export type EntityAnimState = {
  anim: string;
  animStartMs: number;
  lastX: number;
  lastY: number;
  lastHp: number;
  hitUntilMs: number;
};

export const deriveAnim = (
  previous: EntityAnimState | undefined,
  x: number,
  y: number,
  hp: number,
  alive: boolean,
  nowMs: number
): EntityAnimState => {
  const state: EntityAnimState = previous ?? {
    anim: 'idle',
    animStartMs: nowMs,
    lastX: x,
    lastY: y,
    lastHp: hp,
    hitUntilMs: 0,
  };
  const moved = Math.hypot(x - state.lastX, y - state.lastY) > 0.004;
  const tookDamage = hp < state.lastHp - 0.01;
  if (tookDamage) state.hitUntilMs = nowMs + 180;
  const next = !alive ? 'die' : nowMs < state.hitUntilMs ? 'hit' : moved ? 'walk' : 'idle';
  if (next !== state.anim) {
    state.anim = next;
    state.animStartMs = nowMs;
  }
  state.lastX = x;
  state.lastY = y;
  state.lastHp = hp;
  return state;
};
