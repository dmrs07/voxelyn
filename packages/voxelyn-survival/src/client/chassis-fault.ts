// A FALHA DO CHASSI: o que um Prospector com integridade baixa faz com o corpo.
//
// O Prospector e uma maquina. Um robo a 30% nao "sangra" — ele perde
// continuidade eletrica: um servo pula, um relé fecha fora de hora, um arco
// salta entre duas placas que nao deviam se tocar. E o que o jogador VE aqui:
// o corpo da uns solavancos curtos e espacados, e faiscas azuis saem do
// chassi no mesmo instante. Quanto mais baixa a integridade, mais frequentes
// e mais longos os episodios.
//
// Tudo e derivado do RELOGIO e do slot, nunca de `Math.random`: dois quadros
// no mesmo instante desenham o mesmo solavanco, o co-op ve o parceiro falhar
// com o mesmo ritmo, e o teste consegue medir a frequencia sem sorte.
//
// O limiar (35%) e o MESMO da barra de HP no painel — vermelho la, curto aqui.
// Duas leituras do mesmo estado tem de virar no mesmo ponto.

/** A partir de que fracao de integridade o chassi comeca a falhar. */
export const CHASSIS_FAULT_AT = 0.35;

export type ChassisFault = {
  /** Um episodio de curto esta acontecendo neste instante. */
  active: boolean;
  /** 0 no limiar, 1 com a integridade a zero. */
  severity: number;
  /** Solavanco do corpo, em pixels de mundo (multiplique pelo zoom). */
  jitterX: number;
  jitterY: number;
};

const NONE: ChassisFault = { active: false, severity: 0, jitterX: 0, jitterY: 0 };

/** Ruido determinístico em [-1, 1] a partir de um inteiro. */
const noise = (k: number): number => {
  let h = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) % 2000) / 1000 - 1;
};

/** Intervalo entre episodios no limiar, e no fundo. */
export const FAULT_PERIOD_MS = { atThreshold: 2400, atZero: 800 };
/** Duracao de um episodio no limiar, e no fundo. */
export const FAULT_BURST_MS = { atThreshold: 110, atZero: 220 };

export const chassisFault = (nowMs: number, slot: number, hpFraction: number): ChassisFault => {
  if (hpFraction <= 0 || hpFraction > CHASSIS_FAULT_AT) return NONE;
  const severity = Math.min(1, 1 - hpFraction / CHASSIS_FAULT_AT);
  const period =
    FAULT_PERIOD_MS.atThreshold - (FAULT_PERIOD_MS.atThreshold - FAULT_PERIOD_MS.atZero) * severity;
  const burst =
    FAULT_BURST_MS.atThreshold + (FAULT_BURST_MS.atZero - FAULT_BURST_MS.atThreshold) * severity;
  // Cada slot tem a propria fase: dois Prospectors no co-op nao falham em
  // uníssono, o que leria como um efeito da sala e nao de cada corpo.
  const phase = (nowMs + slot * 733) % period;
  if (phase > burst) return { active: false, severity, jitterX: 0, jitterY: 0 };
  // O solavanco troca de direcao a cada 24 ms: rapido o bastante para ser um
  // tremor eletrico e nao um balanço, lento o bastante para nao virar chuvisco
  // a 120 Hz.
  const k = Math.floor((nowMs + slot * 97) / 24);
  const amp = 1 + severity;
  return {
    active: true,
    severity,
    jitterX: noise(k) * amp,
    jitterY: noise(k * 7 + 3) * amp * 0.55,
  };
};

/**
 * O ARCO do curto: uma linha quebrada de dois ou tres segmentos, azul-branca,
 * saltando de um ponto do chassi. Desenhada em espaco de tela, DEPOIS do
 * corpo — o arco esta por cima da chapa, nao dentro dela.
 *
 * A geometria muda a cada 24 ms como o solavanco, e some com o episodio: um
 * arco parado na mesma pose por meio segundo seria um adesivo.
 */
export const drawShortArc = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  bodySize: number,
  zoom: number,
  nowMs: number,
  slot: number,
): void => {
  const k = Math.floor((nowMs + slot * 97) / 24);
  // De onde o arco salta: alterna entre ombro, cintura e cabeca.
  const anchor = Math.abs(Math.floor(noise(k * 3 + 1) * 3)) % 3;
  const ax = sx + noise(k * 5 + 2) * bodySize * 0.7;
  const ay = sy - bodySize * (anchor === 0 ? 2.1 : anchor === 1 ? 1.2 : 0.5);
  const segments = 2 + (Math.abs(Math.floor(noise(k * 11 + 4) * 10)) % 2);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  let px = ax;
  let py = ay;
  for (let i = 0; i < segments; i++) {
    px += noise(k * 13 + i * 2) * bodySize * 0.55;
    py += noise(k * 17 + i * 2 + 1) * bodySize * 0.35 - zoom * 0.6;
    ctx.lineTo(px, py);
  }
  ctx.strokeStyle = '#e8f1ff';
  ctx.lineWidth = Math.max(1, zoom * 0.9);
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.strokeStyle = '#7ab8ff';
  ctx.lineWidth = Math.max(1.5, zoom * 1.8);
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.restore();
};
