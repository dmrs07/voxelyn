// Validacao no editor — espelho das regras por-atlas de tools/validate.mjs,
// rodando ANTES do export para o artista corrigir no aparelho, e nao so no CI.
import type { Project, ValidationIssue } from './types';
import { projectFrame, packProject } from './atlas';
import { colorsUsed, contentBounds, isEmpty } from './grid';
import { ALLOWED_HEX, FRAME_MARGIN, MAX_ATLAS_COLORS, MAX_TEXTURE } from './palette';
import { orderedAnims } from './presets';

export const validateProject = (project: Project): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const anims = orderedAnims(project.animations);
  const isFx = project.spriteId.startsWith('fx-');

  if (!/^[a-z0-9-]+$/.test(project.spriteId)) {
    issues.push({
      level: 'error',
      message: `id "${project.spriteId}" invalido: use minusculas, digitos e hifens (ex.: enemy-stalker)`,
    });
  }
  if (
    project.anchorX < 0 ||
    project.anchorX >= project.frameWidth ||
    project.anchorY < 0 ||
    project.anchorY >= project.frameHeight
  ) {
    issues.push({ level: 'error', message: 'anchor fora do canvas' });
  }
  if (project.frameWidth > MAX_TEXTURE) {
    issues.push({
      level: 'error',
      message: `frame mais largo que o teto de textura (${MAX_TEXTURE}px)`,
    });
  }
  for (const [dir, source] of Object.entries(project.flipPairs)) {
    if (!project.authoredDirs.includes(source)) {
      issues.push({
        level: 'error',
        message: `flipPair ${dir}→${source} aponta para direcao nao autorada`,
      });
    }
    if (project.authoredDirs.includes(dir)) {
      issues.push({
        level: 'error',
        message: `direcao ${dir} esta autorada E em flipPairs ao mesmo tempo`,
      });
    }
  }
  const covered = new Set([...project.authoredDirs, ...Object.keys(project.flipPairs)]);
  if (!isFx) {
    for (const dir of ['dr', 'dl', 'ur', 'ul']) {
      if (!covered.has(dir))
        issues.push({ level: 'error', message: `direcao ${dir} sem arte e sem flipPair` });
    }
  }

  const palette = new Set<string>();
  const offPalette = new Set<string>();
  let emptyFrames = 0;
  let alphaViolations = 0;
  let marginViolations = 0;

  for (const dir of project.authoredDirs) {
    for (const anim of anims) {
      const def = project.animations[anim];
      for (let f = 0; f < def.frames; f++) {
        const g = projectFrame(project, dir, anim, f);
        if (isEmpty(g)) {
          emptyFrames++;
          continue;
        }
        for (const hex of colorsUsed(g)) {
          palette.add(hex);
          if (!ALLOWED_HEX.has(hex)) offPalette.add(hex);
        }
        for (let i = 3; i < g.buf.length; i += 4) {
          const a = g.buf[i];
          if (a !== 0 && a !== 255) {
            alphaViolations++;
            break;
          }
        }
        if (!isFx) {
          const b = contentBounds(g)!;
          if (
            b.minX < FRAME_MARGIN ||
            b.minY < FRAME_MARGIN ||
            b.maxX >= g.w - FRAME_MARGIN ||
            b.maxY >= g.h - FRAME_MARGIN
          ) {
            marginViolations++;
          }
        }
      }
    }
  }

  if (emptyFrames > 0) {
    issues.push({
      level: 'warn',
      message: `${emptyFrames} frame(s) vazios — o validador do jogo rejeita frame obrigatorio vazio`,
    });
  }
  if (alphaViolations > 0) {
    issues.push({
      level: 'error',
      message: `${alphaViolations} frame(s) com alpha parcial — o contrato e alpha 0 ou 255`,
    });
  }
  if (offPalette.size > 0) {
    issues.push({
      level: 'error',
      message: `cores fora da paleta veio-fungico: ${[...offPalette].sort().slice(0, 8).join(', ')}${offPalette.size > 8 ? '…' : ''}`,
    });
  }
  if (palette.size > MAX_ATLAS_COLORS) {
    issues.push({
      level: 'error',
      message: `${palette.size} cores no atlas — teto e ${MAX_ATLAS_COLORS}`,
    });
  }
  if (marginViolations > 0) {
    issues.push({
      level: 'warn',
      message: `${marginViolations} frame(s) sem os ${FRAME_MARGIN}px de respiro na borda`,
    });
  }

  try {
    const { atlas } = packProject(project);
    if (atlas.w > MAX_TEXTURE) {
      issues.push({
        level: 'error',
        message: `atlas com ${atlas.w}px de largura — teto e ${MAX_TEXTURE}`,
      });
    }
  } catch (err) {
    issues.push({ level: 'error', message: `falha ao montar atlas: ${(err as Error).message}` });
  }

  return issues;
};
