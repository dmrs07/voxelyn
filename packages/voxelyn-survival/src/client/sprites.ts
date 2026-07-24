import {
  dirFromFacing,
  frameAtTime,
  resolveFrame,
  type SpriteManifestEntry,
} from '@voxelyn/survival-content';

// Manifests e atlases carregados via vite (?url para PNG, import JSON).
import playerManifest from '@voxelyn/survival-content/assets/atlases/player-prospector.json';
import stalkerManifest from '@voxelyn/survival-content/assets/atlases/enemy-stalker.json';
import spitterManifest from '@voxelyn/survival-content/assets/atlases/enemy-spitter.json';
import boltManifest from '@voxelyn/survival-content/assets/atlases/fx-projectile-bolt.json';
import impactManifest from '@voxelyn/survival-content/assets/atlases/fx-impact-burst.json';

import playerUrl from '@voxelyn/survival-content/assets/atlases/player-prospector.png?url';
import stalkerUrl from '@voxelyn/survival-content/assets/atlases/enemy-stalker.png?url';
import spitterUrl from '@voxelyn/survival-content/assets/atlases/enemy-spitter.png?url';
import boltUrl from '@voxelyn/survival-content/assets/atlases/fx-projectile-bolt.png?url';
import impactUrl from '@voxelyn/survival-content/assets/atlases/fx-impact-burst.png?url';

type Loaded = { manifest: SpriteManifestEntry; image: HTMLImageElement; ready: boolean };

const SOURCES: Array<{ manifest: SpriteManifestEntry; url: string }> = [
  { manifest: playerManifest as unknown as SpriteManifestEntry, url: playerUrl },
  { manifest: stalkerManifest as unknown as SpriteManifestEntry, url: stalkerUrl },
  { manifest: spitterManifest as unknown as SpriteManifestEntry, url: spitterUrl },
  { manifest: boltManifest as unknown as SpriteManifestEntry, url: boltUrl },
  { manifest: impactManifest as unknown as SpriteManifestEntry, url: impactUrl },
];

/** Mapeia arquetipos da sim para ids de sprite do primeiro pacote. */
const ARCHETYPE_SPRITE: Record<string, string> = {
  prospector: 'player-prospector',
  stalker: 'enemy-stalker',
  spitter: 'enemy-spitter',
};

export class SpriteBank {
  private readonly byId = new Map<string, Loaded>();

  load(): void {
    for (const { manifest, url } of SOURCES) {
      const image = new Image();
      const entry: Loaded = { manifest, image, ready: false };
      image.onload = () => {
        entry.ready = true;
      };
      image.src = url;
      this.byId.set(manifest.id, entry);
    }
  }

  get(id: string): Loaded | null {
    const e = this.byId.get(id);
    return e && e.ready ? e : null;
  }

  spriteForArchetype(archetype: string): Loaded | null {
    const id = ARCHETYPE_SPRITE[archetype];
    return id ? this.get(id) : null;
  }

  /**
   * Desenha uma entidade com sprite. Retorna true se desenhou (sprite pronto),
   * false se o chamador deve usar o fallback vetorial.
   */
  drawEntity(
    ctx: CanvasRenderingContext2D,
    archetype: string,
    anim: string,
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
    const dir = manifest.directions > 1 ? dirFromFacing(facingX, facingY) : manifest.authoredDirs[0];
    const frame = frameAtTime(manifest, anim, elapsedMs);
    const rect = resolveFrame(manifest, anim, dir, frame);

    const dw = manifest.frameWidth * zoom;
    const dh = manifest.frameHeight * zoom;
    const dx = footX - manifest.anchorX * zoom;
    const dy = footY - manifest.anchorY * zoom;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (rect.flip) {
      ctx.translate(footX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-footX, 0);
      const fdx = footX - (manifest.frameWidth - manifest.anchorX) * zoom;
      ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, fdx, dy, dw, dh);
    } else {
      ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, dx, dy, dw, dh);
    }
    if (tint && tint.alpha > 0) {
      ctx.globalAlpha = tint.alpha;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = tint.color;
      ctx.fillRect(Math.min(dx, footX - dw), dy, dw, dh);
    }
    ctx.restore();
    return true;
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

/**
 * Estado de animacao derivado no cliente (a sim autoritativa nao carrega intent
 * de animacao para entidades survival). Deriva anim de movimento/vida/dano.
 */
export type EntityAnimState = {
  anim: string;
  animStartMs: number;
  lastX: number;
  lastY: number;
  lastHp: number;
  hitUntilMs: number;
};

export const deriveAnim = (
  prev: EntityAnimState | undefined,
  x: number,
  y: number,
  hp: number,
  alive: boolean,
  nowMs: number
): EntityAnimState => {
  const state: EntityAnimState = prev ?? {
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

  let next: string;
  if (!alive) next = 'die';
  else if (nowMs < state.hitUntilMs) next = 'hit';
  else if (moved) next = 'walk';
  else next = 'idle';

  if (next !== state.anim) {
    state.anim = next;
    state.animStartMs = nowMs;
  }
  state.lastX = x;
  state.lastY = y;
  state.lastHp = hp;
  return state;
};
