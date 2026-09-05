// O CORPO DO LEVIATA — oito cortes transversais atras da cabeca, em dois
// comportamentos que nao se misturam.
//
// A simulacao move UM ponto (a cabeca) e guarda UMA postura (o humor mais a
// acao em curso). O corpo e desenho, e a razao de ele ser segmentado nao e
// comprimento: e a SUBMERSAO. Cabeca, asas, tronco e cauda atravessam a lamina
// em momentos diferentes, e so um corpo em pecas consegue ser recortado pela
// superficie da agua peca a peca.
//
// MODO ANCORADO (primeira fase). Ele esta parado sobre a poca, corpo aberto
// tampando o nucleo. Os segmentos usam uma POSE AUTORADA em volta da posicao
// central — uma manta completa, asas abertas, cauda repousando sobre a lamina
// — e uma respiracao lenta. NAO ha historico de movimento aqui: o boss nao
// anda, e um rastro alimentado por uma cabeca parada seria um rastro
// inventado. O mergulho e a emergencia sao a mesma pose com cada peca a uma
// fracao debaixo d'agua, derivada do progresso autoritativo da acao e do
// posto (`leviathanSegmentSubmersion`, na simulacao).
//
// MODO DE PERSEGUICAO (segunda fase). O corpo passa a usar o rastro por
// comprimento de arco (`spine-trail.ts`, o mesmo do Devorador): a cabeca
// persegue o Prospector e os segmentos seguem as curvas que ela fez, com uma
// onda das asas propagando da frente para tras. O rastro NASCE na emergencia
// e e jogado fora em qualquer salto de posicao — nunca ha um segmento ligando
// duas pocas.
//
// ESCONDIDO nao desenha nada. Nem corpo, nem sombra, nem barra.
import {
  LEVIATHAN_BODY_RANKS,
  LEVIATHAN_HIDDEN,
  leviathanDiveProgress,
  leviathanEmergeProgress,
  leviathanPosture,
  leviathanSegmentSubmersion,
  type Entity,
  type LeviathanPosture,
} from '@voxelyn/survival-sim';
import { SpineTrail, type TrailNode } from './spine-trail';

/**
 * Os atlas das pecas do corpo: as asas (postos 0..3) e a cauda (postos 4..7).
 * Os quadros sao POSTOS, nao instantes. Dois atlas porque um atlas tem um
 * tamanho de quadro so, e a raiz das asas (quatro tiles de vao) num quadro
 * de 208 px faria a ponta da cauda, de cinquenta, pagar o mesmo em branco.
 */
export const LEVIATHAN_WINGS_ATLAS = 'part-sheet-leviathan-wings';
export const LEVIATHAN_TAIL_ATLAS = 'part-sheet-leviathan-tail';
export const LEVIATHAN_WING_RANKS = 4;

/** Em que atlas e em que quadro vive a peca de um posto. */
export const leviathanPieceFrame = (rank: number): { atlas: string; frame: number } =>
  rank < LEVIATHAN_WING_RANKS
    ? { atlas: LEVIATHAN_WINGS_ATLAS, frame: rank }
    : { atlas: LEVIATHAN_TAIL_ATLAS, frame: rank - LEVIATHAN_WING_RANKS };

/**
 * O raio da MASSA que cada posto arrasta por baixo da lamina, em tiles.
 *
 * O que se ve dele e o dorso; o que o jogador tem de sentir e o resto — a
 * sombra larga e sem borda que uma coisa grande demais faz na agua escura.
 * Desenhada no chao sob cada peca (e sob a cabeca), so sobre agua, e ela
 * que faz o corpo parecer maior do que o que rompe a superficie. Os postos
 * das asas sao os mais largos; a cauda quase nao faz sombra.
 */
export const LEVIATHAN_MASS_RADIUS: readonly number[] = [2.6, 2.9, 2.5, 1.8, 1.3, 0.9, 0.7, 0.5];
export const LEVIATHAN_HEAD_MASS_RADIUS = 2.0;

/**
 * Passo entre pecas, em tiles.
 *
 * A peca e autorada com 7 unidades de comprimento (0,875 tile) e o passo e de
 * 0,62: sobram 0,25 tile de sobreposicao, que e o que impede a fila de abrir
 * fresta nas curvas da cacada — o lado de fora de uma coluna torta anda mais
 * que o passo. Com a cabeca (~1,4 tile) o corpo inteiro passa de 6 tiles.
 */
export const LEVIATHAN_SEGMENT_GAP = 0.62;
/** Onde a primeira peca (a raiz das asas) se encaixa, atras da ancora da cabeca. */
export const LEVIATHAN_HEAD_OFFSET = 0.7;
/** Resolucao do rastro na cacada, em tiles. */
export const LEVIATHAN_TRAIL_STEP = 0.12;
/** A ondulacao lateral na cacada: um corpo pesado, uma onda longa, devagar. */
export const LEVIATHAN_SWAY = 0.1;
export const LEVIATHAN_SWAY_WAVES = 0.8;
export const LEVIATHAN_SWAY_HZ = 0.45;
/**
 * A RIGIDEZ do corpo na cacada (`TrailConfig.stiffness`): uma raia, nao uma
 * cobra. A cabeca e o vetor, a raiz das asas herda o rumo dela quase inteiro
 * e o corpo so dobra de verdade do tronco para tras — e cada peca desvia da
 * anterior no maximo `LEVIATHAN_MAX_BEND` (12 graus), o que da a cauda uma
 * curva de 84 graus no total, para o corpo VIRAR sem serpentear.
 */
export const LEVIATHAN_STIFFNESS = 0.72;
export const LEVIATHAN_MAX_BEND = (12 * Math.PI) / 180;
/**
 * Salto de posicao acima do qual o rastro e descartado. O menor salto entre
 * pocas e de 5 tiles (`LEVIATHAN_HOP_MIN_TILES`); a cabeca nada no maximo
 * ~6,3 tiles/s, ou seja, 0,3 tile por tick — tres tiles nunca sao um passo.
 */
export const LEVIATHAN_TELEPORT_TILES = 3;

/**
 * Quanto uma peca DESCE, em pixels de atlas, quando esta 100% submersa.
 * A altura do quadro das asas (112px, o maior dos tres): descendo tudo, o
 * recorte na lamina nao deixa um pixel, nem da cabeca nem de peca alguma.
 */
export const LEVIATHAN_SINK_PX = 112;

/** Uma peca do corpo resolvida para este quadro. */
export type LeviathanBodyNode = TrailNode & {
  /** 0 = inteira fora da agua; 1 = inteira debaixo dela. */
  submersion: number;
  /** A onda das asas na cacada: elevacao em pixels logicos (so apresentacao). */
  bobPx: number;
};

export type LeviathanBodyHead = {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  /** 0..1 da cabeca debaixo d'agua. */
  submersion: number;
};

/** O que o corpo esta fazendo neste quadro, derivado da postura autoritativa. */
export type LeviathanBodyMode = 'anchored' | 'dive' | 'emerge' | 'hunting' | 'hidden';

export const leviathanBodyMode = (posture: LeviathanPosture): LeviathanBodyMode => {
  switch (posture) {
    case 'diving':
      return 'dive';
    case 'emerging':
      return 'emerge';
    case 'hidden':
      return 'hidden';
    case 'hunting':
    case 'charging':
      return 'hunting';
    default:
      return 'anchored';
  }
};

/**
 * A submersao da CABECA e de cada POSTO neste tick, ou tudo zero fora do
 * mergulho e da emergencia. Vem do progresso autoritativo da acao — as duas
 * pontas (e o co-op) leem os mesmos numeros.
 */
export const leviathanSubmersions = (
  enemy: Entity,
  tick: number,
): { head: number; ranks: number[] } => {
  const dive = leviathanDiveProgress(enemy, tick);
  const emerge = dive === null ? leviathanEmergeProgress(enemy, tick) : null;
  const ranks: number[] = [];
  if (dive === null && emerge === null) {
    const hidden = (enemy.mood ?? 0) === LEVIATHAN_HIDDEN ? 1 : 0;
    for (let k = 0; k < LEVIATHAN_BODY_RANKS; k++) ranks.push(hidden);
    return { head: hidden, ranks };
  }
  const mode = dive !== null ? 'dive' : 'emerge';
  const progress = dive ?? emerge ?? 0;
  for (let k = 0; k < LEVIATHAN_BODY_RANKS; k++) {
    ranks.push(leviathanSegmentSubmersion(k, LEVIATHAN_BODY_RANKS, progress, mode));
  }
  return { head: leviathanSegmentSubmersion(-1, LEVIATHAN_BODY_RANKS, progress, mode), ranks };
};

/**
 * A POSE ANCORADA: as pecas em linha reta atras da cabeca, com a manta aberta
 * e uma respiracao lenta — as asas sobem e descem um nada, a cauda balanca de
 * leve sobre a lamina. Nada aqui vem de historico: a forma sai da posicao, do
 * rumo e do relogio, e e a mesma nas duas pontas do co-op.
 */
export const anchoredBodyNodes = (
  head: LeviathanBodyHead,
  ranks: readonly number[],
  nowMs: number,
): LeviathanBodyNode[] => {
  const back = { x: -head.dirX, y: -head.dirY };
  const side = { x: -head.dirY, y: head.dirX };
  const breath = Math.sin(nowMs / 1400);
  const nodes: LeviathanBodyNode[] = [];
  for (let k = 0; k < LEVIATHAN_BODY_RANKS; k++) {
    const d = LEVIATHAN_HEAD_OFFSET + k * LEVIATHAN_SEGMENT_GAP;
    const grow = k / (LEVIATHAN_BODY_RANKS - 1);
    // A cauda repousa de lado, ondulando devagar; as asas so respiram.
    const drift = k >= 5 ? Math.sin(nowMs / 1900 + k * 0.8) * 0.12 * grow : 0;
    nodes.push({
      x: head.x + back.x * d + side.x * drift,
      y: head.y + back.y * d + side.y * drift,
      liftPx: 0,
      dirX: head.dirX,
      dirY: head.dirY,
      rank: k,
      submersion: ranks[k] ?? 0,
      bobPx: k <= 2 ? breath * 1.2 : 0,
    });
  }
  return nodes;
};

/**
 * Os corpos em CACADA, um rastro por Leviata vivo.
 *
 * `follow` so e chamado na segunda fase: fora dela o rastro e esquecido
 * (`forget`), entao ele nasce reto atras da cabeca no primeiro quadro de
 * cacada — que e a pose de quem acabou de emergir inteiro — e nunca carrega
 * um caminho de antes de um salto.
 */
export class LeviathanBodies {
  private readonly trail = new SpineTrail({
    segments: LEVIATHAN_BODY_RANKS,
    gap: LEVIATHAN_SEGMENT_GAP,
    headOffset: LEVIATHAN_HEAD_OFFSET,
    step: LEVIATHAN_TRAIL_STEP,
    sway: LEVIATHAN_SWAY,
    swayWaves: LEVIATHAN_SWAY_WAVES,
    swayHz: LEVIATHAN_SWAY_HZ,
    stiffness: LEVIATHAN_STIFFNESS,
    maxBend: LEVIATHAN_MAX_BEND,
    teleportTiles: LEVIATHAN_TELEPORT_TILES,
  });

  reset(): void {
    this.trail.reset();
  }

  keepOnly(live: ReadonlySet<number>): void {
    this.trail.keepOnly(live);
  }

  hasTrail(id: number): boolean {
    return this.trail.has(id);
  }

  /**
   * As pecas deste Leviata neste quadro, conforme a postura autoritativa.
   *
   * Ancorado, mergulhando e emergindo usam a pose autorada (sem rastro, e o
   * rastro que houvesse e esquecido). Cacando, o rastro. Escondido, nada.
   */
  nodes(enemy: Entity, tick: number, head: LeviathanBodyHead, nowMs: number): LeviathanBodyNode[] {
    const mode = leviathanBodyMode(leviathanPosture(enemy));
    if (mode === 'hidden') {
      this.trail.forget(enemy.id);
      return [];
    }
    const { ranks } = leviathanSubmersions(enemy, tick);
    if (mode !== 'hunting') {
      this.trail.forget(enemy.id);
      return anchoredBodyNodes(head, ranks, nowMs);
    }
    const followed = this.trail.follow(
      enemy.id,
      { x: head.x, y: head.y, liftPx: 0, dirX: head.dirX, dirY: head.dirY },
      nowMs,
    );
    // A ONDA DAS ASAS: propaga da frente para tras enquanto ele nada — a
    // fase e o posto, entao a raiz sobe antes da ponta.
    return followed.map((node) => ({
      ...node,
      submersion: 0,
      bobPx: node.rank <= 3 ? Math.sin(nowMs / 260 - node.rank * 0.9) * 2.2 : 0,
    }));
  }
}
