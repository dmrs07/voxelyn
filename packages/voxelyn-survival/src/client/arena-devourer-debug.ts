// CENARIOS DE ARENA DO DEVORADOR BRANCO — e, no centro deles, o RUMO DO SALTO.
//
// O corpo dele passou a ter oito rumos (ver `devourerFrame` no gerador). Quatro
// ja existiam e quatro sao novos, e a diferenca entre os dois grupos nao e
// estetica: no espaco do mundo, `dr`/`dl`/`ur`/`ul` sao os EIXOS (+x, +y, -y,
// -x) e `r`/`d`/`l`/`u` sao as DIAGONAIS (x e y juntos). Ver `FACING_BY_DIR`.
//
// Entao a pergunta que este painel existe para responder e uma so: o Devorador
// salta em rumos NAO ORTOGONAIS? Se o arco dele so nascesse alinhado aos eixos,
// os quatro quadros novos nunca apareceriam em jogo e a metade nova do atlas
// seria peso morto no orcamento de boot.
//
// Como os cenarios respondem isso: eles NAO escrevem o arco. Eles colocam o
// Prospector num rumo escolhido em volta do chefe, limpam o vidro (que e o que
// recusa a emergencia) e mandam o chefe decidir agora. Quem escolhe a queda
// continua sendo a simulacao, pelo caminho de verdade — `devourerSurfacingSpot`
// mira onde o jogador VAI estar, `devourerLaunchSpot` recua a decolagem pela
// mesma reta. O que a leitura mostra e o rumo que saiu daquilo, e nao o que se
// pediu. Um cenario que forcasse `leapToX/leapToY` provaria apenas que a
// atribuicao funciona.
import {
  BOSS_PHASE_HUNGER,
  DEVOURER_BURROWED,
  DEVOURER_HUNGER_HP_FRACTION,
  DEVOURER_LEAPS_PER_CYCLE,
  DEVOURER_MAW,
  DEVOURER_MAW_TICKS,
  SOLID_NONE,
  SURF_GLASS,
  SURF_SILT,
  type Entity,
  type SemanticEvent,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { FACING_BY_DIR, arenaCenter } from './arena-diamandis-debug';

export type DevourerScenario =
  // Os quatro rumos que o atlas ja tinha: os EIXOS do mundo.
  | 'hopDR'
  | 'hopDL'
  | 'hopUR'
  | 'hopUL'
  // Os quatro NOVOS: as diagonais do mundo, e a razao deste painel.
  | 'hopR'
  | 'hopD'
  | 'hopL'
  | 'hopU'
  // Estados que valem olhar de perto com o atlas novo.
  | 'maw'
  | 'burrow'
  // A FOME: a vida cai abaixo da metade e a simulacao vira a fase sozinha
  // no tick seguinte — o cenario nao escreve o bit, pelo mesmo principio dos
  // saltos: o que se quer ver e a virada acontecendo pelo caminho de verdade.
  | 'hunger'
  | 'reset';

export const DEVOURER_SCENARIOS: readonly DevourerScenario[] = [
  'hopDR',
  'hopDL',
  'hopUR',
  'hopUL',
  'hopR',
  'hopD',
  'hopL',
  'hopU',
  'maw',
  'burrow',
  'hunger',
  'reset',
];

/** O rumo do mundo que cada cenario de salto pede. */
const HOP_DIR: Partial<Record<DevourerScenario, string>> = {
  hopDR: 'dr',
  hopDL: 'dl',
  hopUR: 'ur',
  hopUL: 'ul',
  hopR: 'r',
  hopD: 'd',
  hopL: 'l',
  hopU: 'u',
};

/**
 * Um rumo do mundo e ORTOGONAL quando anda num eixo so.
 *
 * E a divisa exata entre os quatro quadros antigos do atlas e os quatro novos,
 * e por isso ela vira leitura no painel em vez de ficar na cabeca de quem olha.
 */
export const isOrthogonal = (dx: number, dy: number): boolean =>
  Math.abs(dx) < 1e-6 || Math.abs(dy) < 1e-6;

export const devourerOf = (state: SurvivalState): Entity | null =>
  state.enemies.find((e) => e.alive && e.archetype === 'white_devourer') ?? null;

/** Quantos tiles em volta o cenario devolve a areia solta. */
const SAND_RADIUS = 26;

/**
 * Devolve a AREIA em volta do ponto.
 *
 * O vidro e o contra-jogo do encontro: sobre ele o chefe nao emerge nem decola.
 * Num cenario de inspecao isso vira "o salto simplesmente nao acontece", que
 * nao e o que se quer ver aqui — entao a areia volta antes de cada pedido.
 */
const restoreSand = (state: SurvivalState, cx: number, cy: number): void => {
  const w = state.config.width;
  const h = state.config.height;
  for (let y = Math.max(1, cy - SAND_RADIUS); y < Math.min(h - 1, cy + SAND_RADIUS); y++) {
    for (let x = Math.max(1, cx - SAND_RADIUS); x < Math.min(w - 1, cx + SAND_RADIUS); x++) {
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) continue;
      if (state.surface[i] === SURF_GLASS) state.surface[i] = SURF_SILT;
    }
  }
};

/** A celula esta livre para receber o Prospector? */
const openAt = (state: SurvivalState, x: number, y: number): boolean => {
  const w = state.config.width;
  const h = state.config.height;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= h - 1) return false;
  return state.solid[cy * w + cx] === SOLID_NONE;
};

/**
 * A distancia do alvo, do mais longe para o mais perto.
 *
 * Vai ate 3 porque a sala nao e redonda: numa primeira versao a lista parava em
 * 5 e o cenario DESISTIA em silencio quando o rumo pedido nao tinha espaco —
 * quatro dos oito botoes (dr, ur, d, l) nao faziam nada e o painel continuava
 * mostrando a resposta anterior, o que parecia defeito do chefe e era do
 * cenario. Junto com o recentramento abaixo, os oito passam a caber.
 */
const HOP_RANGE = [11, 9, 7, 5, 4, 3] as const;

export const applyDevourerScenario = (
  state: SurvivalState,
  scenario: DevourerScenario,
): SemanticEvent[] => {
  const events: SemanticEvent[] = [];
  const boss = devourerOf(state);
  if (!boss) return events;

  const dirName = HOP_DIR[scenario];
  if (dirName) {
    const raw = FACING_BY_DIR[dirName];
    const len = Math.hypot(raw.x, raw.y) || 1;
    const ux = raw.x / len;
    const uy = raw.y / len;
    // O chefe vai para o CENTRO da sala antes de tudo. Sem isto, o rumo pedido
    // pode simplesmente nao ter sala pela frente — e o que se leria seria a
    // geometria da arena, e nao a decisao do bicho.
    const center = arenaCenter(state);
    if (center && openAt(state, center.x, center.y)) {
      boss.x = center.x;
      boss.y = center.y;
    }
    // O Prospector vai para o rumo pedido, o mais longe que a sala permitir: e
    // dele que sai a mira da queda, e um alvo colado daria um arco curto demais
    // para ler o rumo.
    let placed = false;
    for (const d of HOP_RANGE) {
      const px = boss.x + ux * d;
      const py = boss.y + uy * d;
      if (!openAt(state, px, py)) continue;
      state.player.x = px;
      state.player.y = py;
      placed = true;
      break;
    }
    if (!placed) return events;
    restoreSand(state, Math.floor(boss.x), Math.floor(boss.y));
    restoreSand(state, Math.floor(state.player.x), Math.floor(state.player.y));
    // De volta ao começo do ciclo, e decidindo AGORA. A rajada cheia porque um
    // salto solto cairia direto na janela da boca, e o que se quer ver aqui e o
    // arco.
    boss.mood = DEVOURER_BURROWED;
    boss.action = undefined;
    state.bossRuntime.leapsLeft = DEVOURER_LEAPS_PER_CYCLE;
    state.bossRuntime.mawOpenedAt = -1;
    boss.nextActionAt = state.tick;
    asked = dirName;
    askedAt = state.tick;
    answer = null;
    return events;
  }

  switch (scenario) {
    case 'maw': {
      // A CRATERA, que desde a separacao mora no atlas proprio
      // (`part-white-devourer-maw`). Vale olhar junto com os saltos: e a unica
      // pose do bicho que continua em quatro rumos.
      restoreSand(state, Math.floor(boss.x), Math.floor(boss.y));
      boss.mood = DEVOURER_MAW;
      boss.action = undefined;
      state.bossRuntime.mawOpenedAt = state.tick;
      boss.nextActionAt = state.tick + DEVOURER_MAW_TICKS;
      break;
    }
    case 'burrow': {
      // Submerso: o corpo afunda a altura inteira do quadro e o que sobra e o
      // rastro. E o estado em que `DEVOURER_HEAD_ABOVE_ANCHOR_PX` decide se
      // ainda ha cabeca na tela — a constante que ficou para tras quando o
      // quadro encolheu.
      boss.mood = DEVOURER_BURROWED;
      boss.action = undefined;
      state.bossRuntime.mawOpenedAt = -1;
      boss.nextActionAt = state.tick + 600;
      break;
    }
    case 'hunger': {
      // Abaixo da metade, e de volta ao comeco do ciclo: a rajada seguinte
      // e a primeira com crateras que ficam abertas, e a boca no fim dela e a
      // primeira que anda.
      boss.hp = Math.floor(boss.maxHp * (DEVOURER_HUNGER_HP_FRACTION - 0.05));
      boss.mood = DEVOURER_BURROWED;
      boss.action = undefined;
      state.bossRuntime.leapsLeft = DEVOURER_LEAPS_PER_CYCLE;
      state.bossRuntime.mawOpenedAt = -1;
      boss.nextActionAt = state.tick + 20;
      restoreSand(state, Math.floor(boss.x), Math.floor(boss.y));
      break;
    }
    case 'reset': {
      boss.hp = boss.maxHp;
      // A Fome nao volta atras em jogo; no painel, reiniciar e reiniciar.
      state.bossRuntime.phasesFired &= ~BOSS_PHASE_HUNGER;
      state.bossRuntime.sinkholes.length = 0;
      boss.mood = DEVOURER_BURROWED;
      boss.action = undefined;
      state.bossRuntime.leapsLeft = DEVOURER_LEAPS_PER_CYCLE;
      state.bossRuntime.mawOpenedAt = -1;
      boss.nextActionAt = state.tick + 20;
      restoreSand(state, Math.floor(boss.x), Math.floor(boss.y));
      break;
    }
  }
  return events;
};

export type DevourerReadout = {
  hpFraction: number;
  /**
   * O humor como CHAVE, e nao como frase.
   *
   * O rotulo em portugues mora no painel (`arena-main.ts`), junto dos rotulos
   * dos cenarios: texto de tela fora do catalogo e o que o guard de i18n
   * recusa, e ele esta certo em recusar.
   */
  mood: 'burrowed' | 'surfaced' | 'airborne' | 'maw' | 'unknown';
  /** O rumo do atlas que o corpo esta mostrando agora. */
  facing: string;
  /** O arco em curso, quando ha um: para onde ele vai e em que rumo. */
  arc: { dx: number; dy: number; dir: string; orthogonal: boolean } | null;
  /** O rumo que o ultimo cenario pediu, e se o arco lido ja e resposta a ele. */
  asked: string | null;
  fresh: boolean;
  leapsLeft: number;
  /** Quantos dos oito rumos ja sairam desde que o painel abriu. */
  seen: string[];
  seenDiagonal: number;
  mawTicks: number | null;
};

/** O rumo do atlas mais proximo de um vetor do mundo. */
export const dirOfVector = (dx: number, dy: number): string => {
  let best = 'dr';
  let bestDot = -Infinity;
  const len = Math.hypot(dx, dy) || 1;
  for (const [name, v] of Object.entries(FACING_BY_DIR)) {
    const vl = Math.hypot(v.x, v.y) || 1;
    const dot = (dx / len) * (v.x / vl) + (dy / len) * (v.y / vl);
    if (dot > bestDot) {
      bestDot = dot;
      best = name;
    }
  }
  return best;
};

/**
 * Os rumos que ja apareceram nesta sessao de painel.
 *
 * E a prova acumulada: o painel nao pergunta "este salto foi diagonal?", ele
 * mostra quantos dos oito o encontro ja produziu. Quatro deles so podem sair de
 * arcos nao ortogonais.
 */
const seenDirs = new Set<string>();
/**
 * O ultimo rumo PEDIDO por um cenario, e o arco que ja foi lido para ele.
 *
 * Sem isto o painel mentia por omissao: logo depois do clique o arco em curso
 * ainda e o do pedido anterior, e quem olhasse rapido leria o rumo errado como
 * se fosse a resposta. Medido — dois cenarios seguidos mostravam o mesmo
 * `(0,0; 5,0)`. Agora o painel diz o que foi pedido, o que saiu, e fica em
 * `aguardando` ate um arco NOVO nascer.
 */
let asked: string | null = null;
let askedAt = -1;
/**
 * A resposta do ultimo pedido, GUARDADA.
 *
 * O arco so existe enquanto a erupcao esta em curso — pouco mais de um segundo.
 * Quem clica e olha chega depois disso e encontraria um traco, e uma captura
 * automatizada perde a janela em boa parte das rodadas (medido: quatro dos oito
 * pedidos numa passagem). Guardar a resposta ate o proximo pedido e o que torna
 * este painel util para a pergunta que ele existe para responder.
 */
let answer: { dir: string; dx: number; dy: number; orthogonal: boolean } | null = null;
export const resetDevourerReadout = (): void => {
  seenDirs.clear();
  asked = null;
  askedAt = -1;
  answer = null;
};

const MOOD_KEY: Record<number, DevourerReadout['mood']> = {
  0: 'burrowed',
  1: 'surfaced',
  2: 'airborne',
  3: 'maw',
};

export const devourerReadout = (state: SurvivalState): DevourerReadout | null => {
  const boss = devourerOf(state);
  if (!boss) return null;
  const facing = dirOfVector(boss.facing.x, boss.facing.y);
  seenDirs.add(facing);
  let arc: DevourerReadout['arc'] = null;
  const toX = state.bossRuntime.leapToX;
  const toY = state.bossRuntime.leapToY;
  // So conta como arco o que nasceu DEPOIS do pedido: ver `asked`.
  const fresh = askedAt < 0 || (boss.action !== undefined && boss.action.startedAt >= askedAt);
  if (boss.action?.kind === 'erupt' && fresh && Number.isFinite(toX) && Number.isFinite(toY)) {
    const dx = toX - boss.x;
    const dy = toY - boss.y;
    arc = { dx, dy, dir: dirOfVector(dx, dy), orthogonal: isOrthogonal(dx, dy) };
    answer = arc;
  } else if (answer) {
    arc = answer;
  }
  const seen = [...seenDirs].sort();
  return {
    hpFraction: boss.maxHp > 0 ? boss.hp / boss.maxHp : 0,
    mood: MOOD_KEY[boss.mood ?? 0] ?? 'unknown',
    facing,
    arc,
    asked,
    fresh,
    leapsLeft: state.bossRuntime.leapsLeft,
    seen,
    seenDiagonal: seen.filter((d) => !isOrthogonal(FACING_BY_DIR[d].x, FACING_BY_DIR[d].y)).length,
    mawTicks:
      boss.mood === DEVOURER_MAW && state.bossRuntime.mawOpenedAt >= 0
        ? state.tick - state.bossRuntime.mawOpenedAt
        : null,
  };
};
