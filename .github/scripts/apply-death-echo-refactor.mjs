import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (source, needle, replacement, label) => {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`duplicate ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
};

const presentationPath = 'packages/voxelyn-survival/src/client/death-echo-presentation.ts';
write(presentationPath, `// Controller client-side dos Ecos do Veio.
//
// Esta camada guarda memória local e projeta carcaças, mas não participa da
// simulação. O renderer recebe apenas uma lista imutável de apresentação.

import type { SurvivalState } from '@voxelyn/survival-sim';
import { describeCause } from './run-summary';
import {
  applyDeathEchoOnce,
  loadDeathEchoRecords,
  projectDeathEchoes,
  saveDeathEchoRecords,
  type DeathEchoRecords,
  type PlacedDeathEcho,
} from './death-echoes';

export type DeathEchoReadout = {
  title: string;
  headline: string;
};

export const deathEchoReadout = (echo: PlacedDeathEcho): DeathEchoReadout => {
  const serialParts = echo.id.split(':');
  const serial = serialParts[serialParts.length - 1] ?? '---';
  return {
    title: \`CAIXA-PRETA \${serial.padStart(3, '0')}\`,
    headline: describeCause(echo.cause).headline,
  };
};

export class DeathEchoController {
  private recordedIdentity: string | null = null;
  private terminal = false;
  private projectionKey = '';
  private placed: readonly PlacedDeathEcho[] = [];

  constructor(private records: DeathEchoRecords = loadDeathEchoRecords()) {}

  sync(state: SurvivalState): readonly PlacedDeathEcho[] {
    if (state.phase !== 'running') {
      if (!this.terminal && state.phase === 'dead') {
        const result = applyDeathEchoOnce(this.records, state, this.recordedIdentity);
        this.recordedIdentity = result.identity;
        if (result.applied) {
          this.records = result.records;
          saveDeathEchoRecords(this.records);
        }
      }
      this.terminal = true;
      this.projectionKey = '';
      this.placed = [];
      return this.placed;
    }

    if (this.terminal) {
      this.recordedIdentity = null;
      this.terminal = false;
    }

    const key = [
      state.config.seed,
      state.sector,
      state.config.width,
      state.config.height,
      this.records.nextSerial,
    ].join(':');
    if (key !== this.projectionKey) {
      this.projectionKey = key;
      this.placed = projectDeathEchoes(state, this.records);
    }
    return this.placed;
  }
}
`);

const entryPath = 'packages/voxelyn-survival/src/client/death-echo-entry.ts';
if (!fs.existsSync(entryPath)) throw new Error('missing obsolete death echo entrypoint');
fs.rmSync(entryPath);

const indexPath = 'packages/voxelyn-survival/index.html';
let html = read(indexPath);
html = replaceOnce(
  html,
  '<script type="module" src="./src/client/death-echo-entry.ts"></script>',
  '<script type="module" src="./src/client/main.ts"></script>',
  'canonical survival entrypoint',
);
write(indexPath, html);

const mainPath = 'packages/voxelyn-survival/src/client/main.ts';
let main = read(mainPath);
main = replaceOnce(
  main,
  "import { SurvivalRenderer } from './render';",
  "import { SurvivalRenderer } from './render';\nimport { DeathEchoController } from './death-echo-presentation';",
  'death echo controller import',
);
main = main.replaceAll('renderer.render(state,', 'renderState(state,');
main = replaceOnce(
  main,
  `const renderer = new SurvivalRenderer(canvas);
const input = new SurvivalInput(canvas);`,
  `const renderer = new SurvivalRenderer(canvas);
const deathEchoes = new DeathEchoController();
const renderState = (
  state: SurvivalState,
  alpha: number,
  inputState: Parameters<SurvivalRenderer['render']>[2],
  nowMs: number,
): void => {
  renderer.setDeathEchoes(deathEchoes.sync(state));
  renderer.render(state, alpha, inputState, nowMs);
};
const input = new SurvivalInput(canvas);`,
  'render controller wiring',
);
write(mainPath, main);

const echoesPath = 'packages/voxelyn-survival/src/client/death-echoes.ts';
let echoes = read(echoesPath);
echoes = replaceOnce(
  echoes,
  `  type DamageCause,
  type RunSummary,`,
  `  type DamageCause,
  type EnemyArchetype,
  type ProjectileKind,
  type RunSummary,`,
  'cause enum type imports',
);
echoes = replaceOnce(
  echoes,
  `const isEffectSource = (value: unknown): value is 'player' | 'enemy' | 'environment' =>
  value === 'player' || value === 'enemy' || value === 'environment';

const isDamageCause`,
  `const isEffectSource = (value: unknown): value is 'player' | 'enemy' | 'environment' =>
  value === 'player' || value === 'enemy' || value === 'environment';

const ENEMY_ARCHETYPES = new Set<EnemyArchetype>([
  'stalker',
  'bruiser',
  'spitter',
  'bomber',
  'guardian',
  'bishop',
  'fungal_horse',
  'miner',
]);
const PROJECTILE_KINDS = new Set<ProjectileKind>(['bolt', 'spit', 'rock', 'return_disc']);
const isEnemyArchetype = (value: unknown): value is EnemyArchetype =>
  typeof value === 'string' && ENEMY_ARCHETYPES.has(value as EnemyArchetype);
const isProjectileKind = (value: unknown): value is ProjectileKind =>
  typeof value === 'string' && PROJECTILE_KINDS.has(value as ProjectileKind);

const isDamageCause`,
  'cause enum validators',
);
echoes = replaceOnce(
  echoes,
  `    case 'enemy_contact':
      return typeof cause.archetype === 'string' && typeof cause.elite === 'boolean';
    case 'enemy_projectile':
      return typeof cause.archetype === 'string' && typeof cause.elite === 'boolean' && typeof cause.projectile === 'string';`,
  `    case 'enemy_contact':
      return isEnemyArchetype(cause.archetype) && typeof cause.elite === 'boolean';
    case 'enemy_projectile':
      return (
        isEnemyArchetype(cause.archetype) &&
        typeof cause.elite === 'boolean' &&
        isProjectileKind(cause.projectile)
      );`,
  'cause enum validation branches',
);
write(echoesPath, echoes);

const renderPath = 'packages/voxelyn-survival/src/client/render.ts';
let render = read(renderPath);
render = replaceOnce(
  render,
  `import { objectiveLightSpec, objectivePropName } from './objective-prop';`,
  `import { objectiveLightSpec, objectivePropName } from './objective-prop';
import { deathEchoReadout } from './death-echo-presentation';
import type { PlacedDeathEcho } from './death-echoes';`,
  'renderer death echo imports',
);
render = replaceOnce(
  render,
  `  private choiceRevealAt = 0;
  private purgePulseUntil = 0;
  quality: QualityPreset = PRESETS.high;`,
  `  private choiceRevealAt = 0;
  private purgePulseUntil = 0;
  private deathEchoes: readonly PlacedDeathEcho[] = [];
  quality: QualityPreset = PRESETS.high;`,
  'renderer death echo field',
);
render = replaceOnce(
  render,
  `  setSafeArea(safeArea: SafeInsets): void {
    this.safeArea = { ...safeArea };
  }

  isChoiceRevealReady`,
  `  setSafeArea(safeArea: SafeInsets): void {
    this.safeArea = { ...safeArea };
  }

  setDeathEchoes(echoes: readonly PlacedDeathEcho[]): void {
    this.deathEchoes = echoes;
  }

  isChoiceRevealReady`,
  'renderer death echo setter',
);
render = replaceOnce(
  render,
  `    const spriteZoom = Math.max(1, Math.round(z));

    this.archetypeById.clear();`,
  `    const spriteZoom = Math.max(1, Math.round(z));

    for (const echo of this.deathEchoes) {
      const [esx, esy] = toScreen(echo.x, echo.y);
      if (esx < -80 || esx > vw + 80 || esy < -100 || esy > vh + 80) continue;
      items.push({
        depth: echo.x + echo.y,
        draw: () => this.drawDeathEchoBody(echo, esx, esy, z, spriteZoom, nowMs),
      });
    }

    this.archetypeById.clear();`,
  'depth-sorted death echo items',
);
render = replaceOnce(
  render,
  `    this.renderRewardFlight(toScreen, nowMs);
    this.renderHud(state, input, nowMs, vw, vh);
  }

  private renderRewardFlight(`,
  `    this.renderRewardFlight(toScreen, nowMs);
    this.renderHud(state, input, nowMs, vw, vh);
    this.renderDeathEchoReadout(state, vw, vh);
  }

  private drawDeathEchoBody(
    echo: PlacedDeathEcho,
    sx: number,
    sy: number,
    z: number,
    spriteZoom: number,
    nowMs: number,
  ): void {
    const ctx = this.ctx;
    const size = 0.34 * TILE_W * 0.9 * z;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, size, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const drew = this.sprites.drawEntity(
      ctx,
      'prospector',
      'die',
      echo.facingX,
      echo.facingY,
      10_000,
      sx,
      sy,
      spriteZoom,
      { color: 'rgba(110,74,51,0.62)', alpha: 0.62 },
    );
    if (!drew) {
      ctx.fillStyle = PAL.rust;
      ctx.fillRect(sx - 9 * z, sy - 5 * z, 16 * z, 4 * z);
      ctx.fillStyle = PAL.rockShadow;
      ctx.fillRect(sx - 6 * z, sy - 8 * z, 7 * z, 4 * z);
      ctx.fillStyle = PAL.player;
      ctx.fillRect(sx - 5 * z, sy - 7 * z, 2 * z, z);
    }

    const pulse = Math.sin(nowMs * 0.008 + echo.cell * 0.17) > -0.2;
    ctx.fillStyle = pulse ? PAL.biolum : PAL.rockShadow;
    ctx.fillRect(sx + 2 * z, sy - 7 * z, 3 * z, 3 * z);
    ctx.strokeStyle = PAL.dark;
    ctx.lineWidth = Math.max(1, z * 0.6);
    ctx.strokeRect(sx + 2 * z, sy - 7 * z, 3 * z, 3 * z);
  }

  private renderDeathEchoReadout(state: SurvivalState, vw: number, vh: number): void {
    const echo = this.deathEchoes
      .map((candidate) => ({
        candidate,
        distance: Math.hypot(state.player.x - candidate.x, state.player.y - candidate.y),
      }))
      .filter(({ distance }) => distance <= 4)
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
    if (!echo) return;

    const ctx = this.ctx;
    const readout = deathEchoReadout(echo);
    const left = this.safeArea.left + 14;
    const right = this.safeArea.right + 14;
    const top = this.safeArea.top + 14;
    const maxWidth = Math.min(360, Math.max(180, vw - left - right));
    const titleSize = 10;
    const bodySize = 12;
    const lineHeight = bodySize + 4;
    ctx.font = \`bold \${bodySize}px monospace\`;

    const words = readout.headline.toUpperCase().split(/\\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? \`\${current} \${word}\` : word;
      if (current && ctx.measureText(candidate).width > maxWidth - 24) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);

    const boxWidth = Math.min(
      maxWidth,
      Math.max(190, ...lines.map((line) => ctx.measureText(line).width + 24)),
    );
    const boxHeight = 20 + titleSize + lines.length * lineHeight;
    const x = Math.max(left, vw - right - boxWidth);
    const y = Math.max(top, Math.min(vh - this.safeArea.bottom - boxHeight - 14, top));

    ctx.save();
    ctx.fillStyle = 'rgba(11,14,20,0.94)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.strokeStyle = PAL.biolum;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PAL.biolum;
    ctx.font = \`bold \${titleSize}px monospace\`;
    ctx.fillText(readout.title, x + 12, y + 8);
    ctx.fillStyle = PAL.player;
    ctx.font = \`bold \${bodySize}px monospace\`;
    lines.forEach((line, index) =>
      ctx.fillText(line, x + 12, y + 14 + titleSize + index * lineHeight),
    );
    ctx.fillStyle = echo.projection === 'exact' ? PAL.blood : PAL.rust;
    ctx.fillRect(x, y + boxHeight - 3, boxWidth, 3);
    ctx.restore();
  }

  private renderRewardFlight(`,
  'renderer body and readout methods',
);
write(renderPath, render);

const presentationTestPath = 'packages/voxelyn-survival/src/client/death-echo-presentation.test.ts';
write(presentationTestPath, `import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SurvivalRenderer } from './render';
import {
  DeathEchoController,
  deathEchoReadout,
} from './death-echo-presentation';
import { emptyDeathEchoRecords, type PlacedDeathEcho } from './death-echoes';

const echo = (over: Partial<PlacedDeathEcho> = {}): PlacedDeathEcho => ({
  id: '42:dead:1234:7',
  sourceSeed: 42,
  sector: 2,
  sourceWidth: 96,
  sourceHeight: 96,
  sourceX: 30,
  sourceY: 40,
  progressQ: 140,
  openness: 5,
  surface: 0,
  nearOre: false,
  facingX: 1,
  facingY: 0,
  cause: { kind: 'fire' },
  ticks: 1234,
  x: 25.5,
  y: 38.5,
  cell: 3673,
  projection: 'topological',
  ...over,
});

describe('apresentação do eco', () => {
  it('mostra a causa autoritativa sem expor seed ou identidade pessoal', () => {
    const readout = deathEchoReadout(echo({
      cause: { kind: 'discharge', source: 'player' },
    }));
    expect(readout.title).toBe('CAIXA-PRETA 007');
    expect(readout.headline).toBe('Sua própria descarga te pegou');
    expect(\`\${readout.title} \${readout.headline}\`).not.toContain('42');
  });

  it('mantém memória e projeção num controller separado da simulação', () => {
    const controller = new DeathEchoController(emptyDeathEchoRecords());
    expect(controller).toBeInstanceOf(DeathEchoController);
    expect(typeof SurvivalRenderer.prototype.setDeathEchoes).toBe('function');
  });

  it('usa main.ts como entrypoint canônico, sem bootstrap de monkey patch', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toContain('./src/client/main.ts');
    expect(html).not.toContain('death-echo-entry');
  });
});
`);

const echoesTestPath = 'packages/voxelyn-survival/src/client/death-echoes.test.ts';
let echoesTest = read(echoesTestPath);
echoesTest = replaceOnce(
  echoesTest,
  `        { ...echo, id: 'bad-source', cause: { kind: 'explosion', source: 'somewhere' } },
        { id: '', cause: null },`,
  `        { ...echo, id: 'bad-source', cause: { kind: 'explosion', source: 'somewhere' } },
        { ...echo, id: 'bad-archetype', cause: { kind: 'enemy_contact', archetype: 'bogus', elite: false } },
        {
          ...echo,
          id: 'bad-projectile',
          cause: { kind: 'enemy_projectile', archetype: 'spitter', elite: false, projectile: 'laser' },
        },
        { id: '', cause: null },`,
  'invalid persisted cause regressions',
);
write(echoesTestPath, echoesTest);
