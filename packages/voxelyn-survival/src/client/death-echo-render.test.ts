import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRun, SOLID_NONE, SOLID_ROCK, SURF_NONE } from '@voxelyn/survival-sim';
import { encodeDeathEchoTrace } from '@voxelyn/survival-protocol';
import { SurvivalRenderer } from './render';
import { PropBank, SpriteBank, SurfaceBank, TerrainBank } from './sprites';
import * as hologramDraw from './death-echo-hologram-draw';
import { deathEchoHologramFrame } from './death-echo-hologram';
import type { InputState } from './input';
import type { PlacedDeathEcho } from './death-echoes';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('composição do holograma no mundo', () => {
  it.each([-1, 1])('desenha o chão antes dos atores e paredes na aproximação %s', (direction) => {
    const calls: string[] = [];
    const ctx = new Proxy<Record<string, unknown>>(
      {},
      {
        get: (target, key: string) => {
          if (key in target) return target[key];
          if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
          if (key.startsWith('create') && key.endsWith('Gradient')) {
            return () => ({ addColorStop: () => {} });
          }
          return () => {};
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    const canvas = { getContext: () => ctx } as unknown as HTMLCanvasElement;
    vi.stubGlobal('window', { innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1 });
    vi.stubGlobal('Image', class {});
    vi.stubGlobal('document', { createElement: () => canvas });
    for (const bank of [SpriteBank, TerrainBank, SurfaceBank, PropBank]) {
      vi.spyOn(bank.prototype, 'load').mockImplementation(() => {});
    }
    const renderer = new SurvivalRenderer(canvas);
    // Instrumenta o renderer real: a fila e seu sort continuam em execução.
    const internals = renderer as unknown as {
      drawDeathEchoActor: (archetype: string) => void;
      drawDeathEchoBody: () => void;
      renderHud: () => void;
      renderDeathEchoReadout: () => void;
    };
    vi.spyOn(internals, 'drawDeathEchoActor').mockImplementation((archetype) => {
      calls.push(`hologram:${archetype}`);
    });
    vi.spyOn(internals, 'drawDeathEchoBody').mockImplementation(() => {
      calls.push('carcass');
    });
    vi.spyOn(internals, 'renderHud').mockImplementation(() => {});
    vi.spyOn(internals, 'renderDeathEchoReadout').mockImplementation(() => {});
    vi.spyOn(hologramDraw, 'drawHologramGround').mockImplementation(() => {
      calls.push('ground');
    });
    vi.spyOn(renderer.terrain, 'draw').mockImplementation(() => {
      calls.push('wall');
      return true;
    });
    vi.spyOn(renderer.sprites, 'drawEntity').mockImplementation(() => {
      calls.push('actor');
      return true;
    });

    const state = createRun({ seed: 7 });
    state.solid.fill(SOLID_NONE);
    state.surface.fill(SURF_NONE);
    state.enemies = [];
    state.player.x = 40.5;
    state.player.y = 40.5;
    // Uma parede entre o ator atrás da carcaça e o ponto da morte.
    state.solid[40 * state.config.width + 39] = SOLID_ROCK;
    const cause = { kind: 'enemy_contact', archetype: 'bruiser', elite: false } as const;
    const finalTrace = encodeDeathEchoTrace(
      Array.from({ length: 8 }, (_, i) => ({
        x: 40.5 + direction * (7 - i) * 0.5,
        y: 40.5,
        aimX: 1,
        aimY: 0,
        firing: false,
        hp: 1,
        enemies: [
          {
            id: 9,
            archetype: 'bruiser' as const,
            elite: false,
            x: 39.5 + direction * (7 - i) * 0.5,
            y: 40.5,
          },
        ],
      })),
      40.5,
      40.5,
      120,
      cause,
    )!;
    const echo: PlacedDeathEcho = {
      id: 'render:echo',
      sourceSeed: 7,
      sourceSimulationVersion: 0,
      sourceContentVersion: 0,
      sector: 1,
      sourceWidth: 96,
      sourceHeight: 96,
      sourceX: 40,
      sourceY: 40,
      progressQ: 100,
      openness: 6,
      surface: SURF_NONE,
      nearOre: false,
      facingX: 1,
      facingY: 0,
      cause,
      ticks: 900,
      finalTrace,
      x: 40.5,
      y: 40.5,
      cell: 40 * 96 + 40,
      projection: 'exact',
      lost: 1,
    };
    renderer.setDeathEchoes({
      echoes: [echo],
      prompt: null,
      paired: { echo, openedAtMs: 0 },
    });
    const input = { aiming: false, firing: false, usingTouch: false } as InputState;
    renderer.render(state, 0, input, 300);

    expect(calls.filter((call) => call === 'ground')).toHaveLength(1);
    for (const kind of ['hologram:prospector', 'hologram:bruiser', 'actor', 'wall', 'carcass']) {
      expect(calls).toContain(kind);
      expect(calls.indexOf('ground')).toBeLessThan(calls.indexOf(kind));
    }
    // Os atores ainda obedecem à profundidade própria, dos dois lados da parede.
    const frame = deathEchoHologramFrame(echo, 0, 300)!;
    const victimBeforeWall = frame.victim.x + frame.victim.y < 79;
    expect(calls.indexOf('hologram:prospector') < calls.indexOf('wall')).toBe(victimBeforeWall);
  });
});
