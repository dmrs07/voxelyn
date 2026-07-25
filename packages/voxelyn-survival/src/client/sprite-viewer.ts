import { resolveFrame, type SpriteManifestEntry } from '@voxelyn/survival-content';
import { TILE_W } from './render';

import playerManifest from '@voxelyn/survival-content/assets/atlases/player-prospector.json';
import stalkerManifest from '@voxelyn/survival-content/assets/atlases/enemy-stalker.json';
import spitterManifest from '@voxelyn/survival-content/assets/atlases/enemy-spitter.json';
import bomberManifest from '@voxelyn/survival-content/assets/atlases/enemy-spore-bomber.json';
import bruiserManifest from '@voxelyn/survival-content/assets/atlases/enemy-bruiser.json';
import guardianManifest from '@voxelyn/survival-content/assets/atlases/enemy-guardian.json';
import boltManifest from '@voxelyn/survival-content/assets/atlases/fx-projectile-bolt.json';
import impactManifest from '@voxelyn/survival-content/assets/atlases/fx-impact-burst.json';
import playerUrl from '@voxelyn/survival-content/assets/atlases/player-prospector.png?url';
import stalkerUrl from '@voxelyn/survival-content/assets/atlases/enemy-stalker.png?url';
import spitterUrl from '@voxelyn/survival-content/assets/atlases/enemy-spitter.png?url';
import bomberUrl from '@voxelyn/survival-content/assets/atlases/enemy-spore-bomber.png?url';
import bruiserUrl from '@voxelyn/survival-content/assets/atlases/enemy-bruiser.png?url';
import guardianUrl from '@voxelyn/survival-content/assets/atlases/enemy-guardian.png?url';
import boltUrl from '@voxelyn/survival-content/assets/atlases/fx-projectile-bolt.png?url';
import impactUrl from '@voxelyn/survival-content/assets/atlases/fx-impact-burst.png?url';

type Item = { manifest: SpriteManifestEntry; url: string };
const ITEMS: Item[] = [
  [playerManifest, playerUrl],
  [stalkerManifest, stalkerUrl],
  [spitterManifest, spitterUrl],
  [bomberManifest, bomberUrl],
  [bruiserManifest, bruiserUrl],
  [guardianManifest, guardianUrl],
  [boltManifest, boltUrl],
  [impactManifest, impactUrl],
].map(([manifest, url]) => ({ manifest: manifest as unknown as SpriteManifestEntry, url: url as string }));

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
const grid = $('grid');
const images = new Map<string, HTMLImageElement>();
const controls = {
  zoom: () => Number(($('zoom') as HTMLSelectElement).value),
  bg: () => ($('bg') as HTMLSelectElement).value,
  speed: () => Number(($('speed') as HTMLInputElement).value),
  hitbox: () => ($('hitbox') as HTMLInputElement).checked,
  anchor: () => ($('anchor') as HTMLInputElement).checked,
  dir: () => ($('dir') as HTMLSelectElement).value,
};
type CanvasRef = { canvas: HTMLCanvasElement; manifest: SpriteManifestEntry; anim: string };
const canvases: CanvasRef[] = [];

const build = (): void => {
  grid.innerHTML = '';
  canvases.length = 0;
  for (const { manifest } of ITEMS) {
    for (const anim of Object.keys(manifest.animations)) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const def = manifest.animations[anim];
      cell.innerHTML = `<h3>${manifest.id}</h3><div class="meta">${anim} · ${def.frames}f @ ${def.fps}fps · ${manifest.frameWidth}×${manifest.frameHeight} · v${manifest.version} · footprint ${manifest.footprint.w}×${manifest.footprint.h}</div>`;
      const canvas = document.createElement('canvas');
      cell.appendChild(canvas);
      grid.appendChild(cell);
      canvases.push({ canvas, manifest, anim });
    }
  }
};

const preload = (): Promise<void>[] => ITEMS.map(({ manifest, url }) => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => resolve();
  image.onerror = () => resolve();
  image.src = url;
  images.set(manifest.id, image);
}));

const draw = (now: number): void => {
  const zoom = controls.zoom();
  const bg = controls.bg();
  const speed = controls.speed();
  const dirSelection = controls.dir();
  for (const { canvas, manifest, anim } of canvases) {
    const direction = manifest.directions === 1 ? manifest.authoredDirs[0] : dirSelection === 'n' ? 'dr' : dirSelection;
    const def = manifest.animations[anim];
    const frame = Math.floor((now / 1000) * def.fps * speed) % def.frames;
    const rect = resolveFrame(manifest, anim, direction, frame);
    const width = manifest.frameWidth * zoom;
    const height = manifest.frameHeight * zoom;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    const image = images.get(manifest.id);
    if (image?.complete) ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, width, height);

    if (controls.anchor()) {
      ctx.fillStyle = '#59f2c2';
      ctx.fillRect(manifest.anchorX * zoom - 1, manifest.anchorY * zoom - 1, 3, 3);
    }
    if (controls.hitbox()) {
      ctx.strokeStyle = 'rgba(217,59,76,0.9)';
      ctx.lineWidth = 1;
      const hbw = manifest.hitbox.w * TILE_W * zoom;
      const hbh = manifest.hitbox.h * TILE_W * 0.5 * zoom;
      ctx.strokeRect(manifest.anchorX * zoom - hbw / 2, manifest.anchorY * zoom - hbh, hbw, hbh);
      ctx.strokeStyle = 'rgba(255,209,102,0.9)';
      const fpw = manifest.footprint.w * TILE_W * zoom;
      const fph = manifest.footprint.h * TILE_W * 0.5 * zoom;
      const fpx = manifest.anchorX * zoom + manifest.footprint.offsetX * TILE_W * zoom;
      const fpy = manifest.anchorY * zoom + manifest.footprint.offsetY * TILE_W * 0.5 * zoom;
      ctx.strokeRect(fpx - fpw / 2, fpy - fph, fpw, fph);
    }
  }
  requestAnimationFrame(draw);
};

build();
Promise.all(preload()).then(() => requestAnimationFrame(draw));
