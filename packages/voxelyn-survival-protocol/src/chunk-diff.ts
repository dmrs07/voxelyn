import { CHUNK, type SurvivalState } from '@voxelyn/survival-sim';

// ---------------------------------------------------------------------------
// Sincronizacao do mundo destrutivel sem enviar o grid inteiro.
//
// Estrategia:
//  1. cliente gera o estado estatico localmente pela seed (mesmo worldgen);
//  2. servidor rastreia um espelho das camadas solid/surface;
//  3. a cada snapshot, apenas chunks com celulas alteradas viram ChunkDiff,
//     carregando (indice local, solid, surface) das celulas que mudaram;
//  4. o cliente aplica os diffs sobre suas proprias arrays.
//
// Um ChunkDiff carrega a versao do chunk (monotonica) para deteccao de
// perda/reordenacao e para full resync.
// ---------------------------------------------------------------------------

export type CellChange = {
  /** indice da celula dentro do chunk: (localY * CHUNK + localX), 0..CHUNK*CHUNK-1 */
  i: number;
  solid: number;
  surface: number;
};

export type ChunkDiff = {
  /** indice do chunk: chunkY * chunksX + chunkX */
  c: number;
  /** versao do chunk no momento da geracao do diff */
  v: number;
  cells: CellChange[];
};

const chunksX = (width: number): number => Math.ceil(width / CHUNK);
const chunksY = (height: number): number => Math.ceil(height / CHUNK);

/**
 * Rastreador de mundo do lado do servidor. Mantem um espelho das camadas e
 * produz diffs incrementais desde a ultima chamada.
 */
export class ChunkTracker {
  private readonly mirrorSolid: Uint8Array;
  private readonly mirrorSurface: Uint8Array;
  private readonly cx: number;
  private readonly cy: number;

  constructor(
    private readonly width: number,
    private readonly height: number
  ) {
    this.mirrorSolid = new Uint8Array(width * height);
    this.mirrorSurface = new Uint8Array(width * height);
    this.cx = chunksX(width);
    this.cy = chunksY(height);
  }

  /** Inicializa o espelho a partir do estado inicial (sem gerar diffs). */
  seed(state: SurvivalState): void {
    this.mirrorSolid.set(state.solid);
    this.mirrorSurface.set(state.surface);
  }

  /**
   * Compara o estado atual contra o espelho e retorna diffs dos chunks alterados,
   * atualizando o espelho. `chunkVersion` vem do proprio estado da sim.
   */
  diff(state: SurvivalState): ChunkDiff[] {
    const diffs: ChunkDiff[] = [];
    const w = this.width;

    for (let cyi = 0; cyi < this.cy; cyi++) {
      for (let cxi = 0; cxi < this.cx; cxi++) {
        const chunkIndex = cyi * this.cx + cxi;
        const cells: CellChange[] = [];
        const x0 = cxi * CHUNK;
        const y0 = cyi * CHUNK;
        const x1 = Math.min(x0 + CHUNK, w);
        const y1 = Math.min(y0 + CHUNK, this.height);

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const gi = y * w + x;
            const s = state.solid[gi];
            const su = state.surface[gi];
            if (s !== this.mirrorSolid[gi] || su !== this.mirrorSurface[gi]) {
              const li = (y - y0) * CHUNK + (x - x0);
              cells.push({ i: li, solid: s, surface: su });
              this.mirrorSolid[gi] = s;
              this.mirrorSurface[gi] = su;
            }
          }
        }

        if (cells.length > 0) {
          diffs.push({ c: chunkIndex, v: state.chunkVersion[chunkIndex] ?? 0, cells });
        }
      }
    }
    return diffs;
  }

  /** Produz um "diff completo" (todas as celulas nao-vazias) para full resync. */
  fullSnapshot(state: SurvivalState): ChunkDiff[] {
    const diffs: ChunkDiff[] = [];
    const w = this.width;
    for (let cyi = 0; cyi < this.cy; cyi++) {
      for (let cxi = 0; cxi < this.cx; cxi++) {
        const chunkIndex = cyi * this.cx + cxi;
        const cells: CellChange[] = [];
        const x0 = cxi * CHUNK;
        const y0 = cyi * CHUNK;
        const x1 = Math.min(x0 + CHUNK, w);
        const y1 = Math.min(y0 + CHUNK, this.height);
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const gi = y * w + x;
            const li = (y - y0) * CHUNK + (x - x0);
            cells.push({ i: li, solid: state.solid[gi], surface: state.surface[gi] });
          }
        }
        diffs.push({ c: chunkIndex, v: state.chunkVersion[chunkIndex] ?? 0, cells });
      }
    }
    // sincroniza o espelho com o estado enviado
    this.mirrorSolid.set(state.solid);
    this.mirrorSurface.set(state.surface);
    return diffs;
  }
}

/**
 * Espelho do mundo no cliente: arrays solid/surface que recebem diffs.
 * O cliente costuma inicializa-las via worldgen local (mesma seed) e entao
 * aplicar os diffs incrementais do servidor por cima.
 */
export class ClientWorldMirror {
  readonly solid: Uint8Array;
  readonly surface: Uint8Array;
  readonly chunkVersions: Uint32Array;
  private readonly cx: number;

  constructor(
    readonly width: number,
    readonly height: number,
    initialSolid?: Uint8Array,
    initialSurface?: Uint8Array
  ) {
    this.solid = new Uint8Array(width * height);
    this.surface = new Uint8Array(width * height);
    if (initialSolid) this.solid.set(initialSolid);
    if (initialSurface) this.surface.set(initialSurface);
    this.cx = chunksX(width);
    this.chunkVersions = new Uint32Array(this.cx * chunksY(height));
  }

  /**
   * Aplica um lote de diffs. Diffs obsoletos sao ignorados.
   * @returns true se algum diff era INCOERENTE com este mundo (indice de chunk
   * fora da grade) — sinal de divergencia que o chamador deve tratar pedindo
   * um full_resync, em vez de seguir renderizando terreno errado.
   */
  apply(diffs: ChunkDiff[]): boolean {
    const w = this.width;
    let diverged = false;
    for (const diff of diffs) {
      if (diff.c < 0 || diff.c >= this.chunkVersions.length) {
        diverged = true; // diff de um mundo que nao e este
        continue;
      }
      // ignora diffs obsoletos (reordenacao/reentrega)
      if (diff.v !== 0 && diff.v < this.chunkVersions[diff.c]) continue;
      const cxi = diff.c % this.cx;
      const cyi = Math.floor(diff.c / this.cx);
      const x0 = cxi * CHUNK;
      const y0 = cyi * CHUNK;
      for (const cell of diff.cells) {
        const lx = cell.i % CHUNK;
        const ly = Math.floor(cell.i / CHUNK);
        const gx = x0 + lx;
        const gy = y0 + ly;
        if (gx >= w || gy >= this.height) continue;
        const gi = gy * w + gx;
        this.solid[gi] = cell.solid;
        this.surface[gi] = cell.surface;
      }
      this.chunkVersions[diff.c] = diff.v;
    }
    return diverged;
  }
}

/** Serializacao explicita (round-trip com JSON). */
export const encodeChunkDiffs = (diffs: ChunkDiff[]): string => JSON.stringify(diffs);

export const decodeChunkDiffs = (raw: string): ChunkDiff[] => {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('chunk diffs: esperava um array');
  return parsed as ChunkDiff[];
};
