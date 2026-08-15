// A OPERACAO DE TREINAMENTO: o setor cirurgico da primeira descida.
//
// ---------------------------------------------------------------------------
// POR QUE ELA EXISTE
// ---------------------------------------------------------------------------
// A Inducao notifica; ela nao ensina (ver induction.ts, que declara isso de
// proposito). Um jogador real desceu, jogou tres runs e escreveu "eu nao sabia
// exatamente qual era o objetivo" — a circular tinha dito, e dizer nao bastou.
// O treinamento e o complemento que a circular se recusa a ser: um setor curto
// onde mover, atirar, esquivar, interagir, o Nucleo e a EXTRACAO acontecem uma
// vez, na ordem, com a instrucao na tela.
//
// ---------------------------------------------------------------------------
// COMO ELA E CONSTRUIDA
// ---------------------------------------------------------------------------
// Nao existe um segundo motor nem um formato de mapa novo — a mesma receita da
// arena de chefes (arena-setup.ts): `createRun` com uma seed fixa, e cirurgia
// no estado ANTES do primeiro tick. A profundidade `{ sectorCount: 1,
// coreSectors: [1] }` ja significa "recolha o Nucleo e extraia na entrada":
// setor 1 nunca tem chefe (bosses.ts), entao o pedestal nasce funcional, e a
// extracao com o Nucleo no setor 1 fecha em `extracted_with_core`. O HUD real
// ensina o macro-objetivo sozinho (findCore → extract), sem override.
//
// O percurso e CARIMBADO por cima do que a seed gerou: plataforma de entrada,
// galeria, camara com dois stalkers, corredor de pilares para a esquiva, e a
// camara do pedestal — uma linha, porque a ordem espacial E a ordem das
// licoes. Todo tile fora do percurso vira rocha lisa, pela mesma regra (e pelo
// mesmo motivo) do recorte da arena: minerio, cristal e duto fora do curso sao
// cenario chamando atencao para um lugar que o treinamento declarou inexistente.
import {
  CONTAMINATION_WAVES,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_NONE,
  createRun,
  spawnEnemy,
  type RunDepthConfig,
  type SurvivalState,
  type Vec2,
} from '@voxelyn/survival-sim';

/**
 * A seed do treinamento, fixa como as do catalogo da arena.
 *
 * Diferente de la, nenhuma busca offline foi necessaria: TODO setor 1 de toda
 * linhagem e basalto sem ocupacao (as intrusoes comecam no setor 2), entao a
 * seed so decide a geografia — e a geografia e sobrescrita pelo carimbo. O que
 * esta seed precisa entregar e apenas uma ENTRADA com folga perpendicular para
 * a camara de 9 tiles caber sem tocar a borda; o teste de setup e quem prova
 * que ela continua entregando.
 */
export const TRAINING_SEED = 0x54524e31;

/**
 * A profundidade do exercicio: um setor, Nucleo nele.
 *
 * E a MESMA gramatica de uma run real, so que minima — recolher e voltar a
 * plataforma fecha o contrato. G-00 de proposito: o treinamento ensina o chassi
 * de fabrica, que e o que o novato tem.
 */
export const TRAINING_DEPTH: RunDepthConfig = {
  generation: 'G-00',
  sectorCount: 1,
  coreSectors: [1],
};

/** O percurso carimbado, devolvido para o spawn, o diretor e os testes. */
export type TrainingCourse = {
  /** Todo tile aberto do percurso, como indice `y * width + x`. */
  cells: Set<number>;
  /** Onde o pedestal foi realocado (`state.corePos`). */
  coreCell: Vec2;
  /** Onde os dois stalkers da camara de tiro nascem. */
  stalkerCells: readonly Vec2[];
  /**
   * Alguma celula do percurso caiu fora da margem do mapa?
   *
   * Em producao o carimbo grampeia em silencio (um treinamento torto e melhor
   * que um crash), mas o teste afirma FALSE: a seed foi escolhida para o
   * percurso caber inteiro, e um worldgen futuro que mova a entrada para a
   * borda deve falhar no vitest, nao na primeira descida de alguem.
   */
  truncated: boolean;
};

// A geometria do percurso, em passos AO LONGO do eixo (t) e perpendicular (o).
// Uma linha so: plataforma (disco r=3 na entrada, grampeado na parede — a
// entrada do worldgen SEMPRE nasce encostada na borda) → vestibulo que alinha a
// entrada ao eixo do percurso → galeria 3 de largura → camara 9x9 → corredor de
// pilares → camara do pedestal 7x7. O total (~32 tiles) passa com folga dos 4
// tiles que armam `leftEntryZone`, entao a primeira licao (mover) termina ainda
// na galeria.
const VESTIBULE = { from: 1, to: 3 };
const CORRIDOR_A = { from: 3, to: 10 };
const CHAMBER_A = { from: 11, to: 19, halfWidth: 4 };
const CORRIDOR_B = { from: 20, to: 26 };
/** Pilares do corredor de esquiva: rocha deixada DENTRO do percurso. */
const PILLARS: readonly { t: number; o: number }[] = [
  { t: 22, o: 0 },
  { t: 25, o: 0 },
];
const PEDESTAL = { from: 27, to: 33, halfWidth: 3 };
const CORE_T = 30;
/** Os stalkers, ao fundo da camara de tiro: ~16 tiles da entrada, aggro 9. */
const STALKERS: readonly { t: number; o: number }[] = [
  { t: 15, o: -2 },
  { t: 17, o: 2 },
];

/**
 * Carimba o percurso e fecha o resto do mapa.
 *
 * O fechamento copia a filosofia de `carveArena` por inteiro: TODO tile fora do
 * conjunto esculpido vira `SOLID_ROCK` com a superficie limpa — nao so os vaos.
 * Fechar apenas o chao herdaria cristal e minerio intactos no macico, e cristal
 * emite luz no cliente.
 */
export const carveTrainingCourse = (state: SurvivalState): TrainingCourse => {
  const w = state.config.width;
  const h = state.config.height;
  const entry = state.entry;

  // O eixo com mais folga ate o centro, para o percurso de ~33 tiles caber
  // sempre: de qualquer entrada, ha pelo menos meio mapa nessa direcao.
  const roomX = entry.x < w / 2 ? w - entry.x : entry.x;
  const roomY = entry.y < h / 2 ? h - entry.y : entry.y;
  const horizontal = roomX >= roomY;
  const dir: Vec2 = horizontal
    ? { x: entry.x < w / 2 ? 1 : -1, y: 0 }
    : { x: 0, y: entry.y < h / 2 ? 1 : -1 };
  const perp: Vec2 = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };

  // A LINHA do percurso nao passa pela entrada: ela e empurrada para o
  // interior ate a camara mais larga (meia-largura 4, mais um tile de folga da
  // margem de 2) caber inteira. A entrada do worldgen nasce encostada na
  // borda, e sem este desvio o disco e as camaras grampeariam sempre.
  const perpSize = horizontal ? h : w;
  const entryPerp = horizontal ? entry.y : entry.x;
  const lane = Math.max(7, Math.min(perpSize - 8, entryPerp));
  /** Offset da entrada em relacao a linha do percurso. */
  const eo = entryPerp - lane;

  const at = (t: number, o: number): Vec2 => ({
    x: entry.x + dir.x * t + perp.x * (o + lane - entryPerp),
    y: entry.y + dir.y * t + perp.y * (o + lane - entryPerp),
  });

  const cells = new Set<number>();
  let truncated = false;
  const open = (p: Vec2, clip = false): void => {
    // Margem de 2, a mesma que o worldgen reserva de borda solida.
    if (p.x < 2 || p.y < 2 || p.x >= w - 2 || p.y >= h - 2) {
      // A plataforma tem licenca para abraçar a parede (a entrada mora la);
      // o resto do percurso grampeado e um erro que o teste denuncia.
      if (!clip) truncated = true;
      return;
    }
    cells.add(p.y * w + p.x);
  };

  // Plataforma de entrada: disco euclidiano r=3, o "porto seguro" do inicio.
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy <= 9) open({ x: entry.x + dx, y: entry.y + dy }, true);
    }
  }
  // Vestibulo: o trecho que leva da plataforma (encostada na borda) ate a
  // linha do percurso, largo o bastante para cobrir as duas.
  for (let t = VESTIBULE.from; t <= VESTIBULE.to; t++) {
    for (let o = Math.min(eo, 0) - 1; o <= Math.max(eo, 0) + 1; o++) open(at(t, o));
  }
  // Galeria de entrada (licao 1: mover).
  for (let t = CORRIDOR_A.from; t <= CORRIDOR_A.to; t++) {
    for (let o = -1; o <= 1; o++) open(at(t, o));
  }
  // Camara de tiro (licao 2: atirar).
  for (let t = CHAMBER_A.from; t <= CHAMBER_A.to; t++) {
    for (let o = -CHAMBER_A.halfWidth; o <= CHAMBER_A.halfWidth; o++) open(at(t, o));
  }
  // Corredor de pilares (licao 3: esquivar). Os pilares NAO entram no
  // conjunto: o fechamento os devolve a rocha, e e isso que os ergue.
  for (let t = CORRIDOR_B.from; t <= CORRIDOR_B.to; t++) {
    for (let o = -1; o <= 1; o++) {
      if (PILLARS.some((p) => p.t === t && p.o === o)) continue;
      open(at(t, o));
    }
  }
  // Camara do pedestal (licoes 4 e 5: o Nucleo, e o caminho de volta).
  for (let t = PEDESTAL.from; t <= PEDESTAL.to; t++) {
    for (let o = -PEDESTAL.halfWidth; o <= PEDESTAL.halfWidth; o++) open(at(t, o));
  }

  // Aplica o carimbo: dentro do percurso, chao limpo; fora, rocha lisa.
  for (let i = 0; i < state.solid.length; i++) {
    state.solid[i] = cells.has(i) ? SOLID_NONE : SOLID_ROCK;
    state.surface[i] = SURF_NONE;
    state.surfaceTimer[i] = 0;
  }
  for (let c = 0; c < state.chunkVersion.length; c++) state.chunkVersion[c]++;

  return {
    cells,
    coreCell: at(CORE_T, 0),
    stalkerCells: STALKERS.map((s) => at(s.t, s.o)),
    truncated,
  };
};

/**
 * Constroi o estado do treinamento, pronto para o primeiro tick.
 *
 * Mesmo ponto de intervencao da arena: DEPOIS de `createRun`, ANTES de
 * qualquer `stepRun`. A partir daqui a simulacao roda intocada — o que o
 * jogador aprende e o jogo de verdade, nao uma aproximacao dele.
 */
export const createTrainingRun = (): SurvivalState => {
  const state = createRun({ seed: TRAINING_SEED, sector: 1, depth: TRAINING_DEPTH });
  const course = carveTrainingCourse(state);

  // O pedestal muda de endereco junto com o percurso. `corePos` e o ponto
  // objetivo polimorfico do setor — o interact, o prop e o farol do HUD leem
  // todos daqui, entao realocar o campo realoca a licao inteira.
  state.corePos = course.coreCell;

  // Fauna do worldgen fora; o elenco do exercicio e escolhido a dedo. Dois
  // stalkers no fundo da camara de tiro: longe o bastante da entrada (aggro 9,
  // eles a ~16 tiles) para quem parou para ler nao ser atacado no meio da
  // primeira instrucao.
  state.enemies = [];
  for (const cell of course.stalkerCells) {
    spawnEnemy(state, 'stalker', cell.x, cell.y, false);
  }

  // Nada que nao esteja no curriculo: sem salvage, sem ofertas de poco, sem
  // respiradouro, trilho ou leyline. A circular cobre o resto.
  state.salvageSites = [];
  state.wellOffers = [];
  state.vents = [];
  state.railTracks = [];
  state.leylineSegments = [];
  state.leylineNodes = [];
  // As ondas de contaminacao nascem gastas, como na arena: um exercicio lento
  // nao pode terminar com stalkers brotando no meio da licao de esquiva.
  state.contaminationWaves = CONTAMINATION_WAVES.length;

  return state;
};

// ---------------------------------------------------------------------------
// "Ja treinei?"
// ---------------------------------------------------------------------------
// O mesmo contrato do `inductionSeen`: storage bloqueado responde NAO, porque
// oferecer o treinamento de novo e o erro barato.

const DONE_KEY = 'voxelyn.training.done';

export const trainingDone = (): boolean => {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
};

export const markTrainingDone = (): void => {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    /* sem storage: o treinamento continua sendo oferecido, e tudo bem */
  }
};
