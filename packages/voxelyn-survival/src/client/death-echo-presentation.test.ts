import { readFileSync } from 'node:fs';
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
  sourceSimulationVersion: 0,
  sourceContentVersion: 0,
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
});
