import { describe, expect, it } from 'vitest';
import {
  BOLT_SPEED,
  DEFAULT_PLAYER_TUNING,
  LURKER_EXPOSED,
  LURKER_HIDDEN,
  MINER_MOOD_ENRAGED,
  MINER_MOOD_FLEEING,
  MINER_MOOD_PASSIVE,
  SOLID_NONE,
  TICK_HZ,
  createRun,
  emptyCommand,
  type Entity,
  type PlayerTuning,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import {
  ACQUIRE_RANGE_TILES,
  EngagementMemory,
  acquireTarget,
  applyCombatAssist,
  combatTuningOf,
  interceptPoint,
  isAcquirableTarget,
  threatMarks,
  threatPostureOf,
} from './combat-assist';

// Mundo REAL da sim, esvaziado: as regras de aquisicao leem `solid`, `config`
// e `enemies`, e um estado sintetico esqueceria o proximo campo que a
// assistencia passasse a consultar.
const openState = (): SurvivalState => {
  const state = createRun({ seed: 1234 });
  state.solid.fill(SOLID_NONE);
  state.enemies.length = 0;
  state.player.x = 40;
  state.player.y = 40;
  state.player.alive = true;
  return state;
};

let nextId = 100;
const enemy = (x: number, y: number, over: Partial<Entity> = {}): Entity => ({
  id: nextId++,
  kind: 'enemy',
  archetype: 'stalker',
  x,
  y,
  vx: 0,
  vy: 0,
  hp: 10,
  maxHp: 10,
  radius: 0.4,
  alive: true,
  elite: false,
  nextActionAt: 0,
  contactReadyAt: 0,
  rangedReadyAt: 0,
  stunnedUntil: 0,
  alertedUntil: 0,
  facing: { x: 1, y: 0 },
  ...over,
});

const withCombat = (
  state: SurvivalState,
  combat: Partial<PlayerTuning['combat']>,
): SurvivalState => {
  state.config.tuning = {
    ...DEFAULT_PLAYER_TUNING,
    navigation: { ...DEFAULT_PLAYER_TUNING.navigation },
    combat: { ...DEFAULT_PLAYER_TUNING.combat, ...combat },
  };
  return state;
};

/** Parede vertical em `x`, cobrindo `y0..y1`. Basta ser != SOLID_NONE. */
const wallColumn = (state: SurvivalState, x: number, y0: number, y1: number): void => {
  for (let y = y0; y <= y1; y++) state.solid[y * state.config.width + x] = 1;
};

describe('alcance de aquisicao', () => {
  it('nunca passa do alcance efetivo do bolt', () => {
    const boltRange = BOLT_SPEED * (Math.ceil(TICK_HZ * 1.4) / TICK_HZ);
    expect(ACQUIRE_RANGE_TILES).toBeLessThanOrEqual(boltRange);
    expect(ACQUIRE_RANGE_TILES).toBeGreaterThan(0);
  });
});

describe('validade de alvo (as regras do capstone)', () => {
  it('vivo, hostil, no alcance e com linha de visao: valido', () => {
    const state = openState();
    const target = enemy(44, 40);
    expect(isAcquirableTarget(state, state.player, target)).toBe(true);
  });

  it('morto nao e alvo', () => {
    const state = openState();
    expect(isAcquirableTarget(state, state.player, enemy(44, 40, { alive: false }))).toBe(false);
  });

  it('fora do alcance nao e alvo', () => {
    const state = openState();
    const far = enemy(40 + ACQUIRE_RANGE_TILES + 2, 40);
    expect(isAcquirableTarget(state, state.player, far)).toBe(false);
  });

  it('atras de parede NUNCA e alvo', () => {
    const state = openState();
    wallColumn(state, 42, 36, 44);
    expect(isAcquirableTarget(state, state.player, enemy(45, 40))).toBe(false);
  });

  // O Minerador comeca neutro e reage ao calor da arma. Um auto-aim ingenuo
  // faria o jogador ataca-lo por acidente — e a mancha de `innocentsKilled`
  // sairia de uma decisao que nao foi dele.
  it('Minerador passivo ou em fuga nao e alvo; enfurecido e', () => {
    const state = openState();
    const passive = enemy(44, 40, { archetype: 'miner', mood: MINER_MOOD_PASSIVE });
    const fleeing = enemy(44, 40, { archetype: 'miner', mood: MINER_MOOD_FLEEING });
    const enraged = enemy(44, 40, { archetype: 'miner', mood: MINER_MOOD_ENRAGED });
    expect(isAcquirableTarget(state, state.player, passive)).toBe(false);
    expect(isAcquirableTarget(state, state.player, fleeing)).toBe(false);
    expect(isAcquirableTarget(state, state.player, enraged)).toBe(true);
  });

  it('espreitador submerso nao e alvo; exposto e', () => {
    const state = openState();
    const hidden = enemy(44, 40, { archetype: 'mud_lamprey', mood: LURKER_HIDDEN });
    const exposed = enemy(44, 40, { archetype: 'mud_lamprey', mood: LURKER_EXPOSED });
    expect(isAcquirableTarget(state, state.player, hidden)).toBe(false);
    expect(isAcquirableTarget(state, state.player, exposed)).toBe(true);
  });
});

describe('acquireTarget', () => {
  it('escolhe o mais proximo', () => {
    const state = openState();
    const near = enemy(43, 40);
    const far = enemy(47, 40);
    state.enemies.push(far, near);
    expect(acquireTarget(state, state.player)).toBe(near);
  });

  it('empate exato resolve pelo menor entity.id', () => {
    const state = openState();
    const a = enemy(44, 40, { id: 7 });
    const b = enemy(36, 40, { id: 3 });
    state.enemies.push(a, b);
    expect(acquireTarget(state, state.player)?.id).toBe(3);
  });

  it('sem alvo valido, null', () => {
    const state = openState();
    state.enemies.push(enemy(44, 40, { alive: false }));
    expect(acquireTarget(state, state.player)).toBeNull();
  });
});

describe('IA-X · Diretiva Autonoma (tap neutro)', () => {
  it('resolve o tap contra o alvo valido mais proximo', () => {
    const state = withCombat(openState(), { autoAcquire: true });
    state.enemies.push(enemy(45, 40));
    const cmd = emptyCommand();
    applyCombatAssist(state, cmd, true, new EngagementMemory());
    expect(cmd.fire).toBe(true);
    expect(cmd.aim.x).toBeCloseTo(1, 6);
    expect(cmd.aim.y).toBeCloseTo(0, 6);
  });

  it('sem alvo valido, nenhum disparo acontece', () => {
    const state = withCombat(openState(), { autoAcquire: true });
    const cmd = emptyCommand();
    applyCombatAssist(state, cmd, true, new EngagementMemory());
    expect(cmd.fire).toBe(false);
  });

  it('sem IA-X, o tap e consumido e nada acontece', () => {
    const state = withCombat(openState(), { autoAcquire: false });
    state.enemies.push(enemy(45, 40));
    const cmd = emptyCommand();
    applyCombatAssist(state, cmd, true, new EngagementMemory());
    expect(cmd.fire).toBe(false);
  });

  it('um vetor manual sempre substitui o auto-aim', () => {
    const state = withCombat(openState(), { autoAcquire: true });
    state.enemies.push(enemy(45, 40));
    const cmd = emptyCommand();
    cmd.fire = true;
    cmd.aim = { x: 0, y: -1 }; // mirando para OUTRO lado, de proposito
    applyCombatAssist(state, cmd, true, new EngagementMemory());
    expect(cmd.aim).toEqual({ x: 0, y: -1 });
  });
});

describe('IA-04 · Correcao Vetorial', () => {
  it('mira que passa dentro do cone encosta no alvo', () => {
    const state = withCombat(openState(), { aimAssistConeDegrees: 6 });
    state.enemies.push(enemy(48, 40));
    const cmd = emptyCommand();
    cmd.fire = true;
    // ~4 graus fora do rumo exato: dentro do cone de 6.
    const rad = (4 * Math.PI) / 180;
    cmd.aim = { x: Math.cos(rad), y: Math.sin(rad) };
    applyCombatAssist(state, cmd, false, new EngagementMemory());
    expect(cmd.aim.x).toBeCloseTo(1, 6);
    expect(cmd.aim.y).toBeCloseTo(0, 6);
  });

  it('mira fora do cone fica exatamente onde o jogador a pos', () => {
    const state = withCombat(openState(), { aimAssistConeDegrees: 6 });
    state.enemies.push(enemy(48, 40));
    const cmd = emptyCommand();
    cmd.fire = true;
    const rad = (12 * Math.PI) / 180;
    const aim = { x: Math.cos(rad), y: Math.sin(rad) };
    cmd.aim = { ...aim };
    applyCombatAssist(state, cmd, false, new EngagementMemory());
    expect(cmd.aim).toEqual(aim);
  });

  it('nao corrige para um alvo atras de parede', () => {
    const state = withCombat(openState(), { aimAssistConeDegrees: 6 });
    wallColumn(state, 44, 36, 44);
    state.enemies.push(enemy(48, 40));
    const cmd = emptyCommand();
    cmd.fire = true;
    cmd.aim = { x: 1, y: 0 };
    applyCombatAssist(state, cmd, false, new EngagementMemory());
    expect(cmd.aim).toEqual({ x: 1, y: 0 });
  });
});

describe('IA-05 · Memoria de Engajamento', () => {
  const tuningIds = { targetMemoryTicks: 30 };

  it('aquisicao manual lembra o alvo e adere enquanto a mira acompanha', () => {
    const state = withCombat(openState(), tuningIds);
    const target = enemy(48, 40);
    state.enemies.push(target);
    const memory = new EngagementMemory();

    // 1º tick: mira quase exata adquire (cone de aquisicao sem IA-04).
    const first = emptyCommand();
    first.fire = true;
    const rad = (5 * Math.PI) / 180;
    first.aim = { x: Math.cos(rad), y: Math.sin(rad) };
    applyCombatAssist(state, first, false, memory);
    expect(memory.heldTarget(state.tick)).toBe(target.id);

    // 2º tick: a mira derrapou 20 graus — dentro da aderencia, encosta.
    const second = emptyCommand();
    second.fire = true;
    const drift = (20 * Math.PI) / 180;
    second.aim = { x: Math.cos(drift), y: Math.sin(drift) };
    applyCombatAssist(state, second, false, memory);
    expect(second.aim.x).toBeCloseTo(1, 6);
    expect(second.aim.y).toBeCloseTo(0, 6);
  });

  it('desviar de vez solta a aderencia', () => {
    const state = withCombat(openState(), tuningIds);
    const target = enemy(48, 40);
    state.enemies.push(target);
    const memory = new EngagementMemory();
    memory.remember(target.id, state.tick + 30);

    const cmd = emptyCommand();
    cmd.fire = true;
    cmd.aim = { x: 0, y: -1 }; // 90 graus: decisao nova do jogador
    applyCombatAssist(state, cmd, false, memory);
    expect(cmd.aim).toEqual({ x: 0, y: -1 });
    expect(memory.heldTarget(state.tick)).toBeNull();
  });

  it('quando o alvo lembrado morre, troca para o proximo', () => {
    const state = withCombat(openState(), tuningIds);
    const dead = enemy(48, 40, { alive: false });
    const next = enemy(44, 41);
    state.enemies.push(dead, next);
    const memory = new EngagementMemory();
    memory.remember(dead.id, state.tick + 30);

    const cmd = emptyCommand();
    cmd.fire = true;
    cmd.aim = { x: 1, y: 0 };
    applyCombatAssist(state, cmd, false, memory);
    expect(memory.heldTarget(state.tick)).toBe(next.id);
  });

  it('a memoria expira sozinha: aderencia e curta, nao lock-on', () => {
    const state = withCombat(openState(), tuningIds);
    const target = enemy(48, 40);
    state.enemies.push(target);
    const memory = new EngagementMemory();
    memory.remember(target.id, state.tick); // ja vencida

    const cmd = emptyCommand();
    cmd.fire = true;
    const drift = (20 * Math.PI) / 180;
    const aim = { x: Math.cos(drift), y: Math.sin(drift) };
    cmd.aim = { ...aim };
    applyCombatAssist(state, cmd, false, memory);
    expect(cmd.aim).toEqual(aim);
  });

  // "Nao adquire alvos partindo do repouso": sem gatilho apertado, a memoria
  // nao faz nada — nem o tap neutro a alimenta.
  it('sem disparo manual, nada e adquirido', () => {
    const state = withCombat(openState(), tuningIds);
    state.enemies.push(enemy(44, 40));
    const memory = new EngagementMemory();
    const cmd = emptyCommand();
    applyCombatAssist(state, cmd, false, memory);
    expect(memory.heldTarget(state.tick)).toBeNull();
    expect(cmd.fire).toBe(false);
  });
});

describe('IA-01 · classificacao para o desenho', () => {
  it('classifica hostil, passivo e em fuga, e marca o hostil mais proximo', () => {
    const state = openState();
    const hostile = enemy(44, 40);
    const nearer = enemy(42, 40);
    const passive = enemy(43, 41, { archetype: 'miner', mood: MINER_MOOD_PASSIVE });
    const fleeing = enemy(43, 39, { archetype: 'miner', mood: MINER_MOOD_FLEEING });
    state.enemies.push(hostile, nearer, passive, fleeing);
    const marks = threatMarks(state);
    expect(marks).toHaveLength(4);
    expect(marks.find((m) => m.enemy === nearer)?.nearest).toBe(true);
    expect(marks.find((m) => m.enemy === hostile)?.nearest).toBe(false);
    expect(marks.find((m) => m.enemy === passive)?.posture).toBe('passive');
    expect(marks.find((m) => m.enemy === fleeing)?.posture).toBe('fleeing');
  });

  it('nao classifica atraves de paredes', () => {
    const state = openState();
    wallColumn(state, 42, 36, 44);
    state.enemies.push(enemy(45, 40));
    expect(threatMarks(state)).toHaveLength(0);
  });

  it('postura: so o Minerador tem tres', () => {
    expect(threatPostureOf(enemy(0, 0, { archetype: 'bruiser' }))).toBe('hostile');
    expect(threatPostureOf(enemy(0, 0, { archetype: 'miner' }))).toBe('passive');
  });
});

describe('IA-03 · solucao de interceptacao', () => {
  it('alvo parado: o ponto e o proprio alvo', () => {
    const point = interceptPoint({ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 0 }, BOLT_SPEED);
    expect(point).not.toBeNull();
    expect(point?.x).toBeCloseTo(6, 6);
    expect(point?.y).toBeCloseTo(0, 6);
  });

  it('alvo em movimento: o ponto ANTECIPA o rumo', () => {
    const point = interceptPoint({ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 4 }, BOLT_SPEED);
    expect(point).not.toBeNull();
    expect(point!.y).toBeGreaterThan(0.1);
  });

  it('sem solucao alcancavel, null', () => {
    // Alvo mais rapido que o projetil, fugindo em linha: nao ha encontro.
    const point = interceptPoint(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: BOLT_SPEED * 2, y: 0 },
      BOLT_SPEED,
    );
    expect(point).toBeNull();
  });
});

describe('tolerancia a ticket antigo', () => {
  it('tuning sem o grupo combat cai no default desligado', () => {
    const legacy = { ...DEFAULT_PLAYER_TUNING } as PlayerTuning;
    // Simula o JSON de um ticket emitido antes da trilha existir.
    delete (legacy as unknown as Record<string, unknown>).combat;
    const combat = combatTuningOf(legacy);
    expect(combat.autoAcquire).toBe(false);
    expect(combat.aimAssistConeDegrees).toBe(0);
  });
});
