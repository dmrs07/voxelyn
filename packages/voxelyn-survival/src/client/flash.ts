// Luzes de curta duracao nascidas de eventos: explosao, descarga, pulso.
//
// Por que existem: a explosao era literalmente invisivel no escuro. O render
// descarta a celula cujo brilho fica abaixo de 0.045 e nao desenha nada ali, e
// nenhum evento acendia luz nenhuma — so fogo parado e cristal iluminavam. Uma
// detonacao num corredor sem cristal nem fogo saia desenhada sobre preto: o
// efeito mais forte do jogo acontecia em cima do nada.
//
// A correcao nao e pintar mais pixels brilhantes, e sim acender LUZ: o que
// vende uma explosao subterranea nao e a bola de fogo, e a sala aparecendo por
// um instante em volta dela.
//
// Vive fora do renderer porque e aritmetica pura de tempo — o teto, o decaimento
// e o descarte tem de poder ser verificados sem um canvas por perto.

export type Flash = {
  x: number;
  y: number;
  /** Alcance em tiles. */
  r: number;
  /** Forca no instante em que acende, de 0 a 1. */
  power: number;
  startedMs: number;
  durationMs: number;
  /**
   * A COR do clarao, em hex.
   *
   * Uma explosao e laranja, uma descarga e azul-eletrico e um pulso cinetico
   * nao tem cor nenhuma — ele desloca ar, nao queima. Antes do sistema de luz
   * colorida os tres acendiam a sala do mesmo jeito, e a unica coisa que
   * distinguia um do outro eram as particulas. Agora a SALA conta qual foi.
   */
  hex: string;
};

/**
 * Teto de clarões simultâneos.
 *
 * O brilho de CADA celula visivel percorre TODAS as luzes, entao uma luz custa
 * milhares de comparacoes por quadro. Sem teto, uma cadeia de explosoes — que e
 * o caso comum, porque explosao acende gas e gas detona — derruba a taxa de
 * quadros exatamente quando ha mais coisa acontecendo na tela.
 */
export const MAX_FLASHES = 6;

/**
 * Forca do clarao agora, ja decaida; 0 depois de expirado.
 *
 * Decai ao QUADRADO: perder forca linearmente le como uma lampada desligada no
 * interruptor, enquanto fogo se apagando entrega quase todo o brilho no comeco e
 * some devagar no fim.
 */
export const flashPower = (flash: Flash, nowMs: number): number => {
  const elapsed = nowMs - flash.startedMs;
  if (elapsed < 0) return flash.power;
  if (elapsed >= flash.durationMs) return 0;
  const remaining = 1 - elapsed / flash.durationMs;
  return flash.power * remaining * remaining;
};

/**
 * Acrescenta um clarao, descartando o MAIS VELHO ao estourar o teto.
 *
 * Recusar o clarao NOVO tambem respeitaria o teto, e estaria errado pela mesma
 * razao que estaria nas particulas: numa cadeia de detonacoes, a que importa e a
 * que acabou de acontecer — provavelmente em cima do jogador. Descartar a nova
 * deixaria justamente essa no escuro.
 */
export const addFlash = (flashes: Flash[], flash: Flash): void => {
  if (flashes.length >= MAX_FLASHES) flashes.splice(0, flashes.length - MAX_FLASHES + 1);
  flashes.push(flash);
};

/** Descarta os que ja apagaram. Mantem a ordem, que e a de chegada. */
export const pruneFlashes = (flashes: Flash[], nowMs: number): Flash[] =>
  flashes.filter((f) => nowMs - f.startedMs < f.durationMs);
