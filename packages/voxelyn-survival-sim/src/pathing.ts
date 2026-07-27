// Busca de caminho na grade, para inimigos que nao podem ser perdidos de vista.
//
// Por que existe: a direcao de perseguicao era `normalized(alvo - inimigo)` e
// mais nada. Contra parede isso nao e "burro" de um jeito interessante, e sim
// inerte: o inimigo encosta na quina, escorrega de lado e para. Qualquer canto
// do mapa virava abrigo permanente, e para um CHEFE isso e o fim da luta — o
// jogador nao precisa vencer, precisa achar uma pedra.
//
// Duas decisoes moldam tudo aqui:
//
// 1. O caminho tem CUSTO, nao so passagem. Parede quebravel e atravessavel, mas
//    cara: o guardiao prefere contornar quando ha volta curta e arromba quando
//    nao ha. Isso e o que faz a rota parecer escolha e nao trilho — e e a
//    traducao literal de "o caminho mais rapido viavel", que nem sempre e o
//    caminho livre.
// 2. Minerio e cristal sao INTRANSPONIVEIS, e nao caros. Sao recurso e luz do
//    jogador; um chefe que abre passagem por dentro deles tira da mesa coisas
//    que o jogador foi ali buscar, sem que ele possa disputar.
import {
  SOLID_FRAGILE,
  SOLID_FRAGILE_WEAK,
  SOLID_NONE,
  SOLID_ROCK,
} from './constants.js';
import type { SurvivalState } from './types.js';

/** Andar por chao livre custa 1; arrombar parede custa isto. */
export const PATH_COST_BREAK = 7;

/**
 * Teto de celulas expandidas por busca.
 *
 * A simulacao roda a 20 Hz e precisa caber no orcamento de um celular. Sem teto,
 * um alvo inalcancavel faria a busca varrer o mapa inteiro toda vez que fosse
 * chamada. Estourado o teto, quem chamou volta para a perseguicao em linha reta
 * — pior, mas barata e previsivel.
 */
export const PATH_NODE_BUDGET = 2600;

const breakableCost = (solid: number): number =>
  solid === SOLID_ROCK || solid === SOLID_FRAGILE || solid === SOLID_FRAGILE_WEAK ? PATH_COST_BREAK : -1;

/** Custo de entrar numa celula, ou -1 se ela for intransponivel. */
const enterCost = (solid: number): number => (solid === SOLID_NONE ? 1 : breakableCost(solid));

/**
 * Ha linha de visao livre entre dois pontos?
 *
 * Amostra a meio tile porque a grade e de tiles inteiros: passo de um tile
 * pularia por cima de uma parede fina na diagonal, e o inimigo tentaria andar em
 * linha reta atravessando pedra.
 */
export const hasLineOfSight = (
  state: SurvivalState,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean => {
  const w = state.config.width;
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = Math.floor(x0 + (x1 - x0) * t);
    const cy = Math.floor(y0 + (y1 - y0) * t);
    if (cx < 0 || cy < 0 || cx >= w || cy >= state.config.height) return false;
    if (state.solid[cy * w + cx] !== SOLID_NONE) return false;
  }
  return true;
};

/** Monte binario minimo de (custo, celula). O indice desempata. */
class MinHeap {
  private readonly cost: number[] = [];
  private readonly cell: number[] = [];

  get size(): number {
    return this.cell.length;
  }

  private before(a: number, b: number): boolean {
    // Desempate pelo INDICE da celula, e nao pela ordem de insercao: `sort` e a
    // ordem de descoberta variam com detalhes de implementacao, e este atlas de
    // decisoes precisa sair identico nas duas maquinas de uma sala de co-op.
    return this.cost[a] !== this.cost[b] ? this.cost[a] < this.cost[b] : this.cell[a] < this.cell[b];
  }

  private swap(a: number, b: number): void {
    const c = this.cost[a];
    const k = this.cell[a];
    this.cost[a] = this.cost[b];
    this.cell[a] = this.cell[b];
    this.cost[b] = c;
    this.cell[b] = k;
  }

  push(cost: number, cell: number): void {
    this.cost.push(cost);
    this.cell.push(cell);
    let i = this.cell.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): { cost: number; cell: number } {
    const top = { cost: this.cost[0], cell: this.cell[0] };
    const lastCost = this.cost.pop() as number;
    const lastCell = this.cell.pop() as number;
    if (this.cell.length > 0) {
      this.cost[0] = lastCost;
      this.cell[0] = lastCell;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let best = i;
        if (l < this.cell.length && this.before(l, best)) best = l;
        if (r < this.cell.length && this.before(r, best)) best = r;
        if (best === i) break;
        this.swap(i, best);
        i = best;
      }
    }
    return top;
  }
}

/**
 * Caminho de menor CUSTO entre duas celulas, como lista de indices de celula da
 * primeira depois da origem ate o destino. Vazio quando nao ha rota dentro do
 * orcamento.
 *
 * Dijkstra e nao busca em largura porque as arestas tem pesos diferentes —
 * atravessar parede custa `PATH_COST_BREAK`. Com busca em largura o inimigo
 * arrombaria a primeira parede sempre que ela encurtasse a rota em UM passo, o
 * que le como teimosia, e nao como escolha.
 */
export const findPath = (
  state: SurvivalState,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number
): number[] => {
  const w = state.config.width;
  const h = state.config.height;
  if (startX < 0 || startY < 0 || startX >= w || startY >= h) return [];
  if (targetX < 0 || targetY < 0 || targetX >= w || targetY >= h) return [];
  const start = startY * w + startX;
  const goal = targetY * w + targetX;
  if (start === goal) return [];

  const dist = new Map<number, number>();
  const from = new Map<number, number>();
  const heap = new MinHeap();
  dist.set(start, 0);
  heap.push(0, start);
  let expanded = 0;
  let reached = false;

  while (heap.size > 0 && expanded < PATH_NODE_BUDGET) {
    const { cost, cell } = heap.pop();
    if (cost > (dist.get(cell) ?? Infinity)) continue; // entrada obsoleta
    if (cell === goal) {
      reached = true;
      break;
    }
    expanded++;
    const cx = cell % w;
    const cy = (cell / w) | 0;
    // Ordem fixa dos vizinhos: a rota tem de sair igual nas duas maquinas.
    const deltas = [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ];
    for (const [dx, dy] of deltas) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue; // moldura do mapa
      const next = ny * w + nx;
      const step = next === goal ? 1 : enterCost(state.solid[next]);
      if (step < 0) continue;
      const nd = cost + step;
      if (nd >= (dist.get(next) ?? Infinity)) continue;
      dist.set(next, nd);
      from.set(next, cell);
      heap.push(nd, next);
    }
  }

  if (!reached) return [];
  const path: number[] = [];
  let node = goal;
  while (node !== start) {
    path.push(node);
    const prev = from.get(node);
    if (prev === undefined) return []; // sem rota completa
    node = prev;
  }
  path.reverse();
  return path;
};
