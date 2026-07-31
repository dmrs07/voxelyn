/**
 * Estabilizacao do rumo VISUAL contra as fronteiras dos quadrantes autorados.
 *
 * O sprite tem quatro rumos (`dr`, `dl`, `ul`, `ur`), e `dirFromFacing` escolhe
 * um pelo angulo do vetor no plano da TELA. Isso significa que existem quatro
 * angulos exatos em que a escolha e um empate — e sao justamente os rumos mais
 * comuns do jogo: andar para cima, para baixo, para a esquerda ou para a direita
 * na tela (W, A, S, D sozinhos) cai EM CIMA de uma fronteira.
 *
 * Em cima da fronteira, qualquer ruido de um milesimo no vetor decide o
 * quadrante. No solo isso nunca aparecia porque as duas componentes do
 * deslocamento sao identicas bit a bit: `dx - dy` da zero exato, quadro apos
 * quadro, e o desempate cai sempre para o mesmo lado. No co-op nao ha essa
 * simetria — o servidor arredonda `x` e `y` para tres casas SEPARADAMENTE antes
 * de mandar, entao `dx - dy` vira ruido de sinal aleatorio e o quadrante troca
 * A CADA QUADRO. E o "flicker absurdo" reportado: o boneco espelhando 60 vezes
 * por segundo, no jogador local e no parceiro.
 *
 * A correcao e histerese: o rumo desenhado so muda de quadrante quando o vetor
 * cru entra no quadrante vizinho por uma margem folgada. Empate no fio da
 * fronteira mantem o que ja estava — que e a resposta honesta, porque ali as
 * duas poses representam a mesma direcao de mundo.
 */

const TAU = Math.PI * 2;
const QUADRANT = Math.PI / 2;

/**
 * Quanto o vetor cru precisa ENTRAR no quadrante vizinho para tomar o lugar do
 * que esta desenhado.
 *
 * O teto e a distancia entre uma fronteira e o rumo de teclado mais proximo
 * dela: as oito direcoes do teclado caem ou sobre a fronteira, ou a 26,6 graus
 * dela. Uma margem maior que isso grudaria uma diagonal legitima no quadrante
 * errado. Metade disso (~12,6 graus) e larga o bastante para o ruido de
 * arredondamento nunca alcancar e estreita o bastante para uma virada de
 * verdade trocar o sprite no mesmo quadro.
 */
export const FACING_HYSTERESIS_RAD = 0.22;

/** Nao devolve angulo exatamente sobre a fronteira: ali o desempate volta a ser sorte. */
const EDGE_EPSILON = 1e-4;

/** Angulo do vetor de MUNDO no plano da TELA — a mesma conta de `dirFromFacing`. */
export const screenAngle = (fx: number, fy: number): number => Math.atan2(fx + fy, fx - fy);

/**
 * Indice do quadrante autorado: 0=`dr`, 1=`dl`, 2=`ul`, 3=`ur`.
 *
 * Replica `dirFromFacing` degrau a degrau, incluindo de que lado cada fronteira
 * fechada cai. Divergir dela por um epsilon devolveria o problema pela porta dos
 * fundos: a histerese seguraria um quadrante e o desenho escolheria outro.
 */
export const facingQuadrant = (fx: number, fy: number): number => {
  const angle = screenAngle(fx, fy);
  if (angle >= 0 && angle < QUADRANT) return 0;
  if (angle >= QUADRANT) return 1;
  if (angle < -QUADRANT) return 2;
  return 3;
};

const normalized = (angle: number): number => ((angle % TAU) + TAU) % TAU;

/** Centro do quadrante, no mesmo espaco normalizado de `normalized`. */
const quadrantCenter = (quadrant: number): number => quadrant * QUADRANT + QUADRANT / 2;

/** Diferenca angular assinada, sempre no menor arco. */
const signedDelta = (angle: number, from: number): number => {
  let delta = normalized(angle) - normalized(from);
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return delta;
};

/** Angulo de tela -> vetor unitario de mundo (a inversa de `screenAngle`). */
const worldFromScreenAngle = (angle: number): { x: number; y: number } => {
  const sx = Math.cos(angle);
  const sy = Math.sin(angle);
  // sx = fx - fy, sy = fx + fy
  const fx = (sx + sy) / 2;
  const fy = (sy - sx) / 2;
  const length = Math.hypot(fx, fy) || 1;
  return { x: fx / length, y: fy / length };
};

type Held = { quadrant: number; seenMs: number };

/** Com que frequencia varrer entradas de entidades que sumiram do mundo. */
const SWEEP_EVERY_MS = 2_000;
/** Quanto tempo sem aparecer num quadro antes de esquecer uma entidade. */
const FORGET_AFTER_MS = 5_000;

/**
 * Memoria de qual quadrante cada rumo desenhado esta ocupando.
 *
 * A chave e do chamador porque uma entidade tem mais de um rumo desenhado ao
 * mesmo tempo — as pernas seguem o andar enquanto o tronco segue a mira —, e
 * cada um precisa da propria histerese.
 */
export class FacingHysteresis {
  private readonly held = new Map<number, Held>();
  private lastSweepMs = 0;

  /**
   * Devolve o rumo a DESENHAR para `key`, dado o rumo cru deste quadro.
   *
   * Enquanto o quadrante nao muda — o caso de longe mais comum — devolve o
   * proprio vetor recebido, sem tocar em nada: quem le o resultado (o recoil,
   * por exemplo) continua enxergando a direcao continua de verdade.
   */
  resolve(key: number, fx: number, fy: number, nowMs = 0): { x: number; y: number } {
    // Vetor nulo nao tem rumo: devolver o proprio evita inventar um quadrante e
    // grava-lo como se fosse decisao.
    if (fx === 0 && fy === 0) return { x: fx, y: fy };

    const quadrant = facingQuadrant(fx, fy);
    const previous = this.held.get(key);
    if (previous === undefined || previous.quadrant === quadrant) {
      this.held.set(key, { quadrant, seenMs: nowMs });
      return { x: fx, y: fy };
    }

    const center = quadrantCenter(previous.quadrant);
    const delta = signedDelta(screenAngle(fx, fy), center);
    if (Math.abs(delta) > QUADRANT / 2 + FACING_HYSTERESIS_RAD) {
      // Virada de verdade: o vetor cru entrou fundo no quadrante vizinho.
      this.held.set(key, { quadrant, seenMs: nowMs });
      return { x: fx, y: fy };
    }

    // Empate no fio da fronteira: segura o quadrante que ja esta desenhado e
    // devolve o angulo preso na borda de dentro dele — o desvio maximo e a
    // propria margem, invisivel em qualquer uso continuo do vetor.
    previous.seenMs = nowMs;
    const limit = QUADRANT / 2 - EDGE_EPSILON;
    return worldFromScreenAngle(center + Math.max(-limit, Math.min(limit, delta)));
  }

  forget(key: number): void {
    this.held.delete(key);
  }

  clear(): void {
    this.held.clear();
    this.lastSweepMs = 0;
  }

  /**
   * Descarta entidades que sumiram do mundo sem passar por `forget` (inimigo
   * removido do snapshot, run trocada de setor). Sem isso o mapa cresceria com
   * um id morto por criatura ao longo de uma run inteira.
   */
  sweep(nowMs: number): void {
    if (nowMs - this.lastSweepMs < SWEEP_EVERY_MS) return;
    this.lastSweepMs = nowMs;
    for (const [key, entry] of this.held) {
      if (nowMs - entry.seenMs > FORGET_AFTER_MS) this.held.delete(key);
    }
  }
}
