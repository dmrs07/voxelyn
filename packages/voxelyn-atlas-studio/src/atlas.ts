// Empacotamento e fatiamento de atlas — o espelho browser do par
// tools/generate.mjs (escrita) e src/manifest.ts resolveFrame (leitura) do
// pacote de conteudo. O que sai daqui e carregavel pelo SpriteBank sem tocar
// em nada do jogo.
import type { Grid, Project, SpriteManifestEntry } from './types';
import { frameKey } from './types';
import { createGrid, colorsUsed, isEmpty } from './grid';
import { MAX_TEXTURE, PALETTE_NAME } from './palette';
import { orderedAnims } from './presets';

export type PackedAtlas = {
  atlas: Grid;
  manifest: SpriteManifestEntry;
  totalFrames: number;
};

/** Frame do projeto, ou um buffer vazio se nunca foi desenhado. */
export const projectFrame = (project: Project, dir: string, anim: string, index: number): Grid => {
  const buf = project.frames[frameKey(dir, anim, index)];
  const g = createGrid(project.frameWidth, project.frameHeight);
  if (buf && buf.length === g.buf.length) g.buf.set(buf);
  return g;
};

const blitToAtlas = (atlas: Grid, frame: Grid, col: number, row: number): void => {
  const ox = col * frame.w;
  const oy = row * frame.h;
  for (let y = 0; y < frame.h; y++) {
    atlas.buf.set(
      frame.buf.subarray(y * frame.w * 4, (y + 1) * frame.w * 4),
      ((oy + y) * atlas.w + ox) * 4,
    );
  }
};

/**
 * Monta o atlas e o manifest. Mesma matematica do gerador: frames por direcao
 * na ordem de ANIM_ORDER, `columns` limitado ao teto de textura de 4096px,
 * multiplas linhas quando nao cabe, frameMap com a coluna inicial de cada
 * (direcao, animacao).
 */
export const packProject = (project: Project): PackedAtlas => {
  const anims = orderedAnims(project.animations);
  const framesPerDir = anims.reduce((sum, a) => sum + project.animations[a].frames, 0);
  const totalCols = framesPerDir * project.authoredDirs.length;
  if (totalCols === 0) throw new Error('projeto sem animacoes ou direcoes');
  const columns = Math.min(totalCols, Math.max(1, Math.floor(MAX_TEXTURE / project.frameWidth)));
  const rows = Math.ceil(totalCols / columns);
  const atlas = createGrid(columns * project.frameWidth, rows * project.frameHeight);
  const frameMap: Record<string, Record<string, number>> = {};
  const palette = new Set<string>();
  let col = 0;

  for (const dir of project.authoredDirs) {
    frameMap[dir] = {};
    for (const anim of anims) {
      frameMap[dir][anim] = col;
      const def = project.animations[anim];
      for (let f = 0; f < def.frames; f++) {
        const frame = projectFrame(project, dir, anim, f);
        for (const hex of colorsUsed(frame)) palette.add(hex);
        blitToAtlas(atlas, frame, col % columns, Math.floor(col / columns));
        col++;
      }
    }
  }

  const manifest: SpriteManifestEntry = {
    id: project.spriteId,
    version: project.version,
    atlas: `${project.spriteId}.png`,
    frameWidth: project.frameWidth,
    frameHeight: project.frameHeight,
    columns,
    anchorX: project.anchorX,
    anchorY: project.anchorY,
    directions: project.directions,
    authoredDirs: [...project.authoredDirs],
    flipPairs: { ...project.flipPairs },
    hitbox: { ...project.hitbox },
    footprint: { ...project.footprint },
    palette: PALETTE_NAME,
    paletteColors: [...palette].sort(),
    animations: structuredClone(project.animations),
    frameMap,
    generation: {
      tool: 'voxelyn-atlas-studio',
      prompt: project.prompt || 'autorado a mao no Atlas Studio',
      seedOrRef: `authored-v${project.version}`,
    },
  };
  return { atlas, manifest, totalFrames: totalCols };
};

/**
 * Fatia um atlas ja existente de volta em frames de projeto, usando o
 * frameMap/columns do manifest — o inverso exato do packProject e a mesma
 * conta do resolveFrame do jogo.
 */
export const sliceAtlas = (
  manifest: SpriteManifestEntry,
  atlas: Grid,
): Record<string, Uint8Array> => {
  const frames: Record<string, Uint8Array> = {};
  const columns = manifest.columns ?? Number.MAX_SAFE_INTEGER;
  const fw = manifest.frameWidth;
  const fh = manifest.frameHeight;
  for (const dir of manifest.authoredDirs) {
    const dirMap = manifest.frameMap[dir];
    if (!dirMap) continue;
    for (const [anim, start] of Object.entries(dirMap)) {
      const def = manifest.animations[anim];
      if (!def) continue;
      for (let f = 0; f < def.frames; f++) {
        const index = start + f;
        const sx = (index % columns) * fw;
        const sy = Math.floor(index / columns) * fh;
        const out = new Uint8Array(fw * fh * 4);
        for (let y = 0; y < fh; y++) {
          const srcY = sy + y;
          if (srcY >= atlas.h) break;
          const srcStart = (srcY * atlas.w + sx) * 4;
          const width = Math.min(fw, Math.max(0, atlas.w - sx));
          out.set(atlas.buf.subarray(srcStart, srcStart + width * 4), y * fw * 4);
        }
        frames[frameKey(dir, anim, f)] = out;
      }
    }
  }
  return frames;
};

/** Projeto reconstruido a partir de um manifest importado + atlas fatiado. */
export const projectFromManifest = (
  manifest: SpriteManifestEntry,
  frames: Record<string, Uint8Array>,
): Project => {
  const now = Date.now();
  return {
    key: `p${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    spriteId: manifest.id,
    name: manifest.id,
    version: manifest.version,
    frameWidth: manifest.frameWidth,
    frameHeight: manifest.frameHeight,
    anchorX: manifest.anchorX,
    anchorY: manifest.anchorY,
    directions: manifest.directions,
    authoredDirs: [...manifest.authoredDirs],
    flipPairs: { ...manifest.flipPairs },
    hitbox: { ...manifest.hitbox },
    footprint: manifest.footprint
      ? { ...manifest.footprint }
      : { w: 1, h: 1, offsetX: 0, offsetY: 0 },
    animations: structuredClone(manifest.animations),
    frames,
    prompt: manifest.generation?.prompt ?? '',
    createdAt: now,
    updatedAt: now,
  };
};

/** Quantos frames uma (dir, anim) ainda nao tem pixels desenhados. */
export const emptyFrameCount = (project: Project): number => {
  const anims = orderedAnims(project.animations);
  let empty = 0;
  for (const dir of project.authoredDirs) {
    for (const anim of anims) {
      for (let f = 0; f < project.animations[anim].frames; f++) {
        if (isEmpty(projectFrame(project, dir, anim, f))) empty++;
      }
    }
  }
  return empty;
};
