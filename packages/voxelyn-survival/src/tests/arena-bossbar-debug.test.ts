// Os cenarios da barra de chefe na arena agem pelo FUNIL da simulacao — e por
// isso podem ser testados contra uma run de verdade: o que o botao faz e o
// que a barra mostra sao o que o jogo faria.
import { describe, expect, it } from 'vitest';
import { createArenaRun } from '../client/arena-setup';
import {
  BOSS_BAR_SCENARIOS,
  BossBarGallery,
  BossBarScenarioDriver,
  GALLERY_SCENARIOS,
  bossBarReadout,
} from '../client/arena-bossbar-debug';
import { BossHealthBarPresentation, resolveSectorBoss } from '../client/boss-health-bar';

const run = () =>
  createArenaRun({
    boss: 'guardian',
    maxHp: 100,
    ability: 'pulse',
    modules: [],
    stabilisers: false,
    coop: false,
  });

describe('os cenarios da arena', () => {
  it('a run real resolve o chefe por arquetipo mesmo com entityId anulado (como o online)', () => {
    const state = run();
    state.sectorBoss.entityId = null;
    const boss = resolveSectorBoss(state);
    expect(boss?.archetype).toBe('guardian');
    expect(bossBarReadout(state).entityIdNull).toBe(true);
  });

  it('despertar, golpes, cura, fase e morte passam pela simulacao e chegam a barra', () => {
    const state = run();
    const driver = new BossBarScenarioDriver();
    const bar = new BossHealthBarPresentation();
    let now = 0;
    const step = (ms = 50): void => {
      state.tick += 1;
      now += ms;
      bar.sync(state, now);
    };
    driver.apply(state, 'sleep');
    step();
    expect(bar.view(now, false)).toBeNull();

    const awake = driver.apply(state, 'awaken');
    expect(awake.map((e) => e.t)).toEqual(['boss_awake']);
    bar.ingestEvents(awake, now);
    step();
    expect(bar.view(now, false)!.entry.ritual).toBe(true);
    const boss = resolveSectorBoss(state)!;
    const max = boss.maxHp;

    const big = driver.apply(state, 'hitBig');
    expect(big.some((e) => e.t === 'hit')).toBe(true);
    step();
    expect(bar.view(now, false)!.hpFrac).toBeCloseTo((max - max * 0.18) / max, 3);
    expect(bar.view(now, false)!.echoFrac).toBeCloseTo(1, 3);

    driver.apply(state, 'burst');
    let hits = 0;
    for (let i = 0; i < 6; i++) {
      const events = driver.tick(state);
      hits += events.filter((e) => e.t === 'hit').length;
      step();
    }
    expect(hits).toBe(4);

    const before = boss.hp;
    const heal = driver.apply(state, 'heal');
    expect(heal.map((e) => e.t)).toEqual(['heal']);
    step();
    expect(boss.hp).toBeGreaterThan(before);
    expect(bar.view(now, false)!.heal).not.toBeNull();
    expect(bar.view(now, false)!.hit).toBeNull();

    const phase = driver.apply(state, 'phase');
    expect(phase.map((e) => e.t)).toEqual(['boss_phase']);
    bar.ingestEvents(phase, now);
    step();
    expect(bar.view(now, false)!.phase).not.toBeNull();

    const kill = driver.apply(state, 'kill');
    expect(kill.some((e) => e.t === 'death' && e.archetype === 'guardian')).toBe(true);
    bar.ingestEvents(kill, now);
    step();
    const v = bar.view(now, false)!;
    expect(v.hpFrac).toBe(0);
    expect(v.death).not.toBeNull();
  });

  it('todos os cenarios existem no painel e nenhum quebra sem chefe', () => {
    const state = run();
    state.sectorBoss.archetype = null;
    const driver = new BossBarScenarioDriver();
    for (const scenario of BOSS_BAR_SCENARIOS) expect(driver.apply(state, scenario)).toEqual([]);
  });
});

describe('a galeria', () => {
  it('renderiza todos os cenarios em todas as viewports sem lancar', () => {
    const calls: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_t, prop: string) => {
        if (prop === 'measureText') return () => ({ width: 11 });
        return (..._args: unknown[]) => {
          calls.push(prop);
        };
      },
      set: () => true,
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;
    const gallery = new BossBarGallery(canvas);
    for (const scenario of GALLERY_SCENARIOS) {
      for (const viewport of ['desktop', 'landscape', 'portrait'] as const) {
        gallery.scenario = scenario;
        gallery.viewport = viewport;
        gallery.restart();
        for (let t = 0; t < 4600; t += 200) gallery.render(t);
      }
    }
    expect(calls.filter((c) => c === 'fillRect').length).toBeGreaterThan(100);
  });
});
