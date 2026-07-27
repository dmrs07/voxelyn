import {
  BUDGET_DISCHARGE_CELLS,
  BUDGET_REACTING_CELLS,
  CELL_STEP_INTERVAL,
  DISCHARGE_TICKS,
  FIRE_FUEL_TICKS,
  FIRE_SPREAD_BIOFLUID,
  FUNGAL_FIRE_FUEL_TICKS,
  FUNGAL_HEAT_IMPACT_TICKS,
  FUNGAL_HEAT_TICKS,
  GAS_FLASH_TICKS,
  GAS_LIFE_TICKS,
  GAS_SPREAD_CHANCE,
  SOLID_CRYSTAL,
  SOLID_CRYSTAL_DULL,
  SOLID_FRAGILE,
  SOLID_FRAGILE_WEAK,
  SOLID_NONE,
  SOLID_ROCK,
  SPORE_BURN_TICKS,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_NONE,
  SURF_SCORCHED,
  SURF_SPORES,
  VENT_BASE_INTERVAL_TICKS,
} from './constants.js';
import { chunkOf } from './worldgen.js';
import type { SemanticEvent, SurvivalState } from './types.js';

const W = (state: SurvivalState): number => state.config.width;
const H = (state: SurvivalState): number => state.config.height;

export const markDirty = (state: SurvivalState, x: number, y: number): void => {
  state.chunkVersion[chunkOf(x, y, W(state))]++;
};

const isReactiveSurface = (kind: number): boolean =>
  kind === SURF_FIRE || kind === SURF_GAS || kind === SURF_SPORES || kind === SURF_FUNGAL_HEATED;

export const setSurface = (state: SurvivalState, i: number, kind: number, timer: number): void => {
  state.surface[i] = kind;
  state.surfaceTimer[i] = timer;
  const x = i % W(state);
  const y = (i - x) / W(state);
  markDirty(state, x, y);
  if (isReactiveSurface(kind)) state.reactionQueue.push(i);
};

const announceIgnite = (state: SurvivalState, i: number, events: SemanticEvent[]): void => {
  const x = i % W(state);
  events.push({ t: 'ignite', x, y: (i - x) / W(state) });
};

/**
 * Comeca ou acelera a secagem do tapete fungico.
 *
 * O fungo e biomassa umida: calor nao o troca por fogo no mesmo instante. O
 * estado intermediario viaja pelo grid, portanto o cliente mostra a colonia
 * fumegando antes da chama aparecer. `directHeat` representa um novo impacto
 * termico; proximidade de fogo apenas inicia a secagem e deixa o relogio correr.
 */
export const heatFungalCell = (
  state: SurvivalState,
  i: number,
  directHeat = false
): boolean => {
  const surf = state.surface[i];
  if (surf === SURF_FUNGAL) {
    const timer = Math.max(CELL_STEP_INTERVAL, FUNGAL_HEAT_TICKS - (directHeat ? FUNGAL_HEAT_IMPACT_TICKS : 0));
    setSurface(state, i, SURF_FUNGAL_HEATED, timer);
    return true;
  }
  if (surf === SURF_FUNGAL_HEATED && directHeat) {
    state.surfaceTimer[i] = Math.max(CELL_STEP_INTERVAL, state.surfaceTimer[i] - FUNGAL_HEAT_IMPACT_TICKS);
    return true;
  }
  return surf === SURF_FUNGAL_HEATED;
};

/**
 * Aplica uma fonte de chama a uma superficie.
 *
 * Cada materia tem sua propria assinatura:
 * - fungo umido apenas entra em secagem;
 * - gas vira um flash curtissimo;
 * - esporos queimam/esterilizam sem explodir;
 * - biofluido usa a combustao normal.
 */
export const igniteCell = (state: SurvivalState, i: number, events: SemanticEvent[]): boolean => {
  const surf = state.surface[i];
  if (surf === SURF_FUNGAL) return heatFungalCell(state, i, false);
  if (surf === SURF_FUNGAL_HEATED) {
    // Uma nova fonte de calor acelera a secagem, mas nao ignora a umidade que
    // ainda resta. A transicao para fogo continua pertencendo ao relogio de
    // stepCells, garantindo que o aviso fumegante nunca seja pulado.
    return heatFungalCell(state, i, true);
  }
  if (surf === SURF_GAS) {
    setSurface(state, i, SURF_FIRE, GAS_FLASH_TICKS);
    announceIgnite(state, i, events);
    return true;
  }
  if (surf === SURF_SPORES) {
    setSurface(state, i, SURF_FIRE, SPORE_BURN_TICKS);
    announceIgnite(state, i, events);
    return true;
  }
  if (surf === SURF_BIOFLUID) {
    setSurface(state, i, SURF_FIRE, FIRE_FUEL_TICKS);
    announceIgnite(state, i, events);
    return true;
  }
  return false;
};

/** Descarga eletrica: BFS pela poca de biofluido conectada, com orcamento. */
/**
 * Alastra por celulas conectadas que satisfacam `connected`, partindo da
 * vizinhanca 3x3 de (sx, sy), ate o orcamento.
 *
 * Era especifico de biofluido; virou generico porque veio de minerio e cadeia
 * de cristal alastram exatamente do mesmo jeito, so mudando o material. Manter
 * tres copias divergiria os orcamentos e o determinismo com o tempo.
 */
export const floodFrom = (
  state: SurvivalState,
  sx: number,
  sy: number,
  budget: number,
  connected: (index: number) => boolean
): number[] => {
  const w = W(state);
  const h = H(state);
  const startCells: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = sx + dx;
      const ny = sy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const i = ny * w + nx;
      if (connected(i)) startCells.push(i);
    }
  }
  if (startCells.length === 0) return [];

  const seen = new Set<number>(startCells);
  const queue = [...startCells];
  let head = 0;
  while (head < queue.length && seen.size < budget) {
    const cur = queue[head++];
    const cx = cur % w;
    const neighbors = [cur - 1, cur + 1, cur - w, cur + w];
    const valid = [cx > 0, cx < w - 1, cur >= w, cur < w * (h - 1)];
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue;
      const ni = neighbors[k];
      if (seen.has(ni) || !connected(ni)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return [...seen];
};

/** Planta carga temporaria nas celulas dadas e anuncia a descarga. */
export const chargeCells = (state: SurvivalState, cells: number[], events: SemanticEvent[]): void => {
  if (cells.length === 0) return;
  for (const i of cells) {
    state.charges.push({ idx: i, until: state.tick + DISCHARGE_TICKS });
  }
  events.push({ t: 'discharge', cells });
};

export const dischargeAt = (state: SurvivalState, sx: number, sy: number, events: SemanticEvent[]): void => {
  chargeCells(
    state,
    floodFrom(state, sx, sy, BUDGET_DISCHARGE_CELLS, (i) => state.surface[i] === SURF_BIOFLUID),
    events
  );
};

export const explodeAt = (
  state: SurvivalState,
  ex: number,
  ey: number,
  radius: number,
  events: SemanticEvent[]
): void => {
  const w = W(state);
  const h = H(state);
  events.push({ t: 'explosion', x: ex, y: ey, radius });
  const r = Math.ceil(radius);
  for (let y = Math.max(0, Math.floor(ey) - r); y <= Math.min(h - 1, Math.floor(ey) + r); y++) {
    for (let x = Math.max(0, Math.floor(ex) - r); x <= Math.min(w - 1, Math.floor(ex) + r); x++) {
      const dx = x + 0.5 - ex;
      const dy = y + 0.5 - ey;
      if (dx * dx + dy * dy > radius * radius) continue;
      const i = y * w + x;
      // Delega em vez de repetir: esta copia da regra de quebra ja existia e
      // teria de aprender cada material novo por conta propria — um bloco
      // corroido seria indestrutivel ate por explosao.
      if (state.solid[i] !== SOLID_NONE) {
        breakSolid(state, x, y, events);
      } else {
        igniteCell(state, i, events);
      }
    }
  }
};

/**
 * Passo celular: processa fila deterministica de celulas reagindo com orcamento fixo.
 * Excedente fica na fila para o proximo passo (degrada latencia, nunca o determinismo).
 */
export const stepCells = (state: SurvivalState, events: SemanticEvent[]): void => {
  if (state.tick % CELL_STEP_INTERVAL !== 0) return;
  const w = W(state);
  const h = H(state);

  // Respiradouros minerais emitem o gas sulfurico periodicamente. A nuvem de
  // esporos e outra materia e nasce exclusivamente do Spore Bomber.
  for (const vent of state.vents) {
    if (state.tick >= vent.nextEmitAt) {
      const interval = Math.max(50, VENT_BASE_INTERVAL_TICKS * (1 - state.contamination * 0.6));
      vent.nextEmitAt = state.tick + Math.floor(interval);
      const i = vent.y * w + vent.x;
      if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
        setSurface(state, i, SURF_GAS, GAS_LIFE_TICKS);
      }
    }
  }

  // descargas expiram
  state.charges = state.charges.filter((c) => c.until > state.tick);

  const queue = state.reactionQueue;
  const budget = Math.min(queue.length, BUDGET_REACTING_CELLS);
  const nextQueue: number[] = [];
  const seenNext = new Set<number>();
  const pushNext = (i: number): void => {
    if (!seenNext.has(i)) {
      seenNext.add(i);
      nextQueue.push(i);
    }
  };

  for (let n = 0; n < budget; n++) {
    const i = queue[n];
    const kind = state.surface[i];
    const x = i % w;
    const y = (i - x) / w;

    if (kind === SURF_FIRE) {
      // Cada vizinho recebe a reacao do proprio material. O fungo nao vira chama
      // aqui: apenas inicia a secagem. Gas e esporos queimam com timers curtos.
      const neighbors = [i - 1, i + 1, i - w, i + w];
      const valid = [x > 0, x < w - 1, y > 0, y < h - 1];
      for (let k = 0; k < 4; k++) {
        if (!valid[k]) continue;
        const ni = neighbors[k];
        const nsurf = state.surface[ni];
        if (nsurf === SURF_GAS || nsurf === SURF_SPORES) {
          igniteCell(state, ni, events);
        } else if (nsurf === SURF_FUNGAL) {
          heatFungalCell(state, ni, false);
        } else if (nsurf === SURF_BIOFLUID && state.rng.nextFloat01() < FIRE_SPREAD_BIOFLUID) {
          igniteCell(state, ni, events);
        }
      }
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        state.surface[i] = SURF_SCORCHED;
        state.surfaceTimer[i] = 0;
        markDirty(state, x, y);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    } else if (kind === SURF_FUNGAL_HEATED) {
      // A umidade precisa sair antes da ignicao. O estado visual permanece
      // fungico/fumegante durante toda a contagem, em vez de surgir fogo do nada.
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        setSurface(state, i, SURF_FIRE, FUNGAL_FIRE_FUEL_TICKS);
        announceIgnite(state, i, events);
        pushNext(i);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    } else if (kind === SURF_SPORES) {
      // Nuvem localizada: nao se multiplica como gas; apenas paira e se desfaz.
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        state.surface[i] = SURF_NONE;
        state.surfaceTimer[i] = 0;
        markDirty(state, x, y);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    } else if (kind === SURF_GAS) {
      // difusao: gas se espalha para celulas abertas sem superficie
      if (state.rng.nextFloat01() < GAS_SPREAD_CHANCE) {
        const dir = state.rng.nextInt(4);
        const ni = [i - 1, i + 1, i - w, i + w][dir];
        const validDir = [x > 0, x < w - 1, y > 0, y < h - 1][dir];
        if (validDir && state.solid[ni] === SOLID_NONE && state.surface[ni] === SURF_NONE) {
          const t = state.surfaceTimer[i];
          if (t > 30) {
            setSurface(state, ni, SURF_GAS, Math.floor(t * 0.65));
            state.surfaceTimer[i] = Math.floor(t * 0.65);
          }
        }
      }
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        state.surface[i] = SURF_NONE;
        state.surfaceTimer[i] = 0;
        markDirty(state, x, y);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    }
  }

  // excedente da fila permanece (ordem preservada)
  for (let n = budget; n < queue.length; n++) pushNext(queue[n]);
  state.reactionQueue = nextQueue;
};

/** Quebra uma celula solida por dano direcionado (projetil perfurante, investida, explosao). */
export const breakSolid = (state: SurvivalState, x: number, y: number, events: SemanticEvent[]): boolean => {
  const w = W(state);
  const i = y * w + x;
  const solid = state.solid[i];
  if (solid === SOLID_FRAGILE || solid === SOLID_FRAGILE_WEAK) {
    state.solid[i] = SOLID_NONE;
    state.surface[i] = SURF_SCORCHED;
    markDirty(state, x, y);
    events.push({ t: 'break', x: x + 0.5, y: y + 0.5, solid });
    return true;
  }
  if (solid === SOLID_CRYSTAL) {
    state.solid[i] = SOLID_NONE;
    markDirty(state, x, y);
    events.push({ t: 'break', x: x + 0.5, y: y + 0.5, solid });
    dischargeAt(state, x, y, events);
    return true;
  }
  if (solid === SOLID_CRYSTAL_DULL) {
    // Quebra, mas sem descarga: a energia dele ja foi embora com o acido.
    state.solid[i] = SOLID_NONE;
    markDirty(state, x, y);
    events.push({ t: 'break', x: x + 0.5, y: y + 0.5, solid });
    return true;
  }
  return false;
};

/**
 * Arranca uma celula de parede COMUM, para virar municao do bruiser.
 *
 * Separado de `breakSolid` de proposito, e as duas diferencas sao intencionais:
 *
 * - `breakSolid` nao quebra rocha — so fragil e cristal. Arrancar a parede e
 *   exatamente o que o bruiser faz de especial, entao precisa passar por cima
 *   dessa regra sem afrouxa-la para todo o resto do jogo.
 * - MINERIO e CRISTAL ficam de fora. Minerio e recurso do jogador e cristal e
 *   luz e descarga; deixar um inimigo apagar qualquer um dos dois de graca
 *   tiraria do jogador coisas que ele foi ate ali buscar, sem que ele pudesse
 *   sequer disputar.
 *
 * A celula vira chao nu, e nao queimado: nada foi incinerado ali, foi levado.
 *
 * A BORDA do mapa tambem fica de fora, e isso apareceu num teste e nao no
 * papel: com o jogador nascendo perto da parede externa, o bruiser arrancava o
 * proprio limite do mundo. Nada quebrava — `isSolidAt` trata fora do mapa como
 * solido — mas abria um buraco na moldura da sala, que e cenario e nao arena.
 */
export const ripSolid = (state: SurvivalState, x: number, y: number, events: SemanticEvent[]): boolean => {
  const w = W(state);
  if (x <= 0 || y <= 0 || x >= w - 1 || y >= state.config.height - 1) return false;
  const i = y * w + x;
  const solid = state.solid[i];
  if (solid !== SOLID_ROCK && solid !== SOLID_FRAGILE && solid !== SOLID_FRAGILE_WEAK) return false;
  state.solid[i] = SOLID_NONE;
  markDirty(state, x, y);
  events.push({ t: 'break', x: x + 0.5, y: y + 0.5, solid });
  return true;
};
