// A nota da run, como TEMPO. Sem canvas aqui: so quando cada estrela cai, o
// tamanho que ela tem naquele instante e onde ela pousa.
//
// A nota existia desde sempre e ninguem a via: tres glifos de onze pixels no
// canto superior direito do formulario, na mesma cor do numero de serie do
// documento. O resultado de uma descida de oito minutos — se ela valeu uma,
// duas, tres ou nenhuma estrela — chegava ao jogador como cromo de papel
// timbrado, do lado oposto de onde o olho estava lendo.
//
// A animacao nao e enfeite: e o que separa "a tela ja estava assim" de "isto
// acabou de ser decidido por causa do que voce fez". Um carimbo por vez, na
// ordem, para a nota ser CONTADA e nao lida — o jogador que tirou duas sabe
// que tirou duas porque viu duas caírem, e sente a terceira que nao veio.
//
// Duas leituras, uma gramatica so:
//   - sucesso: cada estrela conquistada CAI sobre o soquete vazio e bate, com
//     o anel de impacto do carimbo. Nota cheia ganha o brilho que atravessa.
//   - fracasso (nenhuma estrela): os tres soquetes ficam vazios e uma linha
//     vermelha os RISCA — a companhia nao concedeu classificacao nenhuma.
//
// Tudo aqui e funcao pura do tempo decorrido: nenhum estado, nenhum rAF
// proprio. A tela de fim ja e redesenhada a cada quadro, entao a animacao e so
// o que o quadro corrente pergunta.

/** As tres estrelas do formulario. Nao e configuracao: e a nota do jogo. */
export const STAR_COUNT = 3;

/** Os soquetes vazios aparecem primeiro: a fileira precisa ter forma. */
export const SOCKET_FADE_MS = 220;
/** Respiro antes do primeiro carimbo, para o soquete ja estar la. */
export const STAR_DELAY_MS = 260;
/** Intervalo entre um carimbo e o proximo. E o que faz a nota ser contada. */
export const STAR_STEP_MS = 300;
/** Duracao da queda de uma estrela. */
export const STAMP_MS = 220;
/** O anel de impacto, depois que ela bate. */
export const RING_MS = 340;
/** De que tamanho a estrela comeca a cair. */
export const STAMP_FROM_SCALE = 2.4;
/** O brilho que atravessa a fileira quando a nota e cheia. */
export const SWEEP_MS = 520;
/** A linha de recusa, quando nao houve nota nenhuma. */
export const STRIKE_DELAY_MS = 480;
export const STRIKE_MS = 360;

/** Altura da faixa dos glifos, em unidades tipograficas da tela de fim. */
export const STAR_ROW_UNITS = 2.3;
/** Respiro entre a linha de base do titulo e o topo da fileira. */
export const STAR_TOP_GAP_UNITS = 0.7;
/**
 * O que a tela de fim precisa reservar para a fileira, em unidades.
 *
 * Exportado porque `renderEnd` soma os coeficientes de todos os blocos antes de
 * escolher o `unit` que faz o documento caber: um numero solto la dentro
 * desandaria em silencio no dia em que a fileira mudar de altura aqui.
 */
export const STARS_UNITS = STAR_TOP_GAP_UNITS + STAR_ROW_UNITS;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Saida elastica com passagem do ponto: a estrela cai, esmaga um fio abaixo do
 * tamanho final e volta. E o que faz um carimbo parecer ter PESO — uma
 * interpolacao linear entrega o mesmo glifo no mesmo lugar e nao bate em nada.
 */
const easeOutBack = (t: number): number => {
  const c1 = 1.18;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
};

export type StarStamp = {
  /** Escala do glifo neste quadro. 1 = pousado. */
  scale: number;
  alpha: number;
  /** Ja bateu no soquete? */
  landed: boolean;
  /** 0..1 do anel de impacto; 0 quando nao ha anel a desenhar. */
  ring: number;
};

const SETTLED: StarStamp = { scale: 1, alpha: 1, landed: true, ring: 0 };

/** Quando a estrela `index` comeca a cair. */
export const stampStartMs = (index: number): number => STAR_DELAY_MS + index * STAR_STEP_MS;

/** Quando a ultima estrela conquistada termina de cair. */
export const stampEndMs = (stars: number): number =>
  stars <= 0 ? STAR_DELAY_MS : stampStartMs(stars - 1) + STAMP_MS;

/**
 * O estado da estrela `index` em `elapsed` ms de tela de fim.
 *
 * `reduced` respeita `prefers-reduced-motion`: a nota aparece pousada, no
 * primeiro quadro. Quem pediu menos movimento nao pode receber MENOS
 * INFORMACAO — so a informacao sem o movimento.
 */
export const starStamp = (elapsed: number, index: number, reduced = false): StarStamp => {
  if (reduced) return SETTLED;
  const start = stampStartMs(index);
  if (elapsed < start) return { scale: STAMP_FROM_SCALE, alpha: 0, landed: false, ring: 0 };
  const t = clamp01((elapsed - start) / STAMP_MS);
  if (t >= 1) {
    const ring = clamp01((elapsed - (start + STAMP_MS)) / RING_MS);
    return { scale: 1, alpha: 1, landed: true, ring: ring >= 1 ? 0 : ring };
  }
  const eased = easeOutBack(t);
  return {
    scale: STAMP_FROM_SCALE + (1 - STAMP_FROM_SCALE) * eased,
    // O glifo termina de aparecer na metade da queda: uma estrela que so fica
    // opaca ao pousar nao parece ter vindo de lugar nenhum.
    alpha: clamp01(t / 0.5),
    landed: false,
    ring: 0,
  };
};

/** Opacidade dos soquetes vazios, que entram antes de tudo. */
export const socketAlpha = (elapsed: number, reduced = false): number =>
  reduced ? 1 : clamp01(elapsed / SOCKET_FADE_MS);

/**
 * O brilho que atravessa a fileira depois da terceira estrela. Zero em
 * qualquer nota menor: a passagem e a celebracao da nota CHEIA, e concede-la a
 * duas estrelas apagaria a diferenca entre elas.
 */
export const sweepProgress = (elapsed: number, stars: number, reduced = false): number => {
  if (stars < STAR_COUNT || reduced) return 0;
  const start = stampEndMs(stars) + 90;
  if (elapsed < start) return 0;
  const t = (elapsed - start) / SWEEP_MS;
  return t >= 1 ? 0 : t;
};

/**
 * A linha que risca os tres soquetes vazios, de 0 a 1.
 *
 * So na nota zero, que e a morte: uma estrela ja e uma extracao viva, e riscar
 * a fileira de quem saiu do Veio chamaria de fracasso a run que a companhia
 * pagou.
 */
export const strikeProgress = (elapsed: number, stars: number, reduced = false): number => {
  if (stars > 0) return 0;
  if (reduced) return 1;
  return clamp01((elapsed - STRIKE_DELAY_MS) / STRIKE_MS);
};

export type StarRow = {
  /** Tamanho tipografico do glifo. */
  size: number;
  /** Centro horizontal de cada soquete, da esquerda para a direita. */
  centers: number[];
  /** Linha de centro vertical dos glifos. */
  cy: number;
  /** Meia-largura da fileira inteira, para a linha de recusa e o brilho. */
  half: number;
};

/**
 * Onde os tres glifos ficam.
 *
 * A fileira cabe SEMPRE: em paisagem de 320px o `unit` ja desceu para 7, mas o
 * passo tambem encolhe com a largura disponivel — a nota e a ultima coisa
 * desta tela que pode vazar pela moldura.
 */
export const starRowLayout = (vw: number, top: number, unit: number, margin: number): StarRow => {
  const size = unit * 2.1;
  const room = Math.max(unit * 3, vw - margin * 2 - unit * 2);
  const step = Math.min(size * 1.45, room / STAR_COUNT);
  const centers: number[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    centers.push(vw / 2 + (i - (STAR_COUNT - 1) / 2) * step);
  }
  return { size, centers, cy: top + (unit * STAR_ROW_UNITS) / 2, half: (step * STAR_COUNT) / 2 };
};
