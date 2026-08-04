import { describe, expect, it } from 'vitest';
import {
  SOLID_FRAGILE,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_NONE,
} from '../src/constants';
import { spawnEnemy } from '../src/entities';
import { grantOrRechargeModule } from '../src/modules';
import { createRun, emptyCommand, stepRun } from '../src/run';
import type { Projectile, SemanticEvent, SurvivalState } from '../src/types';

// O bolt que morria em parede firme era o UNICO fim de tiro sem evento nenhum:
// `impactSolid` em rocha devolve { stop, broke: false } sem emitir nada, e o
// projetil sumia mudo. O `bolt_impact` e o burst de plasma desse termino — uma
// vez so, no ponto de contato, sem atropelar ricochet/piercing/explosive.

const clearArena = (state: SurvivalState, cx = 40, cy = 40, radius = 14): void => {
  state.enemies = [];
  state.vents = [];
  state.projectiles = [];
  state.player.x = cx + 0.5;
  state.player.y = cy + 0.5;
  state.player.hp = state.player.maxHp;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const i = y * state.config.width + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
    }
  }
};

const bolt = (state: SurvivalState, overrides: Partial<Projectile> = {}): Projectile => ({
  kind: 'bolt',
  id: state.nextEntityId++,
  owner: state.player.id,
  x: state.player.x,
  y: state.player.y,
  vx: 0,
  vy: 0,
  damage: 10,
  distanceTravelled: 0,
  hostile: false,
  leavesBiofluid: false,
  ttl: 40,
  ...overrides,
});

const impacts = (events: SemanticEvent[]): Extract<SemanticEvent, { t: 'bolt_impact' }>[] =>
  events.filter((event): event is Extract<SemanticEvent, { t: 'bolt_impact' }> => event.t === 'bolt_impact');

const runUntilSettled = (state: SurvivalState, maxTicks = 20): SemanticEvent[] => {
  const all: SemanticEvent[] = [];
  for (let tick = 0; tick < maxTicks && state.projectiles.length > 0; tick++) {
    all.push(...stepRun(state, [emptyCommand()]).events);
  }
  return all;
};

describe('bolt contra parede: burst de plasma', () => {
  it('emite exatamente UM bolt_impact na face da parede e remove o projetil', () => {
    const state = createRun({ seed: 0xb017 });
    clearArena(state);
    const wallX = Math.floor(state.player.x) + 3;
    state.solid[Math.floor(state.player.y) * state.config.width + wallX] = SOLID_ROCK;
    state.projectiles = [bolt(state, { vx: 13 })];

    const events = runUntilSettled(state);
    const bursts = impacts(events);
    expect(bursts).toHaveLength(1);
    // O contato e NA face oeste da parede, nao no centro da celula nem na
    // posicao anterior do projetil.
    expect(bursts[0].x).toBeCloseTo(wallX, 5);
    expect(bursts[0].y).toBeCloseTo(state.player.y, 5);
    expect(bursts[0].nx).toBe(-1);
    expect(bursts[0].ny).toBe(0);
    expect(state.projectiles).toHaveLength(0);
  });

  it('acerta a face certa tambem no eixo vertical', () => {
    const state = createRun({ seed: 0xb018 });
    clearArena(state);
    const wallY = Math.floor(state.player.y) - 3;
    state.solid[wallY * state.config.width + Math.floor(state.player.x)] = SOLID_ROCK;
    state.projectiles = [bolt(state, { vy: -13 })];

    const bursts = impacts(runUntilSettled(state));
    expect(bursts).toHaveLength(1);
    expect(bursts[0].y).toBeCloseTo(wallY + 1, 5);
    expect(bursts[0].ny).toBe(1);
  });

  it('ricochet: nenhum burst no rebote; o burst sai no impacto FINAL', () => {
    const state = createRun({ seed: 0xb019 });
    clearArena(state);
    grantOrRechargeModule(state.playerExtra, 'ricochet', state.tick);
    const w = state.config.width;
    const py = Math.floor(state.player.y);
    // Parede a leste (primeiro toque, rebote) e a oeste (fim do voo).
    state.solid[py * w + Math.floor(state.player.x) + 3] = SOLID_ROCK;
    state.solid[py * w + Math.floor(state.player.x) - 3] = SOLID_ROCK;
    state.projectiles = [bolt(state, { vx: 13, modules: { ricochet: { remainingBounces: 1 } } })];

    const first = stepRun(state, [emptyCommand()]).events;
    const second = stepRun(state, [emptyCommand()]).events;
    // Enquanto ha rebote sobrando, o rebote tem precedencia: sem explosao
    // prematura no primeiro toque.
    expect(impacts([...first, ...second]).length).toBeLessThanOrEqual(1);

    const rest = runUntilSettled(state);
    const total = impacts([...first, ...second, ...rest]);
    expect(total).toHaveLength(1);
    expect(state.projectiles).toHaveLength(0);
  });

  it('explosive armado detona e NAO empilha um segundo efeito de impacto', () => {
    const state = createRun({ seed: 0xb01a });
    clearArena(state);
    grantOrRechargeModule(state.playerExtra, 'explosive', state.tick);
    const wallX = Math.floor(state.player.x) + 6;
    state.solid[Math.floor(state.player.y) * state.config.width + wallX] = SOLID_ROCK;
    state.projectiles = [
      bolt(state, { vx: 13, modules: { explosive: { armAfterDistance: 2.25 } } }),
    ];

    const events = runUntilSettled(state);
    expect(events.filter((event) => event.t === 'explosion')).toHaveLength(1);
    expect(impacts(events)).toHaveLength(0);
  });

  it('piercing que atravessa parede quebrada nao produz burst naquela parede', () => {
    const state = createRun({ seed: 0xb01b });
    clearArena(state);
    grantOrRechargeModule(state.playerExtra, 'piercing', state.tick);
    const w = state.config.width;
    const py = Math.floor(state.player.y);
    state.solid[py * w + Math.floor(state.player.x) + 3] = SOLID_FRAGILE;
    state.projectiles = [bolt(state, { vx: 13, modules: { piercing: true } })];

    const events: SemanticEvent[] = [];
    for (let tick = 0; tick < 8 && !events.some((event) => event.t === 'break'); tick++) {
      events.push(...stepRun(state, [emptyCommand()]).events);
    }
    // A fragil quebra (evento `break`), o tiro atravessa: sem burst ali.
    expect(events.some((event) => event.t === 'break')).toBe(true);
    expect(impacts(events)).toHaveLength(0);
    expect(state.projectiles).toHaveLength(1);
  });

  it('parede que QUEBRA sem piercing tambem nao empilha burst sobre o entulho', () => {
    const state = createRun({ seed: 0xb01c });
    clearArena(state);
    const w = state.config.width;
    const py = Math.floor(state.player.y);
    state.solid[py * w + Math.floor(state.player.x) + 3] = SOLID_FRAGILE;
    state.projectiles = [bolt(state, { vx: 13 })];

    const events = runUntilSettled(state);
    expect(events.some((event) => event.t === 'break')).toBe(true);
    expect(impacts(events)).toHaveLength(0);
  });

  it('colisao com inimigo preserva o comportamento atual, sem burst de parede', () => {
    const state = createRun({ seed: 0xb01d });
    clearArena(state);
    const enemy = spawnEnemy(state, 'bruiser', state.player.x + 3, state.player.y, false);
    enemy.x = state.player.x + 3;
    enemy.y = state.player.y;
    const hp = enemy.hp;
    state.projectiles = [bolt(state, { vx: 13, damage: 5 })];

    const events = runUntilSettled(state);
    expect(enemy.hp).toBeLessThan(hp);
    expect(impacts(events)).toHaveLength(0);
  });

  it('projeteis hostis e de outros tipos morrem na parede sem burst de plasma', () => {
    const state = createRun({ seed: 0xb01e });
    clearArena(state);
    const wallX = Math.floor(state.player.x) + 3;
    state.solid[Math.floor(state.player.y) * state.config.width + wallX] = SOLID_ROCK;
    state.projectiles = [
      // O cuspe nasce a frente do jogador (nao em cima dele) e voa para a
      // mesma parede que engoliria um bolt.
      bolt(state, {
        kind: 'spit',
        hostile: true,
        owner: -1,
        vx: 13,
        x: state.player.x + 1.2,
        leavesBiofluid: true,
      }),
      bolt(state, { kind: 'seeker', vx: 13, y: state.player.y + 4, x: state.player.x }),
    ];
    // O seeker anda no eixo X quatro tiles ao sul, longe da parede do spit; o
    // que importa aqui e o cuspe hostil morrendo na MESMA parede sem plasma.
    const events = runUntilSettled(state, 30);
    expect(impacts(events)).toHaveLength(0);
  });
});
