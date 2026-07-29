import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
process.chdir(root);

const replaceExact = (path, before, after, expected = 1) => {
  const source = readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} occurrence(s), found ${count}`);
  writeFileSync(path, source.replace(before, after), 'utf8');
};

const renderPath = 'packages/voxelyn-survival/src/client/render.ts';
const testPath = 'packages/voxelyn-survival/src/tests/touch-cooldown.test.ts';

replaceExact(
  renderPath,
  "export const TILE_W = 32;\nexport const TILE_H = 16;\nconst WALL_H = 14;",
  `export const TILE_W = 32;\nexport const TILE_H = 16;\nconst WALL_H = 14;\n\nexport type ModuleHudMetrics = { size: number; gap: number };\n\n/** Mantem todos os modulos visiveis dentro da largura compacta do painel. */\nexport const moduleHudMetrics = (count: number, availableWidth: number): ModuleHudMetrics => {\n  const normalizedCount = Math.max(0, Math.floor(count));\n  if (normalizedCount <= 0) return { size: 30, gap: 7 };\n  if (normalizedCount === 1) return { size: Math.max(24, Math.min(30, availableWidth)), gap: 0 };\n\n  const baseGap = 7;\n  const size = Math.max(24, Math.min(30, Math.floor(\n    (availableWidth - baseGap * (normalizedCount - 1)) / normalizedCount\n  )));\n  const remaining = Math.max(0, availableWidth - size * normalizedCount);\n  const gap = Math.max(3, Math.min(baseGap, remaining / (normalizedCount - 1)));\n  return { size, gap };\n};`,
);

replaceExact(
  renderPath,
  `    const ctx = this.ctx;\n    const size = 30;\n    const gap = 7;\n    let cursor = x;`,
  `    const ctx = this.ctx;\n    const availableWidth = Math.max(0, viewportWidth - 12 - x);\n    const { size, gap } = moduleHudMetrics(modules.length, availableWidth);\n    let cursor = x;`,
);
replaceExact(
  renderPath,
  "      drawModuleGlyph(ctx, module.id, cx, cy, 14, PAL.biolum);",
  "      drawModuleGlyph(ctx, module.id, cx, cy, size * 0.47, PAL.biolum);",
);
replaceExact(
  renderPath,
  "      ctx.font = 'bold 9px monospace';",
  "      ctx.font = `bold ${Math.max(8, Math.round(size * 0.3))}px monospace`;",
);

replaceExact(
  testPath,
  "import { cooldownRemainingFraction, resolveCooldownReadyAt } from '../client/cooldown-overlay';",
  "import { cooldownRemainingFraction, resolveCooldownReadyAt } from '../client/cooldown-overlay';\nimport { moduleHudMetrics } from '../client/render';",
);

const source = readFileSync(testPath, 'utf8');
const finalClose = source.lastIndexOf('\n});');
if (finalClose < 0) throw new Error(`${testPath}: final describe close not found`);
const regression = `\n\n  it('mantem os seis modulos visiveis no painel de 568px', () => {\n    // panelW=230 e padding horizontal de 12px em cada lado: 206px uteis.\n    const availableWidth = 206;\n    const metrics = moduleHudMetrics(6, availableWidth);\n    const occupied = metrics.size * 6 + metrics.gap * 5;\n\n    expect(metrics.size).toBeGreaterThanOrEqual(24);\n    expect(occupied).toBeLessThanOrEqual(availableWidth);\n  });`;
writeFileSync(testPath, source.slice(0, finalClose) + regression + source.slice(finalClose), 'utf8');

execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
console.log('compact module HUD fix applied');
