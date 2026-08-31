import { describe, expect, it } from 'vitest';
import {
  SOLID_NONE,
  SOLID_ROCK,
  createRun,
  type DamageCause,
  type RunSummary,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import {
  DEATH_ECHO_TRACE_SAMPLES,
  deathEchoTraceDuration,
  decodeDeathEchoTracePoint,
  encodeDeathEchoTrace,
  projectDeathEchoes,
  type DeathEchoTraceSample,
} from '@voxelyn/survival-protocol';
import {
  DEATH_ECHO_HISTORY_LIMIT,
  applyDeathEchoOnce,
  captureDeathEcho,
  decodeDeathEchoRecords,
  emptyDeathEchoRecords,
  type DeathEchoCapsule,
  type DeathEchoRecords,
} from './death-echoes';

const finishDead = (state: SurvivalState, cause: DamageCause = { kind: 'fire' }): SurvivalState => {
  state.phase = 'dead';
  state.player.alive = false;
  const summary: RunSummary = {
    seed: state.config.seed,
    phase: 'dead',
    ticks: 1234,
    contamination: state.contamination,
    deathCause: cause,
    stats: { ...state.stats, kills: { ...state.stats.kills } },
    cores: 0,
    coresAvailable: 1,
    sectorCount: 3,
    stars: 0,
    targetTicks: 9600,
  };
  state.summary = summary;
  return state;
};

const squaredDistance = (ax: number, ay: number, bx: number, by: number): number =>
  (ax - bx) ** 2 + (ay - by) ** 2;

const safeOpenCell = (state: SurvivalState): { x: number; y: number } => {
  const width = state.config.width;
  for (let y = 0; y < state.config.height; y++) {
    for (let x = 0; x < width; x++) {
      if (state.solid[y * width + x] !== SOLID_NONE) continue;
      if (squaredDistance(x, y, state.entry.x, state.entry.y) < 8 ** 2) continue;
      if (squaredDistance(x, y, state.corePos.x, state.corePos.y) < 7 ** 2) continue;
      if (state.salvageSites.some((site) =>
        squaredDistance(x, y, site.terminal.x, site.terminal.y) < 5 ** 2 ||
        squaredDistance(x, y, site.cache.x, site.cache.y) < 5 ** 2
      )) continue;
      if (state.enemies.some((enemy) => squaredDistance(x, y, enemy.x, enemy.y) < 4 ** 2)) continue;
      return { x, y };
    }
  }
  throw new Error('fixture sem célula segura');
};

const recordOf = (echoes: DeathEchoCapsule[]): DeathEchoRecords => ({
  schema: 1,
  nextSerial: echoes.length + 1,
  echoes,
});

describe('cápsula de morte local', () => {
  it('captura causa autoritativa, posição e assinatura topológica', () => {
    const state = createRun({ seed: 0x1234abcd });
    const cell = safeOpenCell(state);
    state.player.x = cell.x + 0.5;
    state.player.y = cell.y + 0.5;
    state.player.facing = { x: -1, y: 0.25 };
    finishDead(state, { kind: 'discharge', source: 'player' });

    const echo = captureDeathEcho(state, 'echo-1');
    expect(echo).not.toBeNull();
    expect(echo?.sourceSeed).toBe(0x1234abcd);
    expect(echo?.sector).toBe(1);
    expect(echo?.sourceX).toBe(cell.x);
    expect(echo?.sourceY).toBe(cell.y);
    expect(echo?.progressQ).toBeGreaterThanOrEqual(0);
    expect(echo?.progressQ).toBeLessThanOrEqual(255);
    expect(echo?.openness).toBeGreaterThanOrEqual(0);
    expect(echo?.openness).toBeLessThanOrEqual(8);
    expect(echo?.cause).toEqual({ kind: 'discharge', source: 'player' });
    expect(echo?.facingX).toBe(-1);
  });

  it('não inventa causa local no co-op a partir da morte que encerrou a sala', () => {
    const state = finishDead(createRun({ seed: 0xdecafbad, playerCount: 2 }), {
      kind: 'enemy_contact',
      archetype: 'guardian',
      elite: false,
    });
    // `summary.deathCause` descreve o fim da RUN. Sem causa por slot no wire, não
    // há prova de que ela pertence à posição de `state.player` deste cliente.
    expect(captureDeathEcho(state, 'ambiguous-coop')).toBeNull();
    const result = applyDeathEchoOnce(emptyDeathEchoRecords(), state, null);
    expect(result.applied).toBe(false);
    expect(result.records.echoes).toEqual([]);
  });

  it('deduplica snapshots terminais, mas aceita a mesma run depois do reset', () => {
    const state = finishDead(createRun({ seed: 42 }));
    const first = applyDeathEchoOnce(emptyDeathEchoRecords(), state, null);
    expect(first.applied).toBe(true);
    expect(first.records.echoes).toHaveLength(1);

    const duplicate = applyDeathEchoOnce(first.records, state, first.identity);
    expect(duplicate.applied).toBe(false);
    expect(duplicate.records.echoes).toHaveLength(1);

    const replayedAfterReset = applyDeathEchoOnce(duplicate.records, state, null);
    expect(replayedAfterReset.applied).toBe(true);
    expect(replayedAfterReset.records.echoes).toHaveLength(2);
    expect(replayedAfterReset.records.echoes[0].id).not.toBe(replayedAfterReset.records.echoes[1].id);
  });

  it('descarta schema, causa ou entrada corrompida sem impedir o jogo', () => {
    expect(decodeDeathEchoRecords('{')).toEqual(emptyDeathEchoRecords());
    expect(decodeDeathEchoRecords(JSON.stringify({ schema: 99, echoes: [] }))).toEqual(emptyDeathEchoRecords());

    const valid = finishDead(createRun({ seed: 9 }));
    const echo = captureDeathEcho(valid, 'ok');
    const decoded = decodeDeathEchoRecords(JSON.stringify({
      schema: 1,
      nextSerial: 7,
      echoes: [
        echo,
        { ...echo, id: 'bad-source', cause: { kind: 'explosion', source: 'somewhere' } },
        { ...echo, id: 'bad-archetype', cause: { kind: 'enemy_contact', archetype: 'bogus', elite: false } },
        {
          ...echo,
          id: 'player-bolt-as-enemy',
          cause: { kind: 'enemy_projectile', archetype: 'stalker', elite: false, projectile: 'bolt' },
        },
        {
          ...echo,
          id: 'wrong-rock-shooter',
          cause: { kind: 'enemy_projectile', archetype: 'spitter', elite: false, projectile: 'rock' },
        },
        {
          ...echo,
          id: 'bad-projectile',
          cause: { kind: 'enemy_projectile', archetype: 'spitter', elite: false, projectile: 'laser' },
        },
        { id: '', cause: null },
      ],
    }));
    expect(decoded.echoes).toHaveLength(1);
    expect(decoded.echoes[0].id).toBe('ok');
    expect(decoded.nextSerial).toBe(7);
  });

  it('aceita somente combinações de projétil que a simulação pode emitir', () => {
    const state = finishDead(createRun({ seed: 10 }));
    const echo = captureDeathEcho(state, 'base');
    if (!echo) throw new Error('eco não capturado');
    // A lista segue a matriz da simulacao, e ela MUDOU: o Guardiao atira pedra
    // desde a Salva Litoclasta, e o Bispo saiu do ramo de projetil (a resposta
    // a distancia dele e a Supernova, que e area). Este teste afirmava as duas
    // combinacoes antigas — passava verde sobre um defeito, que e o pior lugar
    // para um teste estar.
    const validCauses: DamageCause[] = [
      { kind: 'enemy_projectile', archetype: 'spitter', elite: false, projectile: 'spit' },
      { kind: 'enemy_projectile', archetype: 'guardian', elite: false, projectile: 'rock' },
      { kind: 'enemy_projectile', archetype: 'bruiser', elite: false, projectile: 'rock' },
      { kind: 'enemy_projectile', archetype: 'miner', elite: false, projectile: 'cart' },
    ];
    const decoded = decodeDeathEchoRecords(JSON.stringify({
      schema: 1,
      nextSerial: 5,
      echoes: validCauses.map((cause, index) => ({ ...echo, id: `valid-${index}`, cause })),
    }));
    expect(decoded.echoes).toHaveLength(validCauses.length);

    // E o que a simulacao NAO consegue mais produzir continua barrado, para o
    // teste nao passar por afrouxamento da matriz.
    const impossible: DamageCause[] = [
      { kind: 'enemy_projectile', archetype: 'guardian', elite: false, projectile: 'spit' },
      { kind: 'enemy_projectile', archetype: 'bishop', elite: false, projectile: 'spit' },
    ];
    const rejected = decodeDeathEchoRecords(JSON.stringify({
      schema: 1,
      nextSerial: 5,
      echoes: impossible.map((cause, index) => ({ ...echo, id: `no-${index}`, cause })),
    }));
    expect(rejected.echoes).toHaveLength(0);
  });

  it('a morte para um chefe novo tambem vira Eco', () => {
    // Oito chefes entraram no jogo sem entrar na matriz de arquetipos, e toda
    // morte para eles era descartada em silencio ao carregar o storage.
    const state = finishDead(createRun({ seed: 10 }));
    const echo = captureDeathEcho(state, 'base');
    if (!echo) throw new Error('eco não capturado');
    const bosses = ['diamandis', 'white_devourer', 'archcantor', 'sheet_leviathan',
      'lung_matrix', 'furnace_heart', 'frost_queen', 'magnetarch'];
    const decoded = decodeDeathEchoRecords(JSON.stringify({
      schema: 1,
      nextSerial: 5,
      echoes: bosses.map((archetype, index) => ({
        ...echo,
        id: `boss-${index}`,
        cause: { kind: 'enemy_contact', archetype, elite: false },
      })),
    }));
    expect(decoded.echoes).toHaveLength(bosses.length);
  });

  it('mantém somente o teto de mortes recentes', () => {
    let records = emptyDeathEchoRecords();
    for (let i = 0; i < DEATH_ECHO_HISTORY_LIMIT + 5; i++) {
      const state = finishDead(createRun({ seed: i + 1 }));
      state.summary = { ...(state.summary as RunSummary), ticks: 1000 + i };
      records = applyDeathEchoOnce(records, state, null).records;
    }
    expect(records.echoes).toHaveLength(DEATH_ECHO_HISTORY_LIMIT);
    expect(records.echoes[0].sourceSeed).toBe(DEATH_ECHO_HISTORY_LIMIT + 5);
  });
});

describe('rastro dos últimos segundos', () => {
  const walk = (count: number, firing = false): DeathEchoTraceSample[] =>
    Array.from({ length: count }, (_, i) => ({
      x: 20 + i * 0.25,
      y: 30,
      aimX: 1,
      aimY: 0,
      firing: firing && i % 2 === 0,
    }));

  it('não guarda rastro de uma morte curta demais para contar algo', () => {
    expect(encodeDeathEchoTrace([], 20, 30)).toBeNull();
    expect(encodeDeathEchoTrace(walk(1), 20, 30)).toBeNull();
    expect(encodeDeathEchoTrace(walk(2), 20, 30)).not.toBeNull();
  });

  it('mantém apenas a janela final e devolve os pontos ao mundo', () => {
    const samples = walk(DEATH_ECHO_TRACE_SAMPLES + 10, true);
    const last = samples[samples.length - 1];
    const trace = encodeDeathEchoTrace(samples, last.x, last.y);
    if (!trace) throw new Error('rastro não codificado');
    expect(trace.dx).toHaveLength(DEATH_ECHO_TRACE_SAMPLES);
    expect(deathEchoTraceDuration(trace)).toBe(DEATH_ECHO_TRACE_SAMPLES * trace.stepMs);

    const head = decodeDeathEchoTracePoint(trace, trace.dx.length - 1, last.x, last.y);
    expect(head?.x).toBeCloseTo(last.x, 1);
    expect(head?.y).toBeCloseTo(last.y, 1);
    expect(head?.aimX).toBeCloseTo(1, 5);
    expect(head?.firing).toBe(last.firing);
    // A quantização é grosseira de propósito, mas o trajeto tem de continuar
    // sendo um trajeto: o primeiro ponto fica atrás do último.
    const tail = decodeDeathEchoTracePoint(trace, 0, last.x, last.y);
    expect(tail?.x).toBeLessThan(head?.x ?? 0);
    expect(decodeDeathEchoTracePoint(trace, trace.dx.length, last.x, last.y)).toBeNull();
  });

  it('viaja com a cápsula e sobrevive ao storage', () => {
    const state = finishDead(createRun({ seed: 0x5150 }));
    const samples = walk(6, true).map((sample) => ({
      ...sample,
      x: state.player.x + sample.x - 20,
      y: state.player.y,
    }));
    const echo = captureDeathEcho(state, 'with-trace', samples);
    expect(echo?.finalTrace?.dx).toHaveLength(6);

    const decoded = decodeDeathEchoRecords(JSON.stringify(recordOf([echo as DeathEchoCapsule])));
    expect(decoded.echoes[0].finalTrace?.dx).toEqual(echo?.finalTrace?.dx);
    expect(decoded.echoes[0].finalTrace?.aim).toEqual(echo?.finalTrace?.aim);
  });

  it('descarta um rastro corrompido sem perder a carcaça, que é a parte que ensina', () => {
    const state = finishDead(createRun({ seed: 0x5151 }));
    const echo = captureDeathEcho(state, 'broken-trace', walk(5));
    if (!echo) throw new Error('eco não capturado');
    const decoded = decodeDeathEchoRecords(JSON.stringify(recordOf([
      { ...echo, id: 'mismatched-lengths', finalTrace: { ...echo.finalTrace, dy: [1] } },
      { ...echo, id: 'out-of-range', finalTrace: { ...echo.finalTrace, aim: [99, 0, 0, 0, 0] } },
      { ...echo, id: 'not-an-object', finalTrace: 7 },
    ] as unknown as DeathEchoCapsule[])));
    expect(decoded.echoes).toHaveLength(3);
    for (const entry of decoded.echoes) {
      expect(entry.finalTrace).toBeUndefined();
      expect(entry.cause).toEqual(echo.cause);
    }
  });
});

describe('projeção topológica', () => {
  it('usa a coordenada real quando a mesma seed ainda oferece uma célula segura', () => {
    const state = createRun({ seed: 0x11112222 });
    const cell = safeOpenCell(state);
    state.player.x = cell.x + 0.5;
    state.player.y = cell.y + 0.5;
    finishDead(state);
    const echo = captureDeathEcho(state, 'same-seed');
    if (!echo) throw new Error('eco não capturado');

    const fresh = createRun({ seed: state.config.seed });
    const placed = projectDeathEchoes(fresh, [echo]);
    expect(placed).toHaveLength(1);
    expect(placed[0].projection).toBe('exact');
    expect(placed[0].cell).toBe(cell.y * fresh.config.width + cell.x);
  });

  it('não chama de exata uma coordenada produzida por outra versão do worldgen', () => {
    const source = createRun({ seed: 0x22223333 });
    const cell = safeOpenCell(source);
    source.player.x = cell.x + 0.5;
    source.player.y = cell.y + 0.5;
    finishDead(source);
    const echo = captureDeathEcho(source, 'stale-version');
    if (!echo) throw new Error('eco não capturado');

    const stale = {
      ...echo,
      sourceSimulationVersion: Math.max(0, echo.sourceSimulationVersion - 1),
    };
    const fresh = createRun({ seed: source.config.seed });
    const placed = projectDeathEchoes(fresh, [stale]);
    expect(placed).toHaveLength(1);
    expect(placed[0].projection).toBe('topological');
  });

  it('reprojeta deterministicamente em outra seed e respeita áreas reservadas', () => {
    const source = createRun({ seed: 0x01020304 });
    const sourceCell = safeOpenCell(source);
    source.player.x = sourceCell.x + 0.5;
    source.player.y = sourceCell.y + 0.5;
    finishDead(source, { kind: 'enemy_contact', archetype: 'bruiser', elite: false });
    const echo = captureDeathEcho(source, 'cross-seed');
    if (!echo) throw new Error('eco não capturado');

    const target = createRun({ seed: 0xa0b0c0d0 });
    const first = projectDeathEchoes(target, [echo]);
    const second = projectDeathEchoes(target, [echo]);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0].projection).toBe('topological');

    const x = Math.floor(first[0].x);
    const y = Math.floor(first[0].y);
    expect(squaredDistance(x, y, target.entry.x, target.entry.y)).toBeGreaterThanOrEqual(7 ** 2);
    expect(squaredDistance(x, y, target.corePos.x, target.corePos.y)).toBeGreaterThanOrEqual(6 ** 2);
    for (const site of target.salvageSites) {
      expect(squaredDistance(x, y, site.terminal.x, site.terminal.y)).toBeGreaterThanOrEqual(4 ** 2);
      expect(squaredDistance(x, y, site.cache.x, site.cache.y)).toBeGreaterThanOrEqual(4 ** 2);
    }
  });

  it('prefere ausência a forçar um corpo num mapa sem célula aceitável', () => {
    const source = finishDead(createRun({ seed: 7 }));
    const echo = captureDeathEcho(source, 'no-space');
    if (!echo) throw new Error('eco não capturado');

    const target = createRun({ seed: 8 });
    target.solid.fill(SOLID_ROCK);
    target.solid[target.entry.y * target.config.width + target.entry.x] = SOLID_NONE;
    expect(projectDeathEchoes(target, [echo])).toEqual([]);
  });
});
