// Paridade do rasterizador: o port TS do Studio contra o renderVoxels REAL do
// pipeline do jogo, byte a byte, nas quatro direcoes. Se o jogo mudar rampa,
// sombra, projecao ou ordem do pintor, este teste acusa o port desatualizado.
import { describe, expect, it } from 'vitest';
import {
  box,
  renderVoxels,
  MODEL_SCALE,
  RAMPS as GAME_RAMPS,
  SHADOW_OF as GAME_SHADOW,
  LIGHT_OF as GAME_LIGHT,
  // @ts-expect-error modulo .mjs do pipeline de conteudo, sem tipos
} from '../../../voxelyn-survival-content/tools/voxel.mjs';
import {
  LIGHT_OF,
  RAMPS,
  SHADOW_OF,
  renderVoxelModel,
  voxelKey,
  mirrorModelX,
  removeBox,
  removeZRange,
  settleToGround,
  shiftModel,
  voxelModelBounds,
  type VoxelModel,
} from '../voxel';

type Box = { x: number; y: number; z: number; w: number; d: number; h: number; mat: string };

/** Expande caixas autoradas para o modelo de voxels finos do editor. */
const boxesToModel = (boxes: Box[]): VoxelModel => {
  const fine = (v: number): number => Math.round(v * MODEL_SCALE);
  const model: VoxelModel = {};
  for (const b of boxes) {
    const x0 = fine(b.x);
    const y0 = fine(b.y);
    const z0 = fine(b.z);
    const w = Math.max(1, fine(b.w));
    const d = Math.max(1, fine(b.d));
    const h = Math.max(1, fine(b.h));
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < d; dy++) {
        for (let dz = 0; dz < h; dz++) {
          model[voxelKey(x0 + dx, y0 + dy, z0 + dz)] = b.mat;
        }
      }
    }
  }
  return model;
};

// Modelo de teste com os casos que exercitam o sombreamento: volumes em L
// (quina interna), fresta entre duas paredes, material emissivo, meia-unidade
// autorada e materiais de familias diferentes.
const TEST_BOXES: Box[] = [
  box(-2, -1.5, 0, 4, 3, 2, 'rock') as Box,
  box(-1.5, -1, 2, 3, 2, 1.5, 'player') as Box,
  box(1.5, -0.5, 0, 1, 1, 3, 'rust') as Box,
  box(-2.5, -0.5, 0, 1, 1, 3, 'fungus') as Box,
  box(-0.5, -1.5, 3.5, 1, 0.5, 0.5, 'biolum') as Box,
  box(-0.5, 0.5, 0.5, 1, 1, 1, 'loot') as Box,
];

describe('paridade com o rasterizador do jogo', () => {
  it('tabelas de rampa/sombra/luz identicas', () => {
    expect(RAMPS).toEqual(GAME_RAMPS);
    expect(SHADOW_OF).toEqual(GAME_SHADOW);
    expect(LIGHT_OF).toEqual(GAME_LIGHT);
  });

  it('renderiza byte a byte igual ao renderVoxels, nas 4 direcoes', () => {
    const model = boxesToModel(TEST_BOXES);
    const W = 48;
    const H = 48;
    const AX = 24;
    const AY = 40;
    for (let dir = 0; dir < 4; dir++) {
      const game = renderVoxels(TEST_BOXES, dir, W, H, AX, AY) as {
        w: number;
        h: number;
        buf: Uint8Array;
      };
      const studio = renderVoxelModel(model, dir, W, H, AX, AY);
      expect(studio.w).toBe(game.w);
      expect(studio.h).toBe(game.h);
      expect(Buffer.from(studio.buf).equals(Buffer.from(game.buf)), `direcao ${dir}`).toBe(true);
    }
  });

  it('modelo vazio renderiza frame vazio sem lancar', () => {
    const g = renderVoxelModel({}, 0, 16, 16, 8, 12);
    expect(g.buf.every((b) => b === 0)).toBe(true);
  });
});

describe('projeto voxel no pipeline de atlas', () => {
  it('packProject assa as 4 direcoes do mesmo modelo', async () => {
    const { packProject, bakeFrame } = await import('../atlas');
    const { createProjectFromPreset, PRESETS } = await import('../presets');
    const { frameKey } = await import('../types');
    const project = createProjectFromPreset(
      PRESETS.find((p) => p.id === 'small')!,
      'enemy-vox-test',
      'Vox',
    );
    project.mode = 'voxel';
    project.models = {};
    const model = boxesToModel([box(-1, -1, 0, 2, 2, 3, 'rock') as Box]);
    for (const anim of Object.keys(project.animations)) {
      for (let f = 0; f < project.animations[anim].frames; f++) {
        project.models[`${anim}/${f}`] = model;
      }
    }
    const { atlas, manifest } = packProject(project);
    expect(manifest.authoredDirs).toEqual(['dr', 'dl', 'ur', 'ul']);
    // o frame assado no atlas e identico ao render direto do modelo
    const { sliceAtlas } = await import('../atlas');
    const frames = sliceAtlas(manifest, atlas);
    for (const dir of ['dr', 'dl', 'ur', 'ul']) {
      const direct = bakeFrame(project, dir, 'idle', 0);
      expect(
        Buffer.from(frames[frameKey(dir, 'idle', 0)]).equals(Buffer.from(direct.buf)),
        dir,
      ).toBe(true);
    }
  });
});

describe('operacoes de modelo', () => {
  it('shiftModel desloca todas as chaves', () => {
    const model: VoxelModel = { [voxelKey(0, 0, 0)]: 'rock', [voxelKey(2, -1, 3)]: 'loot' };
    const shifted = shiftModel(model, 1, 2, -1);
    expect(shifted[voxelKey(1, 2, -1)]).toBe('rock');
    expect(shifted[voxelKey(3, 1, 2)]).toBe('loot');
  });

  it('mirrorModelX e involutivo', () => {
    const model: VoxelModel = { [voxelKey(3, 1, 0)]: 'rock', [voxelKey(-4, 0, 2)]: 'fungus' };
    expect(mirrorModelX(mirrorModelX(model))).toEqual(model);
  });
});

/**
 * Cortes grossos: e o fluxo do STL importado, que chega apoiado numa laje de
 * base que nao faz parte do bicho e ocupa dezenas de camadas.
 */
describe('cortes de camada e de area', () => {
  /** Base solida 4x4 em z=0..1 com uma torre de 2 voxels em cima. */
  const slab = (): VoxelModel => {
    const m: VoxelModel = {};
    for (let z = 0; z <= 1; z++)
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) m[voxelKey(x, y, z)] = 'rock';
    m[voxelKey(1, 1, 2)] = 'bone';
    m[voxelKey(1, 1, 3)] = 'bone';
    return m;
  };

  it('removeZRange apaga so as camadas pedidas', () => {
    const cut = removeZRange(slab(), 0, 1);
    expect(Object.keys(cut).length).toBe(2);
    expect(voxelModelBounds(cut)).toMatchObject({ minZ: 2, maxZ: 3 });
  });

  it('removeBox sem z atravessa TODAS as camadas', () => {
    const cut = removeBox(slab(), { minX: 1, maxX: 1, minY: 1, maxY: 1 });
    expect(cut[voxelKey(1, 1, 0)]).toBeUndefined();
    expect(cut[voxelKey(1, 1, 3)]).toBeUndefined();
    expect(cut[voxelKey(0, 0, 0)]).toBe('rock');
  });

  it('removeBox com z limitado so mexe naquela camada', () => {
    const cut = removeBox(slab(), { minX: 0, maxX: 3, minY: 0, maxY: 3 }, 0, 0);
    expect(cut[voxelKey(0, 0, 0)]).toBeUndefined();
    expect(cut[voxelKey(0, 0, 1)]).toBe('rock');
  });

  it('settleToGround baixa o que ficou flutuando e nao mexe no que ja apoia', () => {
    const floating = removeZRange(slab(), 0, 1);
    const settled = settleToGround(floating);
    expect(voxelModelBounds(settled)).toMatchObject({ minZ: 0, maxZ: 1 });
    expect(settleToGround(slab())).toEqual(slab());
  });

  it('cortar a base e assentar preserva o resto do modelo intacto', () => {
    const settled = settleToGround(removeZRange(slab(), 0, 1));
    expect(Object.values(settled).every((mat) => mat === 'bone')).toBe(true);
    expect(Object.keys(settled).length).toBe(2);
  });
});
