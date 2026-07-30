from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one occurrence, found {count}: {old[:100]!r}")
    path.write_text(text.replace(old, new))


def replace_regex_once(path: Path, pattern: str, replacement: str) -> None:
    text = path.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"{path}: regex did not match exactly once: {pattern[:100]!r}")
    path.write_text(updated)


def apply_capsule_fixes() -> None:
    echoes_path = ROOT / "packages/voxelyn-survival/src/client/death-echoes.ts"
    replace_once(
        echoes_path,
        "const isProjectileKind = (value: unknown): value is ProjectileKind =>\n  typeof value === 'string' && PROJECTILE_KINDS.has(value as ProjectileKind);\n",
        "const isProjectileKind = (value: unknown): value is ProjectileKind =>\n"
        "  typeof value === 'string' && PROJECTILE_KINDS.has(value as ProjectileKind);\n\n"
        "// Matriz fechada do que a simulação realmente consegue disparar. `bolt` e\n"
        "// `return_disc` pertencem ao jogador; aceitar qualquer união válida aqui\n"
        "// permitiria que storage adulterado fabricasse uma lição de morte.\n"
        "const HOSTILE_PROJECTILES_BY_ARCHETYPE: Partial<Record<EnemyArchetype, ReadonlySet<ProjectileKind>>> = {\n"
        "  bruiser: new Set(['rock']),\n"
        "  spitter: new Set(['spit']),\n"
        "  guardian: new Set(['spit']),\n"
        "  bishop: new Set(['spit']),\n"
        "};\n"
        "const isValidEnemyProjectileCause = (archetype: unknown, projectile: unknown): boolean => {\n"
        "  if (!isEnemyArchetype(archetype) || !isProjectileKind(projectile)) return false;\n"
        "  return HOSTILE_PROJECTILES_BY_ARCHETYPE[archetype]?.has(projectile) ?? false;\n"
        "};\n",
    )
    replace_regex_once(
        echoes_path,
        r"    case 'enemy_projectile':\n      return \(\n        isEnemyArchetype\(cause\.archetype\) &&\n        typeof cause\.elite === 'boolean' &&\n        isProjectileKind\(cause\.projectile\)\n      \);",
        "    case 'enemy_projectile':\n"
        "      return (\n"
        "        isValidEnemyProjectileCause(cause.archetype, cause.projectile) &&\n"
        "        typeof cause.elite === 'boolean'\n"
        "      );",
    )

    tests_path = ROOT / "packages/voxelyn-survival/src/client/death-echoes.test.ts"
    replace_once(
        tests_path,
        "        { ...echo, id: 'bad-archetype', cause: { kind: 'enemy_contact', archetype: 'bogus', elite: false } },\n",
        "        { ...echo, id: 'bad-archetype', cause: { kind: 'enemy_contact', archetype: 'bogus', elite: false } },\n"
        "        {\n"
        "          ...echo,\n"
        "          id: 'player-bolt-as-enemy',\n"
        "          cause: { kind: 'enemy_projectile', archetype: 'stalker', elite: false, projectile: 'bolt' },\n"
        "        },\n"
        "        {\n"
        "          ...echo,\n"
        "          id: 'wrong-rock-shooter',\n"
        "          cause: { kind: 'enemy_projectile', archetype: 'spitter', elite: false, projectile: 'rock' },\n"
        "        },\n",
    )
    replace_once(
        tests_path,
        "  it('mantém somente o teto de mortes recentes', () => {",
        "  it('aceita somente combinações de projétil que a simulação pode emitir', () => {\n"
        "    const state = finishDead(createRun({ seed: 10 }));\n"
        "    const echo = captureDeathEcho(state, 'base');\n"
        "    if (!echo) throw new Error('eco não capturado');\n"
        "    const validCauses: DamageCause[] = [\n"
        "      { kind: 'enemy_projectile', archetype: 'spitter', elite: false, projectile: 'spit' },\n"
        "      { kind: 'enemy_projectile', archetype: 'guardian', elite: false, projectile: 'spit' },\n"
        "      { kind: 'enemy_projectile', archetype: 'bishop', elite: false, projectile: 'spit' },\n"
        "      { kind: 'enemy_projectile', archetype: 'bruiser', elite: false, projectile: 'rock' },\n"
        "    ];\n"
        "    const decoded = decodeDeathEchoRecords(JSON.stringify({\n"
        "      schema: 1,\n"
        "      nextSerial: 5,\n"
        "      echoes: validCauses.map((cause, index) => ({ ...echo, id: `valid-${index}`, cause })),\n"
        "    }));\n"
        "    expect(decoded.echoes).toHaveLength(validCauses.length);\n"
        "  });\n\n"
        "  it('mantém somente o teto de mortes recentes', () => {",
    )


def apply_layout_fixes() -> None:
    presentation_path = ROOT / "packages/voxelyn-survival/src/client/death-echo-presentation.ts"
    presentation_path.write_text("""// Controller client-side dos Ecos do Veio.
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

export type DeathEchoReadoutRegion = {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
  align: 'right' | 'center';
  placement: 'side' | 'below';
};

type Insets = { top: number; right: number; bottom: number; left: number };
type PanelRect = { x: number; y: number; width: number; height: number };

export const deathEchoReadout = (echo: PlacedDeathEcho): DeathEchoReadout => {
  const serialParts = echo.id.split(':');
  const serial = serialParts[serialParts.length - 1] ?? '---';
  return {
    title: `CAIXA-PRETA ${serial.padStart(3, '0')}`,
    headline: describeCause(echo.cause).headline,
  };
};

/**
 * Reserva o retângulo do HUD antes de posicionar a caixa-preta.
 *
 * Em telas largas ela fica ao lado do painel. Em retrato estreito, desce para
 * baixo dele. Se nem ali houver espaço legível, o readout não é desenhado —
 * esconder informação opcional é melhor do que cobrir HP, calor ou objetivo.
 */
export const deathEchoReadoutRegion = (
  viewportWidth: number,
  viewportHeight: number,
  safeArea: Insets,
  hud: PanelRect,
): DeathEchoReadoutRegion | null => {
  const margin = 14;
  const gap = 12;
  const safeLeft = safeArea.left + margin;
  const safeRight = viewportWidth - safeArea.right - margin;
  const safeTop = safeArea.top + margin;
  const safeBottom = viewportHeight - safeArea.bottom - margin;
  if (safeRight <= safeLeft || safeBottom <= safeTop) return null;

  const sideX = Math.max(safeLeft, hud.x + hud.width + gap);
  const sideWidth = safeRight - sideX;
  if (sideWidth >= 180) {
    return {
      x: sideX,
      y: safeTop,
      maxWidth: Math.min(360, sideWidth),
      maxHeight: safeBottom - safeTop,
      align: 'right',
      placement: 'side',
    };
  }

  const belowY = Math.max(safeTop, hud.y + hud.height + gap);
  const availableWidth = safeRight - safeLeft;
  if (availableWidth < 140 || belowY >= safeBottom) return null;
  return {
    x: safeLeft,
    y: belowY,
    maxWidth: Math.min(360, availableWidth),
    maxHeight: safeBottom - belowY,
    align: 'center',
    placement: 'below',
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
""")

    test_path = ROOT / "packages/voxelyn-survival/src/client/death-echo-presentation.test.ts"
    test_path.write_text("""import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, SIMULATION_VERSION } from '@voxelyn/survival-protocol';
import { SurvivalRenderer } from './render';
import {
  DeathEchoController,
  deathEchoReadout,
  deathEchoReadoutRegion,
} from './death-echo-presentation';
import { emptyDeathEchoRecords, type PlacedDeathEcho } from './death-echoes';

const echo = (over: Partial<PlacedDeathEcho> = {}): PlacedDeathEcho => ({
  id: '42:dead:1234:7',
  sourceSeed: 42,
  sourceSimulationVersion: SIMULATION_VERSION,
  sourceContentVersion: CONTENT_VERSION,
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

const safeArea = { top: 0, right: 0, bottom: 0, left: 0 };
const hud = { x: 12, y: 10, width: 230, height: 100 };

describe('apresentação do eco', () => {
  it('mostra a causa autoritativa sem expor seed ou identidade pessoal', () => {
    const readout = deathEchoReadout(echo({
      cause: { kind: 'discharge', source: 'player' },
    }));
    expect(readout.title).toBe('CAIXA-PRETA 007');
    expect(readout.headline).toBe('Sua própria descarga te pegou');
    expect(`${readout.title} ${readout.headline}`).not.toContain('42');
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

  it('coloca o readout abaixo do HUD em retrato estreito', () => {
    const region = deathEchoReadoutRegion(360, 640, safeArea, hud);
    expect(region?.placement).toBe('below');
    expect(region?.y).toBeGreaterThanOrEqual(hud.y + hud.height);
    expect(region?.x).toBeGreaterThanOrEqual(14);
    expect((region?.x ?? 0) + (region?.maxWidth ?? 0)).toBeLessThanOrEqual(346);
  });

  it('mantém o readout ao lado do HUD quando há largura', () => {
    const region = deathEchoReadoutRegion(900, 600, safeArea, { ...hud, width: 300 });
    expect(region?.placement).toBe('side');
    expect(region?.x).toBeGreaterThanOrEqual(hud.x + 300 + 12);
  });

  it('prefere não mostrar a cobrir o HUD numa viewport curta', () => {
    expect(deathEchoReadoutRegion(320, 140, safeArea, hud)).toBeNull();
  });
});
""")

    render_path = ROOT / "packages/voxelyn-survival/src/client/render.ts"
    replace_once(
        render_path,
        "import { deathEchoReadout } from './death-echo-presentation';",
        "import { deathEchoReadout, deathEchoReadoutRegion } from './death-echo-presentation';",
    )
    replacement = """  private renderDeathEchoReadout(state: SurvivalState, vw: number, vh: number): void {
    const echo = this.deathEchoes
      .map((candidate) => ({
        candidate,
        distance: Math.hypot(state.player.x - candidate.x, state.player.y - candidate.y),
      }))
      .filter(({ distance }) => distance <= 4)
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
    if (!echo) return;

    const extra = state.playerExtra;
    const safeTop = this.safeArea.top + 10;
    const safeLeft = this.safeArea.left + 12;
    const revealed = state.salvageSites
      .filter((site) => site.cacheRevealed && !site.cacheOpened)
      .sort((a, b) => {
        const da = Math.hypot(a.cache.x + 0.5 - state.player.x, a.cache.y + 0.5 - state.player.y);
        const db = Math.hypot(b.cache.x + 0.5 - state.player.x, b.cache.y + 0.5 - state.player.y);
        return da - db;
      })[0];
    const hasModules = extra.activeModules.length > 0;
    const panelW = Math.min(300, Math.max(230, vw * 0.34));
    const sectorY = safeTop + (hasModules ? 112 : 84);
    const objectiveY = sectorY + 18;
    const cacheY = objectiveY + 17;
    const panelH = (revealed ? cacheY : objectiveY) - safeTop + 13;
    const region = deathEchoReadoutRegion(vw, vh, this.safeArea, {
      x: safeLeft,
      y: safeTop,
      width: panelW,
      height: panelH,
    });
    if (!region) return;

    const ctx = this.ctx;
    const readout = deathEchoReadout(echo);
    const titleSize = 10;
    const bodySize = 12;
    const lineHeight = bodySize + 4;
    ctx.font = `bold ${bodySize}px monospace`;

    const words = readout.headline.toUpperCase().split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > region.maxWidth - 24) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);

    const minimumWidth = Math.min(190, region.maxWidth);
    const boxWidth = Math.min(
      region.maxWidth,
      Math.max(minimumWidth, ...lines.map((line) => ctx.measureText(line).width + 24)),
    );
    const boxHeight = 20 + titleSize + lines.length * lineHeight;
    if (boxHeight > region.maxHeight) return;
    const x = region.align === 'right'
      ? region.x + region.maxWidth - boxWidth
      : region.x + (region.maxWidth - boxWidth) / 2;
    const y = region.y;

    ctx.save();
    ctx.fillStyle = 'rgba(11,14,20,0.94)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.strokeStyle = PAL.biolum;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PAL.biolum;
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.fillText(readout.title, x + 12, y + 8);
    ctx.fillStyle = PAL.player;
    ctx.font = `bold ${bodySize}px monospace`;
    lines.forEach((line, index) =>
      ctx.fillText(line, x + 12, y + 14 + titleSize + index * lineHeight),
    );
    ctx.fillStyle = echo.projection === 'exact' ? PAL.blood : PAL.rust;
    ctx.fillRect(x, y + boxHeight - 3, boxWidth, 3);
    ctx.restore();
  }

  private renderRewardFlight"""
    replace_regex_once(
        render_path,
        r"  private renderDeathEchoReadout\(state: SurvivalState, vw: number, vh: number\): void \{.*?\n  \}\n\n  private renderRewardFlight",
        replacement,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=("capsules", "layout"))
    args = parser.parse_args()
    if args.stage == "capsules":
        apply_capsule_fixes()
    else:
        apply_layout_fixes()


if __name__ == "__main__":
    main()
