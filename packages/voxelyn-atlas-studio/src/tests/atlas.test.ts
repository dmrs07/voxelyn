// O contrato central do Studio: o que ele exporta e exatamente o que o jogo
// le. O roundtrip pack → slice devolve os frames byte a byte, e o resolveFrame
// REAL do pacote de conteudo (nao uma copia) enxerga cada frame no lugar certo.
import { describe, expect, it } from 'vitest';
import { resolveFrame } from '../../../voxelyn-survival-content/src/manifest';
import { packProject, projectFrame, sliceAtlas, projectFromManifest } from '../atlas';
import { createGrid, setPx, cloneBuf } from '../grid';
import { COLORS } from '../palette';
import { createProjectFromPreset, PRESETS, orderedAnims } from '../presets';
import { frameKey, type Project } from '../types';

const makeProject = (): Project => {
  const preset = PRESETS.find((p) => p.id === 'small')!;
  const project = createProjectFromPreset(preset, 'enemy-test-crab', 'Teste');
  // desenha um pixel distinto por frame para rastrear posicoes no atlas
  let mark = 0;
  const colorNames = Object.keys(COLORS);
  for (const dir of project.authoredDirs) {
    for (const anim of orderedAnims(project.animations)) {
      for (let f = 0; f < project.animations[anim].frames; f++) {
        const g = createGrid(project.frameWidth, project.frameHeight);
        const x = 4 + (mark % 40);
        const y = 4 + Math.floor(mark / 40);
        setPx(g, x, y, COLORS[colorNames[mark % colorNames.length]]);
        project.frames[frameKey(dir, anim, f)] = cloneBuf(g.buf);
        mark++;
      }
    }
  }
  return project;
};

describe('packProject', () => {
  it('ordena frames por direcao e ANIM_ORDER, como o gerador', () => {
    const project = makeProject();
    const { manifest } = packProject(project);
    // small: idle(4) walk(6) attack(4) hit(2) die(5) = 21 frames por direcao
    expect(manifest.frameMap.dr).toEqual({ idle: 0, walk: 4, attack: 10, hit: 14, die: 16 });
    expect(manifest.frameMap.dl.idle).toBe(21);
    expect(manifest.frameMap.ur.idle).toBe(42);
    expect(manifest.frameMap.ul.idle).toBe(63);
  });

  it('respeita o teto de textura de 4096px com multiplas linhas', () => {
    const project = makeProject();
    const { atlas, manifest, totalFrames } = packProject(project);
    expect(atlas.w).toBeLessThanOrEqual(4096);
    const columns = manifest.columns!;
    expect(atlas.w).toBe(columns * project.frameWidth);
    expect(atlas.h).toBe(Math.ceil(totalFrames / columns) * project.frameHeight);
  });

  it('roundtrip pack → slice devolve os frames byte a byte', () => {
    const project = makeProject();
    const { atlas, manifest } = packProject(project);
    const frames = sliceAtlas(manifest, atlas);
    for (const dir of project.authoredDirs) {
      for (const anim of orderedAnims(project.animations)) {
        for (let f = 0; f < project.animations[anim].frames; f++) {
          const key = frameKey(dir, anim, f);
          expect(frames[key], key).toEqual(project.frames[key]);
        }
      }
    }
  });

  it('o resolveFrame REAL do jogo localiza cada frame exportado', () => {
    const project = makeProject();
    const { atlas, manifest } = packProject(project);
    for (const dir of project.authoredDirs) {
      for (const anim of orderedAnims(project.animations)) {
        for (let f = 0; f < project.animations[anim].frames; f++) {
          const rect = resolveFrame(manifest, anim, dir, f);
          expect(rect.flip).toBe(false);
          // recorta o rect do atlas e compara com o frame autorado
          const expected = project.frames[frameKey(dir, anim, f)];
          for (let y = 0; y < rect.sh; y++) {
            const srcStart = ((rect.sy + y) * atlas.w + rect.sx) * 4;
            const row = atlas.buf.subarray(srcStart, srcStart + rect.sw * 4);
            const expRow = expected.subarray(y * rect.sw * 4, (y + 1) * rect.sw * 4);
            expect(
              Buffer.from(row).equals(Buffer.from(expRow)),
              `${dir}/${anim}/${f} linha ${y}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('flipPairs resolvem para a direcao autorada', () => {
    const project = makeProject();
    project.authoredDirs = ['dr', 'ur'];
    project.flipPairs = { dl: 'dr', ul: 'ur' };
    const { manifest } = packProject(project);
    const rect = resolveFrame(manifest, 'idle', 'dl', 0);
    expect(rect.flip).toBe(true);
    expect(rect.sx).toBe(resolveFrame(manifest, 'idle', 'dr', 0).sx);
  });

  it('manifest carrega paleta, cores usadas ordenadas e metadados', () => {
    const project = makeProject();
    const { manifest } = packProject(project);
    expect(manifest.palette).toBe('veio-fungico.v01');
    expect(manifest.paletteColors).toEqual([...manifest.paletteColors].sort());
    expect(manifest.paletteColors.length).toBeGreaterThan(0);
    expect(manifest.generation?.tool).toBe('voxelyn-atlas-studio');
    expect(manifest.atlas).toBe('enemy-test-crab.png');
  });
});

describe('projectFromManifest', () => {
  it('reconstroi um projeto editavel a partir de manifest + frames', () => {
    const original = makeProject();
    const { atlas, manifest } = packProject(original);
    const project = projectFromManifest(manifest, sliceAtlas(manifest, atlas));
    expect(project.spriteId).toBe('enemy-test-crab');
    expect(project.animations).toEqual(original.animations);
    const g = projectFrame(project, 'dr', 'walk', 2);
    expect(cloneBuf(g.buf)).toEqual(original.frames[frameKey('dr', 'walk', 2)]);
  });
});
