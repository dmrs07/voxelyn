// Sprite viewer interno (art bible #13): todas as animacoes, fundos, zoom
// inteiro, escala real, hitbox, anchor, direcao e velocidade configuraveis.
import { resolveFrame, type SpriteManifestEntry } from '@voxelyn/survival-content';
import { TILE_W } from './render';

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

type Item = { manifest: SpriteManifestEntry; url: string };
const ITEMS: Item[] = [
  { manifest: playerManifest as unknown as SpriteManifestEntry, url: playerUrl },
  { manifest: stalkerManifest as unknown as SpriteManifestEntry, url: stalkerUrl },
  { manifest: spitterManifest as unknown as SpriteManifestEntry, url: spitterUrl },
  { manifest: boltManifest as unknown as SpriteManifestEntry, url: boltUrl },
  { manifest: impactManifest as unknown as SpriteManifestEntry, url: impactUrl },
];

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const grid = $('grid');
const images = new Map<string, HTMLImageElement>();

const controls = {
  zoom: () => Number((($('zoom') as HTMLSelectElement).value)),
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
      cell.innerHTML = `<h3>${manifest.id}</h3><div class="meta">${anim} · ${def.frames}f @ ${def.fps}fps · ${manifest.frameWidth}×${manifest.frameHeight} · v${manifest.version}</div>`;
      const canvas = document.createElement('canvas');
      cell.appendChild(canvas);
      grid.appendChild(cell);
      canvases.push({ canvas, manifest, anim });
    }
  }
};

const preload = (): Promise<void>[] =>
  ITEMS.map(
    ({ manifest, url }) =>
      new Promise<void>((res) => {
        const img = new Image();
        img.onload = () => res();
        img.src = url;
        images.set(manifest.id, img);
      })
  );

const draw = (now: number): void => {
  const zoom = controls.zoom();
  const bg = controls.bg();
  const speed = controls.speed();
  const showHitbox = controls.hitbox();
  const showAnchor = controls.anchor();
  const dirSel = controls.dir();

  for (const ref of canvases) {
    const { canvas, manifest, anim } = ref;
    const dir = manifest.directions === 1 ? manifest.authoredDirs[0] : dirSel === 'n' ? 'dr' : dirSel;
    const def = manifest.animations[anim];
    const frame = Math.floor((now / 1000) * def.fps * speed) % def.frames;
    const rect = resolveFrame(manifest, anim, dir, frame);

    const w = manifest.frameWidth * zoom;
    const h = manifest.frameHeight * zoom;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const img = images.get(manifest.id);
    if (img) {
      ctx.save();
      if (rect.flip) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, w, h);
      ctx.restore();
    }

    // anchor (verde) e footprint na escala real do tile
    if (showAnchor) {
      ctx.fillStyle = '#59f2c2';
      ctx.fillRect(manifest.anchorX * zoom - 1, manifest.anchorY * zoom - 1, 3, 3);
    }
    if (showHitbox) {
      ctx.strokeStyle = 'rgba(217,59,76,0.9)';
      ctx.lineWidth = 1;
      const hbw = manifest.hitbox.w * TILE_W * zoom;
      const hbh = manifest.hitbox.h * TILE_W * 0.5 * zoom;
      ctx.strokeRect(
        manifest.anchorX * zoom - hbw / 2,
        manifest.anchorY * zoom - hbh,
        hbw,
        hbh
      );
    }
  }
  requestAnimationFrame(draw);
};

build();
Promise.all(preload()).then(() => requestAnimationFrame(draw));
for (const id of ['zoom', 'bg', 'dir']) $(id).addEventListener('change', () => {});
