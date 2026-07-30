import { describe, expect, it } from 'vitest';
import {
  SOLID_NONE,
  SOLID_ROCK,
  createRun,
  type DamageCause,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import {
  CONTENT_VERSION,
  DEATH_ECHO_CLUSTER_RADIUS,
  SIMULATION_VERSION,
  buildDeathEchoCapsule,
  contractSeed,
  contractWeekKey,
  deathEchoContract,
  deathEchoTopology,
  groupDeathEchoesByChamber,
  parseDeathEchoCapsule,
  parseDeathEchoContract,
  projectDeathEchoes,
  type DeathEchoCapsule,
  type PlacedDeathEcho,
} from '../src/index.js';

const squaredDistance = (ax: number, ay: number, bx: number, by: number): number =>
  (ax - bx) ** 2 + (ay - by) ** 2;

const safeOpenCell = (state: SurvivalState): { x: number; y: number } => {
  const width = state.config.width;
  for (let y = 0; y < state.config.height; y++) {
    for (let x = 0; x < width; x++) {
      if (state.solid[y * width + x] !== SOLID_NONE) continue;
      if (squaredDistance(x, y, state.entry.x, state.entry.y) < 9 ** 2) continue;
      if (squaredDistance(x, y, state.corePos.x, state.corePos.y) < 8 ** 2) continue;
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

const capsuleAt = (
  state: SurvivalState,
  id: string,
  cause: DamageCause = { kind: 'fire' },
): DeathEchoCapsule => {
  const cell = safeOpenCell(state);
  return buildDeathEchoCapsule(state, {
    id,
    x: cell.x + 0.5,
    y: cell.y + 0.5,
    facingX: 1,
    facingY: 0,
    cause,
    ticks: 1500,
  });
};

const placed = (over: Partial<PlacedDeathEcho>): PlacedDeathEcho => ({
  id: 'p',
  sourceSeed: 1,
  sourceSimulationVersion: SIMULATION_VERSION,
  sourceContentVersion: CONTENT_VERSION,
  sector: 1,
  sourceWidth: 96,
  sourceHeight: 96,
  sourceX: 10,
  sourceY: 10,
  progressQ: 100,
  openness: 5,
  surface: 0,
  nearOre: false,
  facingX: 1,
  facingY: 0,
  cause: { kind: 'fire' },
  ticks: 1500,
  x: 10.5,
  y: 10.5,
  cell: 970,
  projection: 'exact',
  lost: 1,
  ...over,
});

describe('cápsula compartilhada', () => {
  it('mede a mesma topologia que a projeção pontua', () => {
    // A razão de o módulo existir: produtor e consumidor chamam a MESMA função.
    // Divergir aqui colocaria o corpo num lugar que não corresponde a nada, e
    // cada lado estaria correto sozinho.
    const state = createRun({ seed: 0x5eed1 });
    const cell = safeOpenCell(state);
    const topology = deathEchoTopology(state, cell.x, cell.y);
    const capsule = buildDeathEchoCapsule(state, {
      id: 'topology',
      x: cell.x + 0.5,
      y: cell.y + 0.5,
      facingX: 0,
      facingY: 1,
      cause: { kind: 'gas' },
      ticks: 800,
    });
    expect(capsule.progressQ).toBe(topology.progressQ);
    expect(capsule.openness).toBe(topology.openness);
    expect(capsule.surface).toBe(topology.surface);
    expect(capsule.nearOre).toBe(topology.nearOre);
  });

  it('recusa cápsula hostil vinda do wire pelo mesmo portão do storage', () => {
    const state = createRun({ seed: 7 });
    const good = capsuleAt(state, 'wire-ok');
    expect(parseDeathEchoCapsule(good)).not.toBeNull();
    // Combinação que a simulação não emite: o `bolt` é do jogador.
    expect(parseDeathEchoCapsule({
      ...good,
      cause: { kind: 'enemy_projectile', archetype: 'stalker', elite: false, projectile: 'bolt' },
    })).toBeNull();
    expect(parseDeathEchoCapsule({ ...good, sourceX: good.sourceWidth })).toBeNull();
    expect(parseDeathEchoCapsule({ ...good, id: 'x'.repeat(200) })).toBeNull();
    expect(parseDeathEchoCapsule({ ...good, progressQ: 999 })).toBeNull();
    expect(parseDeathEchoCapsule(null)).toBeNull();
  });

  it('nunca ocupa a mesma célula com dois corpos', () => {
    const state = createRun({ seed: 0x0b0b0b });
    const first = capsuleAt(state, 'a');
    const second = { ...first, id: 'b' };
    const third = { ...first, id: 'c' };
    const list = projectDeathEchoes(state, [first, second, third], 3);
    const cells = new Set(list.map((echo) => echo.cell));
    expect(cells.size).toBe(list.length);
    expect(list.length).toBeGreaterThan(1);
  });

  it('prefere ausência a forçar um corpo num mapa sem célula aceitável', () => {
    const source = createRun({ seed: 11 });
    const echo = capsuleAt(source, 'no-space');
    const target = createRun({ seed: 12 });
    target.solid.fill(SOLID_ROCK);
    target.solid[target.entry.y * target.config.width + target.entry.x] = SOLID_NONE;
    expect(projectDeathEchoes(target, [echo], 4)).toEqual([]);
  });
});

describe('agrupamento por camara, antes do teto de corpos', () => {
  /** Cápsulas do MESMO mundo, como o contrato de seed compartilhada produz. */
  const sameWorld = (state: SurvivalState, cell: { x: number; y: number }, id: string) =>
    buildDeathEchoCapsule(state, {
      id,
      x: cell.x + 0.5,
      y: cell.y + 0.5,
      facingX: 1,
      facingY: 0,
      cause: { kind: 'fire' },
      ticks: 1500,
    });

  it('colapsa a mesma câmara num corpo que conta quantas foram', () => {
    const state = createRun({ seed: 0xc0c0 });
    const base = safeOpenCell(state);
    const grouped = groupDeathEchoesByChamber(state, [
      sameWorld(state, base, 'a'),
      sameWorld(state, { x: base.x + 1, y: base.y + 1 }, 'b'),
      sameWorld(state, { x: base.x + 2, y: base.y }, 'c'),
      sameWorld(state, { x: base.x + 40, y: base.y }, 'longe'),
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].id).toBe('a');
    expect(grouped[0].lost).toBe(3);
    expect(grouped[1].lost).toBe(1);
  });

  it('conta a amostra INTEIRA, e não o que sobrou do teto de corpos', () => {
    // O defeito que a ordem corrige: com o teto aplicado antes, vinte cápsulas da
    // mesma câmara viravam quatro corpos anunciando no máximo quatro perdas, e as
    // dezesseis restantes eram descartadas sem nunca serem contadas.
    const state = createRun({ seed: 0xd0d0 });
    const base = safeOpenCell(state);
    const capsules = Array.from({ length: 20 }, (_, i) =>
      sameWorld(state, { x: base.x + (i % 3), y: base.y + Math.floor(i / 10) }, `e${i}`),
    );
    const grouped = groupDeathEchoesByChamber(state, capsules);
    expect(grouped).toHaveLength(1);
    const list = projectDeathEchoes(state, grouped, 4);
    expect(list).toHaveLength(1);
    expect(list[0].lost).toBe(20);
  });

  it('mantém o corpo de uma morte REAL como sobrevivente, sem inventar centro', () => {
    const state = createRun({ seed: 0xe0e0 });
    const base = safeOpenCell(state);
    const first = sameWorld(state, base, 'real');
    const grouped = groupDeathEchoesByChamber(state, [
      first,
      sameWorld(state, { x: base.x + 1, y: base.y }, 'outro'),
    ]);
    expect(grouped[0].sourceX).toBe(first.sourceX);
    expect(grouped[0].sourceY).toBe(first.sourceY);
    expect(grouped[0].cause).toEqual(first.cause);
  });

  it('não altera as cápsulas recebidas', () => {
    const state = createRun({ seed: 0xf0f0 });
    const base = safeOpenCell(state);
    const original = sameWorld(state, base, 'a');
    groupDeathEchoesByChamber(state, [
      original,
      sameWorld(state, { x: base.x + 1, y: base.y }, 'b'),
    ]);
    expect('lost' in original).toBe(false);
  });

  it('trata como distantes cápsulas além do raio da câmara', () => {
    const state = createRun({ seed: 0xabab });
    const base = safeOpenCell(state);
    const grouped = groupDeathEchoesByChamber(state, [
      sameWorld(state, base, 'a'),
      sameWorld(state, { x: base.x + DEATH_ECHO_CLUSTER_RADIUS + 1, y: base.y }, 'b'),
    ]);
    expect(grouped).toHaveLength(2);
  });

  it('nunca agrupa cápsulas de outro mundo, cujas células não se comparam', () => {
    // Duas seeds diferentes têm células de origem sem relação; aproximá-las por
    // coordenada seria comparar endereços de cidades diferentes.
    const source = createRun({ seed: 0x1111 });
    const other = createRun({ seed: 0x2222 });
    const cell = safeOpenCell(source);
    const alien = sameWorld(other, safeOpenCell(other), 'alien');
    const grouped = groupDeathEchoesByChamber(source, [
      sameWorld(source, cell, 'meu'),
      { ...alien, sourceX: cell.x, sourceY: cell.y },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[1].lost).toBeUndefined();
  });
});

describe('contrato coletivo', () => {
  it('deriva a mesma seed do calendário, sem guardar nada', () => {
    const morning = deathEchoContract(new Date('2026-07-30T06:00:00Z'));
    const night = deathEchoContract(new Date('2026-07-30T23:59:00Z'));
    expect(morning.id).toBe('2026-07-30');
    expect(morning.seed).toBe(night.seed);
    expect(morning.label).toContain('30-07');
    expect(morning.label).toMatch(/VEIO [A-Z]+$/);
    // Dia seguinte é outro veio.
    expect(deathEchoContract(new Date('2026-07-31T06:00:00Z')).seed).not.toBe(morning.seed);
  });

  it('usa UTC, para o contrato ser o mesmo no mundo todo', () => {
    // Mesmo instante, dois fusos: a resposta não pode depender de onde se joga.
    const instant = new Date('2026-07-30T02:00:00Z');
    expect(deathEchoContract(instant).id).toBe('2026-07-30');
    expect(deathEchoContract(new Date(instant.toISOString())).id).toBe('2026-07-30');
  });

  it('abre e fecha uma janela de um dia', () => {
    const contract = deathEchoContract(new Date('2026-07-30T15:00:00Z'));
    expect(contract.opensAt).toBe('2026-07-30T00:00:00.000Z');
    expect(contract.closesAt).toBe('2026-07-31T00:00:00.000Z');
  });

  it('conta a semana ISO sem pular a virada de ano', () => {
    // 2026-12-31 é quinta, então pertence à semana 53 de 2026; 2027-01-01 é sexta
    // da MESMA semana. Uma regra caseira erraria exatamente aqui.
    expect(contractWeekKey(new Date('2026-12-31T12:00:00Z'))).toBe('2026-W53');
    expect(contractWeekKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53');
    const weekly = deathEchoContract(new Date('2026-07-30T12:00:00Z'), 'weekly');
    expect(weekly.id).toMatch(/^2026-W\d{2}$/);
    expect(weekly.label).toContain('SEMANA');
  });

  it('recalcula a seed em vez de confiar na que o servidor anunciou', () => {
    // Um servidor comprometido — ou uma resposta em cache de outro dia — poderia
    // anunciar o id de hoje com a seed de ontem, e todo mundo naquele contrato
    // jogaria mapas diferentes achando que jogava o mesmo.
    const parsed = parseDeathEchoContract({
      id: '2026-07-30',
      cadence: 'daily',
      seed: 12345,
      label: 'MENTIRA',
      opensAt: '2026-07-30T00:00:00.000Z',
      closesAt: '2026-07-31T00:00:00.000Z',
      ranked: true,
    });
    expect(parsed?.seed).toBe(contractSeed('2026-07-30'));
    expect(parsed?.seed).not.toBe(12345);
    expect(parsed?.label).toContain('30-07');
  });

  it('descarta anúncio malformado', () => {
    expect(parseDeathEchoContract({ id: 'ontem' })).toBeNull();
    expect(parseDeathEchoContract({ id: '2026-07-30', opensAt: 'x', closesAt: 'y' })).toBeNull();
    expect(parseDeathEchoContract({ id: '2026-W99', cadence: 'daily' })).toBeNull();
    expect(parseDeathEchoContract(null)).toBeNull();
  });

  it('nasce ranqueado, e ranqueado significa apenas informativo', () => {
    // A trava da spec §4: se ecos exatos dessem módulo, quem entrasse à noite
    // jogaria contra um mapa diferente de quem jogou de manhã. Nada em
    // `PlacedDeathEcho` concede recurso — a garantia é estrutural, e este teste
    // existe para quebrar no dia em que alguém adicionar um campo que conceda.
    expect(deathEchoContract(new Date()).ranked).toBe(true);
    expect(Object.keys(placed({}))).not.toContain('moduleId');
    expect(Object.keys(placed({}))).not.toContain('salvageCost');
  });
});
