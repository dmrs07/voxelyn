import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, SIMULATION_VERSION } from '@voxelyn/survival-protocol';
import {
  SOLID_NONE,
  createRun,
  type DamageCause,
  type RunSummary,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { SurvivalRenderer, allyBodyAlpha, allyVisorGlow, deathEchoBodyAlpha } from './render';
import {
  DEATH_ECHO_LINK_RADIUS,
  DEATH_ECHO_PAIR_RADIUS,
  DeathEchoController,
  deathEchoReadout,
  deathEchoReadoutRegion,
  emptyDeathEchoFrame,
} from './death-echo-presentation';
import { carcassVariant, deathEchoDesignation } from './death-echo-carcass';
import {
  DEATH_ECHOES_VISIBLE_PER_SECTOR,
  captureDeathEcho,
  emptyDeathEchoRecords,
  mergeDeathEchoSources,
  type DeathEchoCapsule,
  type PlacedDeathEcho,
} from './death-echoes';
import { deathEchoPoolQuery } from './death-echo-pool';

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
  lost: 1,
  ...over,
});

const safeArea = { top: 0, right: 0, bottom: 0, left: 0 };
const hud = { x: 12, y: 10, width: 230, height: 100 };

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

const capsuleFrom = (seed: number, cause: DamageCause = { kind: 'fire' }): DeathEchoCapsule => {
  const state = createRun({ seed });
  const cell = safeOpenCell(state);
  state.player.x = cell.x + 0.5;
  state.player.y = cell.y + 0.5;
  state.phase = 'dead';
  state.player.alive = false;
  const summary: RunSummary = {
    seed,
    phase: 'dead',
    ticks: 1500,
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
  const capsule = captureDeathEcho(state, 'paired-echo');
  if (!capsule) throw new Error('fixture sem cápsula');
  return capsule;
};

/**
 * Células seguras e distantes umas das outras, para cada corpo virar uma CÂMARA.
 *
 * Sem a distância mínima o agrupamento por câmara colapsaria os corpos num só, que
 * é o comportamento correto e não o que estes testes querem exercitar.
 */
const safeCellsApart = (
  state: SurvivalState,
  count: number,
  minDistance: number,
): Array<{ x: number; y: number }> => {
  const width = state.config.width;
  const found: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < state.config.height && found.length < count; y++) {
    for (let x = 0; x < width && found.length < count; x++) {
      if (state.solid[y * width + x] !== SOLID_NONE) continue;
      if (squaredDistance(x, y, state.entry.x, state.entry.y) < 9 ** 2) continue;
      if (squaredDistance(x, y, state.corePos.x, state.corePos.y) < 8 ** 2) continue;
      if (state.salvageSites.some((site) =>
        squaredDistance(x, y, site.terminal.x, site.terminal.y) < 5 ** 2 ||
        squaredDistance(x, y, site.cache.x, site.cache.y) < 5 ** 2
      )) continue;
      if (state.enemies.some((enemy) => squaredDistance(x, y, enemy.x, enemy.y) < 4 ** 2)) continue;
      if (found.some((cell) => squaredDistance(cell.x, cell.y, x, y) < minDistance ** 2)) continue;
      found.push({ x, y });
    }
  }
  if (found.length < count) throw new Error(`fixture achou ${found.length} de ${count} camaras`);
  return found;
};

/** Cápsulas do MESMO mundo do estado: projetam na coordenada real, como no contrato. */
const chambersOf = (state: SurvivalState, count: number): DeathEchoCapsule[] =>
  safeCellsApart(state, count, 14).map((cell, index) => {
    const source = createRun({ seed: state.config.seed });
    source.player.x = cell.x + 0.5;
    source.player.y = cell.y + 0.5;
    source.phase = 'dead';
    source.player.alive = false;
    source.summary = {
      seed: state.config.seed,
      phase: 'dead',
      ticks: 1500 + index,
      contamination: 0,
      deathCause: { kind: 'fire' },
      stats: { ...source.stats, kills: { ...source.stats.kills } },
      cores: 0,
      coresAvailable: 1,
    sectorCount: 3,
    stars: 0,
      targetTicks: 9600,
    };
    const capsule = captureDeathEcho(source, `camara-${index}`);
    if (!capsule) throw new Error('fixture sem cápsula');
    return capsule;
  });

/** Uma run com exatamente um eco projetado e o jogador longe dele. */
const runWithEcho = (): { state: SurvivalState; controller: DeathEchoController; placed: PlacedDeathEcho } => {
  const capsule = capsuleFrom(0x01020304);
  const state = createRun({ seed: 0xa0b0c0d0 });
  const controller = new DeathEchoController({
    schema: 1,
    nextSerial: 2,
    echoes: [capsule],
  });
  const frame = controller.sync(state, 0);
  const placed = frame.echoes[0];
  if (!placed) throw new Error('fixture sem eco projetado');
  return { state, controller, placed };
};

const standAt = (state: SurvivalState, x: number, y: number): void => {
  state.player.x = x;
  state.player.y = y;
};

describe('apresentação do eco', () => {
  it('identifica o corpo por serial corporativo, sem seed nem identidade pessoal', () => {
    const readout = deathEchoReadout(echo({
      cause: { kind: 'discharge', source: 'player' },
    }));
    expect(readout.title).toMatch(/^UNIDADE \d[A-H]-\d{3}$/);
    expect(readout.condition).toBe('CARCAÇA FULMINADA');
    expect(readout.headline).toBe('Sua própria descarga te pegou');
    expect(readout.lesson).not.toBe('');
    expect(`${readout.title} ${readout.condition} ${readout.headline}`).not.toContain('42');
  });

  it('mantém o serial estável para o mesmo eco e distinto entre ecos', () => {
    expect(deathEchoDesignation('a:dead:1:1')).toBe(deathEchoDesignation('a:dead:1:1'));
    expect(deathEchoDesignation('a:dead:1:1')).not.toBe(deathEchoDesignation('a:dead:1:2'));
  });

  it('mantém memória e projeção num controller separado da simulação', () => {
    const controller = new DeathEchoController(emptyDeathEchoRecords());
    expect(controller).toBeInstanceOf(DeathEchoController);
    expect(typeof SurvivalRenderer.prototype.setDeathEchoes).toBe('function');
    expect(emptyDeathEchoFrame()).toEqual({ echoes: [], prompt: null, paired: null });
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

describe('carcaça por tipo de morte', () => {
  it('dá corpos distintos a mortes distintas', () => {
    const kinds = new Set(
      (
        [
          { kind: 'fire' },
          { kind: 'discharge', source: 'player' },
          { kind: 'explosion', source: 'enemy' },
          { kind: 'gas' },
          { kind: 'spores' },
          { kind: 'enemy_contact', archetype: 'bruiser', elite: false },
          { kind: 'bleedout' },
        ] satisfies DamageCause[]
      ).map((cause) => carcassVariant(cause).kind),
    );
    expect(kinds.size).toBe(7);
  });

  it('separa a pedra do cuspe, que matam de formas diferentes', () => {
    const rock = carcassVariant({
      kind: 'enemy_projectile', archetype: 'bruiser', elite: false, projectile: 'rock',
    });
    const spit = carcassVariant({
      kind: 'enemy_projectile', archetype: 'spitter', elite: false, projectile: 'spit',
    });
    expect(rock.kind).toBe('crushed');
    expect(spit.kind).toBe('dissolved');
  });

  it('nunca devolve uma carcaça sem laudo nem material', () => {
    for (const cause of [
      { kind: 'overheat' }, { kind: 'unknown' }, { kind: 'player_shot' },
    ] satisfies DamageCause[]) {
      const variant = carcassVariant(cause);
      expect(variant.condition.length).toBeGreaterThan(0);
      expect(variant.shell).toMatch(/^#[0-9a-f]{6}$/i);
      expect(variant.tint.alpha).toBeGreaterThan(0);
    }
  });
});

describe('pareamento pelo botão usar', () => {
  it('não abre a caixa-preta só por passar perto', () => {
    const { state, controller, placed } = runWithEcho();
    standAt(state, placed.x, placed.y);
    const frame = controller.sync(state, 100);
    expect(frame.paired).toBeNull();
    expect(frame.prompt?.id).toBe(placed.id);
  });

  it('abre no aperto e fecha no aperto seguinte', () => {
    const { state, controller, placed } = runWithEcho();
    standAt(state, placed.x, placed.y);

    controller.pressInteract();
    const opened = controller.sync(state, 500);
    expect(opened.paired?.echo.id).toBe(placed.id);
    expect(opened.paired?.openedAtMs).toBe(500);
    expect(opened.prompt).toBeNull();

    // Sem novo aperto a transmissão continua aberta, com o mesmo relógio: a
    // reprodução holográfica não pode reiniciar a cada quadro.
    const held = controller.sync(state, 900);
    expect(held.paired?.openedAtMs).toBe(500);

    controller.pressInteract();
    expect(controller.sync(state, 1200).paired).toBeNull();
  });

  it('não parea de longe e derruba a transmissão quando o jogador se afasta', () => {
    const { state, controller, placed } = runWithEcho();
    standAt(state, placed.x + DEATH_ECHO_PAIR_RADIUS + 1, placed.y);
    controller.pressInteract();
    expect(controller.sync(state, 100).paired).toBeNull();

    standAt(state, placed.x, placed.y);
    controller.pressInteract();
    expect(controller.sync(state, 200).paired?.echo.id).toBe(placed.id);

    standAt(state, placed.x + DEATH_ECHO_LINK_RADIUS + 0.5, placed.y);
    const dropped = controller.sync(state, 300);
    expect(dropped.paired).toBeNull();
    expect(dropped.prompt).toBeNull();
  });

  it('mantém o vínculo dentro do alcance de transmissão, maior que o de pareamento', () => {
    const { state, controller, placed } = runWithEcho();
    expect(DEATH_ECHO_LINK_RADIUS).toBeGreaterThan(DEATH_ECHO_PAIR_RADIUS);
    standAt(state, placed.x, placed.y);
    controller.pressInteract();
    controller.sync(state, 0);
    standAt(state, placed.x + (DEATH_ECHO_PAIR_RADIUS + DEATH_ECHO_LINK_RADIUS) / 2, placed.y);
    expect(controller.sync(state, 100).paired?.echo.id).toBe(placed.id);
  });

  it('fecha a transmissão quando a run termina', () => {
    const { state, controller, placed } = runWithEcho();
    standAt(state, placed.x, placed.y);
    controller.pressInteract();
    expect(controller.sync(state, 0).paired).not.toBeNull();
    state.phase = 'extracted';
    const terminal = controller.sync(state, 100);
    expect(terminal).toEqual(emptyDeathEchoFrame());
  });
});

describe('pool comunitario no cliente', () => {
  it('so filtra por seed quando a run ESTA num contrato', () => {
    // O contrato anunciado é um cartaz na parede. Confundi-lo com a modalidade da
    // run fazia toda descida comum consultar o pool por seed, e o pool geral —
    // mortes de mapas que este jogador nunca viu — nunca era pedido.
    expect(deathEchoPoolQuery(2, null)).toEqual({ sector: 2 });
    expect(deathEchoPoolQuery(2, { seed: 777 })).toEqual({ sector: 2, seed: 777 });
  });

  it('dá prioridade à memória local sobre o pool e remove o próprio corpo repetido', () => {
    const mine = capsuleFrom(0x01020304);
    const alheio = { ...mine, id: 'de-outra-pessoa' };
    const merged = mergeDeathEchoSources([mine], [alheio, mine]);
    // A run em que o jogador morreu ontem diz mais a ele do que a de um estranho.
    expect(merged.map((e) => e.id)).toEqual([mine.id, 'de-outra-pessoa']);
  });

  it('mantém todos os corpos auditáveis, sem prompt morto ao lado de um que responde', () => {
    // A spec fala de "um eco interativo por setor", e esse limite é da RECUPERAÇÃO
    // de módulo (Etapa 4), que muda a run. Auditar não custa nada, e uma carcaça
    // que ignora o botão usar — parada ao lado de outra que responde, sem nenhuma
    // diferença visível — leria como defeito.
    const state = createRun({ seed: 0xa0b0c0d0 });
    const controller = new DeathEchoController(emptyDeathEchoRecords());
    controller.setPool(chambersOf(state, 3));
    const frame = controller.sync(state, 0);
    expect(frame.echoes).toHaveLength(3);
    for (const body of frame.echoes) {
      standAt(state, body.x, body.y);
      controller.pressInteract();
      expect(controller.sync(state, 100).paired?.echo.id).toBe(body.id);
      controller.pressInteract();
      controller.sync(state, 200);
    }
  });

  it('respeita o teto de corpos por setor mesmo com o pool cheio', () => {
    const state = createRun({ seed: 0xbeef00 });
    const controller = new DeathEchoController(emptyDeathEchoRecords());
    // Dez câmaras distintas do próprio mapa: todas projetariam na coordenada real,
    // então é o teto — e não a falta de célula — que tem de limitar.
    controller.setPool(chambersOf(state, 10));
    expect(controller.sync(state, 0).echoes).toHaveLength(DEATH_ECHOES_VISIBLE_PER_SECTOR);
  });
});

describe('parceiro na fog of war', () => {
  it('apaga o corpo do parceiro no escuro e o revela conforme a luz sobe', () => {
    expect(allyBodyAlpha(0.04)).toBe(0);
    expect(allyBodyAlpha(0.16)).toBe(0);
    expect(allyBodyAlpha(0.3)).toBeGreaterThan(0);
    expect(allyBodyAlpha(0.3)).toBeLessThan(allyBodyAlpha(0.5));
    expect(allyBodyAlpha(1)).toBe(1);
  });

  it('cresce o halo do visor exatamente onde o corpo deixa de aparecer', () => {
    expect(allyVisorGlow(0.04)).toBeGreaterThan(allyVisorGlow(1));
    expect(allyVisorGlow(1)).toBeGreaterThan(0);
  });
});
