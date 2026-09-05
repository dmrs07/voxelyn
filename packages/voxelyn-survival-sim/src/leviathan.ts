// O LEVIATA DO LENCOL — as regras PURAS do corpo que atravessa a lamina.
//
// Tudo aqui e funcao de estado autoritativo (humor, acao, posicao, grade,
// tick) e nada aqui escreve estado. E o vocabulario que a simulacao e o
// cliente compartilham: a simulacao pergunta "ele e alvo?", "esta celula esta
// tampada?", "o jogador esta dentro da bolha?"; o cliente pergunta "quanto do
// segmento de posto k esta debaixo d'agua?" — e as duas pontas tem de chegar
// a mesma resposta a partir dos mesmos numeros, senao o desenho promete uma
// coisa e o dano cobra outra.
import {
  LEVIATHAN_HEAD_FRACTION,
  LEVIATHAN_LID_RADIUS,
  LEVIATHAN_PROTECTIVE_BUBBLE_RADIUS,
  LEVIATHAN_PROTECTIVE_BUBBLE_SHELL_RADIUS,
  SOLID_NONE,
  SURF_DEEP_WATER,
  SURF_WATER,
} from './constants.js';
import {
  LEVIATHAN_ANCHORED,
  LEVIATHAN_DIVING,
  LEVIATHAN_EMERGING,
  LEVIATHAN_HIDDEN,
  LEVIATHAN_HUNTING,
  type Entity,
  type EntityAction,
  type ProtectiveBubble,
  type SurvivalState,
} from './types.js';

/**
 * As seis posturas legiveis do encontro. Cinco sao o humor autoritativo; a
 * sexta, `charging`, e DERIVADA: ele esta cacando e parou para carregar a
 * descarga massiva. Nao e um humor proprio porque nao decide nada que o humor
 * `hunting` mais a acao ja nao decidam — seria um segundo lugar para a mesma
 * verdade discordar.
 */
export type LeviathanPosture =
  | 'anchored'
  | 'diving'
  | 'hidden'
  | 'emerging'
  | 'hunting'
  | 'charging';

/**
 * Quantos SEGMENTOS VISUAIS o corpo tem alem da cabeca. O posto 0 e a raiz
 * das asas (colado ao disco cefalico); o ultimo e a ponta da cauda. E a
 * contagem de quadros do atlas `part-sheet-leviathan-body`, e a razao de o
 * numero morar aqui e que a ORDEM da submersao (cabeca, asas, tronco, cauda)
 * e uma regra do encontro, nao um detalhe de desenho.
 */
export const LEVIATHAN_BODY_RANKS = 8;

export const leviathanPosture = (enemy: Pick<Entity, 'mood' | 'action'>): LeviathanPosture => {
  switch (enemy.mood ?? LEVIATHAN_ANCHORED) {
    case LEVIATHAN_DIVING:
      return 'diving';
    case LEVIATHAN_HIDDEN:
      return 'hidden';
    case LEVIATHAN_EMERGING:
      return 'emerging';
    case LEVIATHAN_HUNTING:
      return enemy.action?.kind === 'massive_shock' ? 'charging' : 'hunting';
    default:
      return 'anchored';
  }
};

/** Prende um numero em 0..1. */
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * O progresso da FASE CONDUZIDA de uma acao (da liberacao ao fim), 0..1.
 *
 * Zero durante o windup: o mergulho so comeca a afundar segmentos depois do
 * aviso, e a emergencia so comeca a tirar a cabeca da agua depois do halo.
 */
export const actionDrivenProgress = (action: EntityAction | undefined, tick: number): number => {
  if (!action) return 0;
  if (tick < action.releaseAt) return 0;
  const span = action.endsAt - action.releaseAt;
  if (span <= 0) return 1;
  return clamp01((tick - action.releaseAt) / span);
};

/** Progresso do mergulho em curso (0 = corpo inteiro fora; 1 = sumiu), ou null. */
export const leviathanDiveProgress = (enemy: Entity, tick: number): number | null => {
  if (enemy.mood !== LEVIATHAN_DIVING) return null;
  if (enemy.action?.kind !== 'dive') return 1;
  return actionDrivenProgress(enemy.action, tick);
};

/** Progresso da emergencia em curso (0 = nada fora; 1 = corpo inteiro), ou null. */
export const leviathanEmergeProgress = (enemy: Entity, tick: number): number | null => {
  if (enemy.mood !== LEVIATHAN_EMERGING) return null;
  if (enemy.action?.kind !== 'emerge') return 1;
  return actionDrivenProgress(enemy.action, tick);
};

/**
 * QUANTO DA REGIAO VULNERAVEL esta fora da agua, 0..1.
 *
 * A regiao vulneravel e o disco cefalico — e a primeira coisa que entra no
 * mergulho e a primeira que sai na emergencia, entao a janela de dano fecha
 * cedo ao afundar e abre cedo ao subir. `LEVIATHAN_HEAD_FRACTION` e a fracao
 * do intervalo que a cabeca leva; o resto e corpo, que nao e alvo.
 */
export const leviathanExposure = (enemy: Entity, tick: number): number => {
  switch (enemy.mood ?? LEVIATHAN_ANCHORED) {
    case LEVIATHAN_HIDDEN:
      return 0;
    case LEVIATHAN_DIVING: {
      const progress = leviathanDiveProgress(enemy, tick) ?? 1;
      return 1 - clamp01(progress / LEVIATHAN_HEAD_FRACTION);
    }
    case LEVIATHAN_EMERGING: {
      const progress = leviathanEmergeProgress(enemy, tick) ?? 1;
      return clamp01(progress / LEVIATHAN_HEAD_FRACTION);
    }
    default:
      return 1;
  }
};

/**
 * Ele e ALVO neste tick? — a pergunta do funil de dano, dos projeteis e da
 * mira assistida, respondida uma vez so.
 *
 * Meia cabeca fora e o limiar: menos que isso e uma crista rompendo a lamina,
 * e um tiro que "acertasse" a agua sobre ela ensinaria que a emergencia e a
 * janela. A janela e o disco cefalico VISIVEL.
 */
export const leviathanTargetable = (enemy: Entity, tick: number): boolean =>
  leviathanExposure(enemy, tick) >= 0.5;

/**
 * QUANTO DO SEGMENTO de posto `rank` esta debaixo d'agua, 0..1, dado o
 * progresso da acao e o sentido.
 *
 * A ordem e a regra do encontro: no mergulho a cabeca (posto -1, que o
 * chamador trata a parte) entra primeiro, as raizes das asas dobram em
 * seguida, as membranas atravessam a lamina, e tronco e cauda sao os ultimos;
 * na emergencia e o inverso exato. Cada posto ocupa uma janela de
 * `LEVIATHAN_HEAD_FRACTION` do intervalo, com o inicio escalonado ao longo do
 * corpo — a janela da cabeca vai de 0 ate a fracao, a da ponta da cauda
 * termina em 1. As janelas se SOBREPOEM de proposito: um corpo que afundasse
 * um posto de cada vez leria como uma fila de pecas, e este e um so.
 *
 * `rank` -1 e a cabeca; 0..`ranks - 1` sao os segmentos.
 */
export const leviathanSegmentSubmersion = (
  rank: number,
  ranks: number,
  progress: number,
  mode: 'dive' | 'emerge',
): number => {
  const slots = ranks + 1; // a cabeca mais os segmentos
  const slot = rank + 1;
  const window = LEVIATHAN_HEAD_FRACTION;
  const start = slots <= 1 ? 0 : (slot / (slots - 1)) * (1 - window);
  const p = clamp01(progress);
  const entered = clamp01((p - start) / window);
  return mode === 'dive' ? entered : 1 - entered;
};

/**
 * A TAMPA VIVA esta ativa? — ancorado, ou mergulhando ate a cauda sumir.
 *
 * Emergindo NAO: a cobertura so volta quando o corpo termina de ocupar o
 * nucleo (`LEVIATHAN_ANCHORED` de novo). Um jogador que pisasse na poca com
 * a cabeca dele ainda rompendo a lamina cairia — e essa e a regra, e nao um
 * descuido: o corpo ainda nao esta la.
 */
export const leviathanLidActive = (enemy: Entity): boolean =>
  enemy.alive && (enemy.mood === LEVIATHAN_ANCHORED || enemy.mood === LEVIATHAN_DIVING);

/**
 * As celulas de agua profunda que o corpo aberto COBRE, derivadas da posicao
 * (a ancora), do raio autorado da silhueta estacionaria e da grade.
 *
 * Derivadas e nao armazenadas: as duas pontas tem os tres ingredientes, e uma
 * lista guardada teria como discordar deles. So celulas 4-conexas a ancora
 * por agua (rasa ou profunda) contam — uma segunda poca a dois tiles, do outro
 * lado de uma faixa de chao, nao esta debaixo de asa nenhuma.
 */
export const leviathanLidCells = (state: SurvivalState, enemy: Entity): number[] => {
  const w = state.config.width;
  const h = state.config.height;
  const ax = Math.floor(enemy.x);
  const ay = Math.floor(enemy.y);
  if (ax < 0 || ay < 0 || ax >= w || ay >= h) return [];
  const start = ay * w + ax;
  const isWater = (i: number): boolean =>
    state.solid[i] === SOLID_NONE &&
    (state.surface[i] === SURF_WATER || state.surface[i] === SURF_DEEP_WATER);
  if (!isWater(start)) return [];
  const out: number[] = [];
  const seen = new Set<number>([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const cx = cell % w;
    const cy = (cell - cx) / w;
    if (state.surface[cell] === SURF_DEEP_WATER) out.push(cell);
    for (let k = 0; k < 4; k++) {
      const x = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const y = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (Math.hypot(x + 0.5 - enemy.x, y + 0.5 - enemy.y) > LEVIATHAN_LID_RADIUS) continue;
      const i = y * w + x;
      if (seen.has(i) || !isWater(i)) continue;
      seen.add(i);
      queue.push(i);
    }
  }
  return out;
};

/**
 * Esta celula profunda esta TAMPADA pelo corpo do Leviata neste tick?
 *
 * E a pergunta que `plungeIntoDeepWater` faz antes de matar. Barata: so ha um
 * Leviata por setor, e a busca da tampa cobre no maximo uma dezena de celulas.
 */
export const leviathanCovers = (state: SurvivalState, cell: number): boolean => {
  for (const enemy of state.enemies) {
    if (enemy.archetype !== 'sheet_leviathan' || !leviathanLidActive(enemy)) continue;
    if (
      Math.hypot(
        (cell % state.config.width) + 0.5 - enemy.x,
        Math.floor(cell / state.config.width) + 0.5 - enemy.y,
      ) > LEVIATHAN_LID_RADIUS
    )
      continue;
    if (leviathanLidCells(state, enemy).includes(cell)) return true;
  }
  return false;
};

/**
 * O PREDICADO DA BOLHA: o centro do Prospector esta a ate `radius` do centro
 * da bolha. Um so, para dano, HUD, som, renderer, debug e testes.
 *
 * Nao subtrai o raio do corpo: `radius` JA E o raio seguro para o pivo. O
 * epsilon existe para o limite exato contar como dentro nas duas pontas —
 * quem para com o centro na linha desenhada esta protegido, e nao a merce de
 * um arredondamento de ponto flutuante.
 */
export const BUBBLE_EPSILON = 1e-6;
export const playerProtectedByBubble = (
  x: number,
  y: number,
  bubble: Pick<ProtectiveBubble, 'x' | 'y' | 'radius'>,
): boolean => Math.hypot(x - bubble.x, y - bubble.y) <= bubble.radius + BUBBLE_EPSILON;

/** Esta em ALGUMA das bolhas? */
export const insideAnyBubble = (
  x: number,
  y: number,
  bubbles: ReadonlyArray<Pick<ProtectiveBubble, 'x' | 'y' | 'radius'>>,
): boolean => bubbles.some((bubble) => playerProtectedByBubble(x, y, bubble));

/**
 * O raio da CASCA visual de uma bolha: o domo pode ser maior que a area
 * segura, mas e sempre derivado dela pela mesma folga — nunca um numero solto
 * no renderer.
 */
export const bubbleShellRadius = (bubble: Pick<ProtectiveBubble, 'radius'>): number =>
  bubble.radius + (LEVIATHAN_PROTECTIVE_BUBBLE_SHELL_RADIUS - LEVIATHAN_PROTECTIVE_BUBBLE_RADIUS);

/**
 * Uma celula profunda e um CENTRO DE POCA ocupavel: esta aberta, e profunda,
 * e os quatro vizinhos sao agua (rasa ou profunda). E o que separa um nucleo
 * autorado — a plus de cinco celulas que a Sondagem afunda, ou o miolo de
 * uma cisterna natural — de uma celula profunda solta na margem.
 */
export const isPoolCore = (state: SurvivalState, cell: number): boolean => {
  const w = state.config.width;
  const h = state.config.height;
  const x = cell % w;
  const y = (cell - x) / w;
  if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return false;
  if (state.solid[cell] !== SOLID_NONE || state.surface[cell] !== SURF_DEEP_WATER) return false;
  for (const n of [cell - 1, cell + 1, cell - w, cell + w]) {
    if (state.solid[n] !== SOLID_NONE) return false;
    if (state.surface[n] !== SURF_WATER && state.surface[n] !== SURF_DEEP_WATER) return false;
  }
  return true;
};

/**
 * O centro de poca ocupavel mais proximo de (x, y) dentro de `reach` tiles,
 * ou -1. Varredura em anel FIXA: duas maquinas escolhem a mesma celula.
 */
export const nearestPoolCore = (
  state: SurvivalState,
  x: number,
  y: number,
  reach: number,
): number => {
  const w = state.config.width;
  const h = state.config.height;
  for (let r = 0; r <= reach; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const cx = x + dx;
        const cy = y + dy;
        if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= h - 1) continue;
        const i = cy * w + cx;
        if (isPoolCore(state, i)) return i;
      }
    }
  }
  return -1;
};
