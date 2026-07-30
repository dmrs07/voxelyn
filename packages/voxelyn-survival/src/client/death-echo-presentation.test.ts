import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, SIMULATION_VERSION } from '@voxelyn/survival-protocol';
import { SurvivalRenderer, deathEchoBodyAlpha } from './render';
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

  it('não revela a carcaça fora da luz, mas escala sua opacidade quando iluminada', () => {
    expect(deathEchoBodyAlpha(0.04)).toBe(0);
    expect(deathEchoBodyAlpha(0.2)).toBeGreaterThan(0);
    expect(deathEchoBodyAlpha(0.2)).toBeLessThan(deathEchoBodyAlpha(0.8));
    expect(deathEchoBodyAlpha(1)).toBe(1);
  });
});
