import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { findPath, hasLineOfSight, PATH_COST_BREAK } from '../src/pathing';
import { bossArchetypeForBiome } from '../src/bosses';
import { sectorBiome } from '../src/strata';
import { SECTOR_COUNT, SOLID_NONE, SOLID_ORE, SOLID_ROCK } from '../src/constants';
import type { SurvivalState } from '../src/types';


/** Primeira seed >= base cujo setor final tem o Guardiao (bossForBiome). */
const guardianSeed = (base: number): number => {
  for (let seed = base; seed < base + 4096; seed++) {
    if (bossArchetypeForBiome(sectorBiome(seed, SECTOR_COUNT)) === 'guardian') return seed;
  }
  throw new Error(`nenhuma seed proxima de ${base} com Guardiao no setor final`);
};

const clear = (s: SurvivalState, x0: number, y0: number, x1: number, y1: number): void => {
  const w = s.config.width;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    s.solid[y * w + x] = SOLID_NONE;
    s.surface[y * w + x] = 0;
  }
};

describe('busca de caminho', () => {
  it('enxerga bloqueio entre dois pontos', () => {
    const s = createRun({ seed: 51, sector: SECTOR_COUNT });
    const w = s.config.width;
    clear(s, 10, 10, 30, 30);
    expect(hasLineOfSight(s, 12.5, 20.5, 28.5, 20.5)).toBe(true);
    s.solid[20 * w + 20] = SOLID_ROCK;
    expect(hasLineOfSight(s, 12.5, 20.5, 28.5, 20.5)).toBe(false);
  });

  // Uma parede com porta: o caminho tem de dar a volta, e nao atravessar. Com
  // busca em largura (peso unico) ele arrombaria a parede por ser um passo mais
  // curto — o que le como teimosia, nao como escolha.
  it('contorna quando ha volta curta, em vez de arrombar', () => {
    const s = createRun({ seed: 52, sector: SECTOR_COUNT });
    const w = s.config.width;
    clear(s, 10, 10, 30, 30);
    for (let y = 10; y <= 30; y++) s.solid[y * w + 20] = SOLID_ROCK;
    s.solid[12 * w + 20] = SOLID_NONE; // porta perto

    const path = findPath(s, 15, 12, 25, 12);
    expect(path.length, 'nao achou rota').toBeGreaterThan(0);
    const passouPorParede = path.some((c) => s.solid[c] === SOLID_ROCK);
    expect(passouPorParede, 'arrombou tendo porta ao lado').toBe(false);
  });

  // Sem volta curta, atravessar e de fato o caminho mais rapido viavel — e e por
  // isso que a parede e CARA e nao intransponivel.
  it('arromba quando o desvio e longo demais', () => {
    const s = createRun({ seed: 53, sector: SECTOR_COUNT });
    const w = s.config.width;
    clear(s, 10, 10, 40, 40);
    for (let y = 10; y <= 40; y++) s.solid[y * w + 25] = SOLID_ROCK; // parede sem porta

    const path = findPath(s, 20, 25, 30, 25);
    expect(path.length, 'nao achou rota').toBeGreaterThan(0);
    expect(path.some((c) => s.solid[c] === SOLID_ROCK), 'nao atravessou nem sem saida').toBe(true);
    // Atravessar custa mais que andar: a rota curta ainda e curta em PASSOS.
    expect(PATH_COST_BREAK).toBeGreaterThan(1);
  });

  // Minerio e recurso do jogador: o chefe nao abre passagem por dentro dele.
  it('trata minerio como intransponivel, e nao como parede cara', () => {
    const s = createRun({ seed: 54, sector: SECTOR_COUNT });
    const w = s.config.width;
    clear(s, 10, 10, 30, 30);
    // Sala LACRADA em minerio, dividida ao meio tambem por minerio: se houver
    // qualquer rota, ela passa por dentro do minerio. Sem lacrar, a busca
    // simplesmente dava a volta por fora e o teste nao afirmava nada.
    for (let x = 9; x <= 31; x++) {
      s.solid[9 * w + x] = SOLID_ORE;
      s.solid[31 * w + x] = SOLID_ORE;
    }
    for (let y = 9; y <= 31; y++) {
      s.solid[y * w + 9] = SOLID_ORE;
      s.solid[y * w + 31] = SOLID_ORE;
      s.solid[y * w + 20] = SOLID_ORE;
    }
    expect(findPath(s, 15, 20, 25, 20)).toEqual([]);
  });

  it('devolve rota vazia para origem igual ao destino', () => {
    const s = createRun({ seed: 55, sector: SECTOR_COUNT });
    clear(s, 10, 10, 20, 20);
    expect(findPath(s, 15, 15, 15, 15)).toEqual([]);
  });
});

describe('agressividade do guardiao', () => {
  const arena = (): SurvivalState => {
    // Desde bossForBiome nem toda seed termina no Guardiao: procura uma que sim.
    const s = createRun({ seed: guardianSeed(56), sector: SECTOR_COUNT });
    clear(s, 10, 10, 60, 40);
    for (const e of s.enemies) if (e.archetype !== 'guardian') e.alive = false;
    s.player.x = 15.5;
    s.player.y = 25.5;
    return s;
  };

  // O caso que a revisao e o playtest apontaram: um canto do mapa nao pode ser
  // abrigo permanente. Antes, a direcao era `normalized(alvo - inimigo)` e mais
  // nada — contra parede ele encostava na quina e parava.
  it('contorna a parede em vez de encostar nela e parar', () => {
    const s = arena();
    const w = s.config.width;
    const g = s.enemies.find((e) => e.archetype === 'guardian');
    expect(g).toBeDefined();
    if (!g) return;
    // Parede entre os dois, com porta bem ao norte.
    for (let y = 10; y <= 40; y++) s.solid[y * w + 30] = SOLID_ROCK;
    s.solid[12 * w + 30] = SOLID_NONE;
    g.x = 45.5;
    g.y = 25.5;
    s.bossRuntime.awake = true;

    for (let t = 0; t < 400; t++) stepRun(s, [emptyCommand()]);

    // Exige TRAVESSIA, e nao aproximacao. Medir so a distancia deixava o teste
    // passar sem caminho nenhum: partindo de 30 tiles, andar ate encostar na
    // parede ja fechava 15 e satisfazia qualquer margem generosa.
    expect(g.x, `ficou do lado errado da parede (x=${g.x.toFixed(1)})`).toBeLessThan(30);
  });

  // Ele e o clima da sala, nao um bicho que patrulha: sair do raio dele nao pode
  // ser uma forma de vencer.
  it('nao desiste quando o jogador se afasta do raio de aggro', () => {
    const s = arena();
    const g = s.enemies.find((e) => e.archetype === 'guardian');
    if (!g) return;
    g.x = 50.5;
    g.y = 25.5; // muito alem dos 7 tiles de aggro
    s.bossRuntime.awake = true;

    const before = Math.hypot(g.x - s.player.x, g.y - s.player.y);
    for (let t = 0; t < 120; t++) stepRun(s, [emptyCommand()]);
    const after = Math.hypot(g.x - s.player.x, g.y - s.player.y);
    expect(after, 'perdeu o interesse a distancia').toBeLessThan(before - 3);
  });

  // Dormindo ele nao pode caçar: a emboscada do Nucleo depende disso.
  it('continua parado enquanto dorme', () => {
    const s = arena();
    const g = s.enemies.find((e) => e.archetype === 'guardian');
    if (!g) return;
    g.x = 50.5;
    g.y = 25.5;
    s.bossRuntime.awake = false;
    const before = Math.hypot(g.x - s.player.x, g.y - s.player.y);
    for (let t = 0; t < 60; t++) stepRun(s, [emptyCommand()]);
    expect(Math.abs(Math.hypot(g.x - s.player.x, g.y - s.player.y) - before)).toBeLessThan(1);
  });
});
