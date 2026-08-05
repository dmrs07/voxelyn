import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { bossArchetypeForBiome } from '../src/bosses';
import { sectorBiome } from '../src/strata';
import { GUARDIAN_ARENA_EXITS, GUARDIAN_ARENA_RADIUS, GUARDIAN_SUMMON_COUNT, DEFAULT_SECTOR_COUNT,
  SOLID_FRAGILE, SOLID_NONE, SOLID_ORE, SOLID_ROCK } from '../src/constants';
import { BOSS_PHASE_SUMMON } from '../src/types';
import { closeArena } from '../src/cells';
import { impactSolid } from '../src/materials';
import { damageEntity } from '../src/entities';
import { floodOpen } from '../src/worldgen';
import type { SurvivalState } from '../src/types';


/** Primeira seed >= base cujo setor final tem o Guardiao (bossForBiome). */
const guardianSeed = (base: number): number => {
  for (let seed = base; seed < base + 4096; seed++) {
    if (bossArchetypeForBiome(sectorBiome(seed, DEFAULT_SECTOR_COUNT)) === 'guardian') return seed;
  }
  throw new Error(`nenhuma seed proxima de ${base} com Guardiao no setor final`);
};

/** Leva o guardiao a segunda fase com o jogador ao lado dele. */
const enrage = (seed: number): { state: SurvivalState; gx: number; gy: number } => {
  const state = createRun({ seed: guardianSeed(seed), sector: DEFAULT_SECTOR_COUNT });
  const w = state.config.width;
  const g = state.enemies.find((e) => e.archetype === 'guardian');
  if (!g) throw new Error('sem guardiao');
  for (let y = g.y - 12; y <= g.y + 12; y++) {
    for (let x = g.x - 12; x <= g.x + 12; x++) {
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= state.config.height - 1) continue;
      state.solid[cy * w + cx] = SOLID_NONE;
    }
  }
  // O guardiao nasce colado ao Nucleo, que em varias seeds fica no CANTO do
  // mapa. Somar 2 as cegas jogava o jogador para fora dele, e o teste media um
  // cerco a partir de uma celula que nao existe.
  state.player.x = Math.max(2.5, Math.min(w - 3.5, g.x - 2));
  state.player.y = Math.max(2.5, Math.min(state.config.height - 3.5, g.y));
  state.bossRuntime.awake = true;
  g.hp = g.maxHp * 0.4;
  const gx = Math.floor(g.x);
  const gy = Math.floor(g.y);
  stepRun(state, [emptyCommand()]);
  return { state, gx, gy };
};

const ringCells = (state: SurvivalState, gx: number, gy: number): number[] => {
  const w = state.config.width;
  const out: number[] = [];
  for (let y = gy - GUARDIAN_ARENA_RADIUS; y <= gy + GUARDIAN_ARENA_RADIUS; y++) {
    for (let x = gx - GUARDIAN_ARENA_RADIUS; x <= gx + GUARDIAN_ARENA_RADIUS; x++) {
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= state.config.height - 1) continue;
      if (Math.max(Math.abs(x - gx), Math.abs(y - gy)) !== GUARDIAN_ARENA_RADIUS) continue;
      out.push(y * w + x);
    }
  }
  return out;
};

describe('arena do guardiao', () => {
  // Contar celulas do anel nao prova cerco: prova que escrevi pedra em alguns
  // lugares. O que prova e nao dar para SAIR — entao o teste anda pelo chao
  // livre a partir do jogador e verifica que nao passa do raio.
  it('lacra a arena quando a vida cai da metade', () => {
    const { state, gx, gy } = enrage(71);
    expect(state.bossRuntime.arenaClosed, 'nao fechou').toBe(true);

    const w = state.config.width;
    const start = Math.floor(state.player.y) * w + Math.floor(state.player.x);
    const seen = new Set<number>([start]);
    const queue = [start];
    let escaped = false;
    while (queue.length > 0 && !escaped) {
      const cell = queue.shift() as number;
      const cx = cell % w;
      const cy = (cell / w) | 0;
      if (Math.max(Math.abs(cx - gx), Math.abs(cy - gy)) > GUARDIAN_ARENA_RADIUS) {
        escaped = true;
        break;
      }
      for (const n of [cell - 1, cell + 1, cell - w, cell + w]) {
        if (n < 0 || n >= state.solid.length || seen.has(n)) continue;
        if (state.solid[n] !== SOLID_NONE) continue; // fragil tambem barra ate ser quebrada
        seen.add(n);
        queue.push(n);
      }
    }
    expect(escaped, 'da para sair andando, sem quebrar nada').toBe(false);
  });

  // Cerco sem saida nenhuma nao e dificuldade, e sentenca. O jogo promete morte
  // por decisao arriscada, nao por falta de opcao.
  it('deixa poucas saidas quebraveis, e o resto em rocha', () => {
    const { state, gx, gy } = enrage(72);
    const ring = ringCells(state, gx, gy);
    const fragile = ring.filter((i) => state.solid[i] === SOLID_FRAGILE);
    expect(fragile.length, 'sem saida nenhuma').toBeGreaterThan(0);
    expect(fragile.length, 'saidas demais: deixou de ser cerco').toBeLessThanOrEqual(GUARDIAN_ARENA_EXITS);
    // O resto tem de ser ROCHA: fragil em todo canto e o mesmo que nao ter parede,
    // porque rocha e o unico material que nao cede a tiro nenhum.
    const rock = ring.filter((i) => state.solid[i] === SOLID_ROCK);
    expect(rock.length).toBeGreaterThan(fragile.length * 4);
  });

  // Um corpo em cima do anel nao pode virar porta franca.
  //
  // O cerco nunca emparedou ninguem — mas PULAR a celula ocupada deixava um vao
  // aberto e permanente: o bicho saia de cima dela e sobrava uma saida que nem
  // custa tiro, ao contrario das frageis. Foi assim que a seed 71 passou a
  // deixar o jogador sair andando quando um bombardeiro calhou de parar no
  // anel. Agora o corpo e empurrado para DENTRO e a parede fecha atras dele.
  it('empurra para dentro quem estava no anel, em vez de deixar o vao', () => {
    const { state, gx, gy } = enrage(71);
    const w = state.config.width;
    const ring = ringCells(state, gx, gy);
    const open = ring.filter((i) => state.solid[i] === SOLID_NONE);
    // O poco e a entrada continuam podendo furar o anel — sao objetivos da run.
    const objetivos = new Set([
      state.corePos.y * w + state.corePos.x,
      state.entry.y * w + state.entry.x,
    ]);
    for (const i of open) {
      expect(
        objetivos.has(i),
        `vao aberto em ${i % w},${Math.floor(i / w)} sem ser objetivo`,
      ).toBe(true);
    }
    // E ninguem terminou dentro de uma parede DO CERCO. A verificacao e sobre
    // as celulas que o cerco levantou, e nao sobre rocha em geral: nesta mesma
    // seed um perseguido invocado nasce dentro da coluna de borda do mapa
    // (defeito do INVOCAR, anterior a isto e de outro sistema), e um teste do
    // cerco que falhasse por causa dele estaria medindo a coisa errada.
    const barreira = new Set(state.bossRuntime.arenaBarrierCells ?? []);
    for (const e of [...state.players, ...state.enemies]) {
      if (!e.alive) continue;
      expect(
        barreira.has(Math.floor(e.y) * w + Math.floor(e.x)),
        `${(e as { archetype?: string }).archetype ?? 'player'} emparedado pelo cerco`,
      ).toBe(false);
    }
  });

  // O empurrao nao pode empilhar corpos.
  //
  // Achado do Codex na primeira versao: a condicao olhava terreno e objetivos,
  // mas nao se a casa de dentro ja tinha DONO — e o corpo do anel pousava nas
  // coordenadas exatas do ocupante, escondendo um inimigo em cima do jogador
  // com o dano de contato dos dois no mesmo ponto. E ha um segundo empilhamento
  // que so aparece na geometria do anel: duas celulas vizinhas de um lado reto
  // compartilham o mesmo destino — (r,0) e (r,1) apontam ambas para (r-1,0).
  it('nao empilha corpos ao empurrar para dentro', () => {
    const state = createRun({ seed: guardianSeed(76), sector: DEFAULT_SECTOR_COUNT });
    const w = state.config.width;
    const R = GUARDIAN_ARENA_RADIUS;
    // O centro do cerco e PARAMETRO de `closeArena`, entao o teste usa o meio do
    // mapa em vez de onde o guardiao calhou de nascer. O chefe nasce colado ao
    // Nucleo, que na maioria das seeds fica no canto — e ai metade do anel cai
    // fora do mapa e as celulas que este teste precisa simplesmente nao existem.
    const cx = Math.floor(w / 2);
    const cy = Math.floor(state.config.height / 2);
    for (let y = cy - R - 1; y <= cy + R + 1; y++) {
      for (let x = cx - R - 1; x <= cx + R + 1; x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
        state.solid[y * w + x] = SOLID_NONE;
      }
    }
    // (cx+R, cy) e (cx+R, cy+1) dividem o mesmo destino (cx+R-1, cy) — e esse
    // destino ja esta ocupado por um terceiro. Sao os dois empilhamentos.
    const vivos = state.enemies.filter((e) => e.alive).slice(0, 3);
    expect(vivos.length, 'setor sem bicho suficiente para o caso').toBe(3);
    vivos[0].x = cx + R + 0.5;
    vivos[0].y = cy + 0.5;
    vivos[1].x = cx + R + 0.5;
    vivos[1].y = cy + 1.5;
    vivos[2].x = cx + R - 1 + 0.5;
    vivos[2].y = cy + 0.5;
    // Fora do anel e longe de todo mundo.
    state.player.x = cx + 0.5;
    state.player.y = cy + 0.5;

    // Terceiro empilhamento: DOIS corpos na mesma celula do anel, com
    // coordenadas diferentes (a sim nao aplica colisao entre entidades no
    // movimento, entao isso acontece). Mandar os dois para o centro da casa de
    // dentro os sobreporia perfeitamente — pior do que estavam.
    const extras = state.enemies.filter((e) => e.alive).slice(3, 5);
    expect(extras.length, 'setor sem bicho suficiente para o par').toBe(2);
    extras[0].x = cx - R + 0.3;
    extras[0].y = cy + 0.3;
    extras[1].x = cx - R + 0.7;
    extras[1].y = cy + 0.8;

    closeArena(state, cx, cy, R, GUARDIAN_ARENA_EXITS, []);

    const ocupacao = new Map<string, string[]>();
    for (const e of [...state.players, ...state.enemies]) {
      if (!e.alive) continue;
      const chave = `${e.x},${e.y}`;
      const quem = (e as { archetype?: string }).archetype ?? 'player';
      ocupacao.set(chave, [...(ocupacao.get(chave) ?? []), quem]);
    }
    for (const [onde, quem] of ocupacao) {
      expect(quem.length, `corpos empilhados em ${onde}: ${quem.join(' + ')}`).toBe(1);
    }
  });

  it('invoca quatro perseguidores rapidos', () => {
    const { state } = enrage(73);
    const stalkers = state.enemies.filter((e) => e.archetype === 'stalker' && e.alive);
    expect(stalkers.length).toBeGreaterThanOrEqual(GUARDIAN_SUMMON_COUNT);
  });

  // Trancar o chefe e libertar quem devia estar preso seria o oposto do
  // pretendido.
  it('espera o jogador entrar no raio antes de fechar', () => {
    const state = createRun({ seed: guardianSeed(74), sector: DEFAULT_SECTOR_COUNT });
    const g = state.enemies.find((e) => e.archetype === 'guardian');
    if (!g) return;
    state.bossRuntime.awake = true;
    g.hp = g.maxHp * 0.4;
    state.player.x = g.x + GUARDIAN_ARENA_RADIUS + 6;
    state.player.y = g.y;
    for (let t = 0; t < 5; t++) stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.arenaClosed, 'fechou com o jogador do lado de fora').toBe(false);
    // Invocar, por outro lado, acontece na hora.
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_SUMMON).not.toBe(0);
  });

  // Minerio e recurso do jogador: o cerco nao pode apaga-lo.
  it('nao converte minerio em parede de arena', () => {
    const state = createRun({ seed: guardianSeed(75), sector: DEFAULT_SECTOR_COUNT });
    const w = state.config.width;
    const g = state.enemies.find((e) => e.archetype === 'guardian');
    if (!g) return;
    const gx = Math.floor(g.x);
    const gy = Math.floor(g.y);
    const oreCell = (gy - GUARDIAN_ARENA_RADIUS) * w + gx;
    state.solid[oreCell] = SOLID_ORE;
    state.player.x = Math.max(2.5, Math.min(w - 3.5, g.x - 1));
    state.player.y = Math.max(2.5, Math.min(state.config.height - 3.5, g.y));
    state.bossRuntime.awake = true;
    g.hp = g.maxHp * 0.4;
    stepRun(state, [emptyCommand()]);
    expect(state.solid[oreCell], 'o cerco comeu o minerio').toBe(SOLID_ORE);
  });

  // A saida so vale se o tiro PADRAO a abrir. Fosse um material que o cinetico
  // nao derruba, a "possibilidade de escapar" seria decorativa.
  it('abre a saida com o tiro comum do prospector', () => {
    const { state, gx, gy } = enrage(77);
    const w = state.config.width;
    const exit = ringCells(state, gx, gy).find((i) => state.solid[i] === SOLID_FRAGILE);
    expect(exit, 'nao havia saida para testar').toBeDefined();
    if (exit === undefined) return;
    const { broke } = impactSolid(state, exit % w, Math.floor(exit / w), 'kinetic', []);
    expect(broke, 'o tiro comum nao abre a saida').toBe(true);
    expect(state.solid[exit]).toBe(SOLID_NONE);
  });

  it('derruba o cerco ao morrer e restaura o caminho ate o nucleo', () => {
    const { state } = enrage(78);
    const guardian = state.enemies.find((e) => e.archetype === 'guardian');
    expect(guardian).toBeDefined();
    if (!guardian) return;
    const barriers = [...state.bossRuntime.arenaBarrierCells];
    expect(barriers.length, 'o cerco nao registrou seus blocos').toBeGreaterThan(0);
    const events = [];
    damageEntity(state, guardian, guardian.hp, events);
    expect(state.bossRuntime.arenaClosed).toBe(false);
    expect(state.bossRuntime.arenaBarrierCells).toEqual([]);
    for (const cell of barriers) expect(state.solid[cell]).toBe(SOLID_NONE);
    const startX = Math.floor(state.player.x);
    const startY = Math.floor(state.player.y);
    const reachable = floodOpen(state.solid, state.config.width, state.config.height, startX, startY);
    expect(reachable.has(state.corePos.y * state.config.width + state.corePos.x), 'nucleo segue inacessivel').toBe(true);
  });

  it('fecha uma vez so', () => {
    const { state, gx, gy } = enrage(76);
    const ring = ringCells(state, gx, gy);
    const fragileBefore = ring.filter((i) => state.solid[i] === SOLID_FRAGILE).length;
    for (let t = 0; t < 30; t++) stepRun(state, [emptyCommand()]);
    const fragileAfter = ring.filter((i) => state.solid[i] === SOLID_FRAGILE).length;
    expect(fragileAfter).toBeLessThanOrEqual(fragileBefore);
  });
});
