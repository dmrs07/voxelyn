// Regras de validacao do editor — espelho das regras por-atlas do CI do jogo.
import { describe, expect, it } from 'vitest';
import { validateProject } from '../validate';
import { createGrid, setPx, cloneBuf, floodFill, drawLine, contentBounds } from '../grid';
import { COLORS } from '../palette';
import { createProjectFromPreset, PRESETS, orderedAnims } from '../presets';
import { frameKey, type Project } from '../types';

const filled = (
  project: Project,
  painter?: (g: ReturnType<typeof createGrid>) => void,
): Project => {
  for (const dir of project.authoredDirs) {
    for (const anim of orderedAnims(project.animations)) {
      for (let f = 0; f < project.animations[anim].frames; f++) {
        const g = createGrid(project.frameWidth, project.frameHeight);
        if (painter) painter(g);
        else setPx(g, 10, 10, COLORS.rock);
        project.frames[frameKey(dir, anim, f)] = cloneBuf(g.buf);
      }
    }
  }
  return project;
};

const base = (): Project =>
  createProjectFromPreset(PRESETS.find((p) => p.id === 'small')!, 'enemy-ok', 'ok');

describe('validateProject', () => {
  it('projeto correto nao tem erros', () => {
    const issues = validateProject(filled(base()));
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('acusa alpha parcial', () => {
    const project = filled(base());
    const key = frameKey('dr', 'idle', 0);
    project.frames[key][3] = 128; // alpha parcial no primeiro pixel
    const issues = validateProject(project);
    expect(issues.some((i) => i.level === 'error' && i.message.includes('alpha'))).toBe(true);
  });

  it('acusa cor fora da paleta', () => {
    const project = filled(base());
    const key = frameKey('dr', 'idle', 0);
    project.frames[key].set([1, 2, 3, 255], 4 * (project.frameWidth * 10 + 10));
    const issues = validateProject(project);
    expect(issues.some((i) => i.level === 'error' && i.message.includes('fora da paleta'))).toBe(
      true,
    );
  });

  it('acusa violacao da margem de 2px', () => {
    const project = filled(base(), (g) => setPx(g, 0, 0, COLORS.rock));
    const issues = validateProject(project);
    expect(issues.some((i) => i.level === 'warn' && i.message.includes('respiro'))).toBe(true);
  });

  it('acusa anchor fora do canvas', () => {
    const project = filled(base());
    project.anchorY = project.frameHeight + 5;
    const issues = validateProject(project);
    expect(issues.some((i) => i.message.includes('anchor'))).toBe(true);
  });

  it('acusa direcao sem arte e sem flip', () => {
    const project = filled(base());
    project.authoredDirs = ['dr'];
    project.flipPairs = {};
    const issues = validateProject(project);
    expect(issues.some((i) => i.message.includes('sem arte e sem flipPair'))).toBe(true);
  });

  it('avisa sobre frames vazios', () => {
    const project = base(); // nenhum frame desenhado
    const issues = validateProject(project);
    expect(issues.some((i) => i.level === 'warn' && i.message.includes('vazios'))).toBe(true);
  });
});

describe('grid ops', () => {
  it('floodFill respeita fronteiras de cor', () => {
    const g = createGrid(8, 8);
    drawLine(g, 0, 4, 7, 4, COLORS.rock);
    floodFill(g, 0, 0, COLORS.fungus);
    // acima da linha: preenchido; abaixo: intocado
    expect(g.buf[(0 * 8 + 0) * 4 + 3]).toBe(255);
    expect(g.buf[(7 * 8 + 0) * 4 + 3]).toBe(0);
  });

  it('contentBounds mede a caixa do conteudo', () => {
    const g = createGrid(16, 16);
    setPx(g, 3, 5, COLORS.rock);
    setPx(g, 10, 12, COLORS.rock);
    expect(contentBounds(g)).toEqual({ minX: 3, minY: 5, maxX: 10, maxY: 12 });
  });
});
