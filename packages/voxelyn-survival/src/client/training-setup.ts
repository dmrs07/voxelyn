// A OPERACAO DE TREINAMENTO: os dois setores cirurgicos da primeira descida.
//
// ---------------------------------------------------------------------------
// POR QUE ELA EXISTE
// ---------------------------------------------------------------------------
// A Inducao notifica; ela nao ensina (ver induction.ts, que declara isso de
// proposito). Um jogador real desceu, jogou tres runs e escreveu "eu nao sabia
// exatamente qual era o objetivo" — a circular tinha dito, e dizer nao bastou.
// O treinamento e o complemento que a circular se recusa a ser.
//
// ---------------------------------------------------------------------------
// POR QUE DOIS SETORES
// ---------------------------------------------------------------------------
// A versao anterior tinha UM setor com o Nucleo dentro, e ensinava cinco
// verbos: mover, atirar, esquivar, interagir, extrair. O que ela nao conseguia
// ensinar era tudo o que so EXISTE quando ha um andar abaixo:
//
//   · o POCO, e o Eco que ele oferece (um setor de Nucleo nunca tem oferta —
//     ver `revealWellOffers`: `hasCoreHere` cala o poco);
//   · a DESCIDA, e a SUBIDA de volta com o Nucleo na mao, que e o contrato
//     real do jogo ("descer e opcional; voltar e o que paga");
//   · o fato de que o setor de cima continua existindo, e que a extracao so
//     acontece na plataforma do setor 1.
//
// Com `sectorCount: 2, coreSectors: [2]` a gramatica inteira cabe:
//
//   SETOR 1 (descida)  entrada → galeria → veio → camara de tiro → pilares →
//                      terminal de escaneamento → cofre → poco (Eco) → desce
//   SETOR 2 (fundo)    entrada → camara → rocha fragil → pedestal → volta a
//                      entrada → sobe
//   SETOR 1 (subida)   emerge no poco → volta a plataforma → EXTRAI
//
// ---------------------------------------------------------------------------
// COMO ELA E CONSTRUIDA
// ---------------------------------------------------------------------------
// Nao existe um segundo motor nem um formato de mapa novo — a mesma receita da
// arena de chefes (arena-setup.ts): `createRun` com uma seed fixa, e cirurgia
// no estado ANTES do primeiro tick. O percurso e CARIMBADO por cima do que a
// seed gerou, e todo tile fora dele vira rocha lisa, pela mesma regra (e pelo
// mesmo motivo) do recorte da arena: minerio, cristal e duto fora do curso sao
// cenario chamando atencao para um lugar que o treinamento declarou inexistente.
//
// A diferenca desta versao e QUANDO o carimbo acontece. `descend` e `ascend`
// REGERAM o mundo do worldgen — o carimbo do setor 1 nao sobrevive a descida, e
// o do setor 2 nao sobrevive a subida. Por isso o carimbo virou uma operacao
// nomeada (`stampTrainingSector`) que o laco do treinamento reaplica a cada
// troca de setor, no mesmo ponto de intervencao de sempre: depois da transicao,
// antes do proximo tick.
import {
  CONTAMINATION_WAVES,
  SOLID_FRAGILE,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ROCK,
  SURF_NONE,
  createRun,
  markCoreTaken,
  spawnEnemy,
  type EnemyArchetype,
  type RunDepthConfig,
  type SurvivalState,
  type Vec2,
} from '@voxelyn/survival-sim';
import type { TrainingCheckpoint } from './training-director';

/**
 * A seed do treinamento, fixa como as do catalogo da arena.
 *
 * Diferente de la, nenhuma busca offline foi necessaria: o que esta seed
 * precisa entregar e apenas uma ENTRADA, em cada um dos dois setores, com
 * folga perpendicular para as camaras caberem sem tocar a borda. A geografia
 * que a seed inventa e inteiramente sobrescrita pelo carimbo; o teste de setup
 * e quem prova que as duas entradas continuam servindo.
 */
export const TRAINING_SEED = 0x54524e31;

/**
 * A profundidade do exercicio: dois setores, o Nucleo no fundo.
 *
 * E a MESMA gramatica de uma run real, so que minima. `coreSectors: [2]` e o
 * que da ao setor 1 um POCO de verdade (um setor com pedestal nunca oferece
 * Eco) e ao setor 2 o pedestal — e e o que obriga a subida de volta, porque
 * com o Nucleo na mao a entrada de um setor profundo nao extrai: ela sobe.
 *
 * G-00 de proposito: o treinamento ensina o chassi de fabrica, que e o que o
 * novato tem.
 */
export const TRAINING_DEPTH: RunDepthConfig = {
  generation: 'G-00',
  sectorCount: 2,
  coreSectors: [2],
};

/** Os setores que o exercicio conhece. */
export type TrainingSector = 1 | 2;

/** Uma celula do plano, em passos ao longo do eixo (t) e perpendicular (o). */
type Step = { t: number; o: number };

/**
 * Um trecho ABERTO do percurso.
 *
 * `disc` e a plataforma da entrada e tem licenca para abracar a parede (a
 * entrada do worldgen sempre nasce encostada na borda); `hall` e um trecho ao
 * longo do eixo; `spur` e um ramal PERPENDICULAR, que existe por um motivo
 * pedagogico exato — o cofre do salvage precisa ficar fora da linha de visao
 * do terminal, senao o localizador de rumo nao tem o que localizar.
 */
type Reach =
  | { kind: 'disc'; radius: number }
  | { kind: 'hall'; from: number; to: number; half: number }
  | { kind: 'spur'; t: number; from: number; to: number; half: number };

/** O curriculo de um setor, como geometria. */
type SectorPlan = {
  reaches: readonly Reach[];
  /** Rocha lisa deixada DENTRO do percurso: os pilares da esquiva. */
  pillars: readonly Step[];
  /** Veio de minerio: solido, mas rende carga a cada lasca de tiro cinetico. */
  ore: readonly Step[];
  /** Rocha fragil: solida ate o primeiro tiro, e depois passagem. */
  fragile: readonly Step[];
  /** `state.corePos`: o poco no setor 1, o pedestal no setor 2. */
  objective: Step;
  /** O terminal de escaneamento, quando o setor tem um. */
  terminal?: Step;
  /** O cofre que o escaneamento revela. Sempre no fim de um ramal. */
  cache?: Step;
  /** O elenco, escolhido a dedo. O worldgen nao povoa nada aqui. */
  fauna: readonly { at: Step; archetype: EnemyArchetype }[];
};

// ---------------------------------------------------------------------------
// SETOR 1 · A GALERIA DE INSTRUCAO
// ---------------------------------------------------------------------------
// Uma linha so, porque a ordem espacial E a ordem das licoes. O total (~44
// tiles ao longo do eixo) passa com folga dos 4 tiles que armam
// `leftEntryZone`, entao a primeira licao (mover) termina ainda na galeria.
//
//   0        plataforma de entrada (o porto seguro)
//   1– 3     vestibulo: alinha a entrada, que nasce na borda, ao eixo
//   4–13     galeria .............................. LICAO 1 · mover
//   6– 8     alargamento com veio nas paredes ..... LICAO 2 · minerar
//  14–22     camara de tiro, dois espreitadores ... LICAO 3 · atirar (e o calor)
//  23–29     corredor de pilares .................. LICAO 4 · esquivar
//  30–38     baia de salvage, terminal em t=33 .... LICAO 5 · o terminal
//            e o alarme que ele dispara ........... LICAO 6 · segurar o setor
//  ramal em t=36, o=5..9, cofre em o=9 ............ LICAO 7 · o localizador
//                                                   LICAO 8 · o modulo
//  39–44     pescoco: separa a baia do poco, para os Ecos so aparecerem
//            depois de o cofre ter sido aberto
//  45–51     camara do poco, poco em t=48 ......... LICAO 9 · o Eco
//                                                   LICAO 10 · descer
const SECTOR_1: SectorPlan = {
  reaches: [
    { kind: 'disc', radius: 3 },
    { kind: 'hall', from: 4, to: 13, half: 1 },
    { kind: 'hall', from: 6, to: 8, half: 2 },
    { kind: 'hall', from: 14, to: 22, half: 4 },
    { kind: 'hall', from: 23, to: 29, half: 1 },
    { kind: 'hall', from: 30, to: 38, half: 4 },
    { kind: 'spur', t: 36, from: 5, to: 9, half: 1 },
    { kind: 'hall', from: 39, to: 44, half: 1 },
    { kind: 'hall', from: 45, to: 51, half: 3 },
  ],
  // Rocha deixada dentro do corredor: os pilares NAO entram no conjunto
  // aberto, e e o fechamento que os ergue.
  pillars: [
    { t: 25, o: 0 },
    { t: 28, o: 0 },
  ],
  // O veio fica na PAREDE do alargamento, ao alcance de quem passa: minerar e
  // um desvio de dois segundos, nao uma escavacao.
  //
  // E ele fica LOGO NO COMECO, e nao a meio caminho da camara de tiro: parar
  // para minerar e parar de andar, e a primeira versao punia isso — o veio
  // ficava a sete tiles dos espreitadores, dentro do aggro deles, e quem
  // obedecia a instrucao levava uma mordida por obedecer.
  ore: [
    { t: 6, o: -3 },
    { t: 7, o: -3 },
    { t: 8, o: -3 },
    { t: 6, o: 3 },
    { t: 7, o: 3 },
    { t: 8, o: 3 },
  ],
  fragile: [],
  objective: { t: 48, o: 0 },
  terminal: { t: 33, o: 0 },
  // O cofre no fim do ramal: nove tiles perpendiculares, atras da parede da
  // baia. Do terminal nao se ve; o anel de rumo e o unico caminho ate ele.
  cache: { t: 36, o: 9 },
  // Ao FUNDO da camara de tiro: onze tiles do veio e vinte da entrada. Com
  // aggro 9, nem quem para para ler nem quem para para minerar e atacado no
  // meio da instrucao — a licao de atirar comeca quando o jogador escolhe
  // entrar na camara.
  fauna: [
    { at: { t: 19, o: -2 }, archetype: 'stalker' },
    { at: { t: 21, o: 2 }, archetype: 'stalker' },
  ],
};

// ---------------------------------------------------------------------------
// SETOR 2 · A CAMARA DO NUCLEO
// ---------------------------------------------------------------------------
// Mais curto de proposito: o que este setor ensina nao e percurso, e o CICLO —
// pegar o Nucleo e refazer o caminho ao contrario. Um segundo labirinto so
// adiaria a licao que importa.
//
//   0        plataforma de chegada do poco
//   1– 3     vestibulo
//   4–10     galeria
//  11–19     camara, tres corpos ................... LICAO 11 · o Eco novo
//     20     tampao de rocha fragil ................ LICAO 12 · nem toda parede
//  21–27     camara do pedestal, Nucleo em t=24 .... LICAO 13 · o Nucleo
//                                                    LICAO 14 · subir
const SECTOR_2: SectorPlan = {
  reaches: [
    { kind: 'disc', radius: 3 },
    { kind: 'hall', from: 4, to: 10, half: 1 },
    { kind: 'hall', from: 11, to: 19, half: 4 },
    { kind: 'hall', from: 21, to: 27, half: 3 },
  ],
  pillars: [],
  ore: [],
  // O tampao FECHA o corredor: o pedestal so existe do outro lado dele. E a
  // unica licao do exercicio que nao tem como ser pulada, e por isso e a unica
  // que pode se dar ao luxo de ser uma parede.
  fragile: [
    { t: 20, o: -1 },
    { t: 20, o: 0 },
    { t: 20, o: 1 },
  ],
  objective: { t: 24, o: 0 },
  fauna: [
    { at: { t: 15, o: -3 }, archetype: 'stalker' },
    { at: { t: 17, o: 3 }, archetype: 'stalker' },
    { at: { t: 18, o: 0 }, archetype: 'spitter' },
  ],
};

const PLANS: Record<TrainingSector, SectorPlan> = { 1: SECTOR_1, 2: SECTOR_2 };

const planOf = (sector: number): SectorPlan => PLANS[sector === 2 ? 2 : 1];

/** O percurso carimbado, devolvido para o spawn, o diretor e os testes. */
export type TrainingCourse = {
  /** Todo tile aberto do percurso, como indice `y * width + x`. */
  cells: Set<number>;
  /** Onde o ponto especial do setor foi realocado (`state.corePos`). */
  objectiveCell: Vec2;
  /** O terminal de escaneamento, quando o setor tem um. */
  terminalCell: Vec2 | null;
  /** O cofre que o escaneamento revela, quando o setor tem um. */
  cacheCell: Vec2 | null;
  /** As celulas de rocha fragil, para o teste provar que ha caminho por elas. */
  fragileCells: Vec2[];
  /** Onde o elenco nasce. */
  faunaCells: readonly { at: Vec2; archetype: EnemyArchetype }[];
  /**
   * Alguma celula do percurso caiu fora da margem do mapa?
   *
   * Em producao o carimbo grampeia em silencio (um treinamento torto e melhor
   * que um crash), mas o teste afirma FALSE: as seeds foram escolhidas para os
   * percursos caberem inteiros, e um worldgen futuro que mova uma entrada para
   * a borda deve falhar no vitest, nao na primeira descida de alguem.
   */
  truncated: boolean;
};

/**
 * Carimba o percurso do setor corrente e fecha o resto do mapa.
 *
 * O fechamento copia a filosofia de `carveArena` por inteiro: TODO tile fora
 * do conjunto esculpido vira `SOLID_ROCK` com a superficie limpa — nao so os
 * vaos. Fechar apenas o chao herdaria cristal e minerio intactos no macico, e
 * cristal emite luz no cliente. O veio e a rocha fragil deste plano sao a
 * excecao NOMEADA: eles sao pintados de volta depois do fechamento, porque sao
 * curriculo e nao heranca.
 */
export const carveTrainingCourse = (state: SurvivalState): TrainingCourse => {
  const plan = planOf(state.sector);
  const w = state.config.width;
  const h = state.config.height;
  const entry = state.entry;

  // O eixo com mais folga ate a borda oposta, para o percurso caber sempre: de
  // qualquer entrada, ha pelo menos meio mapa nessa direcao.
  const roomX = entry.x < w / 2 ? w - entry.x : entry.x;
  const roomY = entry.y < h / 2 ? h - entry.y : entry.y;
  const horizontal = roomX >= roomY;
  const dir: Vec2 = horizontal
    ? { x: entry.x < w / 2 ? 1 : -1, y: 0 }
    : { x: 0, y: entry.y < h / 2 ? 1 : -1 };
  const perp: Vec2 = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };

  // A LINHA do percurso nao passa pela entrada: ela e empurrada para o
  // interior ate o trecho mais LARGO do plano caber inteiro dos dois lados. A
  // entrada do worldgen nasce encostada na borda, e sem este desvio a camara e
  // o ramal do cofre grampeariam sempre.
  //
  // A folga sai do proprio plano (e nao de um numero escrito a mao) para que
  // alargar uma camara amanha nao exija lembrar de mexer aqui.
  let spanLow = 0;
  let spanHigh = 0;
  for (const reach of plan.reaches) {
    if (reach.kind === 'disc') {
      spanLow = Math.min(spanLow, -reach.radius);
      spanHigh = Math.max(spanHigh, reach.radius);
    } else if (reach.kind === 'hall') {
      spanLow = Math.min(spanLow, -reach.half);
      spanHigh = Math.max(spanHigh, reach.half);
    } else {
      spanLow = Math.min(spanLow, Math.min(reach.from, reach.to) - reach.half);
      spanHigh = Math.max(spanHigh, Math.max(reach.from, reach.to) + reach.half);
    }
  }
  const perpSize = horizontal ? h : w;
  const entryPerp = horizontal ? entry.y : entry.x;
  // Margem de 2 (a mesma que o worldgen reserva de borda solida) mais um tile
  // de folga em cada ponta.
  const lane = Math.max(3 - spanLow, Math.min(perpSize - 4 - spanHigh, entryPerp));
  /** Offset da entrada em relacao a linha do percurso. */
  const eo = entryPerp - lane;

  const at = (t: number, o: number): Vec2 => ({
    x: entry.x + dir.x * t + perp.x * (o + lane - entryPerp),
    y: entry.y + dir.y * t + perp.y * (o + lane - entryPerp),
  });

  const cells = new Set<number>();
  let truncated = false;
  const inBounds = (p: Vec2): boolean => p.x >= 2 && p.y >= 2 && p.x < w - 2 && p.y < h - 2;
  const open = (p: Vec2, clip = false): void => {
    if (!inBounds(p)) {
      // A plataforma tem licenca para abracar a parede (a entrada mora la); o
      // resto do percurso grampeado e um erro que o teste denuncia.
      if (!clip) truncated = true;
      return;
    }
    cells.add(p.y * w + p.x);
  };

  const blocked = (t: number, o: number): boolean =>
    plan.pillars.some((p) => p.t === t && p.o === o) ||
    plan.fragile.some((p) => p.t === t && p.o === o);

  for (const reach of plan.reaches) {
    if (reach.kind === 'disc') {
      // Disco euclidiano na entrada: o "porto seguro" do inicio, e o unico
      // trecho ancorado na celula da entrada em vez da linha do percurso.
      const r = reach.radius;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) open({ x: entry.x + dx, y: entry.y + dy }, true);
        }
      }
      // Vestibulo: o trecho que leva da plataforma (encostada na borda) ate a
      // linha do percurso, largo o bastante para cobrir as duas.
      for (let t = 1; t <= 3; t++) {
        for (let o = Math.min(eo, 0) - 1; o <= Math.max(eo, 0) + 1; o++) open(at(t, o));
      }
      continue;
    }
    if (reach.kind === 'hall') {
      for (let t = reach.from; t <= reach.to; t++) {
        for (let o = -reach.half; o <= reach.half; o++) {
          if (blocked(t, o)) continue;
          open(at(t, o));
        }
      }
      continue;
    }
    for (let o = reach.from; o <= reach.to; o++) {
      for (let t = reach.t - reach.half; t <= reach.t + reach.half; t++) {
        if (blocked(t, o)) continue;
        open(at(t, o));
      }
    }
  }

  // Aplica o carimbo: dentro do percurso, chao limpo; fora, rocha lisa.
  for (let i = 0; i < state.solid.length; i++) {
    state.solid[i] = cells.has(i) ? SOLID_NONE : SOLID_ROCK;
    state.surface[i] = SURF_NONE;
    state.surfaceTimer[i] = 0;
  }
  // E entao as duas excecoes do curriculo, pintadas POR CIMA do macico: o veio
  // que rende carga e o tampao que cede ao tiro.
  const fragileCells: Vec2[] = [];
  for (const step of plan.ore) {
    const p = at(step.t, step.o);
    if (!inBounds(p)) {
      truncated = true;
      continue;
    }
    state.solid[p.y * w + p.x] = SOLID_ORE;
  }
  for (const step of plan.fragile) {
    const p = at(step.t, step.o);
    if (!inBounds(p)) {
      truncated = true;
      continue;
    }
    state.solid[p.y * w + p.x] = SOLID_FRAGILE;
    fragileCells.push(p);
  }
  for (let c = 0; c < state.chunkVersion.length; c++) state.chunkVersion[c]++;

  return {
    cells,
    objectiveCell: at(plan.objective.t, plan.objective.o),
    terminalCell: plan.terminal ? at(plan.terminal.t, plan.terminal.o) : null,
    cacheCell: plan.cache ? at(plan.cache.t, plan.cache.o) : null,
    fragileCells,
    faunaCells: plan.fauna.map((f) => ({ at: at(f.at.t, f.at.o), archetype: f.archetype })),
    truncated,
  };
};

/**
 * Carimba o setor CORRENTE por inteiro: geografia, elenco e mobiliario.
 *
 * Este e o unico ponto de intervencao do treinamento, e ele existe tres vezes
 * na vida de um exercicio: na construcao, depois de `descend` e depois de
 * `ascend`. As tres chamadas acontecem no MESMO lugar da linha do tempo —
 * depois de o mundo ser gerado, antes do proximo `stepRun` — e e isso que faz
 * a simulacao rodar intocada entre elas: o que o jogador aprende e o jogo de
 * verdade, nao uma aproximacao dele.
 */
export const stampTrainingSector = (state: SurvivalState): TrainingCourse => {
  const course = carveTrainingCourse(state);

  // O ponto especial muda de endereco junto com o percurso. `corePos` e o ponto
  // objetivo polimorfico do setor — o interact, o prop e o farol do HUD leem
  // todos daqui, entao realocar o campo realoca a licao inteira.
  state.corePos = course.objectiveCell;

  // Nenhum setor do exercicio tem dono. `sectorHoldsBoss` daria um chefe ao
  // setor 2 (ele e o mais fundo da run), e um chefe selaria o pedestal — a
  // ultima licao viraria uma luta que o exercicio nunca prometeu. Zerar o
  // campo e o suficiente: `descentUnlocked`/`coreUnlocked` leem daqui.
  state.sectorBoss = { archetype: null, entityId: null, defeated: true };

  // Fauna do worldgen fora; o elenco do exercicio e escolhido a dedo.
  state.enemies = [];
  for (const { at, archetype } of course.faunaCells) {
    spawnEnemy(state, archetype, at.x, at.y, false);
  }

  // O mobiliario: um unico sitio de salvage, exatamente onde a licao pediu.
  // Tier 1 porque o alarme dele (2 + tier corpos) e a pressao que o exercicio
  // quer — companhia, nao cerco.
  state.salvageSites =
    course.terminalCell && course.cacheCell
      ? [
          {
            id: 1,
            tier: 1,
            terminal: course.terminalCell,
            cache: course.cacheCell,
            terminalState: 'inactive',
            scanEndsAt: 0,
            cacheRevealed: false,
            cacheOpened: false,
            openedBySlot: null,
          },
        ]
      : [];

  // Nada que nao esteja no curriculo: sem ofertas herdadas, sem respiradouro,
  // trilho ou leyline. A circular cobre o resto.
  state.wellOffers = [];
  state.vents = [];
  state.railTracks = [];
  state.leylineSegments = [];
  state.leylineNodes = [];
  // As ondas de contaminacao nascem gastas, como na arena: um exercicio lento
  // nao pode terminar com stalkers brotando no meio da licao de esquiva.
  state.contaminationWaves = CONTAMINATION_WAVES.length;

  return course;
};

/**
 * Recoloca os jogadores no ponto especial CARIMBADO do setor.
 *
 * `ascend` emerge todo mundo em `world.corePos` — o poco que o WORLDGEN
 * inventou, nao o que o carimbo desenhou. Sem esta correcao o Prospector
 * reapareceria dentro do macico que o carimbo acabou de fechar.
 */
export const placeAtTrainingObjective = (state: SurvivalState, course: TrainingCourse): void => {
  for (const player of state.players) {
    player.x = course.objectiveCell.x + 0.5;
    player.y = course.objectiveCell.y + 0.5;
    player.vx = 0;
    player.vy = 0;
  }
};

/** O comeco de tudo: setor 1, plataforma, chassi de fabrica, maos vazias. */
export const TRAINING_START: TrainingCheckpoint = { sector: 1, withCore: false };

/**
 * Constroi o estado do treinamento no checkpoint pedido, pronto para o
 * primeiro tick.
 *
 * O parametro existe por causa do reinicio a prova de falha: perder a unidade
 * no exercicio nao devolve o jogador a plataforma do setor 1 — ele recomeca o
 * TRECHO em que estava, e um trecho de volta recomeca de volta. Ver
 * `TrainingDirector.rewind`.
 */
export const createTrainingRun = (
  checkpoint: TrainingCheckpoint = TRAINING_START,
): SurvivalState => {
  const state = createRun({
    seed: TRAINING_SEED,
    sector: checkpoint.sector,
    depth: TRAINING_DEPTH,
  });
  const course = stampTrainingSector(state);
  if (!checkpoint.withCore) return state;

  // O caminho de VOLTA, reconstruido: o Nucleo ja saiu do pedestal e esta no
  // chassi, e o Prospector reaparece no ponto especial do setor — o pedestal
  // no setor 2, a boca do poco no setor 1 —, que e exatamente onde `descend` e
  // `ascend` o teriam deixado. `leftEntryZone` nasce armado pela mesma razao
  // que `ascend` o arma: a saida esta longe, e ela precisa aceitar interacao
  // assim que o jogador chegar la.
  markCoreTaken(state, 2);
  state.playerExtra.hasCore = true;
  state.leftEntryZone = true;
  placeAtTrainingObjective(state, course);
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
