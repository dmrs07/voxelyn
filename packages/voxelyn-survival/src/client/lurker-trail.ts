// O RASTRO dos espreitadores ocultos: a memoria de por onde eles passaram.
//
// A promessa do Aquifero e da Cripta e que a posicao da Lampreia e do
// Espectro se le pela LAMINA (agua/gelo), nunca pelo corpo. A perturbacao
// pontual ja diz "esta AQUI"; o rastro diz "veio DALI" — e transforma o
// espreitador de um ponto num vetor: da para ler o rumo, antecipar o bote e
// recuar para o lado certo.
//
// Camada 100% de apresentacao: o rastro vive no cliente, alimentado pelas
// posicoes que o snapshot ja entrega. Nada e sorteado (espacamento e tempo
// determinam tudo), entao as duas maquinas de uma sala co-op veem o MESMO
// rastro — e nenhum byte novo viaja.
export type TrailPoint = { x: number; y: number; at: number };

/**
 * `inWater` fica GRAVADO no rastro, nao derivado do bicho: um espreitador
 * morto some do snapshot no mesmo tick, e um rastro orfao que consultasse a
 * entidade trocaria de elemento no meio do desbote (ondulacao virando
 * rachadura). O rastro e a memoria da LAMINA — ele sabe de que lamina e.
 */
export type LurkerTrail = { ttlMs: number; inWater: boolean; points: TrailPoint[] };

/** Espacamento minimo entre pontos, em celulas: rastro e pegada, nao linha. */
export const TRAIL_SPACING = 0.7;

/**
 * Quanto tempo a lamina lembra. A agua esquece rapido (ondulacao se dissipa);
 * o GELO lembra mais — rachadura nao desfaz, so perde contraste.
 */
export const trailTtlMs = (inWater: boolean): number => (inWater ? 1400 : 2600);

/**
 * Avanca o rastro de um espreitador: poda pontos vencidos e registra a
 * posicao atual se ela se afastou o bastante da ultima pegada. Mutacao em
 * lugar proprio — o chamador guarda o objeto por entidade e chama uma vez
 * por quadro enquanto o bicho estiver oculto.
 */
export const updateTrail = (trail: LurkerTrail, x: number, y: number, nowMs: number): void => {
  const cutoff = nowMs - trail.ttlMs;
  while (trail.points.length > 0 && trail.points[0].at < cutoff) trail.points.shift();
  const last = trail.points[trail.points.length - 1];
  if (!last || Math.hypot(x - last.x, y - last.y) >= TRAIL_SPACING) {
    trail.points.push({ x, y, at: nowMs });
  }
};

/** So poda (para rastros de bichos que ja nao atualizam: morreram ou emergiram). */
export const decayTrail = (trail: LurkerTrail, nowMs: number): void => {
  const cutoff = nowMs - trail.ttlMs;
  while (trail.points.length > 0 && trail.points[0].at < cutoff) trail.points.shift();
};

/** Idade normalizada de um ponto: 0 recem-feito, 1 prestes a sumir. */
export const trailAge = (trail: LurkerTrail, point: TrailPoint, nowMs: number): number =>
  Math.max(0, Math.min(1, (nowMs - point.at) / trail.ttlMs));
